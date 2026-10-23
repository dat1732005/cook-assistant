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
| `slug` | Khóa slug định danh | 205 | `"slug": "trung-chien-ca-chua"` |
| `name` | Tên món ăn | 206 | `"name": "Trứng chiên cà chua"` |
| `servings_base` | Số phần ăn cơ sở | 207 | `"servings_base": 2` |
| `difficulty` | Độ khó (1-3) | 208 | `"difficulty": 1` |
| `equipment` | Danh sách dụng cụ yêu cầu | 209 | `"equipment": ["chao", "to", "dao-thot"]` |
| `ingredients` | Danh sách nguyên liệu | 210 | `"ingredients": [...]` |
| `steps` | Danh sách các bước nấu | 218 | `"steps": [...]` |
| `id` | Mã định danh CSDL | 176 | Cột `id` bảng `recipe` |

### Bảng B: Tên do dự án đặt và mở rộng theo quy tắc R2/R3
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md / Quy tắc | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `total_minutes` | tổng phút | 176 | `number` (positive) |
| `tags` | thẻ (kho, xào, canh...) | 176 | `string[]` |
| `status` | trạng thái | 176 | Enum: `draft`, `reviewed`, `published` |
| `reviewer` | người kiểm duyệt | 176 | `string` (optional) |
| `reviewed_at` | ngày kiểm duyệt | 176 | `string` (ISO datetime/date, optional) |
| `version` | phiên bản | 176 | `number` (int, >= 1, default 1) |
| `description` | THÊM, kế hoạch không có: mô tả ngắn món ăn | — | `string` (optional) |
| `source` | THÊM, kế hoạch không có: nguồn dữ liệu thật theo quy tắc R3 | — | `string` (bắt buộc khi reviewed/published) |
| `confirmed_by` | THÊM, kế hoạch không có: người xác nhận dữ liệu theo quy tắc R3 | — | `string` (bắt buộc khi reviewed/published) |
| `missing_fields` | THÊM, kế hoạch không có: danh sách trường thiếu theo quy tắc R2 | — | `string[]` (bắt buộc rỗng khi reviewed/published) |

---

## 2. Thực thể `recipe_ingredient` (Nguyên liệu trong công thức)

### Bảng A: Khóa nguyên văn từ docs/plan.md
| Khóa schema | Nguồn trích xuất trong docs/plan.md | Dòng plan.md | Ghi chú kế hoạch |
| --- | --- | --- | --- |
| `ingredient` | Mã/slug nguyên liệu | 211 | `"ingredient": "trung-ga"` (CSDL: `ingredient_id`) |
| `qty` | Lượng nguyên liệu | 211 | `"qty": 3` |
| `unit` | Đơn vị đo lường | 211 | `"unit": "quả"` |
| `role` | Vai trò nguyên liệu | 211 | Enum: `flavor`, `structure`, `moisture`, `preservation`, `color` |
| `flavor_group` | Nhóm vị chủ đạo | 212 | Enum: `salt`, `sugar`, `acid`, `fat`, `spice`, `none` |
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
| `id` | Mã bước nấu | 219 | `"id": "s1"` |
| `title` | Tiêu đề ngắn của bước | 219 | `"title": "Cắt cà chua"` |
| `kind` | Loại bước | 219 | Enum: `active`, `passive` |
| `seconds` | Thời lượng tính bằng giây | 219 | `"seconds": 120` (thay thế tên sai duration_seconds) |
| `after` | Các bước phải xong trước | 219 | `"after": ["s2"]` (thay thế tên sai dependencies) |
| `resources` | Dụng cụ bị chiếm dụng | 219 | `"resources": ["chao"]` |
| `cue` | Dấu hiệu nhận biết cảm quan | 221 | `"cue": "Mặt dưới vàng nhẹ thì lật"` (thay thế visual_cue) |
| `text` | Nội dung hướng dẫn thao tác | 219 | `"text": "Cho dầu vào chảo..."` |
| `safety_rule` | Mã quy tắc an toàn gắn với bước | 236 | Mục 236 `safety_rule` |

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
| `id` | Mã slug nguyên liệu | 175 | `id (slug)` |

### Bảng B: Tên do dự án đặt và mở rộng theo quy tắc R2/R3
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md / Quy tắc | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `name` | tên chuẩn | 175 | `string` (min 1) |
| `aliases` | tên gọi khác (danh sách) | 175 | `string[]` (default []) |
| `group` | nhóm | 175 | `string` (min 1) |
| `base_unit` | đơn vị gốc | 175 | Enum: `'g' \| 'ml' \| 'cái'` |
| `conversions` | bảng quy đổi | 175 | `Record<string, number>` |
| `allergen_codes` | mã dị ứng | 175 | `AllergenCode[] \| null` (chỉ được null khi có trong missing_fields) |
| `reference_price` | giá tham khảo theo đơn vị gốc | 175 | `number` (non-negative, nullable/optional) |
| `price_updated_at` | ngày cập nhật giá | 175 | `string` (nullable/optional) |
| `storage_rule_id` | mã quy tắc bảo quản | 175 | `string` (nullable/optional) |
| `source` | THÊM, kế hoạch không có: nguồn trích dẫn dữ liệu theo R3 | — | `string` (optional) |
| `confirmed_by` | THÊM, kế hoạch không có: người xác nhận dữ liệu theo R3 | — | `string` (optional) |
| `missing_fields` | THÊM, kế hoạch không có: danh sách trường còn thiếu theo R2 | — | `string[]` (default []) |

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
| `source` | nguồn | 179 | Enum: `'manual' \| 'cook' \| 'shopping' \| 'photo'` |

---

## 6. Thực thể `pantry_event` (Biến động kho thực phẩm)

### Bảng A: Khóa nguyên văn từ docs/plan.md
| Khóa schema | Nguồn trích xuất trong docs/plan.md | Dòng plan.md | Ghi chú kế hoạch |
| --- | --- | --- | --- |
| `id` | Mã sự kiện kho | 180 | Cột `id` |
| `pantry_item_id` | Mã mục kho biến động | 180 | Cột `pantry_item_id` |
| `delta` | thay đổi (`delta`) | 180 | `number` (dương: nhập, âm: xuất) |
| `cook_session_id` | Phiên nấu liên quan | 180 | Cột `cook_session_id` |

### Bảng B: Tên do dự án đặt
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `reason` | lý do | 180 | Enum: `'cook' \| 'adjust' \| 'discard' \| 'buy'` |
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
| `optimization_mode` | tiêu chí tối ưu | 181 | Enum: `'fastest' \| 'fewest_tools'` |
| `started_at` | bắt đầu | 181 | `string` (ISO datetime) |
| `completed_at` | kết thúc | 181 | `string` (nullable/optional) |
| `status` | trạng thái | 181 | Enum: `'cooking' \| 'done' \| 'abandoned'` |
| `step_states` | trạng thái từng bước | 181 | `Record<string, string>` |
| `removed_or_substituted` | nguyên liệu đã bỏ hoặc thay | 181 | `Record<string, string \| null>` |
| `running_timers` | hẹn giờ đang chạy | 181 | `Array<{ id, step_id?, endsAt }>` (khóa con `endsAt` giữ camelCase) |

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
| `allergies` | dị ứng | 174 | `AllergenCode[]` (default []) |
| `dietary_preference` | chế độ ăn | 174 | `string` (optional) |
| `essential_spices` | gia vị cơ bản đang có | 174 | `string[]` (default []) |
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
| `state` | trạng thái | 183 | Enum: `'fresh' \| 'opened' \| 'cooked'` |
| `location` | vị trí | 183 | Enum: `'fridge' \| 'freezer' \| 'room_temperature'` |
| `max_days` | số ngày tối đa | 183 | `number` (non-negative) |
| `source_name` | tên nguồn | 183 | `string` (min 1) |
| `source_url` | đường dẫn nguồn | 183 | `string` (min 1) |
| `source` | THÊM, kế hoạch không có: nguồn trích dẫn dữ liệu theo R3 | — | `string` (optional) |
| `confirmed_by` | THÊM, kế hoạch không có: người xác nhận dữ liệu theo R3 | — | `string` (optional) |
| `missing_fields` | THÊM, kế hoạch không có: danh sách trường còn thiếu theo R2 | — | `string[]` (default []) |

---

## 10. Thực thể `safety_rule` (Quy tắc an toàn thực phẩm)

### Bảng A: Khóa nguyên văn từ docs/plan.md
*(Kế hoạch không định nghĩa bảng CSDL riêng cho safety_rule; khóa `safety_rule` chỉ xuất hiện ở bước nấu trong thực thể `recipe_step` dòng 236).*

### Bảng B: Tên do dự án đặt và mở rộng theo quy tắc R2/R3
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md / Quy tắc | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `id` | THÊM, kế hoạch không có: định danh quy tắc an toàn khi tách bảng độc lập | — | `string` (min 1) |
| `title` | THÊM, kế hoạch không có: tiêu đề cảnh báo an toàn | — | `string` (min 1) |
| `category` | THÊM, kế hoạch không có: phân loại nhóm an toàn | — | Enum: `'temperature' \| 'cross_contamination' \| 'hygiene' \| 'storage' \| 'allergy'` |
| `description` | THÊM, kế hoạch không có: nội dung hướng dẫn an toàn chi tiết | — | `string` (min 1) |
| `requires_confirmation` | THÊM, kế hoạch không có: cờ bắt xác nhận trước khi tiếp tục | — | `boolean` (default false) |
| `source_name` | THÊM, kế hoạch không có: tên nguồn trích dẫn quy chuẩn an toàn | — | `string` (optional) |
| `source_url` | THÊM, kế hoạch không có: đường dẫn tài liệu tra cứu quy chuẩn | — | `string` (optional) |
| `source` | THÊM, kế hoạch không có: nguồn trích dẫn dữ liệu theo R3 | — | `string` (optional) |
| `confirmed_by` | THÊM, kế hoạch không có: người xác nhận dữ liệu theo R3 | — | `string` (optional) |
| `missing_fields` | THÊM, kế hoạch không có: danh sách trường còn thiếu theo R2 | — | `string[]` (default []) |

---

## 11. Các giá trị liệt kê (Enums) tiếng Anh do dự án quy ước

| Tên Enum trong mã nguồn | Giá trị tiếng Anh dự án quy ước | Mô tả tiếng Việt trong docs/plan.md | Vị trí áp dụng |
| --- | --- | --- | --- |
| `StorageStateEnum` | `'fresh'`<br>`'opened'`<br>`'cooked'` | `tươi`<br>`đã mở`<br>`đã nấu` | `storage_rule.state` (dòng 183) |
| `StorageLocationEnum` | `'fridge'`<br>`'freezer'`<br>`'room_temperature'` | `ngăn mát`<br>`ngăn đá`<br>`nhiệt độ phòng` | `storage_rule.location` (dòng 183) |
| `OptimizationModeEnum` | `'fastest'`<br>`'fewest_tools'` | `tiêu chí tối ưu`<br>(nhanh nhất, ít dụng cụ nhất) | `cook_session.optimization_mode` (dòng 181, mục T04.1) |
| `SafetyCategoryEnum` | `'temperature'`<br>`'cross_contamination'`<br>`'hygiene'`<br>`'storage'`<br>`'allergy'` | THÊM, kế hoạch không có: phân loại quy tắc an toàn thực phẩm khi tách thành thực thể độc lập | `safety_rule.category` |
| `AiUsageLogKindEnum` | `'substitute'`<br>`'qa'`<br>`'scan'` | THÊM, kế hoạch không có: loại tác vụ AI trong ai_usage_log | `ai_usage_log.kind` (dòng 182) |

---

## 12. Thực thể `equipment` (Dụng cụ nấu ăn)

### Bảng A: Khóa nguyên văn từ docs/plan.md
*(Không có bảng CSDL equipment trong docs/plan.md; danh sách dụng cụ chỉ xuất hiện trong mảng `equipment` của công thức).*

### Bảng B: Tên do dự án đặt và đã được chủ dự án chính thức phê duyệt
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md / Quy tắc | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `id` | THÊM, kế hoạch không có: định danh dụng cụ (slug khớp với danh sách equipment trong recipe) | — | `string` (min 1) |
| `name` | THÊM, kế hoạch không có: tên hiển thị tiếng Việt của dụng cụ | — | `string` (min 1) |
| `source` | THÊM, kế hoạch không có: nguồn trích dẫn dữ liệu theo R3 | — | `string` (optional) |
| `confirmed_by` | THÊM, kế hoạch không có: người xác nhận dữ liệu theo R3 | — | `string` (optional) |
| `missing_fields` | THÊM, kế hoạch không có: danh sách trường còn thiếu theo R2 | — | `string[]` (default []) |

---

## 13. Thực thể `ai_usage_log` (Nhật ký sử dụng AI)

### Bảng A: Khóa nguyên văn từ docs/plan.md
*(Không có bảng riêng với khóa tiếng Anh trong docs/plan.md; dòng 182 mô tả các cột bằng tiếng Việt: "id, user_id, loại (substitute, qa, scan), token vào và ra, chi phí, thời điểm").*

### Bảng B: Tên do dự án đặt và đã được chủ dự án chính thức phê duyệt
| Khóa schema | Mô tả tiếng Việt trong docs/plan.md / Quy tắc | Dòng plan.md | Kiểu dữ liệu / Quy ước |
| --- | --- | --- | --- |
| `id` | THÊM, kế hoạch không có: định danh bản ghi nhật ký sử dụng AI | — | `string` (min 1, UUID hoặc chuỗi định danh) |
| `user_id` | THÊM, kế hoạch không có: định danh người dùng sử dụng | — | `string` (min 1, khóa ngoại tham chiếu user_profile.id) |
| `kind` | THÊM, kế hoạch không có: loại tác vụ AI | — | Enum: `'substitute' \| 'qa' \| 'scan'` |
| `tokens_in` | THÊM, kế hoạch không có: số lượng token đầu vào (cho phép null) | — | `number \| null` (integer >= 0) |
| `tokens_out` | THÊM, kế hoạch không có: số lượng token đầu ra (cho phép null) | — | `number \| null` (integer >= 0) |
| `cost_micro_usd` | THÊM, kế hoạch không có: chi phí tính theo micro USD (1 USD = 1,000,000 micro USD, cho phép null) | — | `number \| null` (integer >= 0) |
| `created_at` | THÊM, kế hoạch không có: thời điểm thực hiện cuộc gọi AI | — | `string` (ISO-8601 UTC) |
