# Trạng thái dự án Trợ lý nấu ăn (Bản cuối sau T23)

*Tài liệu tổng hợp toàn bộ trạng thái hoàn thành từ `T01` đến `T23` (Giai đoạn A–G), danh sách lệnh `CHƯA CHẠY` / `CHƯA NGHIỆM THU` trên hạ tầng/thiết bị thật, và các đầu việc đang chờ chủ dự án quyết định trước Giai đoạn H (thử kín).*

---

## 1. Bảng trạng thái toàn bộ các task (`T01` – `T23`)

| Task | Nội dung chính | Trạng thái | Nhánh | Ghi chú / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- |
| **T01, T01-FIX** | Khung monorepo `pnpm` + Backend Java 21 Spring Boot + `/health` + Expo SDK 58 | **ĐÃ GỘP MAIN** | `main` | Đầy đủ test cơ sở & cấu trúc đa gói |
| **T02** | Schema Zod dùng chung tại `@cook/core` & bộ kiểm thử ca sai | **ĐÃ GỘP MAIN** | `main` | Ít nhất 8 ca sai hợp đồng dữ liệu |
| **T03** | Khung `data/`, trình thẩm định `scripts/validate-data.js --strict`, quy tắc `R1–R5` (`MISSING`) | **ĐÃ GỘP MAIN** | `main` | Chặn `MISSING` ở món `reviewed`/`published` |
| **T04** | Bộ lập lịch nấu đa món `Scheduler` (chế độ `fast` / `relaxed`, không tranh dụng cụ) | **ĐÃ GỘP MAIN** | `main` | Khớp `docs/expected/T04.md` |
| **T05** | SQLite cục bộ & `RecipeRepo` (migration an toàn lặp, nạp dữ liệu 1 lần) | **ĐÃ GỘP MAIN** | `main` | Khớp `docs/expected/T05.md` |
| **T06** | Màn hình chính, đổi số phần, lọc dị ứng (`Home` / `Recipes` / `Settings`) | **ĐÃ GỘP MAIN** | `main` | Khớp `docs/expected/T06.md` |
| **T07** | Máy trạng thái phiên nấu `SessionService`, khôi phục phiên sau thoát app | **ĐÃ GỘP MAIN** | `main` | Khớp `docs/expected/T07.md` |
| **T08** | Hẹn giờ nền (`NotificationService`, tối ưu pin, ma trận `docs/timer-test-matrix.md`) | **ĐÃ GỘP MAIN (CHƯA NGHIỆM THU)** | `main` | `CHƯA NGHIỆM THU: chưa có máy thật` (khóa màn hình / tắt app) |
| **T09** | Giao diện 3 màn Chuẩn bị / Nấu / Hoàn tất & điều phối offline trong bếp | **ĐÃ GỘP MAIN (CHƯA NGHIỆM THU)** | `main` | Nấu trọn 1 món trên máy thật chờ chủ dự án thử |
| **T10** | `PantryService` trừ kho FIFO đa lô, quy đổi đơn vị, hoàn tác khi sửa | **ĐÃ GỘP MAIN** | `main` | Khớp `docs/expected/T10.md` trên 5 món tính tay |
| **T11** | Màn thêm nhanh nguyên liệu (`Quick-Add`), khử trùng lặp, mức ước lượng `MISSING` | **ĐÃ GỘP MAIN** | `main` | Đã có test luồng & ca sai; thử tay tốc độ trên máy chờ chủ dự án |
| **T12** | Gợi ý món 2 chế độ (`strict` / `near`) & chế độ ước chừng (`tạo`, `chưa có giá` khi `MISSING`) | **ĐÃ GỘP MAIN** | `main` | Khớp `docs/expected/T12.md` |
| **T13** | Luồng kết thúc nấu -> trừ kho -> sửa kho -> hoàn tác trên giao diện | **ĐÃ GỘP MAIN (CHƯA NGHIỆM THU)** | `main` | Luồng giả lập xanh; thử thực tế trên máy chờ chủ dự án |
| **T14** | Backend kiểm tra biến env khởi động (`EnvValidator`), `DEVICE_SALT`, `ai_usage_log`, Sliding Window rate limit | **ĐÃ GỘP MAIN** | `main` | Chặn thiếu biến hoặc `production + mock` |
| **T15** | Lớp `AiProvider` (`mock`/`real`), `POST /v1/ai/substitute`, `/v1/ai/ask` (tắt mặc định), `SafetyScanService` | **ĐÃ GỘP MAIN** | `main` | Khớp khối JSON `RSU` của `docs/expected/T14.md`; 10 câu hỏi thật chờ chủ dự án |
| **T16** | `SafetyRules` trong app, hiển thị nguồn y tế, chặn món nếu quy tắc còn `MISSING` | **ĐÃ GỘP MAIN** | `main` | Quy tắc an toàn đang giữ `MISSING` theo `R5` chờ nguồn y tế |
| **T17** | `AiClient` (timeout, mất mạng không treo app, không ảnh hưởng hẹn giờ nấu) | **ĐÃ GỘP MAIN** | `main` | Hẹn giờ offline vẫn chạy khi backend mất kết nối |
| **T18** | Modal "Thay hoặc bỏ" (cảnh báo cố định `preservation`/dị ứng), header `X-AI-Mock: true`, nút "Câu trả lời sai" | **ĐÃ GỘP MAIN** | `main` | Đã kiểm thử đủ 3 tình huống UI |
| **T19** | `TelemetryService` ẩn danh, `POST /v1/events`, màn `Cài đặt` opt-out, `docs/metrics.sql` (6 chỉ số) | **ĐÃ GỘP MAIN** | `main` | Khớp `docs/expected/T19.md` sai số `< 0.0001` |
| **T20** | 3 môi trường Android, `eas.json`, `applicationId` tạm `com.cook.app` (+ khóa `production`), quyền tối thiểu, Play skeletons | **ĐÃ GỘP MAIN (CHƯA NGHIỆM THU)** | `main` (`616bf2f`) | APK preview thật trên máy Android là `CHƯA NGHIỆM THU: chưa có máy thật` |
| **T20b** | Tích hợp `expo-keep-awake` vào `CookScreen`, thêm `POST /v1/ai/feedback`, khung HTTP `RealAiProvider` | **ĐÃ GỘP MAIN** | `main` (`8f7131f`) | `RealAiProvider` chỉ có khung HTTP, chờ chọn nhà cung cấp AI |
| **T21** | Multi-stage `Dockerfile`, `docker-compose` VPS/Managed, Caddy HTTPS, `backup-db.sh`/`restore-db.sh`, log STDOUT, tài liệu VPS/Managed, CORS & Rate limit | **ĐÃ GỘP MAIN (CHƯA CHẠY DOCKER)** | `main` (`347a6fa`) | `docker compose config` & `./mvnw verify` xanh; dựng container trên VPS/Docker thật là `CHƯA CHẠY` |
| **T22** | CI Pull Request/Push (`Verify CI`: `pnpm verify` + `./mvnw verify`), workflow Docker release theo tag `v*.*.*`, quét lỗ hổng không chặn (`security-scan.yml`, Dependabot), `docs/release-checklist.md` | **XONG TRÊN `task/T22` (CHỜ DUYỆT)** | `task/T22` | Chưa kích hoạt tag `v*.*.*` và chưa bật Branch Protection trên UI GitHub |
| **T23** | (a) Quét `scan-secrets.py` phủ mọi `application*.yml`, `docker-compose*.yml`, `.env.example`, mã app & backend + ca sai bắt buộc; (b) đổi `API_BASE_URL` bằng biến env qua `expo config` & `expo export` không sửa mã; (c) di chuyển DB 2 máy; (d) `docs/costs.md` | **XONG PHẦN TĨNH TRÊN `task/T22` (`CHƯA CHẠY` EAS & DB MIGRATION)** | `task/T22` | EAS cloud build `preview` và di chuyển DB giữa 2 máy là `CHƯA CHẠY`; `docs/costs.md` để trống mọi số tiền (`MISSING`) |

---

## 2. Danh sách các việc `CHƯA CHẠY` / `CHƯA NGHIỆM THU` (cần chủ dự án tự chạy)

| Việc / Task | Trạng thái | Lý do không chạy được trên máy dev | Lệnh chính xác để chủ dự án tự chạy |
| :--- | :--- | :--- | :--- |
| **T23(b): Đổi URL server trên EAS & build APK `preview` bằng biến cấu hình EAS** | `CHƯA CHẠY` | Không có `eas-cli` và chưa đăng nhập tài khoản Expo/EAS *(đã thử cục bộ bằng `expo config --json` và `expo export` đổi `API_BASE_URL` thành công không sửa mã)* | `cd apps/mobile`<br>`npx eas-cli login`<br>`npx eas-cli env:create --environment preview --name API_BASE_URL --value https://<SERVER-1> --visibility plaintext --force`<br>`npx eas-cli build --platform android --profile preview`<br>`npx eas-cli env:create --environment preview --name API_BASE_URL --value https://<SERVER-2> --visibility plaintext --force`<br>`npx eas-cli build --platform android --profile preview` |
| **T21 & T23(c): Dựng Docker Compose thật & diễn tập xuất/khôi phục di chuyển CSDL giữa 2 máy** | `CHƯA CHẠY` | Docker Desktop daemon không chạy trên máy Windows dev và chưa có VPS / máy chủ Postgres thứ hai | `# Trên máy 1 (VPS cũ / đang chạy):`<br>`cp deploy/.env.example deploy/.env && nano deploy/.env`<br>`docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build`<br>`curl -fsS http://127.0.0.1:8080/health`<br>`./deploy/scripts/backup-db.sh`<br>`# Chép file .sql.gz + .sha256 sang máy 2 và khôi phục:`<br>`docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d postgres`<br>`./deploy/scripts/restore-db.sh deploy/backups/cook_backup_<TIMESTAMP>.sql.gz --yes`<br>`docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build && curl -fsS https://<DOMAIN-MAY-2>/health` |
| **T22.2 & Cổng PR trên GitHub** | `CHƯA CHẠY` | Cần quyền quản trị repo GitHub (Settings -> Branches) và đẩy tag phiên bản thật | 1) GitHub -> **Settings -> Branches -> Add rule (`main`)**: bật **Require status checks to pass before merging** cho `Run pnpm verify` và `Run backend ./mvnw verify`.<br>2) Khi sẵn sàng phát hành Docker image:<br>`git checkout main && git tag v0.1.0 && git push origin v0.1.0` |
| **T08, T09, T13, T20: Nghiệm thu trên máy Android vật lý** | `CHƯA NGHIỆM THU: chưa có máy thật` | Chưa có thiết bị Android vật lý để cài APK và đo hẹn giờ nền / khóa màn hình | Tải APK từ bước EAS `preview` -> cài qua QR hoặc `adb install -r cook-assistant-preview.apk` -> nấu trọn 1 món khi tắt mạng và điền đầy đủ bảng `docs/timer-test-matrix.md`. |

---

## 3. Việc đang chờ chủ dự án quyết định & dữ liệu `MISSING`

1. **Nhà cung cấp AI thật (`RealAiProvider`, T15 / T20b / T23):**
   - `RealAiProvider.java` mới có khung HTTP chung (`java.net.http.HttpClient`). Cần chủ dự án chọn nhà cung cấp (OpenAI / Gemini / Anthropic...), mô hình (`COOK_AI_MODEL`), URL endpoint (`COOK_AI_ENDPOINT_URL`), khóa API (`COOK_AI_API_KEY`) và quyết định bật/tắt `COOK_AI_ASK_ENABLED`.
   - Khi `COOK_AI_ENDPOINT_URL` còn trống hoặc `MISSING`, backend chủ động trả lỗi `AI_PROVIDER_NOT_CONFIGURED` (HTTP 503), không dùng AI giả ngầm.
2. **Báo giá chi phí & Hạn mức ngân sách AI (`docs/costs.md`, T23.4):**
   - Điền giá thật cho các ô `MISSING`: VPS Ubuntu (hoặc Managed Container + DB), tên miền, phí đăng ký Google Play (một lần), đơn giá token AI theo trang pricing chính thức, và thiết lập Hard Monthly Spending Cap trên dashboard nhà cung cấp AI.
3. **Định danh gói Android & Thương hiệu (`T20`):**
   - Chốt tên gói chính thức thay cho giá trị tạm `TEMPORARY_APPLICATION_ID = "com.cook.app"` tại [`apps/mobile/app.config.ts`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/apps/mobile/app.config.ts) *(bản `production` tự động chặn nếu chưa đổi)*.
   - Thay thế 3 ảnh placeholder tại `apps/mobile/assets/placeholder-*.png` bằng bộ nhận diện thật.
   - Kiểm tra chính sách Google Play cho quyền `SCHEDULE_EXACT_ALARM` (`docs/android-release.md` mục 4).
4. **Pháp lý & Google Play Store (`T20.7`):**
   - Hoàn thiện toàn bộ trường `MISSING` trong [`docs/play/privacy-policy.skeleton.md`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/docs/play/privacy-policy.skeleton.md) và [`docs/play/data-safety.skeleton.md`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/docs/play/data-safety.skeleton.md).
5. **Dữ liệu thật `data/` & 10 câu hỏi AI mẫu (`R6`, `T03`, `T11`, `T12`, `T15`, `T16`):**
   - Cung cấp và xác nhận (`source`, `confirmed_by`): 3 món mẫu, danh sách nguyên liệu & tên gọi vùng miền, bảng quy đổi đơn vị, mức "một ít/vừa/nhiều", giá tham khảo, mã dị ứng, **quy tắc an toàn thực phẩm** *(hiện để `MISSING` nên T16 chặn bắt đầu món có bước an toàn theo đúng quy tắc R5)*, và 10 câu hỏi mẫu đánh giá AI thật.
6. **Chuẩn bị Giai đoạn H — Thử kín (ngoài phạm vi code của Antigravity):**
   - Sau khi gộp `task/T22` -> `main` và hoàn tất các mục `CHƯA CHẠY` / `MISSING` trên: lập ngưỡng đạt/không đạt trước thử kín tại `docs/pilot-criteria.md`, tổ chức 10–20 người nấu thử bằng APK `preview`, rồi đối chiếu số đếm tay với kết quả [`docs/metrics.sql`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/docs/metrics.sql).

---

## 4. Quyết định kiến trúc đã chốt

- **Nguồn sự thật & Kiểm định:** Schema `snake_case` theo `docs/plan.md`; mọi file trong `docs/expected/` là bất biến và khóa SHA-256 trong `scripts/verify.js`. Mọi PR/push trên GitHub chịu cổng CI bắt buộc từ [`.github/workflows/verify.yml`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/.github/workflows/verify.yml) (`pnpm verify` + `./mvnw -B verify`).
- **Quy tắc dữ liệu & Bảo mật (`R1–R5`, `T14`, `T19`, `T23`):** Không bịa dữ liệu vào `data/` hay `docs/costs.md`; không dùng AI giả ngầm (`cook.env` & `cook.ai.provider` đặt tường minh, phản hồi giả gắn `X-AI-Mock: true`); không lưu tên/dị ứng/câu hỏi/câu trả lời vào telemetry hoặc `ai_usage_log`; không viết cứng khóa/mật khẩu/URL máy chủ trong code hay YAML (kiểm toán tự động bởi [`scripts/scan-secrets.py`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/scripts/scan-secrets.py)).
- **Chiến lược triển khai:** VPS tự quản Ubuntu + Docker Compose + Caddy HTTPS (`T21.7`) là đường chính, vẫn giữ phương án Managed (`T21.8`). `applicationId` tạm `com.cook.app` chỉ nằm một nơi tại [`apps/mobile/app.config.ts`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/apps/mobile/app.config.ts).
