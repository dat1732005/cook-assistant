/**
 * File: packages/core/src/suggest/weights-config.ts
 * Làm gì: Khai báo bộ trọng số gợi ý món ăn (SuggestService), cho phép chỉnh dễ dàng
 *         mà không cần tìm trong code nghiệp vụ.
 * Nhận vào: Không có.
 * Trả ra: Hằng số SUGGEST_WEIGHTS với từng thành phần điểm, có chú thích đầy đủ.
 * Ai gọi: SuggestService (packages/core/src/suggest/suggest-service.ts).
 * Bám theo: docs/expected/T10.md phần "Gợi ý món (T12)" – công thức điểm.
 */

/**
 * Trọng số gốc từ kế hoạch (tổng = 1.0) trước khi đưa vào MVP.
 * Nguồn: docs/expected/T10.md – "Công thức điểm: 0,5·phủ + 0,2·cấp_bách + 0,15·thời_gian + 0,1·khẩu_vị + 0,05·mới".
 * Ghi chú: Đây là trọng số đề xuất, chưa kiểm chứng qua dữ liệu người dùng thật.
 */
export const RAW_WEIGHTS = {
  /** Tỉ lệ nguyên liệu bắt buộc (không optional, không essential) mà kho có đủ lượng. Đề xuất: 0.5. */
  phu: 0.5, // đề xuất, chưa kiểm chứng

  /** Điểm thưởng khi món dùng nguyên liệu bắt buộc hết hạn trong 2 ngày. Đề xuất: 0.2. */
  capBach: 0.2, // đề xuất, chưa kiểm chứng

  /** Điểm thưởng khi món vượt qua bộ lọc cứng về thời gian (= 1 với mọi món đã lọc). Đề xuất: 0.15. */
  thoiGian: 0.15, // đề xuất, chưa kiểm chứng

  /** Điểm khẩu vị học từ lịch sử người dùng. Giai đoạn 3. Đề xuất: 0.1. */
  khauVi: 0.1, // đề xuất, chưa kiểm chứng – ở MVP luôn = 0

  /** Điểm thưởng khi món chưa từng nấu. Đề xuất: 0.05. */
  moi: 0.05, // đề xuất, chưa kiểm chứng
} as const;

/**
 * Tổng trọng số gốc khi không tính khẩu_vị (MVP mode).
 * Nguồn: docs/expected/T10.md – "ở MVP khẩu_vị = 0, các trọng số còn lại chia lại theo tỉ lệ (cộng còn 0,9 nên chia cho 0,9)".
 * Cách tính: 0.5 + 0.2 + 0.15 + 0 + 0.05 = 0.9 → chia cho 0.9 để chuẩn hóa về 1.0.
 */
export const MVP_NORMALIZATION_FACTOR = 0.9; // đề xuất, chưa kiểm chứng

/**
 * Trọng số MVP đã chuẩn hóa (chia cho 0.9, bỏ khẩu_vị).
 * Mỗi trọng số = RAW_WEIGHTS[x] / MVP_NORMALIZATION_FACTOR.
 * Tổng xấp xỉ 1.0 sau khi bỏ khẩu_vị.
 *
 * Ghi chú: Đây là trọng số đề xuất, chưa kiểm chứng; khi có dữ liệu thật sẽ chỉnh ở file này.
 */
export const SUGGEST_WEIGHTS = {
  /** Trọng số phủ sau chuẩn hóa MVP: 0.5 / 0.9 ≈ 0.5556. Đề xuất. */
  phu: RAW_WEIGHTS.phu / MVP_NORMALIZATION_FACTOR,

  /** Trọng số cấp bách sau chuẩn hóa MVP: 0.2 / 0.9 ≈ 0.2222. Đề xuất. */
  capBach: RAW_WEIGHTS.capBach / MVP_NORMALIZATION_FACTOR,

  /** Trọng số thời gian sau chuẩn hóa MVP: 0.15 / 0.9 ≈ 0.1667. Đề xuất. */
  thoiGian: RAW_WEIGHTS.thoiGian / MVP_NORMALIZATION_FACTOR,

  /** Trọng số mới sau chuẩn hóa MVP: 0.05 / 0.9 ≈ 0.0556. Đề xuất. */
  moi: RAW_WEIGHTS.moi / MVP_NORMALIZATION_FACTOR,
} as const;

/**
 * Số ngày coi là "sắp hết hạn" để tính điểm cấp_bách.
 * Nguồn: docs/expected/T10.md – "bằng 1 nếu món dùng nguyên liệu bắt buộc có lô hết hạn trong vòng 2 ngày (từ hôm nay là ngày 0)".
 * Đề xuất: 2. Chưa kiểm chứng bằng dữ liệu người dùng.
 */
export const URGENT_EXPIRY_DAYS = 2; // đề xuất, chưa kiểm chứng

/**
 * Sai số cho phép khi so sánh điểm trong test (kiểm tra xấp xỉ).
 * Nguồn: docs/expected/T10.md ca K1 – "(sai số 0,0001)".
 */
export const SCORE_TOLERANCE = 0.0001;
