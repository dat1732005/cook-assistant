package com.cook.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

@Service
public class DeviceAnonymizer {

    private final String salt;

    public DeviceAnonymizer(@Value("${cook.device-salt:default-cook-salt-secret}") String salt) {
        this.salt = salt != null ? salt : "";
    }

    public String anonymize(String rawDeviceId) {
        if (rawDeviceId == null || rawDeviceId.isBlank()) {
            rawDeviceId = "anonymous-client";
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((rawDeviceId + ":" + salt).getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
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
