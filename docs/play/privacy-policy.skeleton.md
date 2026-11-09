# Khung Chính sách Quyền riêng tư (Google Play — T20.7 Skeleton)

> **TRẠNG THÁI TÀI LIỆU:** CHỈ DỰNG KHUNG. Toàn bộ phần văn bản pháp lý, thông tin tổ chức chủ quản và cam kết chi tiết đều đánh dấu `MISSING` để chủ dự án và người có chuyên môn pháp lý soạn thảo và phê duyệt trước khi công bố.

---

## Phần A: Các trường pháp lý cần điền (`MISSING`)

1. **Tên ứng dụng chính thức & tên gói (`applicationId`):** `MISSING` *(tạm trong cấu hình: khai báo tại `apps/mobile/app.config.ts`)*
2. **Đơn vị / Cá nhân chịu trách nhiệm pháp lý (Developer / Data Controller):** `MISSING`
3. **Email / Kênh tiếp nhận yêu cầu quyền riêng tư của người dùng:** `MISSING`
4. **URL công khai lưu trữ Chính sách quyền riêng tư (Google Play Store listing):** `MISSING`
5. **Cơ sở pháp lý xử lý dữ liệu theo khu vực phát hành:** `MISSING`
6. **Phân loại dữ liệu sức khỏe / ăn uống nhạy cảm (dị ứng thực phẩm, chế độ ăn) và cơ chế đồng ý của người dùng:** `MISSING` *(xem mục kiểm kê thực tế bên dưới)*
7. **Nhà cung cấp AI bên thứ ba chính thức, quốc gia đặt máy chủ và chính sách không lưu giữ dữ liệu huấn luyện (zero data retention / data processing terms):** `MISSING`
8. **Thời hạn lưu giữ log kỹ thuật trên máy chủ (database & container stdout logs):** `MISSING`
9. **Quy trình xóa dữ liệu khi người dùng yêu cầu / khi gỡ cài đặt ứng dụng:** `MISSING`
10. **Đối tượng người dùng và quy định về trẻ em (Family Policy / Age rating):** `MISSING`
11. **Ngày hiệu lực và quy trình thông báo khi cập nhật chính sách:** `MISSING`

---

## Phần B: KIỂM KÊ DỮ LIỆU THỰC TẾ (Rút trực tiếp từ mã nguồn)

Phần dưới đây đối chiếu đúng những gì mã nguồn hiện tại thực sự lưu trữ hoặc truyền đi, làm căn cứ viết chính sách thật và khai Data Safety.

### 1. Dữ liệu chỉ lưu cục bộ trên thiết bị người dùng (SQLite nội bộ `cook.db`)

- **Hồ sơ khẩu vị & sức khỏe ăn uống (nhạy cảm):** số phần ăn mặc định, **danh sách dị ứng thực phẩm (`allergies`)**, gia vị sẵn có, dụng cụ bếp.
  - Căn cứ mã nguồn: `packages/core/src/storage/user-profile-repo.ts`, `packages/core/src/storage/migrations.ts`, `apps/mobile/src/screens/WelcomeScreen.tsx`.
- **Kho nguyên liệu cá nhân, phiên nấu ăn, lịch sử bước & cài đặt tắt/bật đo lường:**
  - Căn cứ mã nguồn: `packages/core/src/storage/pantry-service.ts`, `packages/core/src/storage/session-service.ts`, `apps/mobile/src/services/telemetry-service.ts` (`local_telemetry_event`, `app_metadata['telemetry_enabled']`).
- **Mã thiết bị ẩn danh cục bộ (`X-Device-Id`):** sinh ngẫu nhiên một lần trên client (`device_<timestamp>_<random>`), không chứa tên, số điện thoại, IMEI hay tài khoản Google.
  - Căn cứ mã nguồn: `apps/mobile/src/services/ai-client.ts` (`getAnonymousDeviceId()`).

### 2. Dữ liệu ứng dụng gửi lên Backend Spring Boot

| Luồng API | Dữ liệu gửi ra khỏi thiết bị | Dữ liệu KHÔNG gửi | Căn cứ mã nguồn |
| --- | --- | --- | --- |
| `POST /v1/ai/substitute` *(khi người dùng bấm hỏi AI "Thay hoặc bỏ")* | Header `X-Device-Id`; JSON gồm `recipeId`, `action` (`substitute`/`omit`), `ingredientId`, `role`, `flavorGroup`, **`allergies`** (mã dị ứng đã khai để tránh gợi ý gây dị ứng), `knownIngredients`, `ingredientAllergens`, `scenarioId`. *(Lưu ý: nguyên liệu `preservation` hoặc dính dị ứng sẵn tại client thì chặn bằng cảnh báo cố định, không gửi request AI).* | Tên hiển thị người dùng, dữ liệu kho đầy đủ, lịch sử nấu cá nhân. | `apps/mobile/src/services/ai-client.ts`, `apps/mobile/src/screens/SubstituteModal.tsx`, `apps/backend/src/main/java/com/cook/backend/controller/AiController.java`, `apps/backend/src/main/java/com/cook/backend/dto/SubstituteRequest.java` |
| `POST /v1/ai/ask` *(khi bật cờ hỏi nhanh và người dùng bấm Gửi)* | Header `X-Device-Id`; JSON gồm `question` (câu hỏi người dùng nhập), `currentStep`, `remainingSteps` (tối đa vài bước còn lại), `scenarioId`. | Danh sách dị ứng, tên hiển thị, toàn bộ kho nguyên liệu, lịch sử phiên trước. | `apps/mobile/src/services/ai-client.ts`, `apps/mobile/src/screens/CookScreen.tsx`, `apps/backend/src/main/java/com/cook/backend/controller/AiController.java`, `apps/backend/src/main/java/com/cook/backend/dto/AskRequest.java` |
| `POST /v1/ai/feedback` *(khi người dùng bấm "Câu trả lời sai")* | Header `X-Device-Id` (backend băm SHA-256 + salt qua `DeviceAnonymizer`); JSON chỉ gồm mã định danh ẩn danh: `questionId`, `feedbackType`, và ID ngữ cảnh tùy chọn (`sessionId`, `recipeSlug`, `stepId`). Backend ghi sự kiện `telemetry_event` với `event_type = "ai_wrong_answer"`. | Tuyệt đối không gửi và không lưu nội dung `question`, `answer`, `comment`, danh sách dị ứng hay tên người dùng. | `apps/mobile/src/services/ai-client.ts`, `apps/mobile/src/screens/SubstituteModal.tsx`, `apps/mobile/src/screens/CookScreen.tsx`, `apps/backend/src/main/java/com/cook/backend/controller/AiController.java`, `apps/backend/src/main/java/com/cook/backend/dto/AiFeedbackRequest.java`, `apps/backend/src/main/java/com/cook/backend/service/TelemetryService.java` |
| `POST /v1/events` *(tắt hoàn toàn nếu tắt công tắc đo lường trong Cài đặt)* | Header `X-Device-Id` (backend băm một chiều SHA-256 + salt qua `DeviceAnonymizer`, không lưu ID gốc); lô `events` gồm whitelist 8 khóa: `eventId`, `eventType`, `sessionId`, `recipeSlug`, `stepId`, `aiKind`, `helpful`, `occurredAt`. | Tuyệt đối chặn `name`, `displayName`, `allergies`, `dietaryPreference`, `question`, `answer`, `prompt`, `comment`, `ingredients`, `pantry`, `userProfile`. | `apps/mobile/src/services/telemetry-service.ts`, `apps/mobile/src/screens/SettingsScreen.tsx`, `apps/backend/src/main/java/com/cook/backend/controller/EventController.java`, `apps/backend/src/main/java/com/cook/backend/dto/EventBatchRequest.java`, `apps/backend/src/main/java/com/cook/backend/dto/TelemetryEventDto.java`, `apps/backend/src/main/java/com/cook/backend/service/TelemetryService.java`, `apps/backend/src/main/java/com/cook/backend/service/DeviceAnonymizer.java` |

### 3. Dữ liệu Backend lưu trữ & gửi cho Bên cung cấp AI thứ ba

- **Lưu trữ tại PostgreSQL của backend:**
  - Bảng `ai_usage_log`: lưu `device_hash` (đã băm một chiều), `endpoint`, số token, chi phí ước tính, trạng thái, thời gian — **không lưu** nội dung `question`, `answer` hay `allergies`.
    - Căn cứ mã nguồn: `apps/backend/src/main/java/com/cook/backend/service/AiService.java`, `apps/backend/src/main/java/com/cook/backend/entity/AiUsageLog.java`.
  - Bảng `telemetry_event`: lưu `device_hash` và 8 trường sự kiện ẩn danh sau khi chặn mọi trường ngoài whitelist.
    - Căn cứ mã nguồn: `apps/backend/src/main/java/com/cook/backend/service/TelemetryService.java`, `apps/backend/src/main/java/com/cook/backend/entity/TelemetryEvent.java`.
- **Truyền tới bên cung cấp AI thứ ba:**
  - Khi kích hoạt `RealAiProvider`: giao diện `AiProvider` nhận `SubstituteRequest` (có trường **`allergies`**, món, nguyên liệu cần thay/bỏ, ngữ cảnh nguyên liệu hợp lệ) và `AskRequest` (`question`, `currentStep`, `remainingSteps`).
  - **Trạng thái mã hiện tại:** `RealAiProvider.java` đã có khung gọi HTTP chung bằng `java.net.http.HttpClient` theo interface `AiProvider` (đọc `COOK_AI_API_KEY`, `COOK_AI_ENDPOINT_URL`, timeout `COOK_AI_TIMEOUT_MS`), nhưng **chưa chọn nhà cung cấp AI cụ thể** (còn `MISSING`, chờ chủ dự án chốt). Nếu chưa đặt `COOK_AI_ENDPOINT_URL`, lời gọi sẽ dừng với mã `AI_PROVIDER_NOT_CONFIGURED`.
  - Căn cứ mã nguồn: `apps/backend/src/main/java/com/cook/backend/ai/AiProvider.java`, `apps/backend/src/main/java/com/cook/backend/ai/RealAiProvider.java`, `apps/backend/src/main/java/com/cook/backend/service/AiService.java`, `apps/backend/src/main/resources/prompts/`.
  - **Tên nhà cung cấp AI, mô hình sử dụng và địa chỉ máy chủ bên thứ ba:** `MISSING` (chờ chủ dự án chốt).

