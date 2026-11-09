/**
 * File: apps/backend/src/test/java/com/cook/backend/FlywayIdempotencyTest.java
 * Làm gì: Kiểm thử tính tự động và an toàn khi chạy lặp lại các bản migration Flyway (T21.4):
 *         - Áp dụng lần đầu V1, V2, V3 tạo đủ bảng anonymous_device, ai_usage_log, telemetry_event.
 *         - Chạy lại migrate() lần thứ 2 và lần thứ 3 phải không lỗi và migrationsExecuted == 0.
 *         - Validate checksum & schema history thành công.
 * Nhận vào: Tập script SQL trong classpath:db/migration và H2 MODE=PostgreSQL.
 * Trả ra: Khẳng định JUnit 5 về tính lũy đẳng (idempotency) của migration.
 * Ai gọi: `./mvnw test` và Maven Surefire.
 * Bám theo: docs/tasks.md mục T21.4.
 */
package com.cook.backend;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.output.MigrateResult;
import org.flywaydb.core.api.output.ValidateResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("T21.4: Flyway migration chạy tự động và chạy lặp an toàn")
class FlywayIdempotencyTest {

    @Test
    @DisplayName("Chạy migrate() lần 1 áp dụng đủ V1-V3; chạy lặp lần 2 & 3 không lỗi, validate sạch và đủ cột/bảng")
    void flywayMigrationsApplyCleanlyAndAreSafeOnRepeatedRuns() throws Exception {
        String jdbcUrl = "jdbc:h2:mem:flyway_idempotency_t21;DB_CLOSE_DELAY=-1;MODE=PostgreSQL";

        Flyway flyway = Flyway.configure()
                .dataSource(jdbcUrl, "sa", "")
                .locations("classpath:db/migration")
                .validateOnMigrate(true)
                .load();

        // Lần chạy đầu khi khởi động container với CSDL trống -> áp dụng V1, V2, V3
        MigrateResult firstRun = flyway.migrate();
        assertTrue(firstRun.success, "Lần migrate đầu tiên phải thành công");
        assertEquals(3, firstRun.migrationsExecuted, "Phải áp dụng đủ 3 bản migration V1, V2, V3");

        // Lần chạy lặp thứ 2 & thứ 3 khi container khởi động lại -> idempotent, 0 thay đổi
        MigrateResult secondRun = flyway.migrate();
        assertTrue(secondRun.success);
        assertEquals(0, secondRun.migrationsExecuted, "Lần chạy lặp thứ 2 không được chạy lại DDL đã áp dụng");

        MigrateResult thirdRun = flyway.migrate();
        assertTrue(thirdRun.success);
        assertEquals(0, thirdRun.migrationsExecuted, "Lần chạy lặp thứ 3 phải giữ nguyên 0 thay đổi");

        ValidateResult validateResult = flyway.validateWithResult();
        assertTrue(validateResult.validationSuccessful,
                "Flyway validate() phải thành công: " + validateResult.getAllErrorMessages());

        MigrationInfo[] applied = flyway.info().applied();
        assertEquals(3, applied.length, "Lịch sử Flyway phải ghi đúng 3 phiên bản V1, V2, V3");

        // Kiểm tra bảng và các cột cốt lõi hiện diện thực sự trong CSDL sau migration
        Set<String> tables = new HashSet<>();
        Set<String> telemetryCols = new HashSet<>();
        try (Connection conn = DriverManager.getConnection(jdbcUrl, "sa", "");
             Statement stmt = conn.createStatement()) {
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC'")) {
                while (rs.next()) {
                    tables.add(rs.getString(1).toLowerCase());
                }
            }
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'PUBLIC' AND LOWER(TABLE_NAME) = 'telemetry_event'")) {
                while (rs.next()) {
                    telemetryCols.add(rs.getString(1).toLowerCase());
                }
            }
        }

        assertTrue(tables.contains("anonymous_device"), "Thiếu bảng anonymous_device sau migration");
        assertTrue(tables.contains("ai_usage_log"), "Thiếu bảng ai_usage_log sau migration");
        assertTrue(tables.contains("telemetry_event"), "Thiếu bảng telemetry_event sau migration");
        assertTrue(telemetryCols.contains("question_id"), "Thiếu cột question_id từ V3");
        assertTrue(telemetryCols.contains("feedback_type"), "Thiếu cột feedback_type từ V3");
    }

    @Test
    @DisplayName("Toàn bộ tệp migration SQL đều dùng IF NOT EXISTS để an toàn khi khởi tạo lặp")
    void sqlMigrationScriptsUseIfNotExists() throws Exception {
        Path migrationDir = Paths.get("src/main/resources/db/migration");
        assertTrue(Files.isDirectory(migrationDir), "Phải tìm thấy thư mục db/migration");

        try (var stream = Files.list(migrationDir)) {
            var sqlFiles = stream.filter(p -> p.toString().endsWith(".sql")).toList();
            assertEquals(3, sqlFiles.size(), "Hiện có đúng 3 tệp migration V1-V3");
            for (Path file : sqlFiles) {
                String sql = Files.readString(file, StandardCharsets.UTF_8);
                assertTrue(sql.toUpperCase().contains("IF NOT EXISTS"),
                        "Script migration phải có IF NOT EXISTS để an toàn: " + file.getFileName());
            }
        }
    }
}

