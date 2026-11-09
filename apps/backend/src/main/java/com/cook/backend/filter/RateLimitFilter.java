package com.cook.backend.filter;

import com.cook.backend.dto.ErrorResponse;
import com.cook.backend.service.DeviceAnonymizer;
import com.cook.backend.service.SlidingWindowRateLimiter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(1)
public class RateLimitFilter extends OncePerRequestFilter {

    private final SlidingWindowRateLimiter rateLimiter;
    private final DeviceAnonymizer deviceAnonymizer;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RateLimitFilter(SlidingWindowRateLimiter rateLimiter,
                           DeviceAnonymizer deviceAnonymizer) {
        this.rateLimiter = rateLimiter;
        this.deviceAnonymizer = deviceAnonymizer;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();

        // Bỏ qua kiểm tra giới hạn đối với preflight CORS OPTIONS để trình duyệt đàm phán bình thường
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        // Áp dụng gắn deviceHash cho mọi API /v1/ai/* và giới hạn tốc độ đối với các endpoint gọi mô hình AI
        if (path != null && path.startsWith("/v1/ai/")) {
            String rawDeviceId = request.getHeader("X-Device-Id");
            String deviceHash = deviceAnonymizer.anonymize(rawDeviceId);

            // Gắn deviceHash vào request attribute để controller sử dụng khi ghi log
            request.setAttribute("deviceHash", deviceHash);

            // Phản hồi báo cáo câu trả lời sai không gọi AI ngoài nên không tiêu hao hạn mức AI
            if ("/v1/ai/feedback".equals(path)) {
                filterChain.doFilter(request, response);
                return;
            }

            SlidingWindowRateLimiter.RateLimitResult result = rateLimiter.check(deviceHash);
            if (!result.allowed()) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setHeader("Retry-After", String.valueOf(result.retryAfter()));

                ErrorResponse error = new ErrorResponse(
                        "RATE_LIMIT_EXCEEDED",
                        "Rate limit exceeded. Please retry after " + result.retryAfter() + " seconds.",
                        result.retryAfter()
                );
                response.getWriter().write(objectMapper.writeValueAsString(error));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }
}
