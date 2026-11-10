/**
 * File: apps/backend/src/main/java/com/cook/backend/service/DeviceAnonymizer.java
 * Làm gì: Băm một chiều mã thiết bị bằng SHA-256 kèm salt bảo mật đọc từ biến môi trường DEVICE_SALT.
 * Nhận vào: Chuỗi mã thiết bị thô từ header X-Device-Id hoặc telemetry batch.
 * Trả ra: Chuỗi hex 64 ký tự đã ẩn danh, không lưu và không đảo ngược được mã thiết bị gốc.
 * Ai gọi: RateLimitFilter và TelemetryService.
 * Bám theo: docs/tasks.md mục T14.2, T19, T23.1.
 */
package com.cook.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

@Service
public class DeviceAnonymizer {

    private static final String ANONYMOUS_FALLBACK_ID = "anonymous-client";

    private final String salt;

    /**
     * Làm gì: Khởi tạo bộ ẩn danh hóa thiết bị với salt đọc từ biến môi trường (không viết cứng mật khẩu).
     * Vào: salt (giá trị cook.device-salt từ DEVICE_SALT; mặc định rỗng khi test nếu chưa truyền).
     * Ra: Instance DeviceAnonymizer sẵn sàng băm SHA-256.
     * Gọi bởi: Spring Container / test JUnit.
     */
    public DeviceAnonymizer(@Value("${cook.device-salt:}") String salt) {
        this.salt = salt != null ? salt : "";
    }

    /**
     * Làm gì: Băm SHA-256 một chiều chuỗi mã thiết bị thô kèm salt để bảo vệ danh tính người dùng.
     * Vào: rawDeviceId (chuỗi mã thiết bị gửi lên từ client; có thể null hoặc rỗng).
     * Ra: Chuỗi hex 64 ký tự chữ thường đại diện cho thiết bị.
     * Ví dụ: anonymize("dev-001") với cùng salt luôn trả về cùng chuỗi hash SHA-256 ổn định.
     * Gọi bởi: RateLimitFilter.doFilterInternal(), TelemetryService.ingestBatch(), TelemetryService.recordAiFeedback().
     */
    public String anonymize(String rawDeviceId) {
        // Nếu client không gửi mã thiết bị -> gộp vào mã ẩn danh mặc định để tránh lỗi NullPointer
        if (rawDeviceId == null || rawDeviceId.isBlank()) {
            rawDeviceId = ANONYMOUS_FALLBACK_ID;
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((rawDeviceId + ":" + salt).getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            // Chuyển từng byte kết quả SHA-256 sang dạng thập lục phân 2 ký tự
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                // Bổ sung số 0 đầu nếu giá trị hex chỉ có 1 ký tự để đủ 64 ký tự chuẩn
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
