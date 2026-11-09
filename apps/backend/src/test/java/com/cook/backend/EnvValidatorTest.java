package com.cook.backend;

import com.cook.backend.config.EnvValidator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.core.env.Environment;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@DisplayName("T14: Kiểm tra biến môi trường và quy tắc AI provider khi khởi động")
class EnvValidatorTest {

    @Test
    @DisplayName("Thiếu cook.ai.provider -> ném IllegalStateException, không được dùng AI giả ngầm")
    void missingAiProviderThrowsException() {
        Environment env = mock(Environment.class);
        when(env.getProperty("cook.env")).thenReturn("development");
        when(env.getProperty("cook.ai.provider")).thenReturn(null);

        EnvValidator validator = new EnvValidator(env, false);
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> validator.run(new DefaultApplicationArguments())
        );
        assertTrue(ex.getMessage().contains("cook.ai.provider"));
    }

    @Test
    @DisplayName("Thiếu cook.env -> ném IllegalStateException, dừng khởi động")
    void missingCookEnvThrowsException() {
        Environment env = mock(Environment.class);
        when(env.getProperty("cook.env")).thenReturn(null);
        when(env.getProperty("cook.ai.provider")).thenReturn("mock");

        EnvValidator validator = new EnvValidator(env, false);
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> validator.run(new DefaultApplicationArguments())
        );
        assertTrue(ex.getMessage().contains("cook.env"));
    }

    @Test
    @DisplayName("production + mock -> ném IllegalStateException, cấm AI giả trên production")
    void productionWithMockThrowsException() {
        Environment env = mock(Environment.class);
        when(env.getProperty("cook.env")).thenReturn("production");
        when(env.getProperty("cook.ai.provider")).thenReturn("mock");

        EnvValidator validator = new EnvValidator(env, false);
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> validator.run(new DefaultApplicationArguments())
        );
        assertTrue(ex.getMessage().contains("production"));
        assertTrue(ex.getMessage().contains("mock"));
    }

    @Test
    @DisplayName("production + real thiếu COOK_AI_API_KEY -> ném IllegalStateException, dừng khởi động")
    void productionWithRealMissingApiKeyThrowsException() {
        Environment env = mock(Environment.class);
        when(env.getProperty("cook.env")).thenReturn("production");
        when(env.getProperty("cook.ai.provider")).thenReturn("real");
        when(env.getProperty("COOK_AI_API_KEY")).thenReturn(null);

        EnvValidator validator = new EnvValidator(env, false);
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> validator.run(new DefaultApplicationArguments())
        );
        assertTrue(ex.getMessage().contains("COOK_AI_API_KEY"));
    }

    @Test
    @DisplayName("development + mock -> khởi động thành công")
    void developmentWithMockSuccess() {
        Environment env = mock(Environment.class);
        when(env.getProperty("cook.env")).thenReturn("development");
        when(env.getProperty("cook.ai.provider")).thenReturn("mock");

        EnvValidator validator = new EnvValidator(env, false);
        assertDoesNotThrow(() -> validator.run(new DefaultApplicationArguments()));
    }

    @Test
    @DisplayName("test + mock -> khởi động thành công")
    void testWithMockSuccess() {
        Environment env = mock(Environment.class);
        when(env.getProperty("cook.env")).thenReturn("test");
        when(env.getProperty("cook.ai.provider")).thenReturn("mock");

        EnvValidator validator = new EnvValidator(env, false);
        assertDoesNotThrow(() -> validator.run(new DefaultApplicationArguments()));
    }

    @Test
    @DisplayName("Thiếu biến môi trường DB/salt khi bật env-check -> ném IllegalStateException")
    void missingEnvThrowsException() {
        Environment env = mock(Environment.class);
        when(env.getProperty("cook.env")).thenReturn("development");
        when(env.getProperty("cook.ai.provider")).thenReturn("mock");
        when(env.getProperty("SPRING_DATASOURCE_URL")).thenReturn(null);

        EnvValidator validator = new EnvValidator(env, true);
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    }

    @Test
    @DisplayName("Đủ toàn bộ biến bắt buộc -> khởi động bình thường")
    void allEnvPresentSuccess() {
        Environment env = mock(Environment.class);
        when(env.getProperty("cook.env")).thenReturn("production");
        when(env.getProperty("cook.ai.provider")).thenReturn("real");
        when(env.getProperty("COOK_AI_API_KEY")).thenReturn("placeholder-val");
        when(env.getProperty("SPRING_DATASOURCE_URL")).thenReturn("jdbc:postgresql://localhost:5432/cook");
        when(env.getProperty("SPRING_DATASOURCE_USERNAME")).thenReturn("postgres");
        when(env.getProperty("SPRING_DATASOURCE_PASSWORD")).thenReturn("secret");
        when(env.getProperty("DEVICE_SALT")).thenReturn("salt123");

        EnvValidator validator = new EnvValidator(env, true);
        assertDoesNotThrow(() -> validator.run(new DefaultApplicationArguments()));
    }
}
