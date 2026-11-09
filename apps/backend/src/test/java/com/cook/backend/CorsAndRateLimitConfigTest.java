/**
 * File: apps/backend/src/test/java/com/cook/backend/CorsAndRateLimitConfigTest.java
 * Làm gì: Kiểm thử T21.9 và T21.6:
 *         - Giới hạn tốc độ (COOK_RATE_LIMIT_LIMIT, COOK_RATE_LIMIT_WINDOW_SECONDS) nạp đúng từ env/property.
 *         - CORS (COOK_CORS_ALLOWED_ORIGINS) cho phép đúng origin khai báo, trả header Exposed (Retry-After, X-AI-Mock),
 *           chặn origin lạ và không làm tiêu hao hạn mức AI khi trình duyệt gửi preflight OPTIONS.
 *         - Logback cấu hình ghi ra STDOUT (System.out), không ghi file appender nội bộ container.
 * Nhận vào: MockMvc với CorsFilter, AiMockHeaderFilter, RateLimitFilter và SlidingWindowRateLimiter.
 * Trả ra: Khẳng định JUnit 5 về hành vi cấu hình từ biến môi trường.
 * Ai gọi: `./mvnw test` và Maven Surefire.
 * Bám theo: docs/tasks.md mục T21.6 và T21.9.
 */
package com.cook.backend;

import com.cook.backend.config.CorsConfig;
import com.cook.backend.filter.AiMockHeaderFilter;
import com.cook.backend.filter.RateLimitFilter;
import com.cook.backend.service.SlidingWindowRateLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.filter.CorsFilter;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@TestPropertySource(properties = {
        "COOK_RATE_LIMIT_LIMIT=2",
        "COOK_RATE_LIMIT_WINDOW_SECONDS=120",
        "COOK_CORS_ALLOWED_ORIGINS=https://app.cook.example, http://localhost:8081"
})
@DisplayName("T21.6 & T21.9: Cấu hình Rate Limit, CORS qua biến môi trường và log STDOUT")
class CorsAndRateLimitConfigTest {

    @Autowired
    private WebApplicationContext wac;

    @Autowired
    private SlidingWindowRateLimiter rateLimiter;

    @Autowired
    private FilterRegistrationBean<CorsFilter> corsFilterRegistration;

    @Autowired
    private AiMockHeaderFilter aiMockHeaderFilter;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac)
                .addFilters(corsFilterRegistration.getFilter(), aiMockHeaderFilter, rateLimitFilter)
                .build();
        rateLimiter.reset();
    }

    @Test
    @DisplayName("T21.9a: Giới hạn lượt AI (limit=2, window=120s) đọc đúng từ biến môi trường và trả 429 kèm Retry-After")
    void rateLimitConfigIsLoadedFromEnvironmentVariables() throws Exception {
        assertEquals(2, rateLimiter.getDefaultLimit(), "Limit phải nhận giá trị COOK_RATE_LIMIT_LIMIT=2");
        assertEquals(120, rateLimiter.getDefaultWindowSeconds(), "Window phải nhận COOK_RATE_LIMIT_WINDOW_SECONDS=120");

        String subJson = "{\"recipeId\":\"mon-1\",\"action\":\"substitute\",\"ingredientId\":\"hanh-la\",\"role\":\"flavor\"}";
        String deviceId = "dev-t21-env-limit";

        // Preflight CORS OPTIONS cho origin hợp lệ -> không tiêu hao hạn mức lượt gọi AI
        mockMvc.perform(options("/v1/ai/substitute")
                        .header("Origin", "https://app.cook.example")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Content-Type, X-Device-Id")
                        .header("X-Device-Id", deviceId))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://app.cook.example"));

        // Lượt 1 & 2 hợp lệ -> HTTP 200 kèm header CORS
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/v1/ai/substitute")
                            .header("Origin", "https://app.cook.example")
                            .header("X-Device-Id", deviceId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(subJson))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Access-Control-Allow-Origin", "https://app.cook.example"))
                    .andExpect(header().string("X-AI-Mock", "true"));
        }

        // Lượt 3 vượt hạn mức 2 -> HTTP 429 vẫn mang đầy đủ header CORS nhờ FilterRegistrationBean(HIGHEST_PRECEDENCE)
        mockMvc.perform(post("/v1/ai/substitute")
                        .header("Origin", "https://app.cook.example")
                        .header("X-Device-Id", deviceId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(subJson))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://app.cook.example"))
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.code").value("RATE_LIMIT_EXCEEDED"));
    }

    @Test
    @DisplayName("T21.9b: CORS cho phép đúng origin khai báo, từ chối origin lạ và mặc định fail-closed khi rỗng")
    void corsAllowsConfiguredOriginsAndRejectsUnknownOrigins() throws Exception {
        // Origin được phép thứ 2
        mockMvc.perform(options("/health")
                        .header("Origin", "http://localhost:8081")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:8081"));

        // Origin không nằm trong danh sách -> bị từ chối và tuyệt đối không gắn Access-Control-Allow-Origin
        mockMvc.perform(options("/v1/ai/substitute")
                        .header("Origin", "https://untrusted.example.com")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));

        // Khi COOK_CORS_ALLOWED_ORIGINS để trống -> fail-closed danh sách rỗng
        CorsConfiguration emptyCfg = CorsConfig.buildCorsConfiguration("   ", false, 3600);
        assertNotNull(emptyCfg.getAllowedOriginPatterns());
        assertTrue(emptyCfg.getAllowedOriginPatterns().isEmpty(),
                "Chưa cấu hình COOK_CORS_ALLOWED_ORIGINS thì phải chặn cross-origin mặc định");
        assertTrue(emptyCfg.getExposedHeaders().contains("Retry-After"));
        assertTrue(emptyCfg.getExposedHeaders().contains("X-AI-Mock"));
    }

    @Test
    @DisplayName("T21.6: Cấu hình logback-spring.xml ghi log chuẩn ra STDOUT và không dùng FileAppender")
    void logbackWritesStrictlyToStdout() throws Exception {
        Path logbackPath = Paths.get("src/main/resources/logback-spring.xml");
        assertTrue(Files.exists(logbackPath), "Phải tồn tại src/main/resources/logback-spring.xml");

        String xml = Files.readString(logbackPath, StandardCharsets.UTF_8);
        assertTrue(xml.contains("ConsoleAppender"), "Phải sử dụng ConsoleAppender");
        assertTrue(xml.contains("<target>System.out</target>"), "Phải ghi ra đầu ra chuẩn System.out (STDOUT)");
        assertFalse(xml.contains("FileAppender"), "Không ghi file log cục bộ trong container");
    }
}

