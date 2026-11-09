# Trạng thái dự án Trợ lý nấu ăn (docs/STATUS.md)

*Tài liệu này theo dõi tiến độ tổng thể, trạng thái từng task, các hạng mục đang chờ và các quyết định đã chốt.*

---

## 1. Bảng trạng thái các task (T01 – T21)

| Task | Tên / Nội dung chính | Trạng thái | Nhánh | Ghi chú / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- |
| **T01 – T06** | Monorepo, Zod schema, validator rỗng, Scheduler T04, SQLite & RecipeRepo T05, T-INFRA, màn hình chính T06 | **ĐÃ GỘP MAIN** | `main` | Đầy đủ test core, mobile và `validate-data --strict` |
| **T07 – T13** | Phiên nấu cục bộ `SessionService`, hẹn giờ nền, màn Chuẩn bị/Nấu/Hoàn tất, FIFO trừ kho, Quick-Add, gợi ý 2 chế độ & ước chừng | **ĐÃ GỘP MAIN** | `main` | Khớp `docs/expected/T07.md`, `T10.md`, `T12.md` |
| **T14 – T18** | Backend Spring Boot, kiểm tra env khởi động, giới hạn cửa sổ trượt, `MockAiProvider`, `SafetyScanService`, `SafetyRules`, `AiClient`, `SubstituteModal`, header `X-AI-Mock` | **ĐÃ GỘP MAIN** | `main` | Khớp khối JSON `RSU` của `docs/expected/T14.md` |
| **T19** | Đo lường ẩn danh `TelemetryService`, gửi lô `POST /v1/events`, màn `Cài đặt` opt-out, truy vấn 6 chỉ số `docs/metrics.sql` | **ĐÃ GỘP MAIN** | `main` | Khớp `docs/expected/T19.md` sai số `< 0.0001` |
| **T20** | Cấu hình 3 môi trường Android, `eas.json`, `applicationId` tạm `com.cook.app` + chốt chặn `production`, quyền tối thiểu, tách `console.log`, `docs/android-release.md`, Play skeletons | **ĐÃ GỘP MAIN** | `main` | Commit gộp `616bf2f` |
| **T20b** | Tích hợp `expo-keep-awake` vào `CookScreen` + test giả; thêm `POST /v1/ai/feedback` ẩn danh kiểu `ai_wrong_answer`; khung HTTP `RealAiProvider` | **HOÀN TẤT** | `task/T20b` | Chuẩn bị gộp vào `main` trước khi làm T21 |
| **T21** | Đóng gói Docker nhiều tầng, `docker-compose`, Caddy HTTPS, `.env.example`, sao lưu/khôi phục, log STDOUT, hướng dẫn VPS/Managed, CORS & Rate Limit qua env | **CHƯA LÀM** | `task/T21` | Bắt đầu từ `main` sau T20b |

---

## 2. Việc kế tiếp
1. **Gộp `task/T20b` vào `main`** và kiểm tra CI xanh.
2. **Triển khai T21** trên nhánh `task/T21` xuất phát từ `main` sau T20b.
3. **Kiểm thử trên thiết bị Android thật (`T08`, `T09`, `T20`):** build bản `preview`, cài đặt APK, đo ma trận hẹn giờ và luồng gọi backend staging (hiện ghi `CHƯA NGHIỆM THU: chưa có máy thật`).

---

## 3. Đang chờ (chờ chủ dự án quyết định / cung cấp)
- **Chọn nhà cung cấp AI thật cho `RealAiProvider` (T20b / T15):** `RealAiProvider.java` hiện mới dựng **khung gọi HTTP chung** theo interface `AiProvider` (`java.net.http.HttpClient`, đọc `COOK_AI_API_KEY`, `COOK_AI_ENDPOINT_URL`, `COOK_AI_MODEL`, timeout). **Chưa chọn nhà cung cấp AI cụ thể** (OpenAI / Gemini / Anthropic...); đang chờ chủ dự án chốt nhà cung cấp, mô hình, URL endpoint chính thức và hạn mức chi tiêu (`R6`). Nếu gọi vào `RealAiProvider` khi `COOK_AI_ENDPOINT_URL` còn để trống/`MISSING`, backend sẽ báo lỗi `AI_PROVIDER_NOT_CONFIGURED` (HTTP 503) chứ không trả dữ liệu giả.
- **Tên gói Android chính thức (`applicationId`):** hiện để giá trị tạm `com.cook.app` trong `apps/mobile/app.config.ts` (bản build `production` cố ý chặn nếu chưa thay).
- **URL máy chủ `staging` và `production` (`API_BASE_URL`):** hiện để trống; build EAS `preview` / `production` chờ cấp URL thật (riêng `production` bắt buộc `https://`).
- **Bộ nhận diện thương hiệu thật:** thay thế các ảnh tạm `apps/mobile/assets/placeholder-*.png`.
- **Nội dung pháp lý & khai báo Google Play (`T20.7`):** hoàn thiện các trường `MISSING` trong `docs/play/privacy-policy.skeleton.md` và `docs/play/data-safety.skeleton.md`.
- **Dữ liệu thật `data/` & quy tắc an toàn (`R6`):** 3 món mẫu, quy đổi đơn vị, giá tham khảo, mã dị ứng, quy tắc nhiệt độ/bảo quản (cần xác nhận từ nguồn chính thức).
- **Nghiệm thu thiết bị Android thật:** chạy thực tế `docs/timer-test-matrix.md` và bản APK `preview` (chưa có máy Android thật).

---

## 4. Quyết định đã chốt
- **Nguồn sự thật & hợp đồng kỳ vọng:** Schema `snake_case` theo `docs/plan.md`; mọi file trong `docs/expected/` là bất biến và được khóa mã băm SHA-256 trong `pnpm verify`.
- **Quy tắc dữ liệu R1–R5:** Không tự bịa dữ liệu vào `data/`, không dùng AI giả ngầm (`cook.env` và `cook.ai.provider` bắt buộc đặt tường minh, mọi phản hồi giả đính `X-AI-Mock: true`), không lưu tên/dị ứng/nội dung câu hỏi-trả lời vào `telemetry_event` hoặc `ai_usage_log` (kể cả `POST /v1/ai/feedback`).
- **Chiến lược triển khai backend & Android:** Tự quản VPS Ubuntu + Docker Compose là đường chính (`T21.7`), vẫn hỗ trợ phương án managed (`T21.8`). `applicationId` tạm `com.cook.app` chỉ khai báo một nơi tại `apps/mobile/app.config.ts`.
