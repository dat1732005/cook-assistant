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

@Component
public class EnvValidator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(EnvValidator.class);

    private final Environment environment;
    private final boolean envCheckEnabled;

    public EnvValidator(Environment environment,
                        @Value("${cook.env-check.enabled:true}") boolean envCheckEnabled) {
        this.environment = environment;
        this.envCheckEnabled = envCheckEnabled;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!envCheckEnabled) {
            log.info("Bỏ qua kiểm tra biến môi trường khởi động (cook.env-check.enabled = false).");
            return;
        }

        List<String> requiredVars = List.of(
                "SPRING_DATASOURCE_URL",
                "SPRING_DATASOURCE_USERNAME",
                "SPRING_DATASOURCE_PASSWORD",
                "DEVICE_SALT"
        );

        List<String> missingVars = new ArrayList<>();
        for (String varName : requiredVars) {
            String value = environment.getProperty(varName);
            if (value == null || value.trim().isEmpty()) {
                missingVars.add(varName);
            }
        }

        if (!missingVars.isEmpty()) {
            String errMsg = "LỖI KHỞI ĐỘNG: Thiếu biến môi trường bắt buộc: " + String.join(", ", missingVars)
                    + ". Vui lòng cấu hình trước khi chạy backend.";
            log.error("================================================================================");
            log.error(errMsg);
            log.error("Ứng dụng dừng khởi động ngay lập tức.");
            log.error("================================================================================");
            throw new IllegalStateException(errMsg);
        }

        log.info("Kiểm tra biến môi trường khởi động thành công. Toàn bộ biến bắt buộc đã sẵn sàng.");
    }
}
