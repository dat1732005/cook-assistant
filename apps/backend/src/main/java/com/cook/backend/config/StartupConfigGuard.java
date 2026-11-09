/**
 * File: apps/backend/src/main/java/com/cook/backend/config/StartupConfigGuard.java
 * Làm gì: Chốt chặn kiểm tra cấu hình cook.env và cook.ai.provider ngay giai đoạn khởi tạo BeanFactory,
 *         trước khi Spring cố gắng tiêm AiProvider vào AiService.
 * Nhận vào: Environment từ Spring thông qua EnvironmentAware.
 * Trả ra: Ném IllegalStateException rõ ràng ngay khi cấu hình thiếu hoặc vi phạm quy tắc môi trường.
 * Ai gọi: Spring Framework (BeanFactoryPostProcessor theo thứ tự ưu tiên cao nhất).
 * Bám theo: docs/tasks.md mục T14.1 và yêu cầu không dùng AI giả ngầm.
 */
package com.cook.backend.config;

import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.context.EnvironmentAware;
import org.springframework.core.Ordered;
import org.springframework.core.PriorityOrdered;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class StartupConfigGuard implements BeanFactoryPostProcessor, EnvironmentAware, PriorityOrdered {

    private Environment environment;

    @Override
    public void setEnvironment(Environment environment) {
        this.environment = environment;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) throws BeansException {
        // Chỉ chạy kiểm tra khi Environment đã được Spring nạp đầy đủ
        if (environment != null) {
            EnvValidator.validateStartupConfig(environment);
        }
    }
}
