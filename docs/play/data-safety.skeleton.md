# Khung khai báo Google Play Data Safety (T20.7 Skeleton)

> **TRẠNG THÁI TÀI LIỆU:** CHỈ DỰNG KHUNG. Mọi lựa chọn khai báo chính thức trên Play Console đều để `MISSING` để chủ dự án trực tiếp đối chiếu, xác nhận hành vi cuối cùng của bản phát hành và điền tay lên Google Play Console.

---

## Phần A: Khung bảng câu hỏi Google Play Data Safety (`MISSING`)

### 1. Tổng quan thu thập & chia sẻ dữ liệu
- **Does your app collect or share any of the required user data types?** `MISSING`
- **Is all of the user data collected by your app encrypted in transit?** `MISSING` *(ghi chú kỹ thuật: môi trường `staging` và `production` trong `apps/mobile/app.config.ts` đặt `usesCleartextTraffic=false` và chặn cleartext ở `network_security_config.xml`; môi trường `production` bắt buộc `API_BASE_URL` dùng `https://`)*
- **Do you provide a way for users to request that their data is deleted?** `MISSING`
- **Do you commit to following the Google Play Families Policy (nếu áp dụng)?** `MISSING`

### 2. Khung phân loại theo từng nhóm dữ liệu Play Data Safety

| Nhóm dữ liệu Google Play | Thu thập (Collected)? | Chia sẻ với bên thứ 3 (Shared)? | Bắt buộc hay Tùy chọn? | Mục đích xử lý theo danh mục Play | Ghi chú kỹ thuật cần đối chiếu khi điền |
| --- | --- | --- | --- | --- | --- |
| **Personal info** (Name, User IDs...) | `MISSING` | `MISSING` | `MISSING` | `MISSING` | Tên hiển thị chưa thu thập lên server; app dùng `X-Device-Id` ngẫu nhiên cục bộ, backend băm SHA-256 + salt. |
| **Health and fitness** (Allergies / Dietary data trong mục Health / Medical info) | `MISSING` | `MISSING` | `MISSING` | `MISSING` | **Cần đặc biệt chú ý:** `allergies` lưu cục bộ trong SQLite và được gửi trong `POST /v1/ai/substitute` nếu người dùng dùng chức năng AI thay/bỏ nguyên liệu; cần đối chiếu trường hợp `RealAiProvider` gửi `SubstituteRequest` ra API AI thứ ba. |
| **Messages / User content** (Câu hỏi tự do nhập vào ô Hỏi AI) | `MISSING` | `MISSING` | `MISSING` | `MISSING` | Câu hỏi chỉ gửi qua `POST /v1/ai/ask` (tắt mặc định ở backend cho đến khi bật cờ). Nút báo sai `POST /v1/ai/feedback` chỉ gửi `questionId` và `feedbackType`, tuyệt đối không gửi hay lưu câu hỏi/câu trả lời. |
| **App activity** (In-app actions / Telemetry ẩn danh) | `MISSING` | `MISSING` | `MISSING` | `MISSING` | Gửi 6 loại sự kiện ẩn danh qua `POST /v1/events`; có công tắc cho phép người dùng tắt hoàn toàn trong `SettingsScreen.tsx`. |
| **App info and performance** (Diagnostics / AI usage logs) | `MISSING` | `MISSING` | `MISSING` | `MISSING` | Backend ghi `ai_usage_log` gồm mã băm thiết bị, endpoint, token, chi phí, trạng thái. |
| **Device or other IDs** (`X-Device-Id`) | `MISSING` | `MISSING` | `MISSING` | `MISSING` | Mã ngẫu nhiên trong phiên app (không dùng Advertising ID / AAID / IMEI); backend băm một chiều thành `deviceHash`. |

---

## Phần B: KIỂM KÊ DỮ LIỆU THỰC TẾ (Căn cứ tệp nguồn để đối chiếu khi khai Play Console)

1. **Dữ liệu hồ sơ & dị ứng người dùng (cục bộ SQLite + gửi khi hỏi thay thế nguyên liệu):**
   - Lưu cục bộ: `packages/core/src/storage/user-profile-repo.ts`, `packages/core/src/storage/migrations.ts`, `apps/mobile/src/screens/WelcomeScreen.tsx`
   - Chặn gửi AI nếu dính dị ứng sẵn hoặc `preservation`: `apps/mobile/src/screens/SubstituteModal.tsx`
   - Gửi lên backend (`/v1/ai/substitute`) để AI tránh gợi ý dị nguyên: `apps/mobile/src/services/ai-client.ts`, `apps/backend/src/main/java/com/cook/backend/dto/SubstituteRequest.java`
2. **Câu hỏi nấu ăn & phản hồi câu trả lời AI:**
   - Gửi từ app (`/v1/ai/ask`, `/v1/ai/feedback`): `apps/mobile/src/services/ai-client.ts`, `apps/mobile/src/screens/CookScreen.tsx`, `apps/mobile/src/screens/SubstituteModal.tsx`
   - Cờ tắt mặc định `/v1/ai/ask` phía backend: `apps/backend/src/main/java/com/cook/backend/controller/AiController.java`, `apps/backend/src/main/java/com/cook/backend/service/AiService.java`
   - DTO câu hỏi backend: `apps/backend/src/main/java/com/cook/backend/dto/AskRequest.java`
3. **Truyền dữ liệu từ backend sang bên AI thứ ba:**
   - Giao diện & provider: `apps/backend/src/main/java/com/cook/backend/ai/AiProvider.java`, `apps/backend/src/main/java/com/cook/backend/ai/RealAiProvider.java` *(mới dựng khung HTTP `HttpClient`, chưa chọn nhà cung cấp AI cụ thể — chờ chủ dự án)*, `apps/backend/src/main/java/com/cook/backend/service/AiService.java`
   - Mẫu prompt: `apps/backend/src/main/resources/prompts/`
   - Lịch sử chi phí kỹ thuật không chứa nội dung nhạy cảm: `apps/backend/src/main/java/com/cook/backend/entity/AiUsageLog.java`
4. **Đo lường ẩn danh & cơ chế opt-out của người dùng:**
   - Client whitelist 8 khóa & công tắc tắt đo lường: `apps/mobile/src/services/telemetry-service.ts`, `apps/mobile/src/screens/SettingsScreen.tsx`
   - Backend kiểm tra khóa lạ & lưu PostgreSQL: `apps/backend/src/main/java/com/cook/backend/controller/EventController.java`, `apps/backend/src/main/java/com/cook/backend/dto/EventBatchRequest.java`, `apps/backend/src/main/java/com/cook/backend/dto/TelemetryEventDto.java`, `apps/backend/src/main/java/com/cook/backend/service/TelemetryService.java`
5. **Mã thiết bị ẩn danh & băm phía server:**
   - Sinh mã ở app: `apps/mobile/src/services/ai-client.ts` (`getAnonymousDeviceId`)
   - Giới hạn lượt & băm `X-Device-Id`: `apps/backend/src/main/java/com/cook/backend/filter/RateLimitFilter.java`, `apps/backend/src/main/java/com/cook/backend/service/DeviceAnonymizer.java`
6. **Chặn cleartext HTTP ở build staging / production:**
   - Cấu hình build & plugin `network_security_config.xml`: `apps/mobile/app.config.ts`, `apps/mobile/src/config/env.ts`
   - Loại bỏ `console.log` và dev-fixtures ở bản production: `apps/mobile/babel.config.js`, `apps/mobile/App.tsx`

