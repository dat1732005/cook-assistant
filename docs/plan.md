# Kế hoạch sản phẩm: Trợ lý nấu ăn cùng bạn

Oct 15, 2026 · @Đạt

## Tầm nhìn và vấn đề

Sản phẩm là một ứng dụng di động giúp người không biết nấu ăn, hoặc không biết hôm nay nấu gì, nấu xong một bữa từ lúc chọn món đến lúc dọn bếp, và tự theo dõi nguyên liệu còn lại sau đó.

**Hai vấn đề người dùng gặp lúc này:**

- **Không biết nấu gì.** Mở tủ lạnh ra có đồ nhưng không biết ghép thành món nào, hoặc không biết cần đi chợ mua gì và tốn khoảng bao nhiêu.
- **Không biết nấu thế nào.** Có công thức nhưng không biết làm việc nào trước, việc nào song song, nêm đến đâu là vừa, và lúc thiếu nguyên liệu thì bỏ hay thay.

**Điều sản phẩm hứa với người dùng:** mở app, chọn một món, và được dẫn tay chỉ việc từng bước có nhắc giờ, cho đến khi món lên bàn. Kho nguyên liệu tự cập nhật theo việc đi chợ và nấu, nên người dùng không phải ghi chép riêng.

**Điểm khác biệt so với app công thức thông thường:** gợi ý dựa trên thứ người dùng đang có và chi phí ước tính, nấu cùng theo thời gian thực, và dần điều chỉnh công thức theo khẩu vị của chính người nấu.

## Người dùng đầu tiên

MVP thiết kế cho hai nhóm có chung một điểm: cần được cầm tay chỉ việc, không cần công thức dài hay mẹo nâng cao.

|  | Người không biết nấu ăn | Người không biết nấu gì |
| --- | --- | --- |
| Tình huống | Ít khi vào bếp, sợ hỏng món, không rõ thuật ngữ | Biết nấu cơ bản nhưng cạn ý tưởng, hay gọi đồ ăn ngoài |
| Nhu cầu chính | Hướng dẫn từng bước rõ, dễ làm theo, có người nhắc giờ | Gợi ý món hợp với đồ đang có, biết đi chợ mua gì |
| Nỗi đau | Quên bước, nấu sai thứ tự, không biết nêm bao nhiêu là vừa | Mất thời gian nghĩ món, mua dư hoặc thiếu nguyên liệu, đồ để hỏng |
| Điều làm họ quay lại | Nấu thành công món đầu tiên | Mỗi lần mở app có ngay vài món phù hợp |

**Khoảnh khắc sử dụng chính:** chiều muộn lúc nghĩ "tối nay ăn gì", lúc đi chợ hoặc siêu thị, và lúc đứng trong bếp bắt đầu nấu.

**Hệ quả cho thiết kế:** mặc định hướng dẫn chi tiết cho người mới, ngôn ngữ gần gũi, ít thuật ngữ. Người đã quen có thể rút gọn mức hướng dẫn ở giai đoạn sau.

## Phạm vi MVP và các giai đoạn

MVP chỉ làm đủ để một người mới nấu xong một bữa và quay lại nấu lần hai; bốn khối ý tưởng ban đầu được chia ra ba giai đoạn, phần phụ thuộc dữ liệu đi sau.

| Giai đoạn | Nội dung | Điều kiện sang giai đoạn sau (đề xuất) |
| --- | --- | --- |
| **1. MVP** | Khoảng 30-50 món Việt đã kiểm duyệt, lưu dạng bước có cấu trúc · Gợi ý món theo đồ đang có hoặc ước chừng chi phí theo bảng giá tham khảo · Nấu cùng từng bước có hẹn giờ và thông báo · Kho đơn giản, tự trừ sau khi nấu · Hỏi AI khi muốn bỏ hoặc thay nguyên liệu | Người dùng nấu trọn vẹn một món và quay lại nấu món thứ hai |
| **2. Kho và phản hồi** | Chốt danh sách đi chợ thì kho tự cập nhật · Hướng dẫn bảo quản theo nguồn y tế · Kiểm kê nhanh hàng tuần · Nhận diện nguyên liệu qua ảnh (người dùng xác nhận) · Đánh giá món sau khi nấu (mặn, vừa, nhạt) để gom dữ liệu | Có đủ lượt đánh giá để thấy xu hướng khẩu vị của từng người |
| **3. Cá nhân hóa** | Điều chỉnh công thức theo hệ số khẩu vị · Gợi ý món theo khẩu vị và thói quen nấu · Báo cáo dinh dưỡng ước tính theo tuần · Nhập công thức từ video TikTok, Facebook (người dùng xem và sửa trước khi nấu) | Tùy kết quả giai đoạn 2 |

**Chưa làm trong MVP:** lấy giá từng sản phẩm từ Winmart, GO!, Bách Hóa Xanh, nhận diện nguyên liệu qua ảnh, học khẩu vị, nhập công thức từ video, báo cáo dinh dưỡng. Giá cửa hàng đi sau vì cần kiểm tra khả năng lấy dữ liệu và điều khoản sử dụng của từng chuỗi; nhận diện ảnh đi sau vì tốn chi phí và hay nhận diện sai.

## Luồng người dùng chính

Một bữa nấu đi từ mở app đến khi kho tự trừ; khi thiếu nguyên liệu hoặc muốn đổi, người dùng hỏi AI rồi quay lại chọn món.

[Sơ đồ nhúng: luồng người dùng chính · 8 bước, 1 nhánh hỏi AI, 1 vòng lặp. Sơ đồ này không có trong bản chữ của tài liệu.]

Từ giai đoạn 2, đánh giá món sau bữa ăn dẫn tới chỉnh khẩu vị ở giai đoạn 3, và kết quả quay lại bước gợi ý cho lần nấu sau.

## Tính năng MVP chi tiết

MVP có năm tính năng; mỗi tính năng dưới đây ghi rõ phần nào là logic của app và phần nào là AI.

### 1. Gợi ý món

Khi mở app, người dùng thấy một danh sách món phù hợp. Có hai cách gợi ý:

- **Theo đồ đang có:** ghép nguyên liệu trong kho với các món đã kiểm duyệt, ưu tiên món dùng hết đồ sắp hỏng.
- **Theo ước chừng:** người dùng chọn số người ăn và bữa nào; app ước tính nguyên liệu cần mua và chi phí tham khảo.

Lượng nguyên liệu người dùng nhập theo cách ước chừng quen thuộc (một thìa, nửa túi, một bó), không bắt buộc đo chính xác.

### 2. Nấu cùng từng bước

Sau khi chọn món, app mô tả toàn bộ việc cần làm rồi dẫn từng bước:

- Mỗi bước có thời lượng, loại việc (làm tay hay chờ) và bước phải xong trước.
- Thuật toán của app xếp thứ tự để việc chờ được tận dụng cho việc khác (ví dụ vừa luộc vừa sơ chế).
- Hẹn giờ và thông báo nhắc khi đến bước tiếp theo.
- Người dùng chọn một tiêu chí tối ưu đơn giản, ví dụ nhanh nhất hoặc ít dụng cụ nhất.

### 3. Hỏi AI khi bỏ hoặc thay nguyên liệu

Người dùng nói "không có hành" hoặc "muốn bớt đường", AI trả lời việc đó ảnh hưởng gì đến vị, kết cấu hoặc độ an toàn của món và gợi ý cách thay. Mỗi nguyên liệu trong công thức được gắn vai trò (tạo vị, tạo kết cấu, giữ ẩm, bảo quản, tạo màu) để app cảnh báo mạnh hơn khi bỏ nguyên liệu quan trọng.

### 4. Kho nguyên liệu đơn giản

Khi nấu xong, app tự trừ nguyên liệu đã dùng trong kho, theo lượng ước chừng của công thức. Người dùng có thể sửa nhanh nếu lệch. Đây là cách giảm công nhập liệu: kho được cập nhật nhờ việc nấu, không nhờ ghi chép riêng.

### 5. Bảng giá tham khảo

Một bảng giá theo nguyên liệu chuẩn (ví dụ giá thịt ba chỉ theo kg), cập nhật định kỳ, dùng để ước tính chi phí một món. Chỉ cần đủ để người dùng ước chừng, không cần chính xác theo từng cửa hàng.

### 6. Nhận diện nguyên liệu qua ảnh (giai đoạn 2)

Người dùng chụp tủ lạnh hoặc bàn bếp; mô hình thị giác đề xuất danh sách nguyên liệu, người dùng xác nhận hoặc sửa rồi mới thêm vào kho.

- **Chỉ là đề xuất:** mục nào mô hình không chắc được gắn nhãn "không chắc" và mặc định bỏ chọn.
- **Lượng và hạn dùng:** ảnh không cho biết lượng hay hạn sử dụng, nên lượng mặc định là "một ít" (người dùng sửa nếu muốn) và hạn dùng lấy từ quy tắc bảo quản.
- **Quyền riêng tư:** đề xuất không lưu ảnh sau khi nhận diện, chỉ lưu kết quả đã xác nhận.
- **Chi phí:** giới hạn số ảnh mỗi ngày ở gói miễn phí.

Trước khi xây, thử trên khoảng vài chục ảnh tủ lạnh thật để biết mô hình nhận đúng được bao nhiêu.

### 7. Học khẩu vị để gợi ý (giai đoạn 3)

App dùng lịch sử món đã nấu, đánh giá thích hoặc không thích, mức mặn nhạt, thời gian nấu và món hay bỏ dở để điều chỉnh.

- **Hai tầng:** chỉnh cách nêm của công thức (hệ số muối, đường) và chọn món nào để gợi ý.
- **Luật đơn giản trước:** mỗi người chỉ có rất ít dữ liệu, nên giai đoạn đầu không dùng học máy.
- **Luôn chen món mới** để gợi ý không lặp lại.
- **Có trần điều chỉnh** muối và đường để không đẩy người dùng ăn mặn hoặc ngọt dần (chi tiết ở phần Thuật toán và AI).

## Mô hình dữ liệu

Dữ liệu có bốn nhóm chính; công thức phải ở dạng có cấu trúc thì app mới tự xếp bước, trừ kho và cảnh báo thay nguyên liệu được.

| Nhóm | Lưu gì | Ghi chú |
| --- | --- | --- |
| **Nguyên liệu chuẩn** | Tên chuẩn, các tên gọi khác (vùng miền), đơn vị chuẩn, quy đổi ước lượng (một bó, một thìa, nửa túi sang gram), giá tham khảo, thời gian bảo quản theo nguồn y tế | Mỗi nguyên liệu chuẩn gắn nhiều tên sản phẩm ở các cửa hàng, để đổi cửa hàng không phải làm lại |
| **Công thức** | Tên món, số phần, danh sách nguyên liệu kèm lượng ước chừng và vai trò (vị, kết cấu, giữ ẩm, bảo quản, màu), danh sách bước | Mỗi bước có thời lượng, loại việc (làm tay hoặc chờ), bước phải xong trước, dụng cụ, và mốc nhắc (ví dụ "nước sôi") |
| **Kho của người dùng** | Nguyên liệu, lượng ước chừng, ngày mua hoặc ngày mở, vị trí bảo quản | Tự trừ sau khi nấu, có màn hình kiểm kê nhanh hàng tuần |
| **Phiên nấu và đánh giá** | Món đã nấu, ngày, số phần, bước hiện tại, nguyên liệu đã bỏ hoặc thay, đánh giá (mặn, vừa, nhạt) và lượng đã ăn | Dùng cho giai đoạn 2 và 3: học khẩu vị và báo cáo tuần |

**Nguyên tắc:** trạng thái phiên nấu (bước nào đã xong, bộ hẹn giờ nào đang chạy) do logic của app giữ, không giao cho AI. Công thức gốc không bị AI viết lại; khi cần điều chỉnh khẩu vị, app chỉ nhân hệ số cho từng nhóm gia vị.

## Vai trò của AI và phần logic cứng

AI xử lý phần cần linh hoạt bằng lời nói; mọi thứ cần đúng tuyệt đối do dữ liệu đã kiểm duyệt và thuật toán của app đảm nhiệm.

| Việc | Ai làm | Lý do |
| --- | --- | --- |
| Xếp thứ tự và song song các bước | Thuật toán của app, dựa trên dữ liệu bước có cấu trúc | Cần đúng và nhanh, không chấp nhận sai hoặc chậm khi đang nấu |
| Hẹn giờ, trạng thái phiên nấu | Logic của app | Là nguồn sự thật, chạy được cả khi mạng yếu |
| Trừ kho, quy đổi đơn vị, tính giá ước tính | Logic của app với bảng nguyên liệu chuẩn | Cần nhất quán giữa các lần nấu |
| Thời gian bảo quản, nhiệt độ chín an toàn, cảnh báo thực phẩm hết hạn | Bảng quy tắc từ nguồn y tế hoặc cơ quan chức năng | Sai có thể gây hại cho sức khỏe |
| Giải thích khi bỏ hoặc thay nguyên liệu | AI, dựa trên vai trò nguyên liệu trong công thức | Cần diễn đạt linh hoạt theo từng tình huống |
| Trả lời tình huống phát sinh khi đang nấu | AI | Câu hỏi đa dạng, không lường trước hết được |
| Diễn đạt lại lời khuyên bảo quản | AI, trong khuôn khổ bảng quy tắc | AI diễn giải, không tự đặt con số |

**Quy tắc cứng, không để AI tự do:** nhiệt độ chín của thịt gia cầm và hải sản, đồ ăn thừa để lâu, thực phẩm hết hạn, dị ứng đã khai báo. Với các mục này app hiển thị cảnh báo từ bảng quy tắc, kèm nguồn.

**Thông báo cho người dùng:** mọi lời khuyên do AI đưa ra kèm câu "AI có thể mắc lỗi". Với nhóm nguy hiểm ở trên, câu này không thay thế quy tắc cứng.

## Kiến trúc kỹ thuật và stack đề xuất

Nguyên tắc chính: nấu cùng và kho chạy hoàn toàn trên máy (offline-first); backend chỉ làm phần cần giữ bí mật hoặc cần chia sẻ như gọi AI, tài khoản và đồng bộ. Cách này giúp MVP chạy được khi mạng bếp yếu và làm backend rất nhỏ. Cột "Đề xuất" là lựa chọn mặc định; bạn quen công cụ nào thì đổi, không có ràng buộc nào khiến một lựa chọn bắt buộc.

| Lớp | Đề xuất | Lý do |
| --- | --- | --- |
| App di động | React Native với Expo (TypeScript), hoặc Flutter nếu bạn quen hơn | Một mã nguồn cho iOS và Android |
| Lưu trên máy | SQLite cho kho, phiên nấu, đánh giá, công thức | Chạy offline, truy vấn quan hệ cho gợi ý món và trừ kho |
| Công thức MVP | Đóng gói sẵn trong app dưới dạng JSON (30-50 món); giai đoạn sau tải về từ backend | MVP nấu được mà không cần backend |
| Hẹn giờ | Lưu thời điểm kết thúc tuyệt đối (`endsAt`) và đặt thông báo cục bộ theo đó; khi app mở lại thì tính lại từ `endsAt`, không dựa vào bộ đếm chạy nền | iOS và Android hạn chế tác vụ nền nên bộ đếm trong bộ nhớ có thể dừng |
| Backend | Dịch vụ mỏng (Node/TypeScript hoặc Python) và PostgreSQL; ban đầu chỉ có proxy gọi AI | Giữ khóa API ngoài app, giới hạn lượt dùng, ghi chi phí |
| AI | Mô hình ngôn ngữ có đầu vào ảnh, gọi qua backend; mô hình nhỏ cho hỏi đáp ngắn, mô hình mạnh hơn cho ảnh nếu cần | Cân bằng chi phí và chất lượng; chọn cụ thể sau khi thử trên dữ liệu thật |
| Tài khoản và đồng bộ | Giai đoạn 2 (đồng bộ kho giữa nhiều thiết bị, sao lưu) | MVP dùng được mà không cần đăng nhập |
| Đo lường | Sự kiện ẩn danh: bắt đầu và hoàn tất phiên nấu, lùi bước, sửa kho, lượt hỏi AI | Tính các chỉ số ở phần Chỉ số thành công |
| Kiểm thử | Test đơn vị cho thuật toán xếp lịch, trừ kho, quy đổi đơn vị, dùng bộ công thức mẫu | Đây là phần logic cứng, phải đúng |

### Danh sách màn hình

1. **Chào mừng và hồ sơ (MVP):** số người ăn, dị ứng, gia vị cơ bản đang có (muối, đường, dầu ăn, nước mắm), dụng cụ đang có.
2. **Trang chủ, gợi ý món (MVP):** danh sách món theo điểm gợi ý, bộ lọc thời gian.
3. **Chi tiết món (MVP):** nguyên liệu theo số phần, nút "Thay hoặc bỏ" (hỏi AI), chọn tiêu chí tối ưu.
4. **Chuẩn bị (MVP):** checklist nguyên liệu và dụng cụ trước khi bắt đầu.
5. **Nấu (MVP):** ba khối "Bây giờ làm", "Đang chờ", "Tiếp theo", nút Xong cỡ lớn, hẹn giờ, nút hỏi AI, màn hình luôn sáng.
6. **Hoàn tất (MVP):** tóm tắt phần kho đã trừ và sửa nhanh; từ giai đoạn 2 có thêm đánh giá món.
7. **Kho (MVP):** danh sách theo vị trí bảo quản, thêm tay, sửa lượng.
8. **Danh sách đi chợ (giai đoạn 2):** tạo từ món đã chọn, chốt thì cập nhật kho.
9. **Quét ảnh (giai đoạn 2):** chụp, xem đề xuất, xác nhận.
10. **Kiểm kê tuần (giai đoạn 2):** duyệt nhanh "còn không?" cho từng nguyên liệu.
11. **Hồ sơ khẩu vị và báo cáo tuần (giai đoạn 3).**

## Schema cơ sở dữ liệu chi tiết

Danh sách dưới đây dùng cho cả SQLite trên máy và PostgreSQL ở backend; tên bảng và cột viết dạng `snake_case`. Cột "Giai đoạn" cho biết khi nào bảng bắt đầu được dùng, bảng có thể tạo sớm hơn.

| Bảng | Cột chính | Giai đoạn |
| --- | --- | --- |
| `user_profile` | id, tên hiển thị, số người ăn, dị ứng (danh sách mã), chế độ ăn, gia vị cơ bản đang có (danh sách `ingredient_id`), dụng cụ đang có | MVP |
| `ingredient` | id (slug), tên chuẩn, tên gọi khác (danh sách), nhóm, đơn vị gốc (`g`, `ml` hoặc `cái`), bảng quy đổi (ví dụ thìa canh sang `ml`), mã dị ứng, giá tham khảo theo đơn vị gốc, ngày cập nhật giá, mã quy tắc bảo quản | MVP |
| `recipe` | id, slug, tên, số phần gốc, tổng phút, độ khó (1-3), thẻ (kho, xào, canh...), dụng cụ, trạng thái (`draft`, `reviewed`, `published`), người kiểm duyệt, ngày kiểm duyệt, phiên bản | MVP |
| `recipe_ingredient` | `recipe_id`, `ingredient_id`, lượng, đơn vị, ghi chú lượng ("vừa ăn"), vai trò (`flavor`, `structure`, `moisture`, `preservation`, `color`), nhóm vị (`salt`, `sugar`, `acid`, `fat`, `spice`, `none`), tùy chọn (đúng/sai), nhóm (nước ướp, nước sốt...) | MVP |
| `recipe_step` | id, `recipe_id`, thứ tự, tiêu đề, nội dung, loại (`active` hoặc `passive`), thời lượng giây, phụ thuộc (danh sách id bước), tài nguyên cần (dụng cụ), dấu hiệu nhận biết ("mặt dưới vàng nhẹ"), nhiệt độ mục tiêu, mã quy tắc an toàn | MVP |
| `pantry_item` | id, `ingredient_id`, lượng, đơn vị gốc, vị trí bảo quản, ngày thêm, ngày mở, hạn dùng, nguồn (`manual`, `cook`, `shopping`, `photo`) | MVP |
| `pantry_event` | id, `pantry_item_id`, thay đổi (`delta`), lý do (`cook`, `adjust`, `discard`, `buy`), `cook_session_id`, thời điểm | MVP (cho phép hoàn tác và đối soát) |
| `cook_session` | id, `recipe_id`, phiên bản công thức, số phần, tiêu chí tối ưu, bắt đầu, kết thúc, trạng thái (`cooking`, `done`, `abandoned`), trạng thái từng bước (JSON), nguyên liệu đã bỏ hoặc thay (JSON), hẹn giờ đang chạy (JSON, có `endsAt`) | MVP |
| `ai_usage_log` | id, `user_id`, loại (`substitute`, `qa`, `scan`), token vào và ra, chi phí, thời điểm | MVP |
| `storage_rule` | id, `ingredient_id` hoặc nhóm, trạng thái (tươi, đã mở, đã nấu), vị trí (ngăn mát, ngăn đá, nhiệt độ phòng), số ngày tối đa, tên nguồn, đường dẫn nguồn | Giai đoạn 2 |
| `shopping_list`, `shopping_list_item` | danh sách: id, trạng thái (nháp, đã chốt); mục: `ingredient_id`, lượng cần, lượng đã có, giá ước tính, đã mua | Giai đoạn 2 |
| `photo_scan` | id, trạng thái, kết quả mô hình (JSON), kết quả đã xác nhận (JSON), thời điểm; không lưu ảnh gốc | Giai đoạn 2 |
| `dish_rating` | `cook_session_id`, mặn nhạt (-1, 0, 1), ngọt (-1, 0, 1), thích (đúng/sai), phần đã ăn (ít, vừa, hết), ghi chú | Giai đoạn 2 |
| `taste_profile` | `user_id`, hệ số muối, hệ số đường, điểm ưa thích theo thẻ (JSON), số đánh giá, ngày cập nhật | Giai đoạn 3 |
| `nutrition_ref` | `ingredient_id`, trên 100 g: năng lượng, đạm, béo, tinh bột, đường, natri; tên nguồn | Giai đoạn 3 |
| `store_product` | id, `ingredient_id`, cửa hàng, tên sản phẩm, quy cách đóng gói, giá, ngày cập nhật | Khi có nguồn giá hợp lệ |

**Quy ước chung:**

- **Đơn vị:** mọi lượng quy về đơn vị gốc (`g`, `ml`, `cái`) khi trừ kho và tính giá; đơn vị đời thường (thìa, bó, nửa túi) chỉ dùng để hiển thị và nhập.
- **Khóa:** `ingredient` và `recipe` dùng slug dễ đọc, ổn định để khớp với JSON đóng gói trong app.
- **Phiên bản công thức:** sửa công thức đã xuất bản thì tăng `version`; `cook_session` lưu phiên bản đã dùng để lịch sử không bị đổi.
- **Mã dị ứng gợi ý:** đậu phộng, hạt cây, tôm cua (giáp xác), cá, trứng, sữa, đậu nành, lúa mì. Danh sách cuối cùng cần đối chiếu với tài liệu của cơ quan y tế.
- **Nguồn dữ liệu y tế:** `storage_rule` và `nutrition_ref` luôn ghi tên nguồn và đường dẫn để hiển thị cho người dùng.

## Định dạng công thức có cấu trúc

Mỗi món được viết thành một tệp JSON; app nạp vào `recipe`, `recipe_ingredient` và `recipe_step`. Ví dụ dưới đây là minh họa định dạng, lượng và thời gian chưa được kiểm duyệt.

```json
{
  "slug": "trung-chien-ca-chua",
  "name": "Trứng chiên cà chua",
  "servings_base": 2,
  "difficulty": 1,
  "equipment": ["chao", "to", "dao-thot"],
  "ingredients": [
    { "ingredient": "trung-ga", "qty": 3, "unit": "quả", "role": "structure" },
    { "ingredient": "ca-chua", "qty": 2, "unit": "quả", "role": "flavor", "flavor_group": "acid" },
    { "ingredient": "hanh-la", "qty": 1, "unit": "nhánh", "role": "flavor", "optional": true },
    { "ingredient": "nuoc-mam", "qty": 1, "unit": "thìa cà phê", "role": "flavor", "flavor_group": "salt" },
    { "ingredient": "duong", "qty": 0.5, "unit": "thìa cà phê", "role": "flavor", "flavor_group": "sugar" },
    { "ingredient": "dau-an", "qty": 2, "unit": "thìa canh", "role": "moisture" }
  ],
  "steps": [
    { "id": "s1", "title": "Cắt cà chua", "kind": "active", "seconds": 120, "after": [], "resources": ["dao-thot"], "text": "Rửa và cắt cà chua thành múi cau." },
    { "id": "s2", "title": "Đánh trứng", "kind": "active", "seconds": 90, "after": [], "resources": ["to"], "text": "Đập trứng vào tô, thêm nước mắm, đánh đều." },
    { "id": "s3", "title": "Chiên trứng", "kind": "active", "seconds": 180, "after": ["s2"], "resources": ["chao"], "cue": "Mặt dưới vàng nhẹ thì lật", "text": "Cho dầu vào chảo, đổ trứng, chiên chín rồi múc ra đĩa." },
    { "id": "s4", "title": "Xào cà chua", "kind": "active", "seconds": 240, "after": ["s1", "s3"], "resources": ["chao"], "cue": "Cà chua mềm và ra nước", "text": "Xào cà chua với đường đến khi mềm." },
    { "id": "s5", "title": "Trộn và nêm", "kind": "active", "seconds": 60, "after": ["s4"], "resources": ["chao"], "text": "Cho trứng vào, đảo nhẹ, nêm nếm rồi rắc hành." }
  ]
}
```

**Ý nghĩa các trường quan trọng:**

- **`kind`:** `active` là bước cần người làm; `passive` là bước chạy nền như ướp, hầm, luộc, để nguội, không cần người nhưng vẫn chiếm dụng cụ nếu có `resources`.
- **`after`:** các bước phải xong trước. Chỉ khai báo phụ thuộc thật; thứ tự bắt buộc về mặt nấu (ở ví dụ là trứng trước cà chua vì dùng chung chảo) cũng khai báo ở đây.
- **`resources`:** dụng cụ bị chiếm trong lúc bước chạy; mỗi dụng cụ chỉ phục vụ một bước tại một thời điểm.
- **`cue`:** dấu hiệu nhìn thấy được, hiển thị cho người mới thay vì chỉ có thời gian.
- **`role` và `flavor_group`:** dùng cho cảnh báo khi bỏ nguyên liệu và cho hệ số khẩu vị.
- **Lượng mơ hồ:** lượng kiểu "vừa ăn" lưu ở ghi chú lượng, không ép thành số.
- **`safety_rule`:** bước nấu thịt gia cầm, hải sản hoặc đồ dễ ngộ độc gắn mã quy tắc an toàn; app bắt xác nhận trước khi sang bước sau.

**Kiểm tra tự động khi nạp công thức (làm thành script chạy khi build):**

- Không có vòng phụ thuộc giữa các bước và mọi id trong `after` đều tồn tại.
- Mọi `ingredient` đều có trong bảng nguyên liệu chuẩn.
- Mọi dụng cụ trong `resources` đều có trong `equipment`.
- Có ít nhất một bước `active`; tổng thời gian không vượt ngưỡng hợp lý cho món.
- Trạng thái `reviewed` hoặc `published` bắt buộc có người kiểm duyệt và ngày kiểm duyệt.

## Thuật toán: xếp lịch, trừ kho, gợi ý món, khẩu vị

Toàn bộ phần này là logic của app, không gọi AI. Các con số trọng số và ngưỡng ghi "đề xuất" là điểm khởi đầu để chỉnh khi có dữ liệu thật.

### 1. Xếp lịch nấu

Đầu vào: các bước của công thức (`kind`, `seconds`, `after`, `resources`), tiêu chí tối ưu, và giả định chỉ có một người nấu. Ý tưởng: bước `passive` chạy nền, người nấu tranh thủ làm bước `active` khác trong lúc chờ; mỗi dụng cụ chỉ phục vụ một bước tại một thời điểm.

```
tail(s) = seconds(s) + max(tail(t) với t là các bước đứng sau s)   # 0 nếu không có bước sau
t = 0
while còn bước chưa xong:
    sẵn_sàng = các bước chưa chạy mà mọi bước trong after đã xong
    1. bước passive trong sẵn_sàng: bắt đầu ngay nếu dụng cụ rảnh
    2. nếu người nấu đang rảnh: chọn 1 bước active trong sẵn_sàng mà dụng cụ rảnh
         nhanh nhất      -> chọn bước có tail lớn nhất
         ít dụng cụ nhất -> ưu tiên bước dùng dụng cụ đang dùng sẵn, hòa thì chọn tail lớn nhất
    3. nhảy t tới thời điểm có bước kết thúc kế tiếp
```

- **Kết quả:** một kế hoạch gồm bước, thời điểm bắt đầu dự kiến, thời điểm kết thúc dự kiến. Màn hình Nấu hiển thị ba khối: "Bây giờ" (bước active hiện tại), "Đang chờ" (các bước passive đang đếm), "Tiếp theo".
- **Chạy thật khác kế hoạch:** khi người dùng bấm Xong sớm hoặc muộn, tính lại phần chưa chạy từ thời điểm thực. Bước `passive` đang đếm giữ nguyên `endsAt`.
- **Người dùng làm khác gợi ý:** cho phép nếu phụ thuộc đã thỏa; nếu chưa thỏa thì cảnh báo nhưng không chặn, trừ bước có quy tắc an toàn thì chặn cho đến khi xác nhận.
- **Giới hạn ở MVP:** thời lượng bước giữ nguyên khi đổi số phần; ghi vào danh sách cải tiến.
- **Bộ test cần có:** hai bước độc lập ngắn và dài; hai bước tranh cùng dụng cụ; bước passive chen bước active; người dùng làm lệch kế hoạch; công thức có vòng phụ thuộc phải bị từ chối khi nạp.

### 2. Trừ kho sau khi nấu

1. Với mỗi nguyên liệu của công thức mà người dùng không bỏ: lượng = lượng gốc × (số phần nấu / số phần gốc), quy về đơn vị gốc bằng bảng quy đổi của `ingredient`.
2. Nguyên liệu được thay thế: trừ nguyên liệu thay thế với lượng người dùng xác nhận.
3. Chọn các `pantry_item` cùng nguyên liệu, xếp theo hạn dùng gần nhất trước, trừ dần.
4. Không để số âm: nếu kho không đủ thì trừ về 0 và ghi nhận phần thiếu (người dùng có thể đã mua mà chưa nhập).
5. Mỗi lần trừ ghi một `pantry_event` với lý do `cook` và `cook_session_id`.
6. Màn hình Hoàn tất hiện danh sách vừa trừ để sửa nhanh; hoàn tác bằng cách đảo các sự kiện của phiên nấu đó.
7. Gia vị cơ bản mà người dùng đã khai là "luôn có sẵn" thì không trừ, để khỏi phiền.

### 3. Chấm điểm gợi ý món

Loại cứng trước: món có mã dị ứng của người dùng, món cần dụng cụ người dùng không có, món vượt thời gian người dùng chọn. Sau đó chấm điểm từ 0 đến 1 cho từng thành phần và cộng có trọng số:

`điểm = 0.5·phủ + 0.2·cấp_bách + 0.15·thời_gian + 0.1·khẩu_vị + 0.05·mới` (trọng số đề xuất)

- **phủ:** tỉ lệ nguyên liệu bắt buộc đã có đủ trong kho (không tính nguyên liệu tùy chọn và gia vị cơ bản đã khai).
- **cấp\_bách:** cao khi món dùng nguyên liệu sắp hết hạn (ví dụ còn không quá 2 ngày).
- **thời\_gian:** bằng 1 nếu món nằm trong thời gian người dùng muốn, giảm dần khi vượt.
- **khẩu\_vị:** 0 ở MVP (chia lại trọng số cho các thành phần còn lại); từ giai đoạn 3 lấy từ điểm ưa thích theo thẻ.
- **mới:** cộng nhẹ cho món chưa nấu lần nào.
- **Chế độ ước chừng** (kho trống hoặc người dùng muốn đi chợ): bỏ `phủ`, thay bằng điểm thấp-chi-phí. Chi phí = tổng lượng × giá tham khảo theo đơn vị gốc, hiển thị dạng khoảng (ví dụ cộng trừ 20%), không hiển thị như con số chính xác.
- Hiển thị khoảng 10 món đầu, trong đó giai đoạn 3 luôn có ít nhất 2 món chưa nấu lần nào.

### 4. Hệ số khẩu vị (giai đoạn 3)

- **Điểm đánh giá:** mặn = +1, vừa = 0, nhạt = -1; làm tương tự cho vị ngọt.
- **Độ lệch:** `bias_mới = 0.7·bias_cũ + 0.3·điểm` (trung bình trượt, để một lần đánh giá nhiễu không làm lệch hẳn).
- **Hệ số:** `hệ_số = 1 − 0.15·bias`, kẹp trong khoảng 0.7 đến 1.3 (đề xuất). Mặn thì hệ số nhỏ hơn 1, nhạt thì lớn hơn 1.
- **Áp dụng:** chỉ nhân cho nguyên liệu có `flavor_group` là `salt` hoặc `sugar` và `role` khác `preservation`; sau ít nhất 3 đánh giá (đề xuất). Hiển thị lượng đã chỉnh kèm dòng "đã chỉnh theo khẩu vị của bạn" và nút xem công thức gốc.
- **Trần an toàn:** hệ số không vượt khoảng kẹp dù người dùng liên tục đánh giá nhạt; khi đó app gợi ý thêm vị khác (chua, thơm, tiêu) thay vì tăng muối.
- **Điểm ưa thích theo thẻ:** với mỗi thẻ (kho, xào, canh, cay...), lấy trung bình đánh giá thích (+1) hoặc không thích (-1) của các món có thẻ đó; điểm khẩu vị của món là trung bình các thẻ của nó, bằng 0 nếu chưa có dữ liệu.
- **Món hay bỏ dở:** `cook_session` có trạng thái `abandoned` làm giảm nhẹ điểm của món và các món cùng thẻ, thời lượng dài.

### 5. Báo cáo dinh dưỡng tuần (giai đoạn 3)

Lượng nạp ước tính của một phiên = (tổng chất của công thức theo số phần nấu, tính từ `nutrition_ref`) chia số phần, nhân số khẩu phần người dùng ăn (ít, vừa, hết lần lượt là 0.5, 1, 1.5 khẩu phần; đề xuất). Báo cáo ghi rõ là ước tính, dùng ngôn từ tham khảo, không dùng giọng chẩn đoán. Natri từ nước mắm, hạt nêm, nước tương dùng giá trị trên nhãn sản phẩm nếu có, vì khác nhau giữa các hãng.

## AI: hợp đồng, prompt và giới hạn

AI xuất hiện ở bốn chỗ, mỗi chỗ có đầu vào và đầu ra theo schema mà app kiểm tra trước khi hiển thị. Nguyên tắc: AI chỉ đề xuất, app hoặc người dùng quyết định; AI không trực tiếp đổi hẹn giờ hay kho.

| Chức năng | App gửi vào | AI trả về | App kiểm tra |
| --- | --- | --- | --- |
| **Thay hoặc bỏ nguyên liệu** (MVP) | Món, nguyên liệu bị bỏ hoặc thay (kèm `role` và `flavor_group`), dị ứng, nguyên liệu đang có trong kho | JSON: `severity` (`low`, `medium`, `high`), `impact` (vị, kết cấu, an toàn), `suggestions` (nguyên liệu, gợi ý lượng, ghi chú), `confirm_required` | Nếu `role` là `preservation` hoặc dính mã dị ứng thì hiện cảnh báo cố định, bỏ qua kết luận của AI; gợi ý phải là nguyên liệu có trong bảng chuẩn; sai schema thì thử lại một lần rồi báo lỗi nhẹ |
| **Hỏi đáp khi đang nấu** (MVP) | Câu hỏi, bước hiện tại, các bước còn lại (rút gọn), hẹn giờ đang chạy | Văn bản ngắn, có thể kèm một đề xuất hành động (ví dụ "đặt thêm 2 phút") | App chỉ hiện nút cho đề xuất; hẹn giờ chỉ đổi khi người dùng bấm; câu trả lời không được đưa nhiệt độ an toàn hay hạn bảo quản ngoài quy tắc đã nạp |
| **Diễn đạt lời khuyên bảo quản** (giai đoạn 2) | Một bản ghi `storage_rule` | Một đến hai câu diễn đạt | App so số ngày trong câu với số trong quy tắc; không khớp thì hiện nguyên văn quy tắc |
| **Nhận diện nguyên liệu qua ảnh** (giai đoạn 2) | Ảnh đã nén | JSON `items`: tên, độ tin cậy (0 đến 1), ghi chú | Khớp tên với tên gọi khác của nguyên liệu chuẩn; độ tin cậy thấp hoặc không khớp thì gắn "không chắc"; luôn cần người dùng xác nhận |

### Khung prompt mẫu

Đây là khung ban đầu, cần thử và chỉnh trên câu hỏi thật. Ngữ cảnh (món, bước, nguyên liệu) gửi kèm dưới dạng JSON trong tin nhắn người dùng.

```
Bạn là trợ lý nấu ăn cho người mới. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu.
Quy tắc:
- Chỉ dùng dữ liệu được cung cấp (món, bước, nguyên liệu). Không biết thì nói là không chắc.
- Không tự đưa ra nhiệt độ an toàn, số ngày bảo quản hay hạn sử dụng; nếu cần, bảo người dùng xem phần quy tắc của app.
- Nếu người dùng có dị ứng được liệt kê, không gợi ý nguyên liệu chứa chất đó.
- Khi được yêu cầu JSON, chỉ trả JSON đúng schema, không thêm chữ nào khác.
- Không thay đổi hẹn giờ hay kho; chỉ đề xuất.
```

### Giới hạn và chi phí

- **Giới hạn lượt:** gói miễn phí có giới hạn lượt hỏi mỗi phiên nấu và số ảnh mỗi ngày (con số do bạn đặt sau khi đo chi phí thật).
- **Cắt ngữ cảnh:** chỉ gửi bước hiện tại và vài bước kế tiếp, không gửi toàn bộ kho hay toàn bộ lịch sử.
- **Chờ tối đa:** đặt thời gian chờ vài giây; quá thời gian thì hiện "Thử lại" và app vẫn chạy bình thường, hẹn giờ không bị ảnh hưởng.
- **Ghi chi phí:** mỗi lần gọi ghi vào `ai_usage_log`; cảnh báo khi chi phí trung bình mỗi phiên nấu vượt ngưỡng bạn chọn.
- **Báo lỗi:** mỗi câu trả lời có nút "Câu trả lời sai" để gom dữ liệu cải thiện prompt, và luôn kèm dòng "AI có thể mắc lỗi".

### Nhận diện ảnh: quy trình và kiểm thử (giai đoạn 2)

1. Chụp ảnh, nén xuống kích thước vừa đủ để nhận diện, gửi qua backend.
2. Mô hình trả danh sách tên và độ tin cậy.
3. App khớp tên với nguyên liệu chuẩn qua tên gọi khác; mục không khớp để người dùng gõ tên.
4. Màn hình xác nhận: bật hoặc tắt từng mục, sửa tên, chọn lượng (một ít, vừa, nhiều, mỗi mức ứng với một lượng mặc định theo nguyên liệu), chọn vị trí bảo quản.
5. Thêm vào `pantry_item` với nguồn `photo`, ghi `photo_scan`, bỏ ảnh.

**Kiểm thử trước khi ra mắt:** chụp khoảng vài chục ảnh tủ lạnh và bàn bếp thật, gắn nhãn bằng tay, đo tỉ lệ nhận đúng và tỉ lệ bỏ sót, chọn ngưỡng độ tin cậy, và tính chi phí mỗi ảnh. Đặt mục tiêu sau khi có số đo thật.

## API backend và phần chạy trên máy

Ở MVP backend chỉ cần hai đường dẫn, còn lại là các hàm chạy ngay trong app. Điều này giữ cho MVP nhỏ và nấu được cả khi mất mạng.

### Backend

| Đường dẫn | Việc | Giai đoạn |
| --- | --- | --- |
| `POST /v1/ai/substitute` | Hỏi AI khi thay hoặc bỏ nguyên liệu | MVP |
| `POST /v1/ai/ask` | Hỏi đáp khi đang nấu | MVP |
| `POST /v1/ai/scan` | Nhận diện nguyên liệu qua ảnh (tải ảnh lên) | Giai đoạn 2 |
| `POST /v1/auth/*` | Đăng ký, đăng nhập, làm mới phiên | Giai đoạn 2 |
| `GET /v1/sync`, `POST /v1/sync` | Đồng bộ kho, phiên nấu, đánh giá giữa các thiết bị (theo mốc thời gian `since`) | Giai đoạn 2 |
| `GET /v1/recipes?since=` | Tải công thức mới hoặc đã cập nhật | Giai đoạn 2 |
| `GET /v1/prices?since=` | Tải bảng giá tham khảo mới | Giai đoạn 2 |
| `GET /v1/taste-profile` | Lấy hồ sơ khẩu vị đã tính | Giai đoạn 3 |
| `POST /v1/import/video` | Gửi đường dẫn video, nhận công thức nháp để người dùng sửa trước khi nấu | Giai đoạn 3 |

**Quy ước chung:** mọi đường dẫn AI yêu cầu xác thực từ giai đoạn 2 (MVP dùng mã thiết bị ẩn danh để giới hạn lượt); vượt giới hạn trả mã `429` kèm `retry_after`; lỗi trả dạng `{ "code": "...", "message": "..." }`; mọi phản hồi AI kiểm tra schema ở backend trước khi trả về app.

**Ví dụ minh họa cho `POST /v1/ai/substitute`:**

```json
// request
{
  "recipe": "trung-chien-ca-chua",
  "action": "omit",
  "ingredient": "hanh-la",
  "role": "flavor",
  "allergies": [],
  "pantry": ["trung-ga", "ca-chua"]
}

// response
{
  "severity": "low",
  "impact": {
    "taste": "Mất mùi thơm nhẹ của hành lá",
    "texture": "Không đổi",
    "safety": "Không ảnh hưởng"
  },
  "suggestions": [
    { "ingredient": "ngo-ri", "amount_hint": "một ít", "note": "Nếu có, rắc thêm cho thơm" }
  ],
  "confirm_required": false
}
```

### Các dịch vụ chạy trong app

Tách thành các module có giao diện rõ ràng để test riêng và để giai đoạn sau đổi nguồn dữ liệu mà không sửa giao diện người dùng.

| Module | Hàm chính |
| --- | --- |
| `RecipeRepo` | `list(filters)`, `get(slug)` |
| `Scheduler` | `plan(recipe, servings, mode)`, `replan(session, now)` |
| `TimerService` | `schedule(stepId, endsAt)`, `cancel(stepId)`, `restore()` khi mở lại app |
| `SessionService` | `start`, `advance`, `finish`, `abandon` |
| `PantryService` | `add`, `adjust`, `deductForSession(sessionId)`, `undoSession(sessionId)` |
| `SuggestService` | `rank(profile, pantry, filters)` |
| `SafetyRules` | `check(step)`, `allergyConflicts(recipe, profile)` |
| `AiClient` | `substitute(...)`, `ask(...)`, `scan(...)` (gọi backend, kiểm tra schema, xử lý hết thời gian chờ) |

## Rủi ro và cách xử lý

Rủi ro lớn nhất của MVP là dữ liệu công thức và kho kém tin cậy; hai rủi ro cần xử lý sớm nhất là nhập liệu và an toàn thực phẩm.

| Rủi ro | Hậu quả | Cách xử lý |
| --- | --- | --- |
| Người dùng không muốn nhập kho | Kho trống, gợi ý kém, bỏ app | Kho cập nhật nhờ nấu xong tự trừ (MVP) và nhờ chốt đi chợ (giai đoạn 2); lượng nhập theo ước chừng |
| Kho lệch dần so với thực tế | Gợi ý sai, mất tin | Màn hình kiểm kê nhanh hàng tuần; cho sửa lượng chỉ với một chạm |
| Công thức sai hoặc thiếu lượng | Món hỏng, người mới nản | Chỉ dùng công thức đã kiểm duyệt trong MVP; nhập từ video để sau và bắt buộc người dùng xem, sửa trước khi nấu |
| Tên nguyên liệu không khớp | Ghép món và trừ kho sai | Nguyên liệu chuẩn có nhiều tên gọi; tên sản phẩm cửa hàng gắn vào nguyên liệu chuẩn |
| Lời khuyên bảo quản hoặc an toàn sai | Có thể gây hại sức khỏe | Quy tắc cứng từ nguồn y tế, hiển thị nguồn, kèm câu "AI có thể mắc lỗi" |
| Dị ứng và chế độ ăn đặc biệt | Gợi ý món không phù hợp | Cho khai báo dị ứng khi bắt đầu, lọc món và cảnh báo khi thay nguyên liệu |
| Lấy giá từ cửa hàng | Vướng điều khoản sử dụng, bị chặn, giao diện đổi | Dùng bảng giá tham khảo theo nguyên liệu chuẩn; kiểm tra API và điều khoản từng chuỗi trước khi cân nhắc lấy giá trực tiếp |
| Chi phí AI mỗi phiên nấu | Người dùng miễn phí làm lỗ | Phần cố định (bước, hẹn giờ, trừ kho) không gọi AI; AI chỉ dùng khi người dùng hỏi |
| Độ trễ khi đang nấu | Người dùng đang cầm chảo nóng phải đợi | Chạy bước và hẹn giờ ngay trên máy, không phụ thuộc AI; ưu tiên chạy được khi mạng yếu |
| Quyền riêng tư | Dữ liệu ăn uống, dị ứng và thói quen là dữ liệu nhạy cảm | Quyết định dữ liệu nào lưu trên máy, dữ liệu nào lên máy chủ, và gửi gì cho bên AI thứ ba trước khi ra mắt |
| Giọng nói trong bếp ồn | Điều khiển rảnh tay kém | Giai đoạn 1 ưu tiên nút lớn, màn hình sáng; thử giọng nói trong bếp thật trước khi đầu tư |
| Nhận diện ảnh sai hoặc tốn chi phí | Kho sai, tốn tiền gọi mô hình ảnh | Luôn có bước xác nhận; gắn nhãn không chắc; giới hạn số ảnh mỗi ngày; thử trên ảnh thật trước khi ra mắt; không lưu ảnh sau khi xử lý |
| Học khẩu vị làm gợi ý lặp hoặc đẩy người dùng ăn mặn, ngọt dần | Mất hứng, ảnh hưởng sức khỏe | Đặt trần hệ số muối đường; luôn chen món mới; dùng trung bình nhiều lần đánh giá thay vì một lần |

## Chỉ số thành công

MVP thành công khi người mới nấu xong món đầu tiên và quay lại nấu món thứ hai. Các chỉ số dưới đây là đề xuất; mục tiêu con số cần đặt sau khi có nhóm người dùng thử đầu tiên.

| Chỉ số | Cách đo | Vì sao quan trọng |
| --- | --- | --- |
| Tỉ lệ nấu xong món đầu tiên | Người dùng mới bắt đầu phiên nấu và bấm hoàn tất | Cho biết hướng dẫn từng bước có dùng được không |
| Tỉ lệ quay lại nấu món thứ hai | Phiên nấu thứ hai trong vài tuần đầu | Chỉ số giữ chân chính của MVP |
| Số bước bị bỏ qua hoặc quay lại | Số lần người dùng lùi bước hoặc thoát giữa chừng | Chỉ ra bước viết khó hiểu hoặc xếp sai thứ tự |
| Tỉ lệ sửa kho sau khi nấu | Số lần người dùng chỉnh lượng tự trừ | Cho biết ước chừng lượng có đủ sát không |
| Tỉ lệ hỏi AI thay nguyên liệu | Số lượt hỏi trên mỗi phiên nấu, kèm đánh giá hữu ích | Cho biết tính năng này đáng giữ và đo chi phí AI |
| Chi phí AI trung bình mỗi phiên nấu | Tổng chi phí gọi AI chia cho số phiên | Xác định mô hình kiếm tiền có gánh nổi không |

Sau giai đoạn 2, thêm hai chỉ số: số đánh giá món (mặn, vừa, nhạt) thu được trên mỗi người dùng, và lượng nguyên liệu sắp hết hạn mà người dùng đã dùng kịp.

## Mô hình kiếm tiền

Đề xuất: MVP chưa thu tiền, giai đoạn 2 thêm liên kết đi chợ, giai đoạn 3 mở thuê bao cho các tính năng cá nhân hóa. Các con số về giá và hoa hồng chưa có dữ liệu, cần đo và hỏi trực tiếp đối tác.

| Nguồn thu | Cách hoạt động | Giai đoạn | Điều kiện và rủi ro |
| --- | --- | --- | --- |
| **Liên kết đi chợ** | Khi người dùng chốt danh sách đi chợ, app mở liên kết sang sàn hoặc cửa hàng và nhận hoa hồng nếu mua qua liên kết | Giai đoạn 2 | Cá nhân đăng ký được chương trình của Lazada, Shopee hoặc mạng trung gian như ACCESSTRADE; các sàn này hợp với đồ khô, gia vị, dụng cụ hơn đồ tươi; chưa thấy chương trình công khai của Winmart, GO!, Bách Hóa Xanh; cần kiểm tra điều khoản dùng liên kết trong app |
| **Thuê bao (freemium)** | Miễn phí cho phần cốt lõi, trả phí cho phần tốn chi phí AI và cá nhân hóa | Giai đoạn 3 | Người mới nấu thường ngại trả phí; cần thử giá |
| **Hợp tác nhãn hàng** | Nội dung tài trợ ghi rõ là tài trợ (nước mắm, gia vị, dụng cụ bếp) | Sau giai đoạn 3 | Mất niềm tin nếu người dùng tưởng gợi ý là quảng cáo ngầm |

**Không làm:** quảng cáo hiển thị trong lúc đang nấu (phá trải nghiệm chính), bán dữ liệu cá nhân (dữ liệu ăn uống và dị ứng rất nhạy cảm).

### Gói miễn phí và trả phí (đề xuất)

| Tính năng | Miễn phí | Trả phí |
| --- | --- | --- |
| Nấu cùng từng bước, hẹn giờ | Có | Có |
| Kho và gợi ý món | Có | Có |
| Hỏi AI | Có giới hạn lượt | Hạn mức cao hơn |
| Nhận diện nguyên liệu qua ảnh | Vài ảnh mỗi ngày | Nhiều ảnh hơn |
| Học khẩu vị, báo cáo tuần | Xem thử | Đầy đủ |
| Hồ sơ cho nhiều người trong nhà | Một hồ sơ | Nhiều hồ sơ |

### Điều kiện để mô hình đứng được

- Doanh thu trung bình mỗi người dùng mỗi tháng (hoa hồng cộng thuê bao) phải lớn hơn chi phí AI trung bình mỗi người dùng mỗi tháng.
- Đo từ sớm: chi phí AI từ `ai_usage_log`, và các sự kiện "chốt danh sách đi chợ", "bấm sang cửa hàng", "mua qua liên kết" (nếu chương trình cho phép đối soát).
- Chưa kiểm tra: thủ tục thuế cho thu nhập hoa hồng và thuê bao của cá nhân; nên hỏi người có chuyên môn trước khi thu tiền.

## Lộ trình xây dựng theo mốc

Các mốc đi theo thứ tự phụ thuộc: dữ liệu trước, logic nấu cùng tiếp theo, rồi kho và AI. Cỡ việc là tương đối (S nhỏ, M vừa, L lớn); thời gian thật phụ thuộc tốc độ của bạn.

**Nên bắt đầu từ đâu:** viết `Scheduler` và bộ test của nó trước, chạy bằng script không cần giao diện, vì đây là phần rủi ro kỹ thuật lớn nhất và kiểm chứng được sớm nhất. Song song, chuyển 3 món mẫu sang JSON để có dữ liệu thử.

| Mốc | Nội dung | Xong khi | Cỡ |
| --- | --- | --- | --- |
| **M0. Dữ liệu nền** (MVP) | 30-50 món sang JSON; bảng nguyên liệu chuẩn và quy đổi; bảng giá tham khảo; script kiểm tra tự động; người biết nấu kiểm duyệt | Script kiểm tra chạy sạch cho mọi món; mỗi món có người kiểm duyệt | L |
| **M1. Khung app** (MVP) | Dựng app, SQLite, nạp công thức; màn Chào mừng, Trang chủ, Chi tiết món | Xem được danh sách và chi tiết mọi món; đổi số phần thì lượng đổi đúng | M |
| **M2. Phiên nấu** (MVP) | `Scheduler` và test; `TimerService` với thông báo cục bộ; màn Chuẩn bị và Nấu | Nấu trọn vẹn 3 món mẫu theo kế hoạch; hẹn giờ kêu đúng khi app ở nền hoặc khóa màn hình; chạy được khi tắt mạng; qua hết bộ test xếp lịch | L |
| **M3. Kho và gợi ý** (MVP) | `PantryService` (trừ kho, hoàn tác), `SuggestService`, màn Hoàn tất và Kho | Kho trừ khớp với tính tay trên 5 món; món có mã dị ứng của người dùng không bao giờ xuất hiện | M |
| **M4. AI** (MVP) | Proxy AI, `substitute`, `ask`, giới hạn lượt, `ai_usage_log`, `SafetyRules` | Phản hồi đúng schema; cảnh báo cố định cho dị ứng và nguyên liệu bảo quản; app vẫn chạy khi AI quá thời gian chờ | M |
| **M5. Thử kín** (MVP) | 10-20 người không biết nấu thử trong bếp thật | Có số đo cho các chỉ số ở phần Chỉ số thành công và danh sách việc sửa theo ưu tiên | M |
| **M6. Đi chợ và đồng bộ** (giai đoạn 2) | Tài khoản, danh sách đi chợ, chốt thì kho cập nhật, kiểm kê tuần, liên kết đi chợ | Chốt danh sách thì kho tự cập nhật; đồng bộ hai thiết bị không mất dữ liệu | L |
| **M7. Bảo quản và đánh giá** (giai đoạn 2) | `storage_rule` từ nguồn y tế, hiển thị hạn, diễn đạt bằng AI; `dish_rating` | Mọi nguyên liệu trong bộ món có quy tắc kèm nguồn; đánh giá lưu được | M |
| **M8. Nhận diện ảnh** (giai đoạn 2) | Quy trình quét, màn xác nhận, bộ ảnh thử | Có số đo tỉ lệ nhận đúng, bỏ sót và chi phí mỗi ảnh, từ đó chọn ngưỡng | M |
| **M9. Khẩu vị** (giai đoạn 3) | `taste_profile`, hệ số muối đường, gợi ý theo thẻ | Test đơn vị cho công thức hệ số; trần điều chỉnh hoạt động đúng | M |
| **M10. Báo cáo tuần và thuê bao** (giai đoạn 3) | `nutrition_ref`, báo cáo ước tính, thanh toán thuê bao | Báo cáo ghi rõ là ước tính; thu phí hoạt động | M |
| **M11. Nhập công thức từ video** (giai đoạn 3) | Trích xuất công thức nháp, người dùng sửa trước khi nấu, ghi nguồn | Công thức nháp sửa được và gắn nhãn nguồn rõ | L |

## Kế hoạch kiểm chứng và việc tiếp theo

Trước khi xây nhiều, kiểm chứng ba điều rẻ nhất trước: công thức có cấu trúc dùng được không, người mới có làm theo được không, và dữ liệu cần có sẵn chưa.

- [ ] Chọn danh sách khoảng 30-50 món Việt cho MVP, ưu tiên món dễ, ít bước, nguyên liệu phổ biến
- [ ] Chuyển từng món sang dạng có cấu trúc (nguyên liệu kèm vai trò, bước kèm thời lượng, loại việc, phụ thuộc) và nhờ người biết nấu kiểm duyệt
- [ ] Dựng bảng nguyên liệu chuẩn với các tên gọi khác và quy đổi ước lượng (một bó, một thìa, nửa túi)
- [ ] Dựng bảng giá tham khảo theo nguyên liệu chuẩn và chọn tần suất cập nhật
- [ ] Tìm nguồn quy tắc bảo quản và an toàn thực phẩm từ cơ quan y tế để làm bảng quy tắc cứng
- [ ] Kiểm tra khả năng lấy dữ liệu và điều khoản sử dụng của Winmart, GO!, Bách Hóa Xanh cho giai đoạn sau
- [ ] Làm prototype chế độ nấu cùng (chỉ gồm bước, hẹn giờ, trừ kho) và cho vài người không biết nấu thử trong bếp thật
- [ ] Xác định chi phí AI cho mỗi phiên nấu và chọn mô hình kiếm tiền sơ bộ
- [ ] Quyết định dữ liệu nào lưu trên máy, dữ liệu nào lên máy chủ, và gửi gì cho bên AI thứ ba

## Câu hỏi còn mở

Các quyết định dưới đây chưa chốt và ảnh hưởng đến phạm vi hoặc chi phí.

1. **Khẩu vị "muối, đường trên nước":** cần xác nhận ý là nồng độ muối, đường trong phần nước dùng hoặc nước kho, vì nó quyết định cách lưu dữ liệu ở giai đoạn 3.
2. **Tiêu chí tối ưu khi nấu:** người dùng chọn nhanh nhất, ít dụng cụ nhất, hay rẻ nhất; MVP nên chỉ có một hoặc hai lựa chọn.
3. **Nguồn công thức cho MVP:** tự biên tập, lấy từ một nguồn có thỏa thuận sử dụng, hay kết hợp; cần rõ về bản quyền trước khi đưa vào app.
4. **Mô hình kiếm tiền:** đã đề xuất ở phần Mô hình kiếm tiền (liên kết đi chợ trước, thuê bao sau); cần chốt mức giá và kiểm tra điều khoản của từng chương trình liên kết, vì người dùng mới nấu thường ngại trả phí.
5. **Khẩu vị nhiều người:** khi cả nhà ăn chung một nồi, chỉnh theo ai.
6. **Giới hạn khi chiều khẩu vị:** có đặt trần điều chỉnh muối, đường để tránh người dùng dần ăn mặn hoặc ngọt hơn không.
7. **Nền tảng:** một hệ điều hành trước (iOS hoặc Android) hay cả hai ngay từ đầu, vì hẹn giờ chạy nền khác nhau giữa hai hệ.
