/**
 * File: apps/backend/src/main/java/com/cook/backend/exception/AiProviderNotConfiguredException.java
 * Làm gì: Ngoại lệ báo rõ khi bật RealAiProvider nhưng chủ dự án chưa chọn nhà cung cấp / URL endpoint AI thật.
 * Nhận vào: Thông báo lỗi chi tiết (không chứa bí mật).
 * Trả ra: Ngoại lệ runtime được GlobalExceptionHandler chuyển thành HTTP 503.
 * Ai gọi: RealAiProvider khi endpointUrl còn trống hoặc MISSING.
 * Bám theo: Yêu cầu T20b mục (3).
 */
package com.cook.backend.exception;

public class AiProviderNotConfiguredException extends RuntimeException {
    public AiProviderNotConfiguredException(String message) {
        super(message);
    }
}

