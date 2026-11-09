/**
 * File: apps/backend/src/main/java/com/cook/backend/dto/EventBatchResponse.java
 * Làm gì: DTO phản hồi sau khi backend xử lý xong lô sự kiện POST /v1/events.
 * Nhận vào: Số lượng sự kiện mới lưu (accepted) và số sự kiện trùng lặp đã bỏ qua/cập nhật (deduplicated).
 * Trả ra: JSON { accepted, deduplicated }.
 * Ai gọi: EventController và TelemetryService.
 * Bám theo: docs/tasks.md mục T19.2.
 */
package com.cook.backend.dto;

public record EventBatchResponse(int accepted, int deduplicated) {}

