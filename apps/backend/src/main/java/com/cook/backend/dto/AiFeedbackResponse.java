/**
 * File: apps/backend/src/main/java/com/cook/backend/dto/AiFeedbackResponse.java
 * Làm gì: DTO phản hồi chuẩn cho API POST /v1/ai/feedback sau khi ghi sự kiện ai_wrong_answer.
 * Nhận vào: status, eventId, eventType.
 * Trả ra: JSON { status, eventId, eventType }.
 * Ai gọi: AiController.feedback().
 * Bám theo: Yêu cầu T20b mục (2).
 */
package com.cook.backend.dto;

public record AiFeedbackResponse(
        String status,
        String eventId,
        String eventType
) {
}

