# Hướng dẫn Deploy lên Nền tảng Quản lý Container & CSDL (T21.8 — Phương án phụ)

> **Vai trò theo Quyết định kiến trúc:** Tự quản VPS Ubuntu (`docs/deploy-vps.md`) là **đường chính**. Tài liệu này hướng dẫn phương án thứ hai dùng dịch vụ quản lý container (ví dụ Render, Railway, Fly.io, Google Cloud Run, AWS App Runner...) kèm PostgreSQL được quản lý (Managed PostgreSQL), đồng thời **liệt kê rõ mọi điểm khác biệt so với VPS**.

---

## 1. Bảng so sánh toàn bộ điểm khác biệt so với VPS (`docs/deploy-vps.md`)

| Hạng mục | VPS tự quản (Đường chính T21.7) | Nền tảng Managed Container (T21.8) |
| --- | --- | --- |
| **Reverse proxy & Chứng chỉ TLS HTTPS** | Tự vận hành container **Caddy** trong `docker-compose.yml`, mở cổng `80`/`443` qua UFW và tự gia hạn Let's Encrypt qua `APP_DOMAIN`. | **Không cần chạy Caddy.** Nền tảng PaaS/Cloud Load Balancer tự cấp TLS HTTPS ở lớp biên và chuyển tiếp HTTP nội bộ vào cổng `$PORT` của container. |
| **Cơ sở dữ liệu PostgreSQL & Volume** | Chạy container `postgres:16-alpine` nội bộ cùng named volume `postgres_data` trên đĩa VPS; URL mặc định `jdbc:postgresql://postgres:5432/...`. | **Không chạy container `postgres`.** Dùng Managed PostgreSQL ngoài (RDS / Cloud SQL / Neon / Supabase) kèm chuỗi `SPRING_DATASOURCE_URL` bắt buộc TLS (`?sslmode=require`). |
| **Cách chạy Docker Compose** | `docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build` (khởi động đủ `postgres` + `backend` + `caddy`). | Build trực tiếp `apps/backend/Dockerfile` trên PaaS, **hoặc** dùng lệnh Compose override:<br>`docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.managed.yml --env-file deploy/.env up -d --build` (tắt `postgres` & `caddy`, bỏ `depends_on`, mở `$PORT`). |
| **Cổng lắng nghe (`PORT`)** | Mặc định cố định `8080` sau Caddy (`127.0.0.1:8080`). | Nền tảng thường cấp biến `$PORT` động (ví dụ `8080`, `10000`, `3000`); `application.yml` (`server.port: ${PORT:8080}`) và `Dockerfile` `HEALTHCHECK` (`127.0.0.1:${PORT:-8080}`) đã hỗ trợ tự động. |
| **Quản lý biến môi trường bí mật** | Lưu trong tệp `deploy/.env` (`chmod 600`) trên ổ đĩa VPS. | Nhập trực tiếp qua mục **Secrets / Environment Variables** trên bảng điều khiển của nền tảng (không đặt tệp `.env` trên máy chủ). |
| **Thu thập log (`STDOUT`)** | Xem qua `docker compose logs -f backend` và `json-file` xoay vòng trên đĩa VPS. | Nền tảng tự thu thập dòng từ **STDOUT** (`logback-spring.xml`) đưa về trang Log Explorer / Cloud Logging. |
| **Giới hạn tốc độ AI (`SlidingWindowRateLimiter`)** | 1 tiến trình backend duy nhất trên VPS -> bộ đếm `ConcurrentHashMap` chính xác 100%. | **Cảnh báo quan trọng:** Bộ đếm hiện tại lưu trong bộ nhớ JVM nên **MVP bắt buộc giữ số bản sao (replica/instance) = 1**. Nếu sau này scale nhiều container song song cần nâng cấp bộ đếm sang Redis. |
| **Sao lưu & Khôi phục CSDL** | Tự chạy script `backup-db.sh` (cron) & `restore-db.sh` vào `postgres` container trên VPS. | Nền tảng Managed DB có snapshot/PITR tự động; vẫn có thể xuất/nhập thủ công bằng `./deploy/scripts/backup-db.sh --external` và `./deploy/scripts/restore-db.sh <file> --external`. |
| **Chi phí & Công sức vận hành** | Chi phí thuê VPS cố định thấp hơn; cần tự cài Docker, tường lửa UFW, vá bảo mật OS và theo dõi ổ đĩa. | Không phải quản lý hệ điều hành, tường lửa hay gia hạn chứng chỉ; chi phí theo giờ/tài nguyên thường cao hơn ở tải nhỏ. |

---

## 2. Hai cách chạy ở hướng Managed

### Cách A: Triển khai trực tiếp từ `apps/backend/Dockerfile` lên PaaS (Render, Railway, Fly.io, Cloud Run)

1. Tạo một dịch vụ **Managed PostgreSQL** trên cùng khu vực (region) với dịch vụ container để giảm độ trễ.
2. Tạo một Web Service từ repo Git:
   - **Docker Context / Build Context:** `apps/backend`
   - **Dockerfile Path:** `apps/backend/Dockerfile`
   - **Health Check Path:** `/health` (nền tảng đọc HTTP `200` với `{"status":"UP","database":"UP"}`).
   - **Scale / Instances:** Giữ **1 instance** cố định ở giai đoạn MVP (tránh chia nhỏ bộ nhớ giới hạn lượt AI).
3. Khai báo toàn bộ biến môi trường theo danh sách `deploy/.env.example` trong bảng Secrets của nền tảng:
   - `SPRING_DATASOURCE_URL=jdbc:postgresql://<host>:<port>/<db>?sslmode=require`
   - `SPRING_DATASOURCE_USERNAME=<user>`
   - `SPRING_DATASOURCE_PASSWORD=<mat-khau-db>`
   - `DEVICE_SALT=<chuoi-hex-64-ky-tu>`
   - `COOK_ENV=production`
   - `COOK_AI_PROVIDER=real` *(cấm `mock` ở production; xem `docs/STATUS.md` về `RealAiProvider`)*
   - `COOK_AI_API_KEY=<khoa-api>`
   - `COOK_AI_ENDPOINT_URL=<url-api-nha-cung-cap>`
   - `COOK_AI_MODEL=<ten-mo-hinh>`
   - `COOK_AI_ASK_ENABLED=false`
   - `COOK_AI_TIMEOUT_MS=5000`
   - `COOK_RATE_LIMIT_LIMIT=5`
   - `COOK_RATE_LIMIT_WINDOW_SECONDS=3600`
   - `COOK_CORS_ALLOWED_ORIGINS=` *(trống nếu không có trình duyệt web gọi trực tiếp)*
   - `COOK_LOG_LEVEL=INFO`
4. Khi container khởi chạy:
   - `EnvValidator` kiểm tra biến môi trường ngay lúc boot.
   - Flyway tự động chạy migration (`V1`, `V2`, `V3`) vào Managed PostgreSQL.
   - Nền tảng kiểm tra `/health` trước khi chuyển lưu lượng HTTPS thật sang container mới.

### Cách B: Chạy `docker compose` kết hợp Managed PostgreSQL (`docker-compose.managed.yml`)

Nếu dùng một VM / container runner chỉ chạy mỗi app backend và kết nối tới Managed PostgreSQL bên ngoài (để tận dụng chung bộ cấu hình `deploy/docker-compose.yml`):

1. Tạo `deploy/.env` từ `deploy/.env.example`, điền đầy đủ `SPRING_DATASOURCE_URL` (kèm `?sslmode=require`), `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` và các biến `COOK_*`, `DEVICE_SALT`. (Không cần `POSTGRES_*` hay `APP_DOMAIN`.)
2. Chạy Compose kèm tệp ghi đè `deploy/docker-compose.managed.yml`:
   ```bash
   docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.managed.yml --env-file deploy/.env up -d --build
   ```
   Tệp `docker-compose.managed.yml` sẽ tự tắt service `postgres` và `caddy`, xóa `depends_on: postgres`, và mở cổng `${PORT:-8080}:${PORT:-8080}` cho bộ cân bằng tải bên ngoài kết nối vào.

---

## 3. Sao lưu, khôi phục & quay lui trên Managed

- **Sao lưu ngoại tuyến (ngoài snapshot của nhà cung cấp):** Đặt `SPRING_DATASOURCE_*` trong môi trường shell (hoặc `deploy/.env`) có cài `pg_dump` / `psql`, rồi chạy:
  ```bash
  ./deploy/scripts/backup-db.sh --external
  ```
- **Khôi phục từ bản sao lưu vào CSDL đích:**
  ```bash
  ./deploy/scripts/restore-db.sh deploy/backups/cook_backup_<TIMESTAMP>.sql.gz --external --yes
  ```
- **Cập nhật & Quay lui (Rollback):**
  - Cập nhật qua thao tác deploy commit mới trên nhánh `main`; Flyway chạy migration mới tự động và nền tảng giữ instance cũ cho đến khi `/health` của bản mới trả `200 UP`.
  - Quay lui bằng tính năng **Rollback / Redeploy previous image** trên bảng điều khiển PaaS (nếu có thay đổi schema phá vỡ cấu trúc, khôi phục thêm snapshot PITR hoặc bản `--external` trước đó).

