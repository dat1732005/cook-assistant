# Danh mục tên trường và giá trị liệt kê do dự án đặt (docs/field-names.md)

Tài liệu này ghi nhận mọi tên trường và giá trị liệt kê (enum values) tiếng Anh `snake_case` dùng trong hệ thống schemas. Mỗi thực thể được chia rõ ràng thành hai bảng:
- **(A) Khóa nguyên văn:** Có trong JSON mẫu hoặc bảng CSDL của [`docs/plan.md`](plan.md).
- **(B) Tên do dự án đặt:** Quy ước tiếng Anh `snake_case` khi kế hoạch chỉ ghi tiếng Việt, hoặc bổ sung bắt buộc theo quy tắc R2 (dữ liệu thiếu: `missing_fields`) và R3 (nguồn dữ liệu thật: `source`, `confirmed_by`).
- Các tên sai lệch trước đây (`duration_seconds`, `dependencies`, `visual_cue`) đã bị loại bỏ hoàn toàn, chuẩn hóa về đúng khóa của kế hoạch (`seconds`, `after`, `cue`).
- Mọi khóa trong tài liệu này được kiểm tra tự động bằng unit test đồng bộ với các Zod schemas trong mã nguồn.

---

## 1. Thực thể `recipe` (Công thức món ăn)

### Bảng A: Khóa nguyên văn từ docs/plan.md
| Khóa schema | Nguồn trích xuất trong docs/plan.md | Dòng plan.md | Ghi chú kế hoạch |
| --- | --- | --- | --- |
| `slug` | Khóa slug định danh | 176, 194, 205 | `"slug": "trung-chien-ca-chua"` |
| `name` | Tên món ăn | 206 | `"name": "Trứng chiên cà chua"` |
| `servings_base` | Số phần ăn cơ sở | 207 | `"servings_base": 2` |
| `difficulty` | Độ khó (1-3) | 176, 208 | `"difficulty": 1` |
| `equipment` | Danh sách dụng cụ yêu cầu | 209 | `"equipment": ["chao", "to", "dao-thot"]` |
| `ingredients` | Danh sách nguyên liệu | 210 | `"ingredients": [...]` |
| `steps` | Danh sách các bước nấu | 218 | `"steps": [...]` |
| `id` | Mã định danh CSDL | 176 | Cột `id` bảng `recipe` |
| `status` | Trạng thái kiểm duyệt | 176 | Enum: `draft`, `reviewed`, `published` |

### Bảng B: Tên do dự án đặt và mở rộng theo quy tắc R2/R3
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md / Quy tắc | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `total_minutes` | tổng phút | 176 | `number` (positive) |
| `tags` | thẻ (kho, xào, canh...) | 176 | `string[]` |
| `reviewer` | người kiểm duyệt | 176 | `string` (optional) |
| `reviewed_at` | ngày kiểm duyệt | 176 | `string` (ISO datetime/date, optional) |
| `version` | phiên bản | 176 | `number` (int, >= 1, default 1) |
| `description` | mô tả ngắn món ăn | Tùy chọn | `string` (optional) |
| `source` | nguồn dữ liệu thật theo quy tắc R3 | docs/tasks.md R3 | `string` (bắt buộc khi reviewed/published) |
| `confirmed_by` | người xác nhận dữ liệu theo quy tắc R3 | docs/tasks.md R3 | `string` (bắt buộc khi reviewed/published) |
| `missing_fields` | danh sách trường thiếu theo quy tắc R2 | docs/tasks.md R2 | `string[]` (bắt buộc rỗng khi reviewed/published) |

---

## 2. Thực thể `recipe_ingredient` (Nguyên liệu trong công thức)

### Bảng A: Khóa nguyên văn từ docs/plan.md
| Khóa schema | Nguồn trích xuất trong docs/plan.md | Dòng plan.md | Ghi chú kế hoạch |
| --- | --- | --- | --- |
| `ingredient` | Mã/slug nguyên liệu | 177, 211 | `"ingredient": "trung-ga"` (CSDL: `ingredient_id`) |
| `qty` | Lượng nguyên liệu | 211 | `"qty": 3` |
| `unit` | Đơn vị đo lường | 211 | `"unit": "quả"` |
| `role` | Vai trò nguyên liệu | 177, 211 | Enum: `flavor`, `structure`, `moisture`, `preservation`, `color` |
| `flavor_group` | Nhóm vị chủ đạo | 212, 234 | Enum: `salt`, `sugar`, `acid`, `fat`, `spice`, `none` |
| `optional` | Tùy chọn có thể bỏ | 213 | `"optional": true` (boolean, default false) |

### Bảng B: Tên do dự án đặt
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `amount_note` | ghi chú lượng ("vừa ăn") | 177 | `string` (optional) |
| `group` | nhóm (nước ướp, nước sốt...) | 177 | `string` (optional) |

---

## 3. Thực thể `recipe_step` (Bước thực hiện công thức)

### Bảng A: Khóa nguyên văn từ docs/plan.md
| Khóa schema | Nguồn trích xuất trong docs/plan.md | Dòng plan.md | Ghi chú kế hoạch |
| --- | --- | --- | --- |
| `id` | Mã bước nấu | 178, 219 | `"id": "s1"` |
| `title` | Tiêu đề ngắn của bước | 219 | `"title": "Cắt cà chua"` |
| `kind` | Loại bước | 219, 230 | Enum: `active`, `passive` |
| `seconds` | Thời lượng tính bằng giây | 219, 252 | `"seconds": 120` (thay thế tên sai duration_seconds) |
| `after` | Các bước phải xong trước | 219, 231 | `"after": ["s2"]` (thay thế tên sai dependencies) |
| `resources` | Dụng cụ bị chiếm dụng | 219, 232 | `"resources": ["chao"]` |
| `cue` | Dấu hiệu nhận biết cảm quan | 221, 233 | `"cue": "Mặt dưới vàng nhẹ thì lật"` (thay thế visual_cue) |
| `text` | Nội dung hướng dẫn thao tác | 219 | `"text": "Cho dầu vào chảo..."` |
| `safety_rule` | Mã quy tắc an toàn gắn với bước | 178, 236 | Cột `mã quy tắc an toàn`, mục 236 `safety_rule` |

### Bảng B: Tên do dự án đặt
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `order` | thứ tự | 178 | `number` (int, positive, optional) |
| `target_temperature` | nhiệt độ mục tiêu | 178 | `number` (optional) |

---

## 4. Thực thể `ingredient` (Từ điển nguyên liệu chuẩn)

### Bảng A: Khóa nguyên văn từ docs/plan.md
| Khóa schema | Nguồn trích xuất trong docs/plan.md | Dòng plan.md | Ghi chú kế hoạch |
| --- | --- | --- | --- |
| `id` | Mã slug nguyên liệu | 175, 194 | `id (slug)` |

### Bảng B: Tên do dự án đặt và mở rộng theo quy tắc R2/R3
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md / Quy tắc | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `name` | tên chuẩn | 175 | `string` (min 1) |
| `aliases` | tên gọi khác (danh sách) | 175 | `string[]` (default []) |
| `group` | nhóm | 175 | `string` (min 1) |
| `base_unit` | đơn vị gốc (`g`, `ml` hoặc `cái`) | 175 | Enum: `'g' \| 'ml' \| 'cái'` |
| `conversions` | bảng quy đổi (ví dụ thìa canh sang `ml`) | 175 | `Record<string, number>` |
| `allergen_codes` | mã dị ứng (bắt buộc khai báo, null khi thiếu) | 175 | `AllergenCode[] \| null` (chỉ được null khi có trong missing_fields) |
| `reference_price` | giá tham khảo theo đơn vị gốc | 175 | `number` (non-negative, nullable/optional) |
| `price_updated_at` | ngày cập nhật giá | 175 | `string` (nullable/optional) |
| `storage_rule_id` | mã quy tắc bảo quản | 175 | `string` (nullable/optional) |
| `source` | nguồn trích dẫn dữ liệu theo R3 | docs/tasks.md R3 | `string` (optional) |
| `confirmed_by` | người xác nhận dữ liệu theo R3 | docs/tasks.md R3 | `string` (optional) |
| `missing_fields` | danh sách trường còn thiếu theo R2 | docs/tasks.md R2 | `string[]` (default []) |

---

## 5. Thực thể `pantry_item` (Mục tồn kho thực phẩm)

### Bảng A: Khóa nguyên văn từ docs/plan.md
| Khóa schema | Nguồn trích xuất trong docs/plan.md | Dòng plan.md | Ghi chú kế hoạch |
| --- | --- | --- | --- |
| `id` | Mã mục kho | 179 | Cột `id` |
| `ingredient_id` | Mã nguyên liệu tham chiếu | 179 | Cột `ingredient_id` |

### Bảng B: Tên do dự án đặt
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `quantity` | lượng | 179 | `number` (non-negative) |
| `base_unit` | đơn vị gốc | 179 | Enum: `'g' \| 'ml' \| 'cái'` |
| `storage_location` | vị trí bảo quản | 179 | `string` (min 1) |
| `added_at` | ngày thêm | 179 | `string` (min 1, ISO/date) |
| `opened_at` | ngày mở | 179 | `string` (nullable/optional) |
| `expiry_date` | hạn dùng | 179 | `string` (nullable/optional) |
| `source` | nguồn (`manual`, `cook`, `shopping`, `photo`) | 179 | Enum: `'manual' \| 'cook' \| 'shopping' \| 'photo'` |

---

## 6. Thực thể `pantry_event` (Biến động kho thực phẩm)

### Bảng A: Khóa nguyên văn từ docs/plan.md
| Khóa schema | Nguồn trích xuất trong docs/plan.md | Dòng plan.md | Ghi chú kế hoạch |
| --- | --- | --- | --- |
| `id` | Mã sự kiện kho | 180 | Cột `id` |
| `pantry_item_id` | Mã mục kho biến động | 180 | Cột `pantry_item_id` |
| `delta` | thay đổi (`delta`) | 180 | `number` (dương: nhập, âm: xuất) |
| `cook_session_id` | Phiên nấu liên quan | 180, 278 | Cột `cook_session_id` |

### Bảng B: Tên do dự án đặt
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `reason` | lý do (`cook`, `adjust`, `discard`, `buy`) | 180 | Enum: `'cook' \| 'adjust' \| 'discard' \| 'buy'` |
| `created_at` | thời điểm | 180 | `string` (ISO datetime) |

---

## 7. Thực thể `cook_session` (Phiên nấu ăn trực tiếp)

### Bảng A: Khóa nguyên văn từ docs/plan.md
| Khóa schema | Nguồn trích xuất trong docs/plan.md | Dòng plan.md | Ghi chú kế hoạch |
| --- | --- | --- | --- |
| `id` | Mã phiên nấu | 181 | Cột `id` |
| `recipe_id` | Mã công thức nấu | 181 | Cột `recipe_id` |

### Bảng B: Tên do dự án đặt
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `recipe_version` | phiên bản công thức | 181 | `number` (int, >= 1) |
| `servings` | số phần | 181 | `number` (int, >= 1) |
| `optimization_mode` | tiêu chí tối ưu | 181, 252 | Enum: `'fastest' \| 'fewest_tools'` |
| `started_at` | bắt đầu | 181 | `string` (ISO datetime) |
| `completed_at` | kết thúc | 181 | `string` (nullable/optional) |
| `status` | trạng thái (`cooking`, `done`, `abandoned`) | 181, 304 | Enum: `'cooking' \| 'done' \| 'abandoned'` |
| `step_states` | trạng thái từng bước (JSON) | 181 | `Record<string, string>` |
| `removed_or_substituted` | nguyên liệu đã bỏ hoặc thay (JSON) | 181, 316 | `Record<string, string \| null>` |
| `running_timers` | hẹn giờ đang chạy (JSON, có `endsAt`) | 147, 181, 409 | `Array<{ id, step_id?, endsAt }>` (khóa con `endsAt` giữ camelCase) |

---

## 8. Thực thể `user_profile` (Hồ sơ người dùng)

### Bảng A: Khóa nguyên văn từ docs/plan.md
| Khóa schema | Nguồn trích xuất trong docs/plan.md | Dòng plan.md | Ghi chú kế hoạch |
| --- | --- | --- | --- |
| `id` | Mã người dùng | 174 | Cột `id` |

### Bảng B: Tên do dự án đặt
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `display_name` | tên hiển thị | 174 | `string` (optional) |
| `servings` | số người ăn | 174 | `number` (int, >= 1, default 2) |
| `allergies` | dị ứng (danh sách mã) | 174 | `AllergenCode[]` (default []) |
| `dietary_preference` | chế độ ăn | 174 | `string` (optional) |
| `essential_spices` | gia vị cơ bản đang có (danh sách `ingredient_id`) | 174 | `string[]` (default []) |
| `available_equipment` | dụng cụ đang có | 174 | `string[]` (default []) |

---

## 9. Thực thể `storage_rule` (Quy tắc bảo quản thực phẩm)

### Bảng A: Khóa nguyên văn từ docs/plan.md
| Khóa schema | Nguồn trích xuất trong docs/plan.md | Dòng plan.md | Ghi chú kế hoạch |
| --- | --- | --- | --- |
| `id` | Mã quy tắc bảo quản | 183 | Cột `id` |

### Bảng B: Tên do dự án đặt và mở rộng theo quy tắc R2/R3
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md / Quy tắc | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `target_id_or_group` | `ingredient_id` hoặc nhóm | 183 | `string` (min 1) |
| `state` | trạng thái (tươi, đã mở, đã nấu) | 183 | Enum: `'fresh' \| 'opened' \| 'cooked'` |
| `location` | vị trí (ngăn mát, ngăn đá, nhiệt độ phòng) | 183 | Enum: `'fridge' \| 'freezer' \| 'room_temperature'` |
| `max_days` | số ngày tối đa | 183 | `number` (non-negative) |
| `source_name` | tên nguồn | 183, 197 | `string` (min 1) |
| `source_url` | đường dẫn nguồn | 183, 197 | `string` (min 1) |
| `source` | nguồn trích dẫn dữ liệu theo R3 | docs/tasks.md R3 | `string` (optional) |
| `confirmed_by` | người xác nhận dữ liệu theo R3 | docs/tasks.md R3 | `string` (optional) |
| `missing_fields` | danh sách trường còn thiếu theo R2 | docs/tasks.md R2 | `string[]` (default []) |

---

## 10. Thực thể `safety_rule` (Quy tắc an toàn thực phẩm)

### Bảng A: Khóa nguyên văn từ docs/plan.md
| Khóa schema | Nguồn trích xuất trong docs/plan.md | Dòng plan.md | Ghi chú kế hoạch |
| --- | --- | --- | --- |
| `id` | Mã quy tắc an toàn | 178, 236 | `mã quy tắc an toàn`, `safety_rule` |

### Bảng B: Tên do dự án đặt và mở rộng theo quy tắc R2/R3
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md / Quy tắc | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `title` | Tiêu đề cảnh báo an toàn | 178, 236 | `string` (min 1) |
| `category` | Phân loại an toàn | 178, 236 | Enum: `'temperature' \| 'cross_contamination' \| 'hygiene' \| 'storage' \| 'allergy'` |
| `description` | Nội dung chi tiết quy tắc an toàn | 178, 236 | `string` (min 1) |
| `requires_confirmation` | Bắt xác nhận trước khi tiếp tục | 236 | `boolean` (default false) |
| `source_name` | Tên nguồn trích dẫn an toàn | 178, 236 | `string` (optional) |
| `source_url` | Đường dẫn tra cứu tài liệu | 178, 236 | `string` (optional) |
| `source` | Nguồn trích dẫn dữ liệu theo R3 | docs/tasks.md R3 | `string` (optional) |
| `confirmed_by` | Người xác nhận dữ liệu theo R3 | docs/tasks.md R3 | `string` (optional) |
| `missing_fields` | Danh sách trường còn thiếu theo R2 | docs/tasks.md R2 | `string[]` (default []) |

---

## 11. Các giá trị liệt kê (Enums) tiếng Anh do dự án quy ước

| Tên Enum trong mã nguồn | Giá trị tiếng Anh dự án quy ước | Mô tả tiếng Việt trong docs/plan.md | Vị trí áp dụng |
| --- | --- | --- | --- |
| `StorageStateEnum` | `'fresh'`<br>`'opened'`<br>`'cooked'` | `tươi`<br>`đã mở`<br>`đã nấu` | `storage_rule.state` (dòng 183) |
| `StorageLocationEnum` | `'fridge'`<br>`'freezer'`<br>`'room_temperature'` | `ngăn mát`<br>`ngăn đá`<br>`nhiệt độ phòng` | `storage_rule.location` (dòng 183) |
| `OptimizationModeEnum` | `'fastest'`<br>`'fewest_tools'` | `tiêu chí tối ưu`<br>(nhanh nhất, ít dụng cụ nhất) | `cook_session.optimization_mode` (dòng 181, mục T04.1) |
| `SafetyCategoryEnum` | `'temperature'`<br>`'cross_contamination'`<br>`'hygiene'`<br>`'storage'`<br>`'allergy'` | Phân loại quy tắc an toàn thực phẩm (nhiệt độ, nhiễm khuẩn chéo, vệ sinh, bảo quản, dị ứng) | `safety_rule.category` (dòng 178, 236) |
