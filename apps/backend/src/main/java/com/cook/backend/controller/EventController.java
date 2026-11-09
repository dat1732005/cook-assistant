/**
 * File: apps/backend/src/main/java/com/cook/backend/controller/EventController.java
 * Làm gì: Tiếp nhận lô sự kiện đo lường ẩn danh tại endpoint POST /v1/events khi app có mạng.
 * Nhận vào: Header ẩn danh X-Device-Id và JSON EventBatchRequest.
 * Trả ra: ResponseEntity<EventBatchResponse> gồm số lượng sự kiện đã lưu và trùng lặp.
 * Ai gọi: Spring Web DispatcherServlet khi app đồng bộ sự kiện đo lường cục bộ (T19.2).
 * Bám theo: docs/tasks.md mục T19.2.
 */
package com.cook.backend.controller;

import com.cook.backend.dto.EventBatchRequest;
import com.cook.backend.dto.EventBatchResponse;
import com.cook.backend.service.TelemetryService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/events")
public class EventController {

    private final TelemetryService telemetryService;

    public EventController(TelemetryService telemetryService) {
        this.telemetryService = telemetryService;
    }

    @PostMapping
    public ResponseEntity<EventBatchResponse> ingestEvents(
            @RequestHeader(value = "X-Device-Id", required = false) String rawDeviceId,
            @Valid @RequestBody EventBatchRequest request) {
        EventBatchResponse response = telemetryService.ingestBatch(rawDeviceId, request);
        return ResponseEntity.ok(response);
    }
}

