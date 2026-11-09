/**
 * File: apps/backend/src/main/java/com/cook/backend/repository/TelemetryEventRepository.java
 * Làm gì: Giao diện Spring Data JPA truy vấn bảng telemetry_event phục vụ ghi lô sự kiện và kiểm thử.
 * Nhận vào: eventId hoặc deviceHash.
 * Trả ra: Thực thể TelemetryEvent hoặc danh sách sự kiện theo thiết bị ẩn danh.
 * Ai gọi: TelemetryService và TelemetryAndMetricsTest.
 * Bám theo: docs/tasks.md mục T19.2.
 */
package com.cook.backend.repository;

import com.cook.backend.entity.TelemetryEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TelemetryEventRepository extends JpaRepository<TelemetryEvent, Long> {
    Optional<TelemetryEvent> findByEventId(String eventId);
    List<TelemetryEvent> findByDeviceHash(String deviceHash);
}

