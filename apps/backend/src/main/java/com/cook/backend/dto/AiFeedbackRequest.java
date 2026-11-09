/**
 * File: apps/backend/src/main/java/com/cook/backend/dto/AiFeedbackRequest.java
 * Làm gì: DTO tiếp nhận phản hồi "Câu trả lời sai" tại POST /v1/ai/feedback (T20b).
 *         Chỉ nhận mã câu hỏi (questionId), loại phản hồi (feedbackType) và ID ngữ cảnh tối giản;
 *         tuyệt đối bỏ qua và không lưu nội dung câu hỏi hay câu trả lời.
 * Nhận vào: JSON request từ AiClient.reportFeedback().
 * Trả ra: AiFeedbackRequest đã kiểm tra Bean Validation.
 * Ai gọi: AiController.feedback() và TelemetryService.recordAiWrongAnswerFeedback().
 * Bám theo: Yêu cầu T20b mục (2) về phản hồi AI ẩn danh.
 */
package com.cook.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AiFeedbackRequest(
        @NotBlank(message = "questionId không được để trống")
        @Size(max = 64, message = "questionId tối đa 64 ký tự")
        @Pattern(regexp = "^[a-zA-Z0-9_.:-]+$", message = "questionId chỉ được chứa mã định danh ngắn không khoảng trắng")
        String questionId,

        @NotBlank(message = "feedbackType không được để trống")
        @Size(max = 32, message = "feedbackType tối đa 32 ký tự")
        @Pattern(regexp = "^[a-zA-Z0-9_-]+$", message = "feedbackType chỉ được chứa mã loại phản hồi hợp lệ")
        String feedbackType,

        @Size(max = 64, message = "sessionId tối đa 64 ký tự")
        String sessionId,

        @Size(max = 128, message = "recipeSlug tối đa 128 ký tự")
        String recipeSlug,

        @Size(max = 64, message = "stepId tối đa 64 ký tự")
        String stepId
) {
}

