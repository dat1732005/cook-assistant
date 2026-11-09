/**
 * File: apps/backend/src/main/java/com/cook/backend/config/EnvValidator.java
 * Làm gì: Kiểm tra bắt buộc các biến môi trường và cấu hình vận hành (cook.env, cook.ai.provider,
 *         COOK_AI_API_KEY, DB, DEVICE_SALT) khi khởi động backend Spring Boot.
 * Nhận vào: Spring Environment và cờ cook.env-check.enabled.
 * Trả ra: Dừng khởi động ngay với IllegalStateException và thông báo lỗi rõ ràng nếu cấu hình sai hoặc thiếu.
 * Ai gọi: StartupConfigGuard (trước khi tạo bean) và Spring Boot ApplicationRunner khi hoàn tất khởi tạo.
 * Bám theo: docs/tasks.md mục T14.1 và yêu cầu sửa lỗi không dùng AI giả ngầm.
 */
package com.cook.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Component
public class EnvValidator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(EnvValidator.class);

    /** Danh sách môi trường hợp lệ của ứng dụng backend */
    public static final Set<String> VALID_ENVIRONMENTS = Set.of("development", "test", "production");

    /** Danh sách chế độ nhà cung cấp AI hợp lệ (tuyệt đối không có mặc định ngầm) */
    public static final Set<String> VALID_AI_PROVIDERS = Set.of("mock", "real");

    private final Environment environment;
    private final boolean envCheckEnabled;

    public EnvValidator(Environment environment,
                        @Value("${cook.env-check.enabled:true}") boolean envCheckEnabled) {
        this.environment = environment;
        this.envCheckEnabled = envCheckEnabled;
    }

    /**
     * Làm gì: Kiểm tra tường minh cook.env, cook.ai.provider và điều kiện bắt buộc theo môi trường.
     * Vào: environment (Environment chứa biến môi trường và thuộc tính Spring).
     * Ra: Không trả về giá trị; ném IllegalStateException nếu thiếu hoặc vi phạm quy tắc an toàn.
     * Ví dụ: cook.env=production + cook.ai.provider=mock -> ném lỗi ngay để chặn chạy AI giả ở production.
     * Gọi bởi: StartupConfigGuard.postProcessBeanFactory() và EnvValidator.run().
     */
    public static void validateStartupConfig(Environment environment) {
        // Bước 1: Kiểm tra biến môi trường vận hành cook.env (bắt buộc là development, test hoặc production)
        String cookEnv = getFirstNonBlank(environment, "cook.env", "COOK_ENV");
        if (cookEnv == null || !VALID_ENVIRONMENTS.contains(cookEnv)) {
            String errMsg = "LỖI KHỞI ĐỘNG: Thiếu hoặc sai cấu hình cook.env "
                    + "(chỉ chấp nhận: development, test, production). Giá trị hiện tại: '"
                    + (cookEnv == null ? "" : cookEnv) + "'.";
            logStartupError(errMsg);
            throw new IllegalStateException(errMsg);
        }

        // Bước 2: Kiểm tra cấu hình nhà cung cấp AI cook.ai.provider (bắt buộc tường minh mock hoặc real)
        String aiProvider = getFirstNonBlank(environment, "cook.ai.provider", "COOK_AI_PROVIDER");
        if (aiProvider == null || !VALID_AI_PROVIDERS.contains(aiProvider)) {
            String errMsg = "LỖI KHỞI ĐỘNG: Thiếu hoặc sai cấu hình cook.ai.provider "
                    + "(bắt buộc đặt tường minh 'mock' hoặc 'real', không được dùng AI giả ngầm). Giá trị hiện tại: '"
                    + (aiProvider == null ? "" : aiProvider) + "'.";
            logStartupError(errMsg);
            throw new IllegalStateException(errMsg);
        }

        // Bước 3: Chặn tuyệt đối AI giả khi chạy ở môi trường production
        if ("production".equals(cookEnv) && "mock".equals(aiProvider)) {
            String errMsg = "LỖI KHỞI ĐỘNG: Không được phép sử dụng AI giả (cook.ai.provider=mock) "
                    + "trong môi trường production (cook.env=production).";
            logStartupError(errMsg);
            throw new IllegalStateException(errMsg);
        }

        // Bước 4: Ở môi trường production dùng AI thật, bắt buộc phải có COOK_AI_API_KEY
        if ("production".equals(cookEnv) && "real".equals(aiProvider)) {
            String apiKey = getFirstNonBlank(environment, "COOK_AI_API_KEY", "cook.ai.api-key");
            if (apiKey == null) {
                String errMsg = "LỖI KHỞI ĐỘNG: Môi trường production dùng AI thật (cook.ai.provider=real) "
                        + "nhưng thiếu biến môi trường COOK_AI_API_KEY.";
                logStartupError(errMsg);
                throw new IllegalStateException(errMsg);
            }
        }
    }

    /**
     * Làm gì: Đọc giá trị chuỗi khác rỗng đầu tiên từ danh sách khóa cấu hình.
     * Vào: environment (Environment), keys (các khóa ưu tiên theo thứ tự).
     * Ra: Chuỗi đã cắt khoảng trắng hai đầu, hoặc null nếu mọi khóa đều thiếu/rỗng.
     * Gọi bởi: validateStartupConfig().
     */
    private static String getFirstNonBlank(Environment environment, String... keys) {
        // Duyệt qua từng khóa ứng viên để lấy giá trị hợp lệ đầu tiên
        for (String key : keys) {
            String value = environment.getProperty(key);
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return null;
    }

    /**
     * Làm gì: Ghi log lỗi khởi động nổi bật ra màn hình để người vận hành dễ nhận biết.
     * Vào: errMsg (thông báo lỗi chi tiết).
     * Ra: Không có.
     * Gọi bởi: validateStartupConfig() và run().
     */
    private static void logStartupError(String errMsg) {
        log.error("================================================================================");
        log.error(errMsg);
        log.error("Ứng dụng dừng khởi động ngay lập tức.");
        log.error("================================================================================");
    }

    @Override
    public void run(ApplicationArguments args) {
        // Luôn kiểm tra cấu hình môi trường và AI provider ngay cả khi bỏ qua kiểm tra DB
        validateStartupConfig(environment);

        // Nếu tắt kiểm tra biến DB/salt (dùng trong môi trường test H2) thì kết thúc tại đây
        if (!envCheckEnabled) {
            log.info("Bỏ qua kiểm tra biến DB/salt khởi động (cook.env-check.enabled = false).");
            return;
        }

        List<String> requiredVars = List.of(
                "SPRING_DATASOURCE_URL",
                "SPRING_DATASOURCE_USERNAME",
                "SPRING_DATASOURCE_PASSWORD",
                "DEVICE_SALT"
        );

        List<String> missingVars = new ArrayList<>();
        // Duyệt từng biến môi trường hạ tầng bắt buộc để phát hiện biến còn thiếu
        for (String varName : requiredVars) {
            String value = environment.getProperty(varName);
            if (value == null || value.trim().isEmpty()) {
                missingVars.add(varName);
            }
        }

        // Nếu còn ít nhất một biến bắt buộc bị thiếu -> dừng khởi động và báo rõ tên biến
        if (!missingVars.isEmpty()) {
            String errMsg = "LỖI KHỞI ĐỘNG: Thiếu biến môi trường bắt buộc: " + String.join(", ", missingVars)
                    + ". Vui lòng cấu hình trước khi chạy backend.";
            logStartupError(errMsg);
            throw new IllegalStateException(errMsg);
        }

        log.info("Kiểm tra biến môi trường khởi động thành công. Toàn bộ biến bắt buộc đã sẵn sàng.");
    }
}
