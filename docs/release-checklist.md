# Danh sách kiểm tra trước khi phát hành (Release Checklist — Khung T20, hoàn thiện ở T22.4)

> **TRẠNG THÁI HIỆN TẠI (cuối T20):** Tài liệu mới là **khung khởi tạo ở T20**; toàn bộ mục đóng gói backend Docker (T21), CI/CD đầy đủ (T22) và nghiệm thu máy thật sẽ được cập nhật hoàn thiện ở T22.4.

---

## 1. Định danh gói, Ký số & Pháp lý Play Store (T20)

- [ ] applicationId chính thức đã chốt trước lần upload đầu lên Play *(Hiện vẫn là giá trị tạm trong `apps/mobile/app.config.ts`; build `production` sẽ tự chặn nếu chưa đổi).*
- [ ] Bộ biểu tượng thật & màn hình khởi động chính thức đã thay cho các tệp `placeholder-*.png` (`MISSING`).
- [ ] Khóa ký phát hành (EAS-managed hoặc self-managed keystore) đã được thiết lập và **đã sao lưu ít nhất 2 bản ngoại tuyến độc lập**.
- [ ] Quyền Android trong bản build cuối cùng không chứa quyền thừa; đã đối chiếu chính sách Google Play cho quyền báo thức chính xác (`SCHEDULE_EXACT_ALARM`, `CẦN XÁC MINH`).
- [ ] Chính sách quyền riêng tư công khai (`docs/play/privacy-policy.skeleton.md` -> bản chính thức) đã có URL công khai (`MISSING`).
- [ ] Biểu mẫu Google Play Data Safety (`docs/play/data-safety.skeleton.md`) đã điền khớp kiểm kê dữ liệu thực tế (`MISSING`).

## 2. Cấu hình môi trường & Kiểm thử chất lượng (T20 - T22)

- [ ] Biến môi trường `API_BASE_URL` cho `preview` (staging) và `production` (`https://` bắt buộc) đã được cấu hình trên EAS (`MISSING`).
- [ ] Toàn bộ test tự động xanh: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `node scripts/validate-data.js --strict`, `./mvnw test` / `verify`, `pnpm verify`.
- [ ] Kết quả `validate-data --strict` không còn giá trị `MISSING` ở mọi món ở trạng thái `reviewed`/`published`.
- [ ] Quét bí mật (`python scripts/scan-secrets.py`) sạch 100% lịch sử Git và working tree; không có địa chỉ máy chủ viết cứng trong mã nguồn app.
- [ ] Bundle `production` đã xác minh loại bỏ hoàn toàn `console.log`, `DEV_DATA_BUNDLE` và công cụ debug.
- [ ] Cài đặt và chạy thử trên thiết bị Android thật (`CHƯA NGHIỆM THU: chưa có máy thật`):
  - [ ] Cài APK `preview` lên máy Android thật.
  - [ ] Nấu trọn một món trên máy thật.
  - [ ] Gọi được backend staging thật qua HTTPS.
  - [ ] Điền đầy đủ ma trận `docs/timer-test-matrix.md` cho các máy thử nghiệm.

## 3. Hạ tầng Backend & Vận hành (Khung chờ T21 & T22.4)

- [ ] *(T21 — Chưa làm)* Đóng gói Docker multi-stage & kiểm tra `GET /health` qua Docker Compose trên máy sạch theo `docs/deploy-vps.md`.
- [ ] *(T21 — Chưa làm)* Cấu hình biến môi trường production (CSDL, `COOK_AI_API_KEY`, CORS, rate limit) và kết nối HTTP thật cho `RealAiProvider` (lưu ý tồn đọng từ T15).
- [ ] *(T21 — Chưa làm)* Kiểm thử sao lưu (`pg_dump`) và phục hồi CSDL PostgreSQL mới nhất trước khi phát hành.
- [ ] *(T22 — Chưa làm)* Hoàn thiện CI/CD GitHub Actions cho backend Java + TypeScript, quét lỗ hổng phụ thuộc và khóa quy tắc nhánh bảo vệ.

