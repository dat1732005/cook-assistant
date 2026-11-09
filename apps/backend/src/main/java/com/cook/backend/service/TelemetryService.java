/**
 * File: apps/backend/src/main/java/com/cook/backend/service/TelemetryService.java
 * Làm gì: Kiểm tra tính ẩn danh, loại trừ trường nhạy cảm và lưu lô sự kiện đo lường (T19.2) vào PostgreSQL.
 * Nhận vào: Mã thiết bị thô từ header X-Device-Id và lô TelemetryEventDto từ POST /v1/events.
 * Trả ra: EventBatchResponse gồm số sự kiện mới lưu (accepted) và số sự kiện trùng lặp/cập nhật (deduplicated).
 * Ai gọi: EventController.
 * Bám theo: docs/tasks.md mục T19.2 và docs/plan.md mục "Chỉ số thành công".
 */
package com.cook.backend.service;

import com.cook.backend.dto.EventBatchRequest;
import com.cook.backend.dto.EventBatchResponse;
import com.cook.backend.dto.TelemetryEventDto;
import com.cook.backend.entity.TelemetryEvent;
import com.cook.backend.repository.TelemetryEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import java.util.Set;

@Service
public class TelemetryService {

    private static final Logger log = LoggerFactory.getLogger(TelemetryService.class);

    /** Tập hợp các loại sự kiện ẩn danh hợp lệ được phép tiếp nhận theo T19.1 */
    public static final Set<String> ALLOWED_EVENT_TYPES = Set.of(
            "session_started",
            "session_completed",
            "step_back",
            "session_abandoned",
            "pantry_adjusted_after_cook",
            "ai_asked"
    );

    /** Tập hợp các giá trị phân loại hỏi AI hợp lệ (tránh dữ liệu văn bản tự do) */
    public static final Set<String> ALLOWED_AI_KINDS = Set.of("substitute", "ask");

    private final TelemetryEventRepository telemetryEventRepository;
    private final DeviceAnonymizer deviceAnonymizer;

    public TelemetryService(TelemetryEventRepository telemetryEventRepository,
                            DeviceAnonymizer deviceAnonymizer) {
        this.telemetryEventRepository = telemetryEventRepository;
        this.deviceAnonymizer = deviceAnonymizer;
    }

    /**
     * Làm gì: Kiểm tra hợp lệ, băm mã thiết bị ẩn danh và lưu toàn bộ lô sự kiện vào CSDL.
     * Vào: rawDeviceId (chuỗi header X-Device-Id), request (EventBatchRequest gồm danh sách events).
     * Ra: EventBatchResponse cho biết số sự kiện mới ghi và số sự kiện trùng eventId.
     * Ví dụ: Lô 3 sự kiện mới + 1 sự kiện trùng -> EventBatchResponse(3, 1).
     * Gọi bởi: EventController.ingestEvents().
     */
    @Transactional
    public EventBatchResponse ingestBatch(String rawDeviceId, EventBatchRequest request) {
        // Từ chối nếu payload cấp gốc chứa trường lạ hoặc trường nhạy cảm
        if (!request.getExtraFields().isEmpty()) {
            throw new IllegalArgumentException(
                    "Dữ liệu gửi lên chứa trường không được phép: "
                            + String.join(", ", request.getExtraFields().keySet())
            );
        }

        // Băm SHA-256 một chiều mã thiết bị kèm salt, tuyệt đối không lưu rawDeviceId
        String deviceHash = deviceAnonymizer.anonymize(rawDeviceId);

        int acceptedCount = 0;
        int deduplicatedCount = 0;

        // Duyệt từng sự kiện trong lô để kiểm tra trường nhạy cảm và lưu idempotent
        for (TelemetryEventDto dto : request.getEvents()) {
            validateEventDto(dto);

            Instant occurredAt = parseOccurredAt(dto.getOccurredAt());
            Optional<TelemetryEvent> existingOpt = telemetryEventRepository.findByEventId(dto.getEventId());

            // Phân nhánh: nếu sự kiện đã tồn tại thì chỉ cập nhật đánh giá helpful (nếu có), ngược lại chèn mới
            if (existingOpt.isPresent()) {
                TelemetryEvent existing = existingOpt.get();
                if (dto.getHelpful() != null && existing.getHelpful() == null) {
                    existing.setHelpful(dto.getHelpful());
                    telemetryEventRepository.save(existing);
                }
                deduplicatedCount++;
                continue;
            }

            TelemetryEvent entity = new TelemetryEvent(
                    dto.getEventId().trim(),
                    deviceHash,
                    trimOrNull(dto.getSessionId()),
                    dto.getEventType().trim(),
                    trimOrNull(dto.getStepId()),
                    trimOrNull(dto.getRecipeSlug()),
                    trimOrNull(dto.getAiKind()),
                    dto.getHelpful(),
                    occurredAt
            );
            telemetryEventRepository.save(entity);
            acceptedCount++;
        }

        log.info("Ghi nhận lô telemetry: accepted={}, deduplicated={}", acceptedCount, deduplicatedCount);
        return new EventBatchResponse(acceptedCount, deduplicatedCount);
    }

    /**
     * Làm gì: Kiểm tra một TelemetryEventDto không chứa khóa lạ/nhạy cảm và đúng danh mục sự kiện T19.
     * Vào: dto (TelemetryEventDto cần kiểm tra).
     * Ra: Không có; ném IllegalArgumentException nếu vi phạm.
     * Gọi bởi: ingestBatch().
     */
    private void validateEventDto(TelemetryEventDto dto) {
        // Chặn tuyệt đối mọi khóa JSON ngoài danh sách ẩn danh (chống lọt name, allergies, question...)
        if (!dto.getExtraFields().isEmpty()) {
            throw new IllegalArgumentException(
                    "Sự kiện chứa trường không hợp lệ hoặc nhạy cảm: "
                            + String.join(", ", dto.getExtraFields().keySet())
            );
        }

        String eventType = dto.getEventType() != null ? dto.getEventType().trim() : "";
        if (!ALLOWED_EVENT_TYPES.contains(eventType)) {
            throw new IllegalArgumentException("Loại sự kiện không hợp lệ: " + eventType);
        }

        String aiKind = trimOrNull(dto.getAiKind());
        if (aiKind != null && !ALLOWED_AI_KINDS.contains(aiKind)) {
            throw new IllegalArgumentException("Phân loại aiKind không hợp lệ: " + aiKind);
        }
    }

    /**
     * Làm gì: Chuyển chuỗi thời gian ISO-8601 sang Instant.
     * Vào: occurredAtRaw (chuỗi thời điểm sự kiện phía client).
     * Ra: Instant hợp lệ, hoặc ném IllegalArgumentException nếu sai định dạng.
     * Gọi bởi: ingestBatch().
     */
    private Instant parseOccurredAt(String occurredAtRaw) {
        try {
            return Instant.parse(occurredAtRaw.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("occurredAt phải đúng định dạng ISO-8601 UTC (ví dụ 2026-11-09T04:00:00Z)");
        }
    }

    /**
     * Làm gì: Cắt khoảng trắng hai đầu chuỗi, trả về null nếu chuỗi rỗng.
     * Vào: value (chuỗi đầu vào tùy chọn).
     * Ra: Chuỗi đã làm sạch hoặc null.
     * Gọi bởi: ingestBatch() và validateEventDto().
     */
    private String trimOrNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }
}

