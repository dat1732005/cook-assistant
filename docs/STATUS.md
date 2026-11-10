# Trạng thái dự án Trợ lý nấu ăn (Bản cuối sau T23)

*Tài liệu tổng hợp toàn bộ trạng thái từ `T01` đến `T23` (Giai đoạn A–G), tách bạch rõ trạng thái **Đã code** và **Đã nghiệm thu trên thiết bị thật**, cùng danh sách **Việc chờ chủ dự án** sắp xếp theo thứ tự ưu tiên trước Giai đoạn H (thử kín).*

---

## 1. Bảng trạng thái toàn bộ các task (`T01` – `T23`)

| Task | Nội dung chính | Đã code | Đã nghiệm thu trên thiết bị thật | Ghi chú / Tham chiếu |
| :--- | :--- | :--- | :--- | :--- |
| **T01, T01-FIX** | Khung monorepo `pnpm` + Backend Java 21 Spring Boot + `/health` + Expo SDK 58 | **Đã code (gộp `main`)** | **CHƯA** *(chờ chạy kiểm chứng trên máy/VPS thật)* | Đầy đủ test cơ sở & cấu trúc đa gói |
| **T02** | Schema Zod dùng chung tại `@cook/core` & bộ kiểm thử ca sai | **Đã code (gộp `main`)** | **CHƯA** *(không cần máy Android; chờ chạy cùng dữ liệu thật)* | Ít nhất 8 ca sai hợp đồng dữ liệu |
| **T03** | Khung `data/`, trình thẩm định `scripts/validate-data.js --strict`, quy tắc `R1–R5` (`MISSING`) | **Đã code (gộp `main`)** | **CHƯA** *(chờ chủ dự án nạp dữ liệu thật & chạy `--strict`)* | Chặn `MISSING` ở món `reviewed`/`published` |
| **T04** | Bộ lập lịch nấu đa món `Scheduler` (chế độ `fast` / `relaxed`, không tranh dụng cụ) | **Đã code (gộp `main`)** | **CHƯA** *(khớp `docs/expected/T04.md`; chờ đối chiếu 3 món thật)* | Logic lõi thuần TypeScript |
| **T05** | SQLite cục bộ & `RecipeRepo` (migration an toàn lặp, nạp dữ liệu 1 lần) | **Đã code (gộp `main`)** | **CHƯA** *(chưa mở app 2 lần trên máy Android thật)* | Khớp `docs/expected/T05.md` |
| **T06** | Màn hình chính, đổi số phần, lọc dị ứng (`Home` / `Recipes` / `Settings`) | **Đã code (gộp `main`)** | **CHƯA** *(chưa có máy Android thật để thao tác trực tiếp)* | Khớp `docs/expected/T06.md` |
| **T07** | Máy trạng thái phiên nấu `SessionService`, khôi phục phiên sau thoát app | **Đã code (gộp `main`)** | **CHƯA** *(khớp `docs/expected/T07.md`; thử tắt app thật ở T08/T09)* | Kiểm thử mô phỏng 3 món & phục hồi phiên |
| **T08** | Hẹn giờ nền (`NotificationService`, tối ưu pin, ma trận `docs/timer-test-matrix.md`) | **Đã code (gộp `main`)** | **CHƯA** *(chưa có máy Android thật — chưa điền `timer-test-matrix.md`)* | Bắt buộc thử màn hình khóa, vuốt tắt app, tiết kiệm pin |
| **T09** | Giao diện 3 màn Chuẩn bị / Nấu / Hoàn tất & điều phối offline trong bếp | **Đã code (gộp `main`)** | **CHƯA** *(chưa có máy Android thật — chưa nấu trọn 1 món thật)* | Phải thử bật chế độ máy bay giữa phiên nấu |
| **T10** | `PantryService` trừ kho FIFO đa lô, quy đổi đơn vị, hoàn tác khi sửa | **Đã code (gộp `main`)** | **CHƯA** *(khớp `docs/expected/T10.md` trên 5 món tính tay)* | Logic trừ kho lõi đã khóa hợp đồng |
| **T11** | Màn thêm nhanh nguyên liệu (`Quick-Add`), khử trùng lặp, mức ước lượng `MISSING` | **Đã code (gộp `main`)** | **CHƯA** *(chưa có máy Android thật — chưa bấm giờ nhập 10 món)* | Mức "một ít/vừa/nhiều" đang `MISSING` chờ đo thật |
| **T12** | Gợi ý món 2 chế độ (`strict` / `near`) & chế độ ước chừng (`tạo`, `chưa có giá` khi `MISSING`) | **Đã code (gộp `main`)** | **CHƯA** *(chưa có máy Android thật; đã khớp `docs/expected/T12.md`)* | Không gợi ý món dính dị ứng trên 20 kho ngẫu nhiên |
| **T13** | Luồng kết thúc nấu -> trừ kho -> sửa kho -> hoàn tác trên giao diện | **Đã code (gộp `main`)** | **CHƯA** *(chưa có máy Android thật để thử luồng sửa/hoàn tác)* | Test giao diện giả lập đã xanh |
| **T14** | Backend kiểm tra env khởi động (`EnvValidator`), `DEVICE_SALT`, `ai_usage_log`, Sliding Window rate limit | **Đã code (gộp `main`)** | **CHƯA** *(chưa chạy trên VPS/server thật của chủ dự án)* | Chặn thiếu biến hoặc `production + mock` |
| **T15** | Lớp `AiProvider` (`mock`/`real`), `POST /v1/ai/substitute`, `/v1/ai/ask` (tắt mặc định), `SafetyScanService` | **Đã code (gộp `main`)** | **CHƯA** *(chưa nối AI thật & chưa chấm 10 câu hỏi mẫu của chủ dự án)* | Khớp khối JSON `RSU` của `docs/expected/T14.md` |
| **T16** | `SafetyRules` trong app, hiển thị nguồn y tế, chặn món nếu quy tắc còn `MISSING` | **Đã code (gộp `main`)** | **CHƯA** *(chưa có máy Android thật; quy tắc an toàn đang `MISSING`)* | App đang chặn món có bước an toàn theo quy tắc `R5` |
| **T17** | `AiClient` (timeout, mất mạng không treo app, không ảnh hưởng hẹn giờ nấu) | **Đã code (gộp `main`)** | **CHƯA** *(chưa có máy Android thật — chưa thử tắt mạng giữa lúc hỏi AI)* | Hẹn giờ offline vẫn chạy khi backend mất kết nối |
| **T18** | Modal "Thay hoặc bỏ" (cảnh báo cố định `preservation`/dị ứng), header `X-AI-Mock: true`, nút "Câu trả lời sai" | **Đã code (gộp `main`)** | **CHƯA** *(chưa có máy Android thật để thử 3 tình huống UI thực tế)* | Đã kiểm thử đủ 3 tình huống & header mock |
| **T19** | `TelemetryService` ẩn danh, `POST /v1/events`, màn `Cài đặt` opt-out, `docs/metrics.sql` (6 chỉ số) | **Đã code (gộp `main`)** | **CHƯA** *(chưa có máy Android thật để chạy 5 phiên thật & đếm tay)* | Khớp `docs/expected/T19.md` sai số `< 0.0001` |
| **T20** | 3 môi trường Android, `eas.json`, `applicationId` tạm `com.cook.app` (+ khóa `production`), quyền tối thiểu, Play skeletons | **Đã code (gộp `main`)** | **CHƯA** *(chưa có máy Android thật — chưa build EAS & chưa cài APK `preview`)* | Đã kiểm tra config/quyền/bundle sạch debug |
| **T20b** | Tích hợp `expo-keep-awake` vào `CookScreen`, thêm `POST /v1/ai/feedback`, khung HTTP `RealAiProvider` | **Đã code (gộp `main`)** | **CHƯA** *(chưa có máy Android thật để kiểm tra giữ sáng màn hình khi nấu)* | `RealAiProvider` chỉ có khung HTTP, chờ chọn nhà cung cấp |
| **T21** | Multi-stage `Dockerfile`, `docker-compose` VPS/Managed, Caddy HTTPS, `backup-db.sh`/`restore-db.sh`, log STDOUT, tài liệu VPS/Managed, CORS & Rate limit | **Đã code (gộp `main`)** | **CHƯA** *(chưa chạy Docker/VPS thật — máy dev không bật Docker daemon)* | `docker compose config` & `./mvnw verify` xanh |
| **T22** | CI Pull Request/Push (`Verify CI`: `pnpm verify` + `./mvnw verify`), workflow Docker release theo tag `v*.*.*`, quét lỗ hổng không chặn (`security-scan.yml`, Dependabot), `docs/release-checklist.md` | **Đã code (gộp `main`)** | **CHƯA** *(đã xanh trên GitHub Actions; chờ bật Branch Protection & tag `v*.*.*`)* | Kiểm định tự động chạy mỗi PR/push |
| **T23** | (a) Quét `scan-secrets.py` phủ mọi `application*.yml`, `docker-compose*.yml`, `.env.example`, mã app & backend + ca sai bắt buộc; (b) đổi `API_BASE_URL` qua env `expo config`/`expo export` không sửa mã; (c) di chuyển DB 2 máy; (d) `docs/costs.md` | **Đã code (gộp `main`)** | **CHƯA** *(EAS cloud build `preview` trên máy thật & di chuyển DB 2 máy là `CHƯA CHẠY`)* | `docs/costs.md` để trống mọi số tiền (`MISSING`) |

---

## 2. Việc chờ chủ dự án (theo thứ tự ưu tiên)

### Ưu tiên 1 — Chốt dữ liệu thật & quy tắc an toàn thực phẩm (`data/`, `R6`, `T03`, `T11`, `T12`, `T16`)
- **Lý do ưu tiên cao nhất:** Hiện các quy tắc an toàn thực phẩm trong `data/` đang giữ trạng thái `MISSING` theo quy tắc `R5`, nên ứng dụng **chủ động chặn bắt đầu món ăn** có bước yêu cầu an toàn; chế độ ước chừng giá hiển thị "chưa có giá" và mức "một ít / vừa / nhiều" đang `MISSING`.
- **Cần chủ dự án cung cấp & xác nhận (`source`, `confirmed_by`):**
  1. Quy tắc nhiệt độ nấu chín, bảo quản, đồ ăn thừa từ nguồn cơ quan y tế / an toàn thực phẩm (`T16`).
  2. 3 món mẫu đầy đủ (nguyên liệu, lượng, bước, thời gian, dụng cụ, dấu hiệu nhận biết `cue`) (`T03`, `T04`).
  3. Danh sách nguyên liệu chuẩn, tên gọi theo vùng miền, mã dị ứng, bảng quy đổi đơn vị (thìa, bó, nhánh, quả -> gam/ml), mức "một ít/vừa/nhiều" và giá tham khảo (`T03`, `T06`, `T10`, `T11`, `T12`).
  4. Chạy xác nhận dữ liệu sạch: `node scripts/validate-data.js --strict`.

### Ưu tiên 2 — Chốt nhà cung cấp AI thật, báo giá chi phí & hạn mức chi tiêu (`T15`, `T20b`, `T23.4`, [`docs/costs.md`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/docs/costs.md))
- **Cần chủ dự án quyết định & điền:**
  1. Chọn nhà cung cấp AI chính thức cho [`RealAiProvider.java`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/apps/backend/src/main/java/com/cook/backend/ai/RealAiProvider.java) (OpenAI / Gemini / Anthropic...), chốt `COOK_AI_MODEL`, `COOK_AI_ENDPOINT_URL`, `COOK_AI_API_KEY` và cờ `COOK_AI_ASK_ENABLED`. *(Hiện nếu gọi `RealAiProvider` khi thiếu endpoint, backend trả lỗi `AI_PROVIDER_NOT_CONFIGURED` HTTP 503, không dùng AI giả ngầm.)*
  2. Điền báo giá thật vào toàn bộ ô `MISSING` trong [`docs/costs.md`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/docs/costs.md) (VPS/Managed, tên miền, phí Google Play một lần, đơn giá Input/Output token AI) và thiết lập **Hard Monthly Spending Cap** trực tiếp trên trang quản trị nhà cung cấp AI.
  3. Soạn 10 câu hỏi mẫu, chạy thử với AI thật và đánh dấu câu trả lời sai (`T15`).

### Ưu tiên 3 — Dựng hạ tầng Backend VPS/Docker & diễn tập di chuyển CSDL (`T21`, `T23(c)` — `CHƯA CHẠY`)
- **Lý do `CHƯA CHẠY`:** Docker Desktop daemon không bật trên máy dev Windows và chưa có VPS / máy chủ PostgreSQL thứ hai.
- **Lệnh chính xác để chủ dự án chạy theo [`docs/deploy-vps.md`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/docs/deploy-vps.md):**
  ```bash
  # Trên máy 1 (VPS Ubuntu chính):
  cp deploy/.env.example deploy/.env && nano deploy/.env
  docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
  curl -fsS http://127.0.0.1:8080/health
  ./deploy/scripts/backup-db.sh

  # Chép deploy/backups/cook_backup_<TIMESTAMP>.sql.gz (+ .sha256) sang máy 2 và diễn tập khôi phục:
  docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d postgres
  ./deploy/scripts/restore-db.sh deploy/backups/cook_backup_<TIMESTAMP>.sql.gz --yes
  docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
  curl -fsS https://<DOMAIN-MAY-2>/health
  ```

### Ưu tiên 4 — Khóa cổng PR trên GitHub & gắn thẻ phát hành Docker (`T22` — `CHƯA CHẠY`)
- **Lý do `CHƯA CHẠY`:** Cần quyền quản trị GitHub Repository Settings và thao tác đẩy tag phát hành.
- **Thao tác chủ dự án thực hiện:**
  1. Vào GitHub -> **Settings -> Branches -> Add branch protection rule (`main`)**: bật **Require status checks to pass before merging** cho `Run pnpm verify` và `Run backend ./mvnw verify` *(giữ `Dependency Vulnerability Scan` ở chế độ báo cáo không chặn)*.
  2. Khi sẵn sàng phát hành Docker image backend lên GHCR:
     ```bash
     git checkout main && git pull --ff-only origin main
     git tag v0.1.0 && git push origin v0.1.0
     ```

### Ưu tiên 5 — Build APK `preview` qua EAS, đổi `API_BASE_URL` & nghiệm thu trên thiết bị Android thật (`T08`, `T09`, `T13`, `T20`, `T23(b)` — `CHƯA CHẠY` / `CHƯA NGHIỆM THU`)
- **Lý do `CHƯA CHẠY` / `CHƯA NGHIỆM THU`:** Không có `eas-cli`, chưa đăng nhập Expo/EAS và chưa có thiết bị Android vật lý *(đã kiểm chứng cục bộ đổi `API_BASE_URL` qua `expo config --json` & `expo export` thành công không sửa mã)*.
- **Lệnh chính xác để chủ dự án chạy theo [`docs/android-release.md`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/docs/android-release.md):**
  ```bash
  cd apps/mobile
  npx eas-cli login
  npx eas-cli env:create --environment preview --name API_BASE_URL --value https://<SERVER-1> --visibility plaintext --force
  npx eas-cli build --platform android --profile preview
  # Đổi sang máy chủ thứ 2 chỉ bằng biến cấu hình EAS và build lại không sửa mã (T23.2):
  npx eas-cli env:create --environment preview --name API_BASE_URL --value https://<SERVER-2> --visibility plaintext --force
  npx eas-cli build --platform android --profile preview
  ```
- **Nghiệm thu trên máy Android thật (`CHƯA NGHIỆM THU: chưa có máy thật`):** Cài APK `preview` (`adb install -r cook-assistant-preview.apk`), nấu trọn ít nhất 1 món khi tắt mạng, kiểm tra màn hình không tự tắt khi nấu (`T20b`), và điền đầy đủ bảng [`docs/timer-test-matrix.md`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/docs/timer-test-matrix.md).

### Ưu tiên 6 — Hoàn thiện định danh gói, thương hiệu & hồ sơ pháp lý trước bản `production` (`T20`, `T20.7`)
- Thay `TEMPORARY_APPLICATION_ID = "com.cook.app"` tại [`apps/mobile/app.config.ts`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/apps/mobile/app.config.ts) *(build `production` cố ý chặn nếu chưa đổi)*.
- Thay 3 ảnh tạm `apps/mobile/assets/placeholder-*.png` bằng icon & splash screen chính thức; sao lưu keystore ký phát hành tối thiểu 2 bản ngoại tuyến mã hóa; đối chiếu chính sách Google Play cho quyền `SCHEDULE_EXACT_ALARM`.
- Hoàn thiện toàn bộ trường `MISSING` trong [`docs/play/privacy-policy.skeleton.md`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/docs/play/privacy-policy.skeleton.md) và [`docs/play/data-safety.skeleton.md`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/docs/play/data-safety.skeleton.md).

### Ưu tiên 7 — Tổ chức thử kín Giai đoạn H (`H1` – `H4`, ngoài phạm vi code của Antigravity)
- Lập ngưỡng đạt/không đạt trước khi thử tại `docs/pilot-criteria.md`, tổ chức 10–20 người nấu thử bằng APK `preview`, và đối chiếu số đếm tay với kết quả [`docs/metrics.sql`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/docs/metrics.sql).

---

## 3. Quyết định kiến trúc đã chốt

- **Nguồn sự thật & Kiểm định tự động:** Schema `snake_case` theo `docs/plan.md`; mọi file trong `docs/expected/` là bất biến và khóa SHA-256 trong [`scripts/verify.js`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/scripts/verify.js). Mọi PR/push trên GitHub chạy CI bắt buộc từ [`.github/workflows/verify.yml`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/.github/workflows/verify.yml) (`pnpm verify` + `./mvnw -B verify`).
- **Quy tắc dữ liệu & Bảo mật (`R1–R5`, `T14`, `T19`, `T23`):** Không bịa dữ liệu vào `data/` hay `docs/costs.md`; không dùng AI giả ngầm (`cook.env` & `cook.ai.provider` đặt tường minh, phản hồi giả gắn `X-AI-Mock: true`); không lưu tên/dị ứng/câu hỏi/câu trả lời vào telemetry hoặc `ai_usage_log`; không viết cứng khóa/mật khẩu/URL máy chủ trong code hay YAML (kiểm toán tự động bởi [`scripts/scan-secrets.py`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/scripts/scan-secrets.py)).
- **Chiến lược triển khai:** VPS tự quản Ubuntu + Docker Compose + Caddy HTTPS (`T21.7`) là đường chính, vẫn giữ phương án Managed (`T21.8`). `applicationId` tạm `com.cook.app` chỉ khai báo duy nhất một nơi tại [`apps/mobile/app.config.ts`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/apps/mobile/app.config.ts).
