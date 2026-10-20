# Quy chuẩn viết mã và chú thích (Coding & Comment Conventions)

Tài liệu này quy định chuẩn mực viết code và chú thích trong toàn bộ dự án Trợ lý nấu ăn. Mọi file code được sinh ra phải tuân thủ nghiêm ngặt 7 quy tắc dưới đây.

---

## 1. Đầu mỗi file (3–6 dòng)
- File này làm gì, nhận vào gì, trả ra gì.
- Ai gọi nó, nó gọi những module nào.
- Bám theo mục nào của `docs/plan.md` (nếu có).

## 2. Trước mỗi hàm (cả hàm chính và hàm phụ)
- **Làm gì:** 1–2 câu, dùng ngôn ngữ đời thường, dễ hiểu.
- **Vào:** từng tham số, ý nghĩa và đơn vị cụ thể (giây, gam, số phần...).
- **Ra:** trả về gì, kể cả khi lỗi hay không có kết quả.
- **Ví dụ có số cụ thể:** Ví dụ: "3 quả trứng, nấu 4 phần thay vì 2 phần → trả về 6 quả."
- **Gọi bởi / gọi tới:** để lần theo luồng chạy của chương trình.

## 3. Trước mỗi if, else, switch, for, while có ý nghĩa nghiệp vụ
- Ghi một dòng giải thích nghiệp vụ (để làm gì), không dịch lại cú pháp code.
  - *Ví dụ đúng:* `// Chặn không cho sang bước tiếp nếu bước hiện tại là bước an toàn mà người dùng chưa bấm xác nhận.`
  - *Ví dụ sai:* `// nếu confirmed là false thì return.`
- Với if có nhánh `else` hoặc nhiều nhánh: ghi rõ từng nhánh ứng với tình huống nào.
- Với vòng lặp: ghi vòng lặp duyệt qua cái gì, mỗi vòng làm gì, và khi nào dừng.
- Điều kiện thoát sớm (`return`, `continue`, `break`, ném lỗi): ghi rõ lý do thoát.

## 4. Hàm dài chia thành các bước đánh số
- Trong hàm có logic nhiều giai đoạn (xếp lịch, trừ kho, chấm điểm), chia thân hàm bằng các dòng chú thích: `// Bước 1: ...`, `// Bước 2: ...`.
- Nếu bám thuật toán trong kế hoạch thì tên bước và thứ tự phải khớp với kế hoạch, kèm tên mục đối chiếu.

## 5. Con số và hằng số
- Mọi con số có ý nghĩa nghiệp vụ (trọng số điểm, ngưỡng, hệ số, giới hạn lượt, số lần thử lại) phải đặt trong hằng số có tên, tuyệt đối không để số trần (magic numbers) trong logic.
- Mỗi hằng số có chú thích: nó là gì, đơn vị, từ đâu ra. Nếu là con số “đề xuất” của kế hoạch thì ghi rõ `// đề xuất, chưa kiểm chứng`.

## 6. Cách viết
- Tiếng Việt, dễ hiểu, giải thích để làm gì và vì sao, không dịch lại từng dòng code.
- Không chú thích dòng hiển nhiên (như tăng biến đếm lên 1).
- Chú thích phải luôn đúng với code. Sửa code thì sửa chú thích trong cùng commit. Chú thích lệch code là lỗi.
- Chỗ tạm hoặc không chắc phải ghi rõ (`// tạm: chưa xử lý trường hợp...`, `// chưa chắc: cần kiểm tra...`). Không viết như đã chắc.
- Không dùng TODO trần; mọi TODO phải kèm lý do và mã task sẽ xử lý (ví dụ: `// TODO(T18): nối AI vào đây`).

## 7. Tên gọi
- Tên hàm và biến đầy đủ, nói rõ việc nó làm (ví dụ `tinhThoiGianConLai`, không viết `calc` hay `tgcl`). Không viết tắt tùy tiện.
- Mỗi hàm làm một việc. Hàm dài quá thì tách thành các hàm nhỏ, mỗi hàm nhỏ có chú thích riêng theo mục 2.

---
*(Lưu ý: Bỏ mục 8 về nộp file mẫu và danh sách if/for chưa chú thích, do dự án thực hiện nghiệm thu độc lập theo tài liệu "Nghiệm thu bằng bằng chứng").*
