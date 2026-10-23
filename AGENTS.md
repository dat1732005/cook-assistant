# Hướng dẫn và Quy tắc chung dành cho AI Agent (AGENTS.md)

Tài liệu này tóm tắt các nguyên tắc cốt lõi, giới hạn hoạt động và chuẩn mực bắt buộc áp dụng đối với mọi AI Agent (Antigravity, Claude, v.v.) khi làm việc trong dự án **Trợ lý nấu ăn**.

---

## 1. Phạm vi hoạt động (Workspace Scope)
- **Chỉ thao tác trong repository:** Mọi thao tác đọc, ghi file, cài đặt gói, thực thi lệnh chỉ được phép diễn ra trong thư mục của dự án (`cook-assistant`). Tuyệt đối không đọc, ghi, chỉnh sửa hay can thiệp vào bất kỳ tệp tin hoặc thư mục nào bên ngoài repository.
- **Không truy cập mạng trái phép:** Không tự ý gửi dữ liệu, mã nguồn hoặc thông tin dự án ra các dịch vụ ngoài trừ các lệnh git push/pull tới remote repo đã cấu hình.

---

## 2. Quy tắc cốt lõi R1 – R6 (Không bịa dữ liệu & Nghiệm thu bằng chứng)
Trích xuất từ `docs/tasks.md` (mục 0 & 2):

- **R1. Tuyệt đối không tự tạo hoặc ước đoán dữ liệu nghiệp vụ:**
  - Không tự bịa công thức (tên món, nguyên liệu, lượng, thời gian, thứ tự bước, dấu hiệu nhận biết `cue`).
  - Không tự bịa bảng quy đổi đơn vị, mức "một ít / vừa / nhiều", giá tham khảo, mã dị ứng của nguyên liệu, số liệu an toàn thực phẩm, thời gian bảo quản, nhiệt độ chín, số liệu dinh dưỡng, chi phí token/AI hay chính sách pháp lý.
  - Thư mục `data/` trong các task chưa có dữ liệu thật phải giữ trạng thái sạch/rỗng hợp lệ (mảng `[]`), vượt qua kiểm tra của `pnpm validate-data --strict`.

- **R2. Xử lý khi thiếu dữ liệu:**
  - Dừng ngay phần việc cần dữ liệu đó, tuyệt đối không "điền tạm cho chạy được".
  - Trong tệp schema/dữ liệu, để trường là `null` kèm ghi nhận trong `missing_fields` (hoặc `"status": "MISSING"`), ném lỗi rõ ràng khi runtime cố truy cập dữ liệu thiếu.
  - Nộp danh sách dữ liệu thiếu rõ ràng (tệp, trường, loại nguồn cần tìm kiếm). Phần việc không phụ thuộc dữ liệu thiếu vẫn tiếp tục bình thường.

- **R3. Tách biệt hoàn toàn dữ liệu thật và dữ liệu giả lập:**
  - Dữ liệu thử nghiệm phải đặt riêng trong `fixtures/`, mỗi tệp ghi rõ `"synthetic": true`. Tuyệt đối không đặt tệp giả vào `data/` và không bao giờ đóng gói vào bản dựng ứng dụng phát hành (`production`).
  - Dữ liệu thật trong `data/` phải có trường `source` (nguồn gốc) và `confirmed_by` (người xác nhận có chuyên môn). Bản build `production` phải thất bại nếu còn tồn tại dữ liệu `MISSING` hoặc thiếu nguồn.

- **R4. Bằng chứng nghiệm thu thật (Không làm giả):**
  - Mọi output test, log terminal, ảnh chụp, video phải là kết quả chạy thật trên máy. Nếu không chạy được (ví dụ chưa có máy ảo Android), bắt buộc ghi rõ `"CHƯA CHẠY"` kèm lý do thật, tuyệt đối không tạo log giả hay làm ảnh giả.
  - Không báo "Xong" khi test chưa xanh. Giá trị kỳ vọng trong test phải do chủ dự án cung cấp (tính tay); Agent không được tự tính rồi lấy chính kết quả đó làm kỳ vọng.

- **R5. Tuân thủ chốt chặn các task:** Mọi task (từ T01 đến T23) đều phải đối chiếu và tuân thủ các quy tắc R1–R4.

- **R6. Tôn trọng phân định trách nhiệm dữ liệu:** Dữ liệu chuẩn (công thức, y tế, an toàn, giá cả, dị ứng) do chủ dự án biên tập và cung cấp. Agent chỉ thiết kế khung xử lý, thuật toán và công cụ kiểm định tự động.

---

## 3. Tuyệt đối không sửa đổi `docs/expected/`
- Thư mục `docs/expected/` (như `T04.md`, `T05.md`, `T06.md`, ...) là **hợp đồng kỳ vọng gốc do chủ dự án tính tay trước khi giao việc**.
- Agent **tuyệt đối không được sửa, thêm hoặc bớt** bất kỳ ký tự nào trong các tệp này.
- Khi test không đạt (đỏ), Agent phải sửa mã nguồn chương trình, không được sửa file kỳ vọng. Nếu nghi ngờ có sai sót trong file kỳ vọng, phải dừng lại, giải trình lý do và đợi chủ dự án phê duyệt bằng văn bản.
- Hệ thống CI (`pnpm verify`) kiểm tra tính toàn vẹn mã băm SHA-256 của toàn bộ tệp trong `docs/expected/`.

---

## 4. Quy chuẩn viết mã và chú thích (docs/coding-rules.md)
1. **Header đầu file (3–6 dòng):** Làm gì, nhận gì, trả gì, ai gọi, gọi module nào, bám theo mục nào trong `docs/plan.md`.
2. **Docstring trước hàm:** 1–2 câu dễ hiểu, tham số kèm đơn vị cụ thể, kết quả trả về, **ví dụ số cụ thể**, gọi bởi/gọi tới.
3. **Chú thích nghiệp vụ:** Luôn giải thích lý do nghiệp vụ trước mọi rẽ nhánh hoặc vòng lặp (`if`, `else`, `switch`, `for`, `while`), không dịch lại cú pháp ngôn ngữ.
4. **Hàm dài chia bước đánh số:** `// Bước 1: ...`, `// Bước 2: ...` khớp theo thuật toán kế hoạch.
5. **Không magic numbers:** Mọi con số nghiệp vụ phải đặt trong hằng số có tên kèm giải thích đơn vị và xuất xứ.
6. **Không TODO trần:** Mọi TODO phải có lý do và mã task xử lý (ví dụ: `// TODO(T18): nối AI...`).
7. **Tên biến/hàm đầy đủ:** Tiếng Việt hoặc tiếng Anh rõ nghĩa, không viết tắt tùy tiện.

---

## 5. Quy chuẩn báo cáo nghiệm thu
- **Ngắn gọn, súc tích (Tối đa 1 trang A4):** Không dán log terminal dài dòng lan man, chỉ trích xuất các kết quả cốt lõi.
- **Nộp đúng bằng chứng bắt buộc:**
  1. Danh sách file tạo/sửa (`git show --stat` hoặc `git status`).
  2. Dòng tổng kết nguyên văn và mã thoát của các lệnh kiểm tra (`pnpm verify`).
  3. Bằng chứng chạy thật (ảnh chụp/kết quả chạy hoặc ghi nhận `"CHƯA CHẠY"` trung thực).
  4. Danh sách các quyết định kỹ thuật phát sinh hoặc điểm làm khác/chưa làm được.
