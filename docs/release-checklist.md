# Danh sách kiểm tra trước khi phát hành (Release Checklist — Hoàn thiện T22.4)

> **TRẠNG THÁI HIỆN TẠI (T22.4):** Đã hoàn thiện quy trình CI/CD GitHub Actions (`pnpm verify` + `./mvnw verify`), đóng gói Docker backend theo thẻ phiên bản và quét lỗ hổng phụ thuộc không chặn. Các mục nghiệm thu thực tế trên VPS/Docker và thiết bị Android thật được giữ nguyên ở trạng thái chờ chủ dự án chạy.

---

## 1. CI/CD, Chất lượng mã & Kiểm định tự động (T22, T23.1)

- [ ] **CI trên Pull Request XANH 100% (`Verify CI`):** cả hai job `Run pnpm verify` và `Run backend ./mvnw verify` (`.github/workflows/verify.yml`) đều đạt; tuyệt đối không gộp PR khi bất kỳ job nào báo đỏ.
- [ ] **Branch Protection Rule trên `main`:** đã bật **Require status checks to pass before merging** trên GitHub cho `Run pnpm verify` và `Run backend ./mvnw verify` *(chỉ giữ workflow quét lỗ hổng `security-scan.yml` ở chế độ báo cáo, không chặn)*.
- [ ] **Toàn bộ lệnh kiểm định cục bộ xanh:** `pnpm verify` (8/8 bước: build `@cook/core`, `pnpm test`, `typecheck`, `ESLint`, `validate-data --strict`, `scan-secrets`, 9 hash `docs/expected/`, `expo export`) và `./mvnw verify` (backend JUnit/Flyway).
- [ ] **Quét bí mật & cấu hình cứng sạch 100% (T23.1):** `python scripts/scan-secrets.py` không phát hiện khóa, mật khẩu, token hoặc địa chỉ máy chủ viết cứng trong toàn bộ lịch sử Git, `application*.yml`, `docker-compose*.yml` và mã app.
- [ ] **Báo cáo lỗ hổng phụ thuộc (T22.3):** đã rà soát tóm tắt từ `.github/workflows/security-scan.yml` (`pnpm audit` + `Trivy FS`) và Dependabot (`.github/dependabot.yml`), không tồn tại lỗ hổng nghiêm trọng chưa có phương án xử lý.
- [ ] **Bundle `production` sạch debug:** bản xuất Android đã loại bỏ hoàn toàn `console.log`, `DEV_DATA_BUNDLE` và công cụ debug (`apps/mobile/babel.config.js`).

## 2. Dữ liệu thật & An toàn thực phẩm (R1–R6, T03, T16)

- [ ] **Dữ liệu đã kiểm duyệt (`validate-data --strict`):** mọi món ở trạng thái `reviewed`/`published` không còn trường `MISSING`, có đủ `source` và `confirmed_by` do chủ dự án điền (`MISSING`).
- [ ] **Quy tắc an toàn thực phẩm & bảo quản:** các quy tắc trong `data/safety_rules.json` (nhiệt độ chín gia cầm, hải sản, đồ ăn thừa, hết hạn) đã điền nguồn y tế chính thức và không còn `MISSING` gây chặn nấu món.
- [ ] **Bảng giá tham khảo & quy đổi đơn vị:** đã cập nhật nguồn và ngày lấy giá theo chuẩn dữ liệu (hoặc giữ chế độ hiển thị "chưa có giá" nếu chưa công bố bảng giá).

## 3. Định danh gói Android, Ký số & Hồ sơ Google Play (T20)

- [ ] **`applicationId` chính thức:** đã thay hằng số tạm `com.cook.app` trong `apps/mobile/app.config.ts` trước lần tải đầu tiên lên Play Store *(môi trường `production` cố ý chặn nếu chưa thay)*.
- [ ] **Bộ nhận diện thương hiệu thật:** đã thay các tệp `apps/mobile/assets/placeholder-*.png` bằng icon và splash screen chính thức (`MISSING`).
- [ ] **Keystore ký phát hành:** đã thiết lập khóa ký phát hành (`eas credentials` hoặc tự quản theo `docs/android-release.md`) và **đã sao lưu tối thiểu 2 bản ngoại tuyến được mã hóa độc lập**.
- [ ] **Quyền Android tối thiểu:** đã kiểm tra danh sách quyền không chứa quyền thừa; đã đối chiếu chính sách Google Play hiện hành cho quyền báo thức chính xác `SCHEDULE_EXACT_ALARM` (`CẦN XÁC MINH`).
- [ ] **Pháp lý & Google Play:** hoàn tất URL công khai cho Chính sách quyền riêng tư (`docs/play/privacy-policy.skeleton.md`) và biểu mẫu Data Safety khớp kiểm kê dữ liệu (`docs/play/data-safety.skeleton.md`) (`MISSING`).

## 4. Bản build EAS & Nghiệm thu trên Thiết bị Android thật (T08, T09, T20, T23.2)

- [ ] **Biến môi trường EAS `API_BASE_URL`:** đã cấu hình trên EAS cho `preview` (staging) và `production` (`https://` bắt buộc); **đã thử đổi URL chỉ bằng biến EAS và build lại `preview` không sửa mã (T23.2)**.
- [ ] **Thử nghiệm trên máy Android vật lý thật (`CHƯA NGHIỆM THU: chưa có máy thật`):**
  - [ ] Cài đặt tệp APK `preview` lên máy Android thật theo `docs/android-release.md`.
  - [ ] Nấu trọn ít nhất 1 món (bao gồm mất mạng giữa chừng khi hẹn giờ đang chạy).
  - [ ] Gọi thành công backend `staging` qua HTTPS (`/v1/ai/substitute`, `/v1/ai/feedback`, `/v1/events`).
  - [ ] Điền đầy đủ ma trận thực nghiệm **`docs/timer-test-matrix.md`** (`KB-01` đến `KB-07` trên các dòng máy mục tiêu).

## 5. Hạ tầng Backend Docker, Biến Production & Sao lưu CSDL (T21, T22.2, T23.3, T23.4)

- [ ] **Ảnh Docker backend theo thẻ phát hành (T22.2):** đã gắn thẻ `git tag vX.Y.Z` và xác nhận workflow `.github/workflows/docker-release.yml` dựng & đẩy ảnh `ghcr.io/<owner>/<repo>-backend` thành công (hoặc dựng tại VPS bằng `docker compose up -d --build`).
- [ ] **Đầy đủ biến môi trường `production` (`deploy/.env` hoặc PaaS Secrets):**
  - [ ] Kết nối PostgreSQL (`POSTGRES_*` trên VPS hoặc `SPRING_DATASOURCE_URL` kèm `?sslmode=require` trên Managed DB).
  - [ ] `DEVICE_SALT` ngẫu nhiên 64 ký tự hex (`openssl rand -hex 32`), `COOK_ENV=production`, `COOK_LOG_LEVEL=INFO`.
  - [ ] Nhà cung cấp AI thật: `COOK_AI_PROVIDER=real`, đã chốt nhà cung cấp & đặt `COOK_AI_API_KEY`, `COOK_AI_ENDPOINT_URL`, `COOK_AI_MODEL`, `COOK_AI_ASK_ENABLED`, `COOK_AI_TIMEOUT_MS` *(tồn đọng chờ chủ dự án theo `docs/STATUS.md`)*.
  - [ ] Bảo mật mạng & hạn mức: `COOK_RATE_LIMIT_LIMIT`, `COOK_RATE_LIMIT_WINDOW_SECONDS`, `COOK_CORS_ALLOWED_ORIGINS`, `APP_DOMAIN` (Caddy HTTPS trên VPS).
- [ ] **Kiểm soát chi phí AI & Ngân sách (`docs/costs.md`, T23.4):** đã đặt hạn mức chi tiêu tối đa (hard cap) và cảnh báo ngân sách trực tiếp trên trang quản trị của nhà cung cấp AI.
- [ ] **Kiểm tra vận hành trên máy chủ đích:** container backend chạy bằng user không phải `root`, Flyway migration áp dụng sạch, log ra `STDOUT`, `curl -fsS https://<APP_DOMAIN>/health` trả HTTP `200` với `{"status":"UP","database":"UP"}`.
- [ ] **Sao lưu CSDL mới nhất & Diễn tập di chuyển/khôi phục (T23.3):** đã tạo bản sao lưu `pg_dump` mới nhất bằng `./deploy/scripts/backup-db.sh` (hoặc `--external`), kiểm tra checksum `.sha256`, và **đã khôi phục thử sang máy/CSDL sạch thành công** bằng `./deploy/scripts/restore-db.sh`.
- [ ] **Kế hoạch quay lui (Rollback):** đã sẵn sàng lệnh quay lui phiên bản & CSDL theo `docs/deploy-vps.md` Bước 10 (hoặc Rollback image trên PaaS theo `docs/deploy-managed.md`).

---

## 6. Cổng quyết định cuối cùng (`GO / NO-GO`)

- [ ] Toàn bộ mục **Cổng chặn (Sections 1–5)** đã được xác nhận đạt, mọi mục `MISSING` và `CHƯA NGHIỆM THU` đã xử lý xong.
- **Người phê duyệt phát hành:** `______________________` · **Ngày:** `____-__-__` · **Thẻ phiên bản (`vX.Y.Z`):** `________`
