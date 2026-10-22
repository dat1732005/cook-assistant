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

### 2.9. Tái cấu trúc `docs/field-names.md` thành hai bảng (A & B) và kiểm thử đồng bộ 100%
- **Vấn đề trước đây:** Tài liệu liệt kê chung, có một số khóa sai lệch lịch sử (`duration_seconds`, `dependencies`, `visual_cue`).
- **Thực tế triển khai:**
  - Tách toàn bộ 10 thực thể thành 2 bảng rõ rệt: (A) Khóa nguyên văn từ JSON mẫu hoặc bảng CSDL của `docs/plan.md` (ghi kèm số dòng từ lệnh thật); (B) Khóa do dự án đặt và mở rộng kỹ thuật (R2/R3).
  - Loại bỏ hoàn toàn các khóa sai lệch cũ: Chuẩn hóa thành `seconds`, `after`, `cue`.
  - Bổ sung unit test tự động đọc trực tiếp `docs/field-names.md`, trích xuất các khóa trong cả bảng A và B, đối chiếu 1-1 với `shape` của 10 Zod schemas tương ứng. Nếu tài liệu thừa/thiếu khóa so với schema, test lập tức fail đỏ (có test case chứng minh).

### 2.10. Bổ sung quy tắc R3 (`source`, `confirmed_by`) và R2 (`missing_fields`)
- **Mục tiêu:** Đảm bảo nguồn dữ liệu y tế/khoa học chính xác (R3) và ghi nhận trường còn thiếu (R2), phục vụ quy trình biên tập và kiểm duyệt.
- **Thực tế triển khai:**
  - Bổ sung `source: z.string().optional()` và `confirmed_by: z.string().optional()` vào 4 thực thể cốt lõi: `recipe`, `ingredient`, `storage_rule`, `safety_rule`.
  - Bổ sung `missing_fields: z.array(z.string()).default([])` vào 4 thực thể trên. Giữ nguyên `RecipeStatusEnum` (`draft`, `reviewed`, `published`).
  - **Quy tắc kiểm duyệt bắt buộc (`superRefine`):** Đối với món `recipe` ở trạng thái `reviewed` hoặc `published`, bắt buộc `missing_fields` phải rỗng (`[]`), đồng thời `source` và `confirmed_by` phải được điền (không được rỗng hoặc undefined). Món `draft` được phép thiếu.

### 2.11. Nguyên tắc an toàn dị ứng cho nguyên liệu (`ingredient.allergen_codes`)
- **Vấn đề an toàn:** Tránh tình trạng nguyên liệu chưa được xác minh thông tin dị ứng lại bị tự động coi là không có dị ứng do nhận giá trị mặc định `[]`.
- **Thực tế triển khai:**
  - Bỏ giá trị mặc định `default([])` ở `ingredient.allergen_codes`.
  - Trường `allergen_codes` bắt buộc phải được khai báo tường minh: là mảng `AllergenCode[]` hoặc `null`.
  - Chỉ cho phép `null` khi và chỉ khi mảng `missing_fields` chứa rõ ràng chuỗi `"allergen_codes"`.
  - Nguyên liệu có `allergen_codes: null` không bao giờ được coi là an toàn hay không có dị ứng (các bộ lọc an toàn dị ứng sẽ chặn hoặc phát cảnh báo rủi ro).

---

## 3. Trạng thái hiện tại của hệ thống (Tính đến hết T02-FIX phần 7)

- **Test Suite (`packages/core`):** 87 ca kiểm thử tự động pass 100%.
  - Bộ test đồng bộ 100% giữa `docs/field-names.md` và 10 Zod schemas (kèm test chứng minh fail đỏ khi làm lệch khóa).
  - Bộ test cho quy tắc R2 và R3 trên `RecipeSchema` (3 ca hợp lệ, 3 ca sai).
  - Bộ test an toàn dị ứng trên `IngredientSchema` (3 ca hợp lệ, 3 ca sai, test logic cảnh báo khi null).
  - Khối JSON món "Trứng chiên cà chua" đọc trực tiếp từ `docs/plan.md`.
  - 15 ca sai bắt buộc của công thức và đầy đủ ca kiểm thử cho toàn bộ 10 thực thể.
- **Kiểm tra tĩnh & Mã nguồn:**
  - `build` thành công, sạch sẽ (`tsc --project tsconfig.build.json`).
  - `typecheck` không có lỗi trên toàn bộ workspace.
  - `eslint` không có cảnh báo/lỗi.
  - `scan-secrets.py` quét toàn bộ lịch sử: sạch 100%, không lọt khóa/token/file nhạy cảm.
- **Tiến độ tổng thể:** Hoàn thành toàn diện nhiệm vụ T01 và T02-FIX (phần 1 đến phần 7). **Chưa thực hiện T03.**
