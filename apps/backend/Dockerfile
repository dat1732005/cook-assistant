# ==============================================================================
# File: apps/backend/Dockerfile
# Làm gì: Dockerfile nhiều tầng (multi-stage) cho backend Spring Boot Java 21 (T21.1):
#         - Tầng 1 (builder): Eclipse Temurin JDK 21 + Maven Wrapper đóng gói file JAR.
#         - Tầng 2 (runtime): Eclipse Temurin JRE 21 gọn nhẹ, người dùng không phải root,
#           cấu hình HEALTHCHECK gọi GET /health và xuất log trực tiếp ra STDOUT.
# Bám theo: docs/tasks.md mục T21.1 và Phụ lục thay đổi.
# ==============================================================================

FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /build

# Cài curl để Maven Wrapper tải Maven distribution qua HTTPS ổn định trên Alpine
RUN apk add --no-cache curl

# Sao chép Maven Wrapper và pom.xml trước để tận dụng Docker layer cache cho phụ thuộc
COPY mvnw ./
COPY .mvn ./.mvn
COPY pom.xml ./

# Chuẩn hóa xuống dòng LF phòng trường hợp checkout trên Windows CRLF trước khi cấp quyền chạy
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw

# Tải trước phụ thuộc Maven (cho phép bỏ qua lỗi tạm ở repo phụ trợ và xử lý hoàn chỉnh khi package)
RUN ./mvnw -B dependency:go-offline || true

# Sao chép mã nguồn và biên dịch gói JAR thực thi (đã chạy test ở bước CI/verify riêng)
COPY src ./src
RUN ./mvnw -B clean package -DskipTests \
    && find target -maxdepth 1 -type f -name '*.jar' ! -name '*-plain.jar' ! -name '*.original' -exec cp {} /build/app.jar \;

# ==============================================================================
# Tầng 2: Runtime gọn nhẹ chỉ chứa JRE 21 và tài khoản không có quyền root
# ==============================================================================
FROM eclipse-temurin:21-jre-alpine AS runtime

# Cài curl phục vụ Docker HEALTHCHECK gọi /health và tzdata cho múi giờ chuẩn
RUN apk add --no-cache curl tzdata

# Tạo nhóm và tài khoản người dùng không phải root để chạy tiến trình Spring Boot
RUN addgroup -S cook && adduser -S -G cook cook

WORKDIR /app
COPY --from=builder --chown=cook:cook /build/app.jar /app/app.jar

ENV PORT=8080 \
    JAVA_OPTS=""

EXPOSE 8080

USER cook

# Kiểm tra sức khỏe container thông qua endpoint GET /health (kiểm tra kết nối CSDL)
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT:-8080}/health" || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -Djava.security.egd=file:/dev/./urandom -jar /app/app.jar"]

