-- File: docs/metrics.sql
-- Mục đích: Tính 6 chỉ số thành công của MVP theo docs/plan.md mục "Chỉ số thành công" (T19.3).
-- Dữ liệu nguồn: Bảng telemetry_event (lô sự kiện ẩn danh) và ai_usage_log (chi phí gọi AI).
-- Khả tương thích: PostgreSQL (chạy thực tế ở backend) và H2 PostgreSQL mode (chạy trong bộ test backend).

WITH ranked_sessions AS (
    -- Tìm phiên nấu đầu tiên của từng thiết bị ẩn danh dựa trên sự kiện session_started
    SELECT
        device_hash,
        session_id,
        occurred_at,
        ROW_NUMBER() OVER (PARTITION BY device_hash ORDER BY occurred_at ASC, id ASC) AS session_rank
    FROM telemetry_event
    WHERE event_type = 'session_started'
      AND session_id IS NOT NULL
),
device_cohorts AS (
    -- Tổng hợp cho từng thiết bị: phiên đầu có hoàn tất không, và có phiên thứ 2 trong 14 ngày đầu không
    SELECT
        first_s.device_hash,
        first_s.session_id AS first_session_id,
        first_s.occurred_at AS first_started_at,
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM telemetry_event comp
                WHERE comp.device_hash = first_s.device_hash
                  AND comp.session_id = first_s.session_id
                  AND comp.event_type = 'session_completed'
            ) THEN 1 ELSE 0
        END AS completed_first_dish,
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM telemetry_event second_s
                WHERE second_s.device_hash = first_s.device_hash
                  AND second_s.event_type = 'session_started'
                  AND second_s.session_id IS NOT NULL
                  AND second_s.session_id <> first_s.session_id
                  AND second_s.occurred_at >= first_s.occurred_at
                  AND second_s.occurred_at <= (first_s.occurred_at + INTERVAL '14' DAY)
            ) THEN 1 ELSE 0
        END AS returned_second_dish
    FROM ranked_sessions first_s
    WHERE first_s.session_rank = 1
),
cohort_summary AS (
    SELECT
        COUNT(*) AS tong_nguoi_moi_bat_dau,
        COALESCE(SUM(completed_first_dish), 0) AS so_nguoi_hoan_tat_mon_dau,
        COALESCE(SUM(returned_second_dish), 0) AS so_nguoi_quay_lai_mon_thu_hai
    FROM device_cohorts
),
event_summary AS (
    SELECT
        COUNT(DISTINCT CASE WHEN event_type = 'session_started' THEN session_id END) AS tong_phien_bat_dau,
        COUNT(DISTINCT CASE WHEN event_type = 'session_completed' THEN session_id END) AS tong_phien_hoan_tat,
        COALESCE(SUM(CASE WHEN event_type = 'step_back' THEN 1 ELSE 0 END), 0) AS so_lan_lui_buoc,
        COALESCE(SUM(CASE WHEN event_type = 'session_abandoned' THEN 1 ELSE 0 END), 0) AS so_lan_thoat_giua_chung,
        COALESCE(SUM(CASE WHEN event_type IN ('step_back', 'session_abandoned') THEN 1 ELSE 0 END), 0) AS so_buoc_bo_qua_hoac_quay_lai,
        COALESCE(SUM(CASE WHEN event_type = 'pantry_adjusted_after_cook' THEN 1 ELSE 0 END), 0) AS so_lan_sua_kho_sau_nau,
        COALESCE(SUM(CASE WHEN event_type = 'ai_asked' THEN 1 ELSE 0 END), 0) AS tong_luot_hoi_ai,
        COALESCE(SUM(CASE WHEN event_type = 'ai_asked' AND ai_kind = 'substitute' THEN 1 ELSE 0 END), 0) AS so_luot_hoi_ai_thay_nguyen_lieu,
        COALESCE(SUM(CASE WHEN event_type = 'ai_asked' AND helpful IS TRUE THEN 1 ELSE 0 END), 0) AS so_danh_gia_huu_ich,
        COALESCE(SUM(CASE WHEN event_type = 'ai_asked' AND helpful IS FALSE THEN 1 ELSE 0 END), 0) AS so_danh_gia_khong_huu_ich,
        COALESCE(SUM(CASE WHEN event_type = 'ai_asked' AND helpful IS NOT NULL THEN 1 ELSE 0 END), 0) AS tong_danh_gia_ai
    FROM telemetry_event
),
ai_cost_summary AS (
    SELECT
        COALESCE(SUM(estimated_cost), 0) AS tong_chi_phi_ai
    FROM ai_usage_log
)
SELECT
    -- 1. Tỉ lệ nấu xong món đầu tiên (người mới bắt đầu và hoàn tất phiên đầu)
    cs.tong_nguoi_moi_bat_dau,
    cs.so_nguoi_hoan_tat_mon_dau,
    COALESCE(ROUND(cs.so_nguoi_hoan_tat_mon_dau * 1.0 / NULLIF(cs.tong_nguoi_moi_bat_dau, 0), 4), 0) AS ti_le_nau_xong_mon_dau_tien,

    -- 2. Tỉ lệ quay lại nấu món thứ hai (trong 14 ngày đầu)
    cs.so_nguoi_quay_lai_mon_thu_hai,
    COALESCE(ROUND(cs.so_nguoi_quay_lai_mon_thu_hai * 1.0 / NULLIF(cs.tong_nguoi_moi_bat_dau, 0), 4), 0) AS ti_le_quay_lai_nau_mon_thu_hai,

    -- 3. Số bước bị bỏ qua hoặc quay lại (lùi bước + thoát giữa chừng)
    es.tong_phien_bat_dau,
    es.so_lan_lui_buoc,
    es.so_lan_thoat_giua_chung,
    es.so_buoc_bo_qua_hoac_quay_lai,
    COALESCE(ROUND(es.so_buoc_bo_qua_hoac_quay_lai * 1.0 / NULLIF(es.tong_phien_bat_dau, 0), 4), 0) AS tb_bo_qua_hoac_quay_lai_moi_phien,

    -- 4. Tỉ lệ sửa kho sau khi nấu (số lần chỉnh lượng tự trừ / tổng phiên hoàn tất)
    es.tong_phien_hoan_tat,
    es.so_lan_sua_kho_sau_nau,
    COALESCE(ROUND(es.so_lan_sua_kho_sau_nau * 1.0 / NULLIF(es.tong_phien_hoan_tat, 0), 4), 0) AS ti_le_sua_kho_sau_khi_nau,

    -- 5. Tỉ lệ hỏi AI thay nguyên liệu (số lượt hỏi trên mỗi phiên nấu + tỉ lệ đánh giá hữu ích)
    es.so_luot_hoi_ai_thay_nguyen_lieu,
    es.tong_luot_hoi_ai,
    COALESCE(ROUND(es.so_luot_hoi_ai_thay_nguyen_lieu * 1.0 / NULLIF(es.tong_phien_bat_dau, 0), 4), 0) AS ti_le_hoi_ai_thay_nguyen_lieu,
    es.so_danh_gia_huu_ich,
    es.so_danh_gia_khong_huu_ich,
    COALESCE(ROUND(es.so_danh_gia_huu_ich * 1.0 / NULLIF(es.tong_danh_gia_ai, 0), 4), 0) AS ti_le_ai_huu_ich,

    -- 6. Chi phí AI trung bình mỗi phiên nấu (tổng chi phí AI / tổng số phiên nấu)
    ac.tong_chi_phi_ai,
    COALESCE(ROUND(CAST(ac.tong_chi_phi_ai AS NUMERIC) / NULLIF(es.tong_phien_bat_dau, 0), 6), 0) AS chi_phi_ai_trung_binh_moi_phien
FROM cohort_summary cs
CROSS JOIN event_summary es
CROSS JOIN ai_cost_summary ac;

