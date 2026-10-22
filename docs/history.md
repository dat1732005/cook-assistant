# Lịch sử thực hiện dự án và các điểm thay đổi so với kế hoạch (docs/history.md)

Tài liệu này ghi lại toàn bộ tiến độ, lịch sử các phiên làm việc từ T01 đến T02 (các phần 1 đến 6), các quyết định kỹ thuật, và **danh sách chi tiết các điểm thêm hoặc thay đổi so với bản kế hoạch gốc** ([`docs/plan.md`](plan.md)).

---

## 1. Dòng thời gian và các mốc thực hiện (Timeline & Commits)

| Mã Task / Phiên | Commit Git | Ngày thực hiện | Nội dung tóm tắt | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| **T01** | `bb63fe3` | 20/10/2026 | Khởi tạo cấu trúc monorepo: `packages/core` (TS), `apps/mobile` (Expo React Native), `apps/backend` (Java 21 Spring Boot), cấu hình pnpm workspace, TypeScript strict, ESLint, Prettier, CI scripts. | **ĐÃ XONG** |
| **T02 (bản đầu)** | `1d80c3b` | 20/10/2026 | Dựng các kiểu dữ liệu dùng chung (`Ingredient`, `Recipe`, `PantryItem`, `CookSession`...), bộ quy đổi đơn vị cơ bản, schema Zod và bộ test 34 ca. | **ĐÃ XONG** |
| **T02-FIX (phần 1)** | `170271b` | 20/10/2026 | Tách dữ liệu fixture khỏi build prod (R3), ghi chú nguồn tài liệu quy đổi, thêm test muỗng kèm chất rắn, bổ sung cảnh báo dị ứng tạm thời. | **ĐÃ XONG** |
| **T02-FIX (phần 2)** | `d735922` | 21/10/2026 | Nâng cấp Spring Boot lên 4.1.0; chuyển đơn vị `chén` sang trạng thái `MISSING` (R2); bổ sung chú thích mock data. | **ĐÃ XONG** |
| **T02-FIX (phần 3)** | `3975475` | 22/10/2026 | Siết chặt bảo mật `.gitignore` chặn toàn bộ file nhạy cảm (`.env*`, `*.pem`, `*.key`, `*.keystore`); viết công cụ `scripts/scan-secrets.py` quét toàn bộ lịch sử Git. | **ĐÃ XONG** |
| **T02-FIX (phần 4)** | `919f443`<br>`8bd18b5` | 22/10/2026 | Cho phép ngoại lệ `!.env.example`; nạp tài liệu `docs/plan.md` chính thức; chuyển `RecipeSchema` sang chuẩn `snake_case` nguyên văn; xác thực thành công JSON mẫu món "Trứng chiên cà chua". | **ĐÃ XONG** |
| **T02-FIX (phần 5)** | `3bfafb2` | 22/10/2026 | Chuyển nốt 5 thực thể (`ingredient`, `pantry_item`, `pantry_event`, `cook_session`, `user_profile`, `storage_rule`) sang đúng khóa của `plan.md`; đọc động JSON mẫu từ `plan.md`; tạo `docs/field-names.md`. | **ĐÃ XONG** |
| **T02-FIX (phần 6)** | `e082fd5` | 22/10/2026 | Chuyển `ingredient.allergen_code` thành `allergen_codes` (mảng danh sách để tránh bỏ sót dị ứng); bổ sung mục enum tiếng Anh vào `docs/field-names.md`; 64 unit tests pass 100%. | **ĐÃ XONG** |

---

## 2. Chi tiết các điểm thêm, sửa đổi hoặc làm khác so với bản kế hoạch gốc (`docs/plan.md`)

Trong quá trình triển khai mã nguồn thực tế, một số điểm được điều chỉnh hoặc làm rõ để đảm bảo tính an toàn, tính nhất quán kiểu dữ liệu và độ khả thi kỹ thuật:

### 2.1. Về nguyên tắc đặt tên khóa (Naming Convention)
- **Kế hoạch:** Mục "Schema cơ sở dữ liệu chi tiết" ([`docs/plan.md:L168-L190`](plan.md#L168-L190)) có chỗ ghi nguyên khóa tiếng Anh (ví dụ `id`, `slug`, `ingredient_id`, `recipe_id`, `pantry_item_id`, `cook_session_id`, `delta`, `endsAt`), nhưng có nhiều chỗ chỉ mô tả bằng tiếng Việt (ví dụ: `tên chuẩn`, `số phần gốc`, `ngày thêm`, `hạn dùng`...).
- **Thực tế triển khai:**
  - Giữ nguyên văn 100% các khóa tiếng Anh và giá trị liệt kê có sẵn trong kế hoạch.
  - Các trường chỉ có mô tả tiếng Việt: Dự án quy ước tên tiếng Anh chuẩn `snake_case` và liệt kê toàn bộ trong [`docs/field-names.md`](field-names.md) (được đánh dấu là `TÊN DO DỰ ÁN ĐẶT` thay vì "Khớp").

### 2.2. Trường `endsAt` trong `cook_session.running_timers`
- **Kế hoạch (dòng 181):** Ghi rõ: `"hẹn giờ đang chạy (JSON, có endsAt)"`.
- **Thực tế triển khai:** Dự án **giữ nguyên định dạng `camelCase` (`endsAt`)** trong schema và TypeScript interface thay vì đổi sang `ends_at`, bám sát tuyệt đối nguyên văn yêu cầu kế hoạch.

### 2.3. Chuyển `ingredient.allergen_code` sang `allergen_codes` (Mảng danh sách)
- **Kế hoạch (dòng 175):** Ghi là `"mã dị ứng"` (số ít).
- **Thực tế triển khai:** Đổi thành `allergen_codes: z.array(AllergenCodeEnum).default([])`.
- **Lý do thay đổi:** Đảm bảo an toàn sức khỏe tuyệt đối. Một nguyên liệu thực phẩm (hoặc sốt pha chế) có thể chứa đồng thời nhiều dị nguyên (ví dụ: sốt đậu phộng mè chứa cả đậu phộng và hạt cây; sốt mayonnaise chứa cả trứng và đậu nành). Nếu chỉ lưu 1 mã duy nhất thì hệ thống sẽ bỏ sót cảnh báo dị ứng nguy hiểm cho người dùng.

### 2.4. Chuẩn hóa trạng thái phiên nấu `COOK_SESSION_STATUSES`
- **Ban đầu:** Dự án tạm định nghĩa các trạng thái: `preparing`, `cooking`, `paused`, `completed`, `cancelled`.
- **Thực tế sửa đổi (T02-FIX phần 5):** Rút gọn và chuẩn hóa về đúng 3 trạng thái duy nhất được quy định trong kế hoạch (dòng 181):
  ```ts
  COOK_SESSION_STATUSES = ['cooking', 'done', 'abandoned']
  ```

### 2.5. Phân tách `storage_rule` và `safety_rule`
- **Kế hoạch:**
  - Bảng CSDL `storage_rule` (dòng 183): Quản lý thời gian bảo quản (ngăn mát, ngăn đá, phòng) từ nguồn y tế.
  - Quy tắc an toàn: Đề cập qua trường `mã quy tắc an toàn` ở bước nấu (dòng 178) và mục cảnh báo kiểm tra nhiệt độ lõi/nhiễm khuẩn chéo (dòng 236).
- **Thực tế triển khai:** Tách thành 2 schema riêng biệt:
  - `StorageRuleSchema`: Đúng các cột của bảng `storage_rule` (dòng 183).
  - `SafetyRuleSchema`: Định nghĩa các quy tắc an toàn thao tác (gắn với `recipe_step.safety_rule`).

### 2.6. Quy ước các giá trị liệt kê tiếng Anh cho trường tiếng Việt
Kế hoạch mô tả bằng tiếng Việt, dự án đã chuẩn hóa sang enum tiếng Anh `snake_case` (ghi tại mục 10 của `docs/field-names.md`):
- `storage_rule.state`: `tươi`, `đã mở`, `đã nấu` $\rightarrow$ `'fresh'`, `'opened'`, `'cooked'`.
- `storage_rule.location`: `ngăn mát`, `ngăn đá`, `nhiệt độ phòng` $\rightarrow$ `'fridge'`, `'freezer'`, `'room_temperature'`.
- `cook_session.optimization_mode`: `tiêu chí tối ưu` $\rightarrow$ `'fastest'`, `'fewest_tools'`.

### 2.7. Xử lý đơn vị `chén` theo quy tắc R2 (`MISSING`)
- **Kế hoạch (dòng 358):** Mọi lượng quy về đơn vị gốc (`g`, `ml`, `cái`).
- **Thực tế triển khai:** Đơn vị đời thường `thìa cà phê` (5 ml), `thìa canh` (15 ml) có quy chuẩn thể tích rõ ràng. Riêng đơn vị `chén` thay đổi rất lớn tùy theo vùng miền/loại chén (chén cơm ~180-200ml, cup phương Tây ~240-250ml) và chưa có nguồn y tế chính thức xác nhận. Theo quy tắc R2 (`docs/tasks.md`), hệ thống đánh dấu quy đổi đơn vị `chén` là `MISSING` và ném lỗi rõ ràng thay vì tự đoán số.

### 2.8. Nâng cấp phiên bản hạ tầng Backend
- **Kế hoạch ban đầu:** Dự kiến Spring Boot 3.x.
- **Thực tế triển khai:** Nâng cấp cấu hình Maven Wrapper sử dụng Spring Boot `4.1.0` (kèm Java 21 LTS) theo chỉ đạo kỹ thuật để đón đầu chu kỳ hỗ trợ dài hạn.

---

## 3. Trạng thái hiện tại của hệ thống (Tính đến hết T02-FIX phần 6)

- **Test Suite (`packages/core`):** 64 ca kiểm thử tự động pass 100%.
  - Tự động nạp trực tiếp khối JSON món "Trứng chiên cà chua" từ file `docs/plan.md`.
  - Có test chứng minh nếu sửa sai khối JSON thì test sẽ lập tức đỏ.
  - Đầy đủ ca kiểm thử hợp lệ và ca sai cho tất cả 7 thực thể.
- **Kiểm tra tĩnh & Mã nguồn:**
  - `build` thành công, sạch sẽ (`tsc --project tsconfig.build.json`).
  - `typecheck` không có lỗi trên toàn bộ workspace.
  - `eslint` không có cảnh báo/lỗi.
  - `scan-secrets.py` quét toàn bộ lịch sử 8 commits: sạch 100%, không lọt khóa/token/file nhạy cảm.
- **Tiến độ tổng thể:** Hoàn thành toàn diện nhiệm vụ T01 và T02-FIX. **Chưa thực hiện T03.**
