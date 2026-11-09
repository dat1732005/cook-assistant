/**
 * File: apps/backend/src/main/java/com/cook/backend/config/CorsConfig.java
 * Làm gì: Cấu hình CORS động thông qua biến môi trường COOK_CORS_ALLOWED_ORIGINS (T21.9),
 *         đăng ký ở độ ưu tiên cao nhất trước mọi filter để cả phản hồi 429 / 503 và OPTIONS preflight
 *         đều mang đầy đủ header CORS theo cấu hình.
 * Nhận vào: cook.cors.allowed-origins, cook.cors.allow-credentials, cook.cors.max-age-seconds.
 * Trả ra: Bean FilterRegistrationBean<CorsFilter> và CorsConfiguration làm nguồn cấu hình.
 * Ai gọi: Spring Web Filter Chain.
 * Bám theo: docs/tasks.md mục T21.9 (chặn cross-origin mặc định nếu chưa khai báo origin hợp lệ).
 */
package com.cook.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

@Configuration
public class CorsConfig {

    private static final Logger log = LoggerFactory.getLogger(CorsConfig.class);

    /** Các phương thức HTTP hợp lệ được phép gọi tới backend */
    private static final List<String> ALLOWED_METHODS = List.of("GET", "POST", "OPTIONS");

    /** Các header phía client được phép gửi kèm request */
    private static final List<String> ALLOWED_HEADERS = List.of("Content-Type", "Authorization", "X-Device-Id");

    /** Các header phản hồi quan trọng mà app/trình duyệt cần đọc được (hạn mức 429 và cờ AI giả) */
    private static final List<String> EXPOSED_HEADERS = List.of("Retry-After", "X-AI-Mock");

    /**
     * Làm gì: Phân tích chuỗi danh sách origin cách nhau bằng dấu phẩy từ biến môi trường.
     * Vào: allowedOriginsRaw (chuỗi COOK_CORS_ALLOWED_ORIGINS từ application.yml / env).
     * Ra: Danh sách chuỗi origin sạch không rỗng (rỗng nếu chưa cấu hình).
     * Ví dụ: "https://a.example, http://localhost:8081 " -> ["https://a.example", "http://localhost:8081"].
     * Gọi bởi: buildCorsConfiguration() và kiểm thử đơn vị T21.9.
     */
    public static List<String> parseAllowedOrigins(String allowedOriginsRaw) {
        if (allowedOriginsRaw == null || allowedOriginsRaw.trim().isEmpty()) {
            return List.of();
        }
        return Arrays.stream(allowedOriginsRaw.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();
    }

    /**
     * Làm gì: Tạo đối tượng CorsConfiguration fail-closed dựa trên cấu hình môi trường.
     * Vào: allowedOriginsRaw, allowCredentials, maxAgeSeconds.
     * Ra: CorsConfiguration sẵn sàng áp dụng cho UrlBasedCorsConfigurationSource.
     * Gọi bởi: corsFilterRegistration() và CorsAndRateLimitConfigTest.
     */
    public static CorsConfiguration buildCorsConfiguration(
            String allowedOriginsRaw,
            boolean allowCredentials,
            long maxAgeSeconds) {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = parseAllowedOrigins(allowedOriginsRaw);

        // Nếu chưa khai báo origin nào -> giữ rỗng để chặn toàn bộ cross-origin trình duyệt theo nguyên tắc an toàn
        config.setAllowedOriginPatterns(origins);
        config.setAllowedMethods(ALLOWED_METHODS);
        config.setAllowedHeaders(ALLOWED_HEADERS);
        config.setExposedHeaders(EXPOSED_HEADERS);

        // Ngăn cấu hình không hợp lệ wildcard "*" đi cùng allowCredentials=true
        boolean hasWildcardAll = origins.contains("*");
        config.setAllowCredentials(allowCredentials && !hasWildcardAll);
        config.setMaxAge(Math.max(0L, maxAgeSeconds));
        return config;
    }

    /**
     * Làm gì: Đăng ký CorsFilter ở độ ưu tiên cao nhất (trước AiMockHeaderFilter và RateLimitFilter).
     * Vào: Các tham số cấu hình cook.cors.* tiêm từ Environment.
     * Ra: FilterRegistrationBean<CorsFilter> gắn lên toàn bộ đường dẫn /**.
     * Gọi bởi: Spring Boot AutoConfiguration khi khởi tạo Web Context.
     */
    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilterRegistration(
            @Value("${cook.cors.allowed-origins:}") String allowedOriginsRaw,
            @Value("${cook.cors.allow-credentials:false}") boolean allowCredentials,
            @Value("${cook.cors.max-age-seconds:3600}") long maxAgeSeconds) {
        CorsConfiguration config = buildCorsConfiguration(allowedOriginsRaw, allowCredentials, maxAgeSeconds);
        List<String> configuredOrigins = parseAllowedOrigins(allowedOriginsRaw);
        log.info("Cấu hình CORS hoàn tất: allowedOriginsCount={}, allowCredentials={}, maxAgeSeconds={}",
                configuredOrigins.size(), config.getAllowCredentials(), config.getMaxAge());

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        FilterRegistrationBean<CorsFilter> registration = new FilterRegistrationBean<>(new CorsFilter(source));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }
}

