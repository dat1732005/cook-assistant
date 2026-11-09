# Hướng dẫn Deploy Backend lên VPS Ubuntu Tự Quản (T21.7 — Đường triển khai chính)

> **Lưu ý kiến trúc:** Đây là **đường triển khai chính thức** đã chốt của dự án Trợ lý nấu ăn (`docs/tasks.md` mục T21.7). Với phương án thuê nền tảng quản lý container & CSDL, xem `docs/deploy-managed.md` (kèm bảng liệt kê đầy đủ mọi điểm khác biệt so với VPS).

---

## Kiến trúc trên VPS

```
[App Android / Internet]
        │  HTTPS (80 -> 443, tự cấp chứng chỉ Let's Encrypt)
        ▼
  [caddy:2-alpine]  (logs JSON ra STDOUT, volume caddy_data/caddy_config)
        │  HTTP nội bộ (cook_internal:8080)
        ▼
  [backend: JRE 21] (user không phải root, Flyway migration tự động, GET /health)
        │  PostgreSQL TCP nội bộ (cook_internal:5432)
        ▼
  [postgres:16-alpine] (volume bền vững postgres_data)
```

---

## Điều kiện tiên quyết

- VPS chạy **Ubuntu 22.04 LTS hoặc 24.04 LTS** mới cài đặt (tối thiểu 1 vCPU, 1–2 GB RAM, 20 GB SSD).
- Quyền SSH ban đầu (`root` hoặc user `sudo`).
- Một tên miền phụ (ví dụ: `api.ten-mien-cua-ban.example`) đã trỏ bản ghi DNS **A** (và/hoặc **AAAA**) về IP công khai của VPS. *(Nếu đang thử nghiệm trên máy ảo cục bộ chưa có tên miền, xem bước 5 để chạy HTTP cổng `:80` hoặc `127.0.0.1:8080`.)*

---

## Bước 1: Cập nhật hệ điều hành và cài Docker Engine + Docker Compose plugin

Đăng nhập SSH vào VPS, cập nhật gói hệ thống và cài đặt Docker chính thức từ kho Docker:

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg git ufw openssl gzip

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Kiểm tra cài đặt thành công:

```bash
docker --version
docker compose version
```

---

## Bước 2: Tạo người dùng không phải `root` để vận hành

Không chạy mã ứng dụng và Docker hàng ngày bằng `root`:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG sudo,docker deploy

# Sao chép khóa SSH từ root sang deploy để đăng nhập trực tiếp bằng deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Từ bước này trở đi, **đăng xuất và SSH lại bằng user `deploy`**.

---

## Bước 3: Mở tường lửa UFW (chỉ SSH, HTTP 80 và HTTPS 443)

Không mở cổng `5432` (PostgreSQL) hay `8080` (Spring Boot) ra Internet:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp   # HTTP/3 (QUIC) cho Caddy
sudo ufw enable
sudo ufw status verbose
```

---

## Bước 4: Tải mã nguồn về VPS

```bash
sudo mkdir -p /opt/cook-assistant
sudo chown -R deploy:deploy /opt/cook-assistant
git clone <URL_REPO_CUA_BAN> /opt/cook-assistant
cd /opt/cook-assistant
```

*(Nếu là bản phát hành gắn thẻ, chuyển sang nhánh `main` hoặc tag tương ứng: `git checkout main && git pull`.)*

---

## Bước 5: Tạo tệp `deploy/.env` (tuyệt đối không commit lên Git)

```bash
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
```

Sinh sẵn các chuỗi bí mật ngẫu nhiên mạnh trên máy chủ:

```bash
# Tạo DEVICE_SALT ngẫu nhiên 64 ký tự hex
openssl rand -hex 32
# Tạo POSTGRES_PASSWORD ngẫu nhiên mạnh
openssl rand -base64 24
```

Mở `deploy/.env` (`nano deploy/.env`) và điền các biến:

- **Caddy & tên miền:**
  - `APP_DOMAIN=<ten-mien-cua-ban>` (ví dụ `api.ten-mien-cua-ban.example` để Caddy tự xin chứng chỉ TLS Let's Encrypt; nếu thử máy ảo cục bộ chưa có tên miền thì điền `:80`).
- **PostgreSQL nội bộ:**
  - `POSTGRES_DB=cook_assistant`
  - `POSTGRES_USER=cook_user`
  - `POSTGRES_PASSWORD=<mat-khau-manh-vua-tao>`
  - *(Hai biến `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` để trống — `deploy/docker-compose.yml` sẽ tự nối tới dịch vụ `postgres` nội bộ.)*
- **Bảo mật & Môi trường Spring Boot:**
  - `DEVICE_SALT=<chuoi-hex-64-ky-tu-vua-tao>`
  - `COOK_ENV=production`
  - `PORT=8080`
  - `COOK_LOG_LEVEL=INFO`
- **Nhà cung cấp AI:**
  - `COOK_AI_PROVIDER=real` *(Lưu ý: `COOK_ENV=production` cấm dùng `mock`. Hiện `RealAiProvider.java` mới có khung HTTP chung chờ chủ dự án chốt nhà cung cấp chính thức — xem `docs/STATUS.md` mục "Đang chờ".)*
  - `COOK_AI_API_KEY=<khoa-api-nha-cung-cap-ai>`
  - `COOK_AI_ENDPOINT_URL=<url-api-nha-cung-cap-ai>`
  - `COOK_AI_MODEL=<ten-mo-hinh-chinh-thuc>`
  - `COOK_AI_ASK_ENABLED=false` *(bật `true` khi sẵn sàng mở `/v1/ai/ask`)*
  - `COOK_AI_TIMEOUT_MS=5000`
- **Giới hạn lượt & CORS:**
  - `COOK_RATE_LIMIT_LIMIT=5`
  - `COOK_RATE_LIMIT_WINDOW_SECONDS=3600`
  - `COOK_CORS_ALLOWED_ORIGINS=` *(để trống nếu chỉ gọi từ app Android gốc; hoặc liệt kê origin phân tách bằng dấu phẩy nếu cần web admin)*

---

## Bước 6: Khởi chạy hệ thống bằng Docker Compose

```bash
cd /opt/cook-assistant
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Khi khởi động, backend Spring Boot (`user cook`, non-root) tự động:
1. Chạy `EnvValidator` kiểm tra đủ biến môi trường bắt buộc (thiếu sẽ thoát kèm thông báo rõ).
2. Chạy **Flyway migration** (`V1`, `V2`, `V3`...) an toàn, có thể khởi động lặp lại nhiều lần không lỗi.
3. Ghi log chuẩn hóa trực tiếp ra **STDOUT**.

Kiểm tra trạng thái các container và xem log STDOUT:

```bash
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs -f backend
```

---

## Bước 7: Kiểm tra endpoint `/health` và cấu hình `/v1/*`

Kiểm tra từ ngay trên VPS qua cổng loopback nội bộ:

```bash
curl -fsS http://127.0.0.1:8080/health
```

Nếu đã trỏ tên miền thật tới VPS, kiểm tra qua **HTTPS (Caddy + Let's Encrypt)**:

```bash
curl -fsS https://<APP_DOMAIN>/health
```

Kết quả kỳ vọng (HTTP 200):

```json
{"status":"UP","database":"UP"}
```

Kiểm tra bảo mật CORS mặc định / giới hạn tốc độ nhanh:
- Gửi `POST /v1/ai/substitute` quá số lượt `COOK_RATE_LIMIT_LIMIT` với cùng `X-Device-Id` -> trả HTTP `429`, header `Retry-After` và JSON `{"code":"RATE_LIMIT_EXCEEDED",...}`.

---

## Bước 8: Sao lưu định kỳ (`pg_dump`) và diễn tập khôi phục

Cấp quyền chạy cho hai script sao lưu/khôi phục:

```bash
chmod +x deploy/scripts/backup-db.sh deploy/scripts/restore-db.sh
```

Chạy thử sao lưu thủ công lần đầu:

```bash
./deploy/scripts/backup-db.sh
ls -lh deploy/backups/
```

Đặt lịch sao lưu tự động mỗi ngày lúc `02:00` sáng bằng `crontab -e`:

```cron
0 2 * * * cd /opt/cook-assistant && ./deploy/scripts/backup-db.sh >> /var/log/cook-backup.log 2>&1
```

*(Tùy chọn tạo file log `/var/log/cook-backup.log` thuộc quyền `deploy` hoặc ghi vào `/opt/cook-assistant/deploy/backups/backup.log`.)*

**Diễn tập khôi phục bắt buộc ít nhất một lần trước khi đưa vào vận hành thật:**

```bash
./deploy/scripts/restore-db.sh deploy/backups/cook_backup_<TIMESTAMP>.sql.gz --yes
curl -fsS http://127.0.0.1:8080/health
```

---

## Bước 9: Cập nhật phiên bản mới (Update)

Luôn sao lưu CSDL trước khi nâng cấp ứng dụng:

```bash
cd /opt/cook-assistant
./deploy/scripts/backup-db.sh
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
curl -fsS https://<APP_DOMAIN>/health
```

---

## Bước 10: Quay lui khi có sự cố (Rollback)

1. Quay mã nguồn về commit/tag ổn định trước đó và dựng lại container:
   ```bash
   cd /opt/cook-assistant
   git log -n 5 --oneline
   git checkout <COMMIT_ON_DINH_TRUOC_DO>
   docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
   ```
2. Nếu bản cập nhật có thay đổi schema CSDL gây lỗi hoặc cần hoàn tác dữ liệu, khôi phục từ bản sao lưu đã tạo ở Bước 9:
   ```bash
   ./deploy/scripts/restore-db.sh deploy/backups/cook_backup_<TIMESTAMP>.sql.gz --yes
   curl -fsS https://<APP_DOMAIN>/health
   ```
3. Kiểm tra lại log STDOUT:
   ```bash
   docker compose -f deploy/docker-compose.yml logs --tail=100 backend
   ```

