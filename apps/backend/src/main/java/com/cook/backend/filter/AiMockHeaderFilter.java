/**
 * File: apps/backend/src/main/java/com/cook/backend/filter/AiMockHeaderFilter.java
 * Làm gì: Filter gắn header X-AI-Mock: true lên mọi phản hồi HTTP từ nhóm endpoint /v1/ai/*
 *         (bao gồm cả 200 OK, 403, 429 từ RateLimitFilter, 502/504 từ GlobalExceptionHandler) khi dùng AI giả.
 * Nhận vào: HttpServletRequest, HttpServletResponse và AiProvider.
 * Trả ra: Phản hồi HTTP có bổ sung header X-AI-Mock: true nếu đang dùng bản giả.
 * Ai gọi: Chuỗi Servlet Filter của Spring Boot trước RateLimitFilter (@Order(0)).
 * Bám theo: Yêu cầu sửa lỗi minh bạch chế độ AI giả.
 */
package com.cook.backend.filter;

import com.cook.backend.ai.AiProvider;
import com.cook.backend.controller.AiController;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(0)
public class AiMockHeaderFilter extends OncePerRequestFilter {

    private final AiProvider aiProvider;

    public AiMockHeaderFilter(AiProvider aiProvider) {
        this.aiProvider = aiProvider;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();

        // Đính kèm X-AI-Mock: true cho mọi phản hồi AI khi backend đang chạy nhà cung cấp giả lập
        if (path != null && path.startsWith("/v1/ai/") && aiProvider.isMock()) {
            response.setHeader(AiController.MOCK_AI_HEADER, "true");
        }

        filterChain.doFilter(request, response);
    }
}
