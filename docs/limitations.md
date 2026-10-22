# Giới hạn đã biết của sản phẩm (docs/limitations.md)

Tài liệu này ghi lại các giới hạn kỹ thuật và nghiệp vụ đã biết trong phiên bản MVP, bám theo các quyết định trong [`docs/plan.md`](plan.md) và [`docs/tasks.md`](tasks.md).

---

## 1. Giới hạn Scheduler (T04.8)

- **Thời lượng bước giữ nguyên khi đổi số phần ăn:**
  - **Mô tả:** Khi người dùng thay đổi số phần ăn từ `servings_base` (ví dụ 2 phần lên 4 phần), thời lượng của từng bước nấu (`seconds`) vẫn được giữ nguyên không đổi trong phiên bản MVP.
  - **Căn cứ kế hoạch:** [`docs/plan.md:L269`](plan.md#L269) ("Giới hạn ở MVP: thời lượng bước giữ nguyên khi đổi số phần; ghi vào danh sách cải tiến.") và [`docs/tasks.md:L154`](tasks.md#L154) ("T04.8: Thời lượng bước giữ nguyên khi đổi số phần (ghi vào `docs/limitations.md`).").
  - **Lý do kỹ thuật:** Việc tăng số phần có thể làm tăng nhẹ thời gian xào nấu hoặc đun sôi nước, nhưng phụ thuộc lớn vào công suất bếp và loại nồi chảo của từng gia đình; MVP ưu tiên giữ thuật toán xếp lịch xác định và dễ dự đoán trước khi thu thập dữ liệu nấu thực tế ở các giai đoạn sau.
