/**
 * File: apps/backend/src/main/java/com/cook/backend/dto/EventBatchRequest.java
 * Làm gì: DTO tiếp nhận lô sự kiện đo lường gửi lên POST /v1/events.
 * Nhận vào: Danh sách events (1 đến 100 phần tử) kèm kiểm tra khóa lạ cấp gốc.
 * Trả ra: EventBatchRequest đã validate cấu trúc cơ bản.
 * Ai gọi: EventController.ingestEvents().
 * Bám theo: docs/tasks.md mục T19.2.
 */
package com.cook.backend.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class EventBatchRequest {

    /** Số lượng sự kiện tối đa cho mỗi lần gửi lô */
    public static final int MAX_EVENTS_PER_BATCH = 100;

    @NotEmpty(message = "Danh sách events không được rỗng")
    @Size(max = MAX_EVENTS_PER_BATCH, message = "Mỗi lô tối đa 100 sự kiện")
    private List<@Valid TelemetryEventDto> events;

    private final Map<String, Object> extraFields = new LinkedHashMap<>();

    /**
     * Làm gì: Ghi nhận các khóa JSON lạ ở cấp gốc của request để chặn dữ liệu nhạy cảm.
     * Vào: key (tên khóa), value (giá trị).
     * Ra: Không có.
     * Gọi bởi: Jackson ObjectMapper.
     */
    @JsonAnySetter
    public void captureUnknownField(String key, Object value) {
        this.extraFields.put(key, value);
    }

    public List<TelemetryEventDto> getEvents() { return events; }
    public void setEvents(List<TelemetryEventDto> events) { this.events = events; }

    public Map<String, Object> getExtraFields() { return extraFields; }
}
