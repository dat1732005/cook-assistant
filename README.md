# Trợ lý nấu ăn (Cooking Assistant MVP)

Dự án trợ lý nấu ăn hỗ trợ người dùng từ khâu chuẩn bị nguyên liệu, xếp lịch nấu ăn tối ưu đến quản lý kho thực phẩm.

## Cấu trúc dự án

```
cook-assistant/
├── apps/
│   ├── mobile/         # Ứng dụng Expo React Native (TypeScript)
│   └── backend/        # Dịch vụ backend Java 21 LTS + Spring Boot 3.x (Maven)
├── packages/
│   └── core/           # Logic nghiệp vụ, scheduler, types, validator (Pure TS)
├── data/               # recipes/*.json, ingredients.json, equipment.json, safety_rules.json
├── scripts/            # Scripts kiểm tra dữ liệu, seed
├── deploy/             # Docker Compose, Nginx/Caddy, cấu hình triển khai
└── docs/               # Tài liệu đặc tả và đối chiếu (tasks.md, plan.md)
```

## Yêu cầu môi trường

- **Node.js**: >= 22.0.0
- **pnpm**: >= 12.0.0
- **Java**: JDK 21 (LTS)

## 1. Cài đặt và phát triển phần TypeScript (Mobile & Core)

Toàn bộ gói TypeScript được quản lý qua `pnpm workspace`:

```bash
# Cài đặt toàn bộ dependencies
pnpm install

# Chạy toàn bộ kiểm thử TypeScript
pnpm test

# Kiểm tra kiểu dữ liệu TypeScript
pnpm typecheck

# Kiểm tra định dạng và quy tắc mã nguồn
pnpm lint

# Khởi chạy ứng dụng di động (Expo)
pnpm --filter @cook/mobile start
# Hoặc chạy trên Android:
pnpm --filter @cook/mobile android
```

## 2. Cài đặt và phát triển Backend (Java Spring Boot)

Thư mục `apps/backend` là ứng dụng Java độc lập sử dụng Maven Wrapper (`mvnw` trên Linux/macOS hoặc `mvnw.cmd` trên Windows):

```bash
# Di chuyển vào thư mục backend
cd apps/backend

# Chạy kiểm thử tự động (JUnit 5 + MockMvc)
./mvnw test
# (Trên Windows: .\mvnw.cmd test hoặc từ thư mục gốc: pnpm run backend:test)

# Chạy server ở chế độ phát triển (tự động build jar và chạy)
pnpm run backend:dev
# Hoặc chạy jar đã build:
pnpm run backend:start
```

Server mặc định lắng nghe tại cổng `8080`.
- Endpoint kiểm tra sức khỏe hệ thống: `GET http://localhost:8080/health` trả về `{"status":"ok"}`.

## 3. Kiểm tra dữ liệu chuẩn

```bash
pnpm run validate-data
```
