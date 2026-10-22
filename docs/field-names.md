# Danh mục tên trường và giá trị liệt kê do dự án đặt (docs/field-names.md)

Tài liệu này ghi nhận mọi tên trường và giá trị liệt kê (enum values) tiếng Anh `snake_case` do dự án tự quy ước khi kế hoạch sản phẩm ([docs/plan.md](plan.md), mục "Schema cơ sở dữ liệu chi tiết" dòng 168-190) chỉ ghi bằng tiếng Việt, không ghi nguyên khóa.

Theo nguyên tắc của dự án:
- Chỗ nào kế hoạch ghi nguyên khóa tiếng Anh (ví dụ: `id`, `slug`, `ingredient_id`, `recipe_id`, `pantry_item_id`, `cook_session_id`, `delta`, `endsAt`) hoặc giá trị liệt kê cụ thể (ví dụ: `g|ml|cái`, `manual|cook|shopping|photo`, `cook|adjust|discard|buy`, `cooking|done|abandoned`) thì giữ đúng nguyên văn.
- Chỗ nào kế hoạch chỉ ghi tiếng Việt thì dự án quy ước tên trường tiếng Anh `snake_case` (hoặc `camelCase` như `endsAt` khi kế hoạch chỉ định rõ), liệt kê đầy đủ tại bảng bên dưới kèm mô tả gốc.
- Trong mọi bảng đối chiếu, các trường này được đánh dấu trạng thái là **`TÊN DO DỰ ÁN ĐẶT`** (không ghi "Khớp").

---

## 1. Thực thể `recipe` (Công thức món ăn - dòng 176)

| Tên trường dự án đặt | Kiểu dữ liệu / Quy ước | Tên và mô tả tiếng Việt trong docs/plan.md (dòng 176) |
| --- | --- | --- |
| `name` | `string` (min 1) | `tên` (tên món ăn hiển thị) |
| `servings_base` | `number` (int, >= 1) | `số phần gốc` (số suất ăn quy chuẩn khi biên soạn công thức) |
| `total_minutes` | `number` (non-negative) | `tổng phút` (tổng thời gian hoàn thành món ăn) |
| `difficulty` | `number` (1, 2, 3) | `độ khó (1-3)` |
| `tags` | `string[]` | `thẻ (kho, xào, canh...)` |
| `equipment` | `string[]` | `dụng cụ` (danh sách dụng cụ bếp cần dùng) |
| `reviewer` | `string` (optional) | `người kiểm duyệt` (chuyên gia ẩm thực thẩm định món) |
| `reviewed_at` | `string` (ISO/date, optional) | `ngày kiểm duyệt` |
| `version` | `number` (int, >= 1) | `phiên bản` (số hiệu phiên bản công thức, tăng khi sửa) |

---

## 2. Thực thể `recipe_ingredient` (Nguyên liệu trong công thức - dòng 177)

| Tên trường dự án đặt | Kiểu dữ liệu / Quy ước | Tên và mô tả tiếng Việt trong docs/plan.md (dòng 177) |
| --- | --- | --- |
| `qty` | `number` (positive) | `lượng` (định lượng cho số phần gốc) |
| `unit` | `string` (min 1) | `đơn vị` (đơn vị đời thường: thìa, quả, nhánh...) |
| `amount_note` | `string` (optional) | `ghi chú lượng ("vừa ăn")` |
| `optional` | `boolean` (default false) | `tùy chọn (đúng/sai)` (có thể nấu mà không có nguyên liệu này) |
| `group` | `string` (optional) | `nhóm (nước ướp, nước sốt...)` |

---

## 3. Thực thể `recipe_step` (Bước thực hiện công thức - dòng 178)

| Tên trường dự án đặt | Kiểu dữ liệu / Quy ước | Tên và mô tả tiếng Việt trong docs/plan.md (dòng 178) |
| --- | --- | --- |
| `order` | `number` (int, >= 1) | `thứ tự` (thứ tự bước trong quy trình nấu) |
| `title` | `string` (min 1) | `tiêu đề` (tiêu đề ngắn gọn của bước) |
| `text` | `string` (min 1) | `nội dung` (nội dung hướng dẫn chi tiết) |
| `duration_seconds` | `number` (non-negative) | `thời lượng giây` (thời gian ước tính thực hiện bước) |
| `dependencies` | `string[]` | `phụ thuộc (danh sách id bước)` (các bước phải xong trước) |
| `equipment` | `string[]` | `tài nguyên cần (dụng cụ)` (chảo, nồi, dao thớt cần cho bước này) |
| `visual_cue` | `string` (optional) | `dấu hiệu nhận biết ("mặt dưới vàng nhẹ")` |
| `target_temperature` | `number` (optional) | `nhiệt độ mục tiêu` (nhiệt độ lò nướng/dầu/thịt) |
| `safety_rule` | `string` (optional) | `mã quy tắc an toàn` (tham chiếu mã quy tắc an toàn thực phẩm) |

---

## 4. Thực thể `ingredient` (Từ điển nguyên liệu chuẩn - dòng 175)

| Tên trường dự án đặt | Kiểu dữ liệu / Quy ước | Tên và mô tả tiếng Việt trong docs/plan.md (dòng 175) |
| --- | --- | --- |
| `name` | `string` (min 1) | `tên chuẩn` (tên nguyên liệu chính thức) |
| `aliases` | `string[]` | `tên gọi khác (danh sách)` (tên địa phương/vùng miền) |
| `group` | `string` (min 1) | `nhóm` (nhóm nguyên liệu: rau củ, thịt cá, gia vị...) |
| `base_unit` | `'g' \| 'ml' \| 'cái'` | `đơn vị gốc ('g', 'ml' hoặc 'cái')` (khóa tự đặt, giá trị enum khớp kế hoạch) |
| `conversions` | `Record<string, number>` | `bảng quy đổi (ví dụ thìa canh sang 'ml')` |
| `allergen_codes` | `AllergenCode[]` (default `[]`) | `mã dị ứng` (dự án dùng mảng để chứa nhiều chất gây dị ứng, tránh bỏ sót cảnh báo an toàn) |
| `reference_price` | `number` (non-negative) | `giá tham khảo theo đơn vị gốc` (ước tính chi phí) |
| `price_updated_at` | `string` (optional) | `ngày cập nhật giá` |
| `storage_rule_id` | `string` (optional) | `mã quy tắc bảo quản` (tham chiếu bảng `storage_rule`) |

---

## 5. Thực thể `pantry_item` (Mục tồn kho thực phẩm - dòng 179)

| Tên trường dự án đặt | Kiểu dữ liệu / Quy ước | Tên và mô tả tiếng Việt trong docs/plan.md (dòng 179) |
| --- | --- | --- |
| `quantity` | `number` (non-negative) | `lượng` (số lượng thực phẩm đang có trong kho) |
| `base_unit` | `'g' \| 'ml' \| 'cái'` | `đơn vị gốc` (chuẩn hóa theo 'g', 'ml', 'cái') |
| `storage_location` | `string` (min 1) | `vị trí bảo quản` (ngăn mát, ngăn đông, tủ bếp...) |
| `added_at` | `string` (ISO/date) | `ngày thêm` (thời điểm nhập vào kho) |
| `opened_at` | `string` (optional) | `ngày mở` (ngày mở bao bì/sử dụng lần đầu) |
| `expiry_date` | `string` (optional) | `hạn dùng` (hạn sử dụng sản phẩm) |
| `source` | `'manual' \| 'cook' \| 'shopping' \| 'photo'` | `nguồn (manual, cook, shopping, photo)` (khóa tự đặt, giá trị enum khớp kế hoạch) |

---

## 6. Thực thể `pantry_event` (Biến động kho thực phẩm - dòng 180)

| Tên trường dự án đặt | Kiểu dữ liệu / Quy ước | Tên và mô tả tiếng Việt trong docs/plan.md (dòng 180) |
| --- | --- | --- |
| `reason` | `'cook' \| 'adjust' \| 'discard' \| 'buy'` | `lý do (cook, adjust, discard, buy)` (khóa tự đặt, giá trị enum khớp kế hoạch) |
| `created_at` | `string` (ISO datetime) | `thời điểm` (thời điểm phát sinh biến động kho) |

---

## 7. Thực thể `cook_session` (Phiên nấu ăn trực tiếp - dòng 181)

| Tên trường dự án đặt | Kiểu dữ liệu / Quy ước | Tên và mô tả tiếng Việt trong docs/plan.md (dòng 181) |
| --- | --- | --- |
| `recipe_version` | `number` (int, >= 1) | `phiên bản công thức` (phiên bản đã dùng để nấu) |
| `servings` | `number` (int, >= 1) | `số phần` (số phần người dùng chọn nấu thực tế) |
| `optimization_mode` | `'fastest' \| 'fewest_tools'` | `tiêu chí tối ưu` (ưu tiên nhanh nhất hoặc ít rửa đồ nhất) |
| `started_at` | `string` (ISO datetime) | `bắt đầu` (thời điểm bắt đầu phiên nấu) |
| `completed_at` | `string` (optional) | `kết thúc` (thời điểm hoàn thành phiên nấu) |
| `status` | `'cooking' \| 'done' \| 'abandoned'` | `trạng thái (cooking, done, abandoned)` (khóa tự đặt, giá trị enum khớp kế hoạch) |
| `step_states` | `Record<string, string>` | `trạng thái từng bước (JSON)` |
| `removed_or_substituted` | `Record<string, string \| null>` | `nguyên liệu đã bỏ hoặc thay (JSON)` |
| `running_timers` | `Array<{ id, step_id?, endsAt }>` | `hẹn giờ đang chạy (JSON, có endsAt)` (mục con chứa `endsAt` giữ nguyên camelCase) |

---

## 8. Thực thể `user_profile` (Hồ sơ người dùng - dòng 174)

| Tên trường dự án đặt | Kiểu dữ liệu / Quy ước | Tên và mô tả tiếng Việt trong docs/plan.md (dòng 174) |
| --- | --- | --- |
| `display_name` | `string` (optional) | `tên hiển thị` |
| `servings` | `number` (int, >= 1, def: 2) | `số người ăn` (số người ăn mặc định mỗi bữa) |
| `allergies` | `AllergenCode[]` | `dị ứng (danh sách mã)` |
| `dietary_preference` | `string` (optional) | `chế độ ăn` (chay, eat clean, bình thường...) |
| `essential_spices` | `string[]` (ingredient_id) | `gia vị cơ bản đang có (danh sách ingredient_id)` |
| `available_equipment` | `string[]` | `dụng cụ đang có` (chảo, nồi, dao thớt...) |

---

## 9. Thực thể `storage_rule` (Quy tắc bảo quản thực phẩm - dòng 183)

| Tên trường dự án đặt | Kiểu dữ liệu / Quy ước | Tên và mô tả tiếng Việt trong docs/plan.md (dòng 183) |
| --- | --- | --- |
| `target_id_or_group` | `string` (min 1) | `ingredient_id hoặc nhóm` (mã nguyên liệu cụ thể hoặc tên nhóm) |
| `state` | `'fresh' \| 'opened' \| 'cooked'` | `trạng thái (tươi, đã mở, đã nấu)` |
| `location` | `'fridge' \| 'freezer' \| 'room_temperature'` | `vị trí (ngăn mát, ngăn đá, nhiệt độ phòng)` |
| `max_days` | `number` (non-negative) | `số ngày tối đa` (thời gian lưu trữ an toàn tối đa) |
| `source_name` | `string` (min 1) | `tên nguồn` (tên cơ quan y tế hoặc tài liệu tham chiếu) |
| `source_url` | `string` (min 1) | `đường dẫn nguồn` (URL tra cứu thông tin y tế) |

---

## 10. Các giá trị liệt kê (Enums) tiếng Anh do dự án quy ước

| Tên Enum trong mã nguồn | Giá trị tiếng Anh dự án quy ước | Mô tả tiếng Việt trong docs/plan.md | Vị trí áp dụng |
| --- | --- | --- | --- |
| `StorageStateEnum` | `'fresh'`<br>`'opened'`<br>`'cooked'` | `tươi`<br>`đã mở`<br>`đã nấu` | `storage_rule.state` (dòng 183) |
| `StorageLocationEnum` | `'fridge'`<br>`'freezer'`<br>`'room_temperature'` | `ngăn mát`<br>`ngăn đá`<br>`nhiệt độ phòng` | `storage_rule.location` (dòng 183) |
| `OptimizationModeEnum` | `'fastest'`<br>`'fewest_tools'` | `tiêu chí tối ưu`<br>(nhanh nhất, ít dụng cụ nhất) | `cook_session.optimization_mode` (dòng 181, mục T04.1) |
| `SafetyCategoryEnum` | `'temperature'`<br>`'cross_contamination'`<br>`'hygiene'`<br>`'storage'`<br>`'allergy'` | Phân loại quy tắc an toàn thực phẩm (nhiệt độ, nhiễm khuẩn chéo, vệ sinh, bảo quản, dị ứng) | `safety_rule.category` (dòng 178, 236) |
