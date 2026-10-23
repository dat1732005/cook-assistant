# Trạng thái dự án Trợ lý nấu ăn (docs/STATUS.md)

*Tài liệu này theo dõi tiến độ tổng thể, trạng thái từng task, các quyết định và việc cần làm. Cập nhật vào cuối mỗi task.*

---

## 1. Bảng trạng thái các task (T01 – T06)

| Task | Tên / Nội dung chính | Trạng thái | Nhánh | Commit |
| :--- | :--- | :--- | :--- | :--- |
| **T01** | Cấu trúc Monorepo, pnpm workspace, cấu hình TypeScript strict, ESLint, Prettier, Spring Boot 4.1.0 backend | **ĐÃ XONG** | `main` | `bb63fe3` |
| **T02** | Schema dữ liệu Zod, chuẩn hóa tên trường `snake_case` bám sát `docs/plan.md`, cơ chế R2/R3, kiểm thử đối chiếu `docs/field-names.md` | **ĐÃ XONG** | `main` | `4d35368`<br>*(nhánh `task/T02-fix` tại `e082fd5`)* |
| **T03** | Khung dữ liệu rỗng chuẩn, script `scripts/validate-data.js` (kiểm tra toàn vẹn, cờ `--strict`, cờ `--report-missing`) | **ĐÃ XONG** | `main` | `8e88863`<br>*(nhánh `task/T03` tại `3ee6904`)* |
| **T04** | Thuật toán Scheduler: `plan()`, `replan()`, `checkManualStart()`, kiểm tra chu trình, bám sát `docs/expected/T04.md` (123 tests) | **ĐÃ XONG** | `main` | `4746bd2`<br>*(nhánh `task/T04` tại `aa40aba`)* |
| **T05** | Tầng CSDL SQLite (`SqlDriver` cho Node & Expo SQLite), `MigrationRunner`, đóng gói dữ liệu `bundle-data.js`, `RecipeRepo` lọc an toàn dị ứng (43 tests) | **ĐÃ XONG** | `main` | `7fce580`<br>*(nhánh `task/T05` tại `1836929`)* |
| **T06** | Màn hình Chào mừng (lưu SQLite `user_profile`), Trang chủ (lọc thời gian/dị ứng), Chi tiết món (pure scaling đơn vị đời thường), tập trung chuỗi chữ (28 tests) | **ĐÃ XONG** *(Chờ duyệt)* | `task/T06` | `e87fa3d` |

---

## 2. Việc kế tiếp
1. **Nghiệm thu T06 & T-INFRA:** Chủ dự án kiểm tra báo cáo T06 và T-INFRA, duyệt gộp các nhánh vào `main`.
2. **Triển khai T07:** Xây dựng `SessionService` quản lý trạng thái phiên nấu ăn cục bộ trong SQLite (`cook_session`, `cook_step_state`, lưu bước đang nấu, bắt đầu, tạm dừng, hoàn thành).

---

## 3. Đang chờ dữ liệu từ chủ dự án
- **Phê duyệt báo cáo T06:** Đợi chủ dự án duyệt nghiệm thu T06 và gộp nhánh `task/T06` vào `main`.
- **Duyệt phương án bộ lọc thời gian:** Xác nhận quy tắc lọc thời gian khi món ăn bị thiếu hoặc `null` giá trị `total_minutes`.
- **Dữ liệu thật công thức & nguyên liệu:** Bộ dữ liệu chính thức do chuyên gia/người biết nấu xác nhận (`source`, `confirmed_by`) để nạp vào `data/recipes/` theo quy tắc R1/R3.

---

## 4. Quyết định đã chốt
- **Nguồn sự thật:** JSON mẫu "Trứng chiên cà chua" trong `docs/plan.md` là nguồn sự thật cho tên trường (`snake_case`) của schema và CSDL.
- **Hợp đồng kỳ vọng bất biến:** Các file trong `docs/expected/` do chủ dự án cung cấp trước khi làm task; Agent không được sửa đổi, kiểm tra mã băm SHA-256 đối chiếu toàn vẹn tự động.
- **Quy tắc dữ liệu R1–R5:** Tuyệt đối không tự bịa dữ liệu vào `data/`. Thư mục `data/` giữ nguyên trạng thái rỗng sạch (đạt chuẩn `validate-data --strict`) cho tới khi có dữ liệu thật.
- **Tách biệt dữ liệu giả lập:** Mọi dữ liệu thử nghiệm đặt trong `fixtures/`, đánh dấu `"synthetic": true`, chỉ nạp trong môi trường dev (`__DEV__`), tuyệt đối không đóng gói vào bản release sản phẩm (`production`).
- **Tập trung chuỗi chữ giao diện:** 100% chuỗi chữ tiếng Việt của giao diện di động đặt tập trung tại `apps/mobile/src/constants/strings.ts`.

---

## 5. Câu hỏi mở
- **Xử lý món thiếu `total_minutes`:** Khi người dùng lọc thời gian `max_minutes`, món thiếu `total_minutes` nên bị ẩn đi (an toàn trải nghiệm) hay giữ lại (không chặn món)?
- **Cơ chế cập nhật dữ liệu OTA / Backend:** Phương án đồng bộ các phiên bản công thức mới từ backend vào thiết bị di động khi có mạng.
