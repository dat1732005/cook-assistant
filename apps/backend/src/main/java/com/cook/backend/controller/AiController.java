/**
 * File: apps/backend/src/main/java/com/cook/backend/controller/AiController.java
 * Làm gì: Tiếp nhận các HTTP request tới /v1/ai/substitute và /v1/ai/ask,
 *         đồng thời gắn header X-AI-Mock: true khi backend dùng bản AI giả.
 * Nhận vào: DTO yêu cầu thay/bỏ nguyên liệu hoặc câu hỏi nấu ăn kèm HttpServletRequest.
 * Trả ra: ResponseEntity chứa kết quả AI hoặc lỗi chuẩn hóa ErrorResponse.
 * Ai gọi: Spring Web DispatcherServlet khi app gọi API /v1/ai/*.
 * Bám theo: docs/tasks.md mục T15 và yêu cầu minh bạch chế độ AI giả.
 */
package com.cook.backend.controller;

import com.cook.backend.dto.AskRequest;
import com.cook.backend.dto.AskResponse;
import com.cook.backend.dto.ErrorResponse;
import com.cook.backend.dto.SubstituteRequest;
import com.cook.backend.dto.SubstituteResponse;
import com.cook.backend.service.AiService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/ai")
public class AiController {

    /** Tên HTTP header thông báo phản hồi xuất phát từ AI giả (mock) */
    public static final String MOCK_AI_HEADER = "X-AI-Mock";

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/substitute")
    public ResponseEntity<SubstituteResponse> substitute(
            @RequestBody SubstituteRequest request,
            HttpServletRequest servletRequest) {
        String deviceHash = (String) servletRequest.getAttribute("deviceHash");
        SubstituteResponse response = aiService.handleSubstitute(request, deviceHash);
        return withOptionalMockHeader(ResponseEntity.ok()).body(response);
    }

    @PostMapping("/ask")
    public ResponseEntity<?> ask(
            @RequestBody AskRequest request,
            HttpServletRequest servletRequest) {
        // Chặn endpoint hỏi đáp nếu cờ cấu hình cook.ai.ask-enabled chưa bật
        if (!aiService.isAskEnabled()) {
            return withOptionalMockHeader(ResponseEntity.status(HttpStatus.FORBIDDEN))
                    .body(new ErrorResponse("FEATURE_DISABLED", "Chức năng hỏi đáp AI đang tắt theo cờ cấu hình."));
        }

        String deviceHash = (String) servletRequest.getAttribute("deviceHash");
        AskResponse response = aiService.handleAsk(request, deviceHash);
        return withOptionalMockHeader(ResponseEntity.ok()).body(response);
    }

    /**
     * Làm gì: Đính kèm header X-AI-Mock: true vào ResponseEntity nếu backend đang chạy chế độ AI giả.
     * Vào: builder (ResponseEntity.BodyBuilder cần gắn header).
     * Ra: ResponseEntity.BodyBuilder đã gắn header (nếu là mock) hoặc giữ nguyên (nếu là real).
     * Gọi bởi: substitute() và ask().
     */
    private ResponseEntity.BodyBuilder withOptionalMockHeader(ResponseEntity.BodyBuilder builder) {
        // Chỉ đính kèm header X-AI-Mock khi nhà cung cấp AI là bản giả lập
        if (aiService.isMockAi()) {
            builder.header(MOCK_AI_HEADER, "true");
        }
        return builder;
    }
}
