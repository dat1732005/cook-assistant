# Khung chi phí vận hành & Cách đặt hạn mức chi tiêu AI (T23.4)

> **Quy tắc R1 / R2 / R5:** Tài liệu này là **khung chi phí** để chủ dự án điền báo giá thật. Mọi ô số tiền đều được để **trống / `MISSING`** (tuyệt đối không tự ước tính hoặc bịa giá).

---

## 1. Hạ tầng máy chủ Backend & Lưu trữ sao lưu (`T21.7` / `T21.8`)

| Hạng mục | Mô tả / Cấu hình dự kiến | Đơn vị tính | Số tiền (VNĐ hoặc USD) | Ghi chú / Nhà cung cấp |
| :--- | :--- | :--- | :--- | :--- |
| **Máy chủ VPS Ubuntu (Đường chính T21.7)** | Tối thiểu 1 vCPU, 1–2 GB RAM, ~20 GB SSD chạy Docker Compose (`postgres` + `backend` + `caddy`) | / tháng | `MISSING` | Chờ chủ dự án chọn nhà cung cấp & báo giá |
| **Phương án Managed PaaS (T21.8, nếu chọn thay VPS)** | Dịch vụ chạy container Backend (1 instance) | / tháng | `MISSING` | Chỉ trả nếu không tự quản VPS |
| **Managed PostgreSQL (T21.8, nếu chọn thay VPS)** | Cơ sở dữ liệu PostgreSQL được quản lý + sao lưu tự động | / tháng | `MISSING` | Chỉ trả nếu chọn hướng T21.8 |
| **Lưu trữ sao lưu ngoài máy chủ (Off-site Backups)** | Lưu bản `cook_backup_*.sql.gz` định kỳ ở nơi tách biệt VPS (`T21.5`) | / tháng | `MISSING` | Tùy dung lượng bản nén & nơi lưu trữ |

---

## 2. Tên miền & Chứng chỉ HTTPS

| Hạng mục | Mô tả | Đơn vị tính | Số tiền (VNĐ hoặc USD) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **Đăng ký / Gia hạn tên miền chính thức** | Tên miền trỏ bản ghi DNS về IP VPS cho API (`APP_DOMAIN`, ví dụ `.vn` / `.com`) | / năm | `MISSING` | Tùy đuôi tên miền & nhà đăng ký |
| **Chứng chỉ TLS / HTTPS** | Caddy (`caddy:2-alpine`) tự cấp và tự gia hạn chứng chỉ qua Let's Encrypt (`T21.2`, `T21.7`) | / năm | `MISSING` *(Cần xác nhận nếu dùng CA trả phí khác; Let's Encrypt chuẩn CA không thu phí bản tiêu chuẩn)* | Không cần mua SSL rời nếu dùng Caddy mặc định |

---

## 3. Tài khoản Google Play & Dịch vụ Build di động

| Hạng mục | Mô tả | Tần suất trả | Số tiền (USD / VNĐ) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **Tài khoản Google Play Developer** | Phí đăng ký xuất bản ứng dụng lên Google Play Console | **Một lần** | `MISSING` | Kiểm tra lệ phí chính thức ngay trên trang đăng ký Google Play Console |
| **Dịch vụ Build ứng dụng Android (Expo EAS Build)** | Bậc miễn phí / gói trả phí khi cần build APK `preview` & AAB `production` vượt hạn mức miễn phí | / tháng | `MISSING` | Tùy bậc gói EAS chủ dự án chọn |

---

## 4. Phí gọi API Nhà cung cấp AI (`RealAiProvider`, `T15` / `T20b` / `T23`)

> **Trạng thái hiện tại:** `RealAiProvider.java` mới có khung HTTP chung (`COOK_AI_ENDPOINT_URL`, `COOK_AI_MODEL`, `COOK_AI_API_KEY`). Chủ dự án chưa chốt nhà cung cấp AI chính thức (`docs/STATUS.md` mục "Đang chờ").

| Tham số cần lấy từ bảng giá chính thức của nhà cung cấp AI | Giá trị / Số tiền | Nguồn kiểm chứng |
| :--- | :--- | :--- |
| **Nhà cung cấp AI đã chọn** (OpenAI / Google Gemini / Anthropic / ...) | `MISSING` | Chủ dự án quyết định |
| **Tên mô hình (`COOK_AI_MODEL`)** | `MISSING` | Chủ dự án quyết định |
| **Đơn giá Input Tokens** (theo triệu tokens) | `MISSING` | Trang pricing chính thức của nhà cung cấp tại ngày chốt |
| **Đơn giá Output Tokens** (theo triệu tokens) | `MISSING` | Trang pricing chính thức của nhà cung cấp tại ngày chốt |
| **Chi phí AI trung bình mỗi phiên nấu (Chỉ số 6 `docs/metrics.sql`)** | `MISSING` | Đo thực tế từ cột `ai_usage_log.estimated_cost_usd` sau thử kín |

**Công thức ghi nhận chi phí thật (chạy theo dữ liệu thực tế `ai_usage_log`, không ước đoán trước):**
- Mỗi lần gọi `/v1/ai/substitute` hoặc `/v1/ai/ask`, backend ghi lại số lượt và `estimated_cost_usd` vào bảng `ai_usage_log`.
- Chỉ số 6 trong [`docs/metrics.sql`](file:///c:/Users/l/OneDrive/Desktop/Tr%E1%BB%A3%20l%C3%BD%20n%E1%BA%A5u%20%C4%83n/cook-assistant/docs/metrics.sql) chia tổng `estimated_cost_usd` cho tổng số phiên nấu `session_started` để làm cơ sở quyết định ngưỡng tiếp tục / điều chỉnh ở Giai đoạn H (`docs/pilot-criteria.md`).

---

## 5. Cách đặt hạn mức chi tiêu cho AI (Bắt buộc trước khi bật `production`)

Để tránh phát sinh hóa đơn AI ngoài kiểm soát nếu lượng dùng tăng đột biến hoặc bị gọi lặp:

1. **Tầng 1 — Chốt chặn cứng tại Backend (`deploy/.env`):**
   - Giữ `COOK_AI_ASK_ENABLED=false` mặc định cho đến khi sẵn sàng mở tính năng hỏi tự do (`POST /v1/ai/ask`); chỉ mở `POST /v1/ai/substitute` khi cần thiết.
   - Đặt giới hạn lượt theo thiết bị ẩn danh trong cửa sổ trượt qua hai biến môi trường (`T14`, `T21.9`):
     - `COOK_RATE_LIMIT_LIMIT` *(số lượt tối đa mỗi cửa sổ — hiện chờ chủ dự án chốt mức production)*
     - `COOK_RATE_LIMIT_WINDOW_SECONDS` *(độ dài cửa sổ trượt tính bằng giây)*
   - Kiểm tra chi phí trung bình mỗi phiên bằng `docs/metrics.sql` hằng ngày trong giai đoạn thử kín; nếu vượt ngưỡng trong `docs/pilot-criteria.md` thì hạ limit hoặc tắt `COOK_AI_ASK_ENABLED=false` ngay mà không cần sửa mã.
2. **Tầng 2 — Hạn mức cứng tại trang quản trị Nhà cung cấp AI (Hard Budget Cap):**
   - Vào mục **Billing / Usage Limits** trên dashboard của nhà cung cấp AI đã chọn:
     - Đặt **Hard Limit / Monthly Spending Cap** (`MISSING` USD/tháng): hệ thống nhà cung cấp sẽ tự từ chối request thay vì tính tiền vượt trần.
     - Đặt **Email Alerts / Soft Alerts** tại các ngưỡng phần trăm ngân sách do chủ dự án quy định (`MISSING` %).
     - **Tắt tính năng tự động nạp thêm tiền (*Auto-recharge*)** nếu sử dụng ví trả trước, hoặc chỉ cấp hạn mức thẻ vừa đủ ngưỡng tháng.
   - **Tách riêng API Key theo môi trường:** dùng key hạn mức rất nhỏ cho `staging` (`preview`) và key riêng cho `production`; không chia sẻ khóa giữa các môi trường và thu hồi/tạo lại ngay nếu có cảnh báo bất thường.

---

## 6. Bảng trường `MISSING` chờ chủ dự án điền báo giá (Quy tắc R2)

| STT | Tệp / Mục cần điền | Trường đang `MISSING` | Nguồn dữ liệu chủ dự án cần tra cứu |
| :--- | :--- | :--- | :--- |
| 1 | `docs/costs.md` §1 | Giá thuê VPS Ubuntu (hoặc Managed Container + Managed DB) & lưu trữ sao lưu | Báo giá công khai từ nhà cung cấp hạ tầng đã chọn |
| 2 | `docs/costs.md` §2 | Phí đăng ký & gia hạn tên miền năm | Bảng giá nhà đăng ký tên miền |
| 3 | `docs/costs.md` §3 | Lệ phí đăng ký Google Play Developer & bậc gói EAS Build (nếu vượt gói miễn phí) | Trang thanh toán Google Play Console & bảng giá Expo EAS |
| 4 | `docs/costs.md` §4 | Nhà cung cấp AI, model, đơn giá Input/Output token | Trang pricing chính thức của nhà cung cấp AI |
| 5 | `docs/costs.md` §5 | Trần chi tiêu cứng (`Hard Cap` tháng) & ngưỡng cảnh báo phần trăm | Quyết định ngân sách của chủ dự án |

