/**
 * File: apps/backend/src/main/java/com/cook/backend/dto/TelemetryEventDto.java
 * Làm gì: DTO tiếp nhận từng sự kiện đo lường ẩn danh trong lô gửi lên POST /v1/events,
 *         đồng thời ghi nhận mọi khóa lạ để chặn dữ liệu nhạy cảm (tên, dị ứng, nội dung câu hỏi).
 * Nhận vào: JSON sự kiện từ app di động.
 * Trả ra: Đối tượng dữ liệu đã kiểm tra hợp lệ và danh sách khóa lạ (nếu có).
 * Ai gọi: EventBatchRequest và TelemetryService.
 * Bám theo: docs/tasks.md mục T19.1, T19.2.
 */
package com.cook.backend.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.Map;

public class TelemetryEventDto {

    @NotBlank(message = "eventId không được để trống")
    @Size(max = 64)
    private String eventId;

    @NotBlank(message = "eventType không được để trống")
    @Size(max = 64)
    private String eventType;

    @Size(max = 64)
    private String sessionId;

    @Size(max = 128)
    private String recipeSlug;

    @Size(max = 64)
    private String stepId;

    @Size(max = 32)
    private String aiKind;

    private Boolean helpful;

    @NotBlank(message = "occurredAt không được để trống")
    @Size(max = 64)
    private String occurredAt;

    private final Map<String, Object> extraFields = new LinkedHashMap<>();

    /**
     * Làm gì: Thu thập các khóa JSON ngoài danh sách cho phép để chặn trường nhạy cảm ở tầng dịch vụ.
     * Vào: key (tên khóa JSON), value (giá trị đi kèm).
     * Ra: Không có.
     * Gọi bởi: Jackson khi giải mã JSON request.
     */
    @JsonAnySetter
    public void captureUnknownField(String key, Object value) {
        this.extraFields.put(key, value);
    }

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getRecipeSlug() { return recipeSlug; }
    public void setRecipeSlug(String recipeSlug) { this.recipeSlug = recipeSlug; }

    public String getStepId() { return stepId; }
    public void setStepId(String stepId) { this.stepId = stepId; }

    public String getAiKind() { return aiKind; }
    public void setAiKind(String aiKind) { this.aiKind = aiKind; }

    public Boolean getHelpful() { return helpful; }
    public void setHelpful(Boolean helpful) { this.helpful = helpful; }

    public String getOccurredAt() { return occurredAt; }
    public void setOccurredAt(String occurredAt) { this.occurredAt = occurredAt; }

    public Map<String, Object> getExtraFields() { return extraFields; }
}

