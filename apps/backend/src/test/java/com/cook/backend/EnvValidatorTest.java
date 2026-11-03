package com.cook.backend;

import com.cook.backend.config.EnvValidator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.core.env.Environment;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@DisplayName("T14: Kiểm tra biến môi trường bắt buộc khi khởi động")
class EnvValidatorTest {

    @Test
    @DisplayName("Thiếu biến môi trường bắt buộc -> ném IllegalStateException, dừng khởi động")
    void missingEnvThrowsException() {
        Environment env = mock(Environment.class);
        // Để trống các biến môi trường
        when(env.getProperty("SPRING_DATASOURCE_URL")).thenReturn(null);

        EnvValidator validator = new EnvValidator(env, true);
        assertThrows(IllegalStateException.class, () -> validator.run(new DefaultApplicationArguments()));
    }

    @Test
    @DisplayName("Đủ toàn bộ biến bắt buộc -> khởi động bình thường")
    void allEnvPresentSuccess() {
        Environment env = mock(Environment.class);
        when(env.getProperty("SPRING_DATASOURCE_URL")).thenReturn("jdbc:postgresql://localhost:5432/cook");
        when(env.getProperty("SPRING_DATASOURCE_USERNAME")).thenReturn("postgres");
        when(env.getProperty("SPRING_DATASOURCE_PASSWORD")).thenReturn("secret");
        when(env.getProperty("DEVICE_SALT")).thenReturn("salt123");

        EnvValidator validator = new EnvValidator(env, true);
        assertDoesNotThrow(() -> validator.run(new DefaultApplicationArguments()));
    }
}
