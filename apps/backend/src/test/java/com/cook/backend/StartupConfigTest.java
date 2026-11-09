package com.cook.backend;

import com.cook.backend.ai.AiProvider;
import com.cook.backend.ai.MockAiProvider;
import com.cook.backend.ai.RealAiProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("T14-fix: Kiểm thử khởi động Spring Boot thực tế với cook.env và cook.ai.provider")
class StartupConfigTest {

    private ConfigurableApplicationContext runBackendContext(String... extraProps) {
        List<String> props = new ArrayList<>(List.of(
                "spring.config.name=startup-isolated-unused",
                "spring.datasource.url=jdbc:h2:mem:startup_cfg_db;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
                "spring.datasource.username=sa",
                "spring.datasource.password=",
                "spring.datasource.driver-class-name=org.h2.Driver",
                "spring.jpa.hibernate.ddl-auto=create-drop",
                "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
                "spring.flyway.enabled=false",
                "cook.env-check.enabled=false",
                "cook.device-salt=test-salt"
        ));
        props.addAll(Arrays.asList(extraProps));

        return new SpringApplicationBuilder(BackendApplication.class)
                .web(WebApplicationType.NONE)
                .properties(props.toArray(new String[0]))
                .run();
    }

    private String collectMessages(Throwable t) {
        StringBuilder sb = new StringBuilder();
        Throwable cur = t;
        while (cur != null) {
            if (cur.getMessage() != null) {
                sb.append(cur.getMessage()).append(" | ");
            }
            cur = cur.getCause();
        }
        return sb.toString();
    }

    @Test
    @DisplayName("1. Thiếu cook.ai.provider -> backend thoát khi khởi động, thông báo rõ")
    void startupFailsWhenAiProviderMissing() {
        Exception ex = assertThrows(Exception.class, () ->
                runBackendContext("cook.env=development")
        );
        String msg = collectMessages(ex);
        assertTrue(msg.contains("cook.ai.provider"), "Thông báo lỗi phải chỉ rõ thiếu cook.ai.provider, nhận được: " + msg);
    }

    @Test
    @DisplayName("2. Thiếu cook.env -> backend thoát khi khởi động, thông báo rõ")
    void startupFailsWhenCookEnvMissing() {
        Exception ex = assertThrows(Exception.class, () ->
                runBackendContext("cook.ai.provider=mock")
        );
        String msg = collectMessages(ex);
        assertTrue(msg.contains("cook.env"), "Thông báo lỗi phải chỉ rõ thiếu cook.env, nhận được: " + msg);
    }

    @Test
    @DisplayName("3. production + mock -> backend thoát khi khởi động")
    void startupFailsWhenProductionWithMock() {
        Exception ex = assertThrows(Exception.class, () ->
                runBackendContext("cook.env=production", "cook.ai.provider=mock")
        );
        String msg = collectMessages(ex);
        assertTrue(msg.contains("production") && msg.contains("mock"),
                "Thông báo lỗi phải nêu rõ cấm mock ở production, nhận được: " + msg);
    }

    @Test
    @DisplayName("4. production + real thiếu COOK_AI_API_KEY -> backend thoát khi khởi động")
    void startupFailsWhenProductionRealMissingApiKey() {
        Exception ex = assertThrows(Exception.class, () ->
                runBackendContext("cook.env=production", "cook.ai.provider=real")
        );
        String msg = collectMessages(ex);
        assertTrue(msg.contains("COOK_AI_API_KEY"),
                "Thông báo lỗi phải nêu rõ thiếu COOK_AI_API_KEY, nhận được: " + msg);
    }

    @Test
    @DisplayName("5. development + mock -> backend khởi động thành công với MockAiProvider")
    void startupSucceedsWhenDevelopmentWithMock() {
        try (ConfigurableApplicationContext ctx = runBackendContext(
                "cook.env=development",
                "cook.ai.provider=mock"
        )) {
            AiProvider provider = ctx.getBean(AiProvider.class);
            assertInstanceOf(MockAiProvider.class, provider);
            assertTrue(provider.isMock());
        }
    }

    @Test
    @DisplayName("6. test + mock -> backend khởi động thành công với MockAiProvider")
    void startupSucceedsWhenTestWithMock() {
        try (ConfigurableApplicationContext ctx = runBackendContext(
                "cook.env=test",
                "cook.ai.provider=mock"
        )) {
            AiProvider provider = ctx.getBean(AiProvider.class);
            assertInstanceOf(MockAiProvider.class, provider);
            assertTrue(provider.isMock());
        }
    }

    @Test
    @DisplayName("7. production + real có COOK_AI_API_KEY -> backend khởi động thành công với RealAiProvider")
    void startupSucceedsWhenProductionRealWithApiKey() {
        try (ConfigurableApplicationContext ctx = runBackendContext(
                "cook.env=production",
                "cook.ai.provider=real",
                "COOK_AI_API_KEY=dummy"
        )) {
            AiProvider provider = ctx.getBean(AiProvider.class);
            assertInstanceOf(RealAiProvider.class, provider);
            assertFalse(provider.isMock());
        }
    }
}
