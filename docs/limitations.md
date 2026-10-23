# Giới hạn đã biết của sản phẩm (docs/limitations.md)

Tài liệu này ghi lại các giới hạn kỹ thuật và nghiệp vụ đã biết trong phiên bản MVP, bám theo các quyết định trong [`docs/plan.md`](plan.md) và [`docs/tasks.md`](tasks.md).

---

## 1. Giới hạn Scheduler (T04.8)

- **Thời lượng bước giữ nguyên khi đổi số phần ăn:**
  - **Mô tả:** Khi người dùng thay đổi số phần ăn từ `servings_base` (ví dụ 2 phần lên 4 phần), thời lượng của từng bước nấu (`seconds`) vẫn được giữ nguyên không đổi trong phiên bản MVP.
  - **Căn cứ kế hoạch:** [`docs/plan.md:L269`](plan.md#L269) ("Giới hạn ở MVP: thời lượng bước giữ nguyên khi đổi số phần; ghi vào danh sách cải tiến.") và [`docs/tasks.md:L154`](tasks.md#L154) ("T04.8: Thời lượng bước giữ nguyên khi đổi số phần (ghi vào `docs/limitations.md`).").

---

## 2. Thư viện SQLite trong môi trường thử nghiệm (T05)

- **node:sqlite chỉ dùng cho test và gắn với phiên bản Node đã cố định:**
  - **Mô tả:** `node:sqlite` là tính năng thử nghiệm của Node.js, chỉ được dùng làm driver chạy test trên môi trường Node (`NodeSqliteDriver`), tuyệt đối không dùng trên ứng dụng di động thật (ứng dụng di động dùng `expo-sqlite`). Việc sử dụng này gắn chặt với phiên bản Node.js đã được quy định cố định (`.nvmrc` là `22.23.2`, dải `engines` là `>=22.23.2 <23`). Cờ `--disable-warning=ExperimentalWarning` được cấu hình riêng trong Vitest (`execArgv`) để tắt đúng cảnh báo thử nghiệm mà không che giấu các cảnh báo khác.
  - **Căn cứ kế hoạch & chỉ đạo chủ dự án:** Chỉ đạo T05 của chủ dự án và [`docs/tasks.md:L176`](tasks.md#L176) (T05.1).

