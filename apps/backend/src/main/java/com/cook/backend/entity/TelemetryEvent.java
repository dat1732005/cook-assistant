/**
 * File: apps/backend/src/main/java/com/cook/backend/entity/TelemetryEvent.java
 * Làm gì: Thực thể JPA ánh xạ bảng telemetry_event trong PostgreSQL để lưu sự kiện đo lường ẩn danh.
 * Nhận vào: Thông tin sự kiện đã ẩn danh (eventId, deviceHash, sessionId, eventType, aiKind, helpful, occurredAt).
 * Trả ra: Bản ghi CSDL phục vụ truy vấn docs/metrics.sql tính 6 chỉ số thành công.
 * Ai gọi: TelemetryService và TelemetryEventRepository.
 * Bám theo: docs/tasks.md mục T19.2 và docs/plan.md mục "Chỉ số thành công".
 */
package com.cook.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "telemetry_event")
public class TelemetryEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false, unique = true, length = 64)
    private String eventId;

    @Column(name = "device_hash", nullable = false, length = 64)
    private String deviceHash;

    @Column(name = "session_id", length = 64)
    private String sessionId;

    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @Column(name = "step_id", length = 64)
    private String stepId;

    @Column(name = "recipe_slug", length = 128)
    private String recipeSlug;

    @Column(name = "ai_kind", length = 32)
    private String aiKind;

    @Column(name = "helpful")
    private Boolean helpful;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "received_at")
    private Instant receivedAt = Instant.now();

    public TelemetryEvent() {}

    public TelemetryEvent(
            String eventId,
            String deviceHash,
            String sessionId,
            String eventType,
            String stepId,
            String recipeSlug,
            String aiKind,
            Boolean helpful,
            Instant occurredAt) {
        this.eventId = eventId;
        this.deviceHash = deviceHash;
        this.sessionId = sessionId;
        this.eventType = eventType;
        this.stepId = stepId;
        this.recipeSlug = recipeSlug;
        this.aiKind = aiKind;
        this.helpful = helpful;
        this.occurredAt = occurredAt;
        this.receivedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getEventId() { return eventId; }
    public String getDeviceHash() { return deviceHash; }
    public String getSessionId() { return sessionId; }
    public String getEventType() { return eventType; }
    public String getStepId() { return stepId; }
    public String getRecipeSlug() { return recipeSlug; }
    public String getAiKind() { return aiKind; }
    public Boolean getHelpful() { return helpful; }
    public Instant getOccurredAt() { return occurredAt; }
    public Instant getReceivedAt() { return receivedAt; }

    public void setId(Long id) { this.id = id; }
    public void setEventId(String eventId) { this.eventId = eventId; }
    public void setDeviceHash(String deviceHash) { this.deviceHash = deviceHash; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public void setStepId(String stepId) { this.stepId = stepId; }
    public void setRecipeSlug(String recipeSlug) { this.recipeSlug = recipeSlug; }
    public void setAiKind(String aiKind) { this.aiKind = aiKind; }
    public void setHelpful(Boolean helpful) { this.helpful = helpful; }
    public void setOccurredAt(Instant occurredAt) { this.occurredAt = occurredAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }
}

