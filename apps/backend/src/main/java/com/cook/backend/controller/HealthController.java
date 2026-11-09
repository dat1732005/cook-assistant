package com.cook.backend.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HealthController {

    private static final Logger log = LoggerFactory.getLogger(HealthController.class);
    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> statusMap = new LinkedHashMap<>();

        try (Connection connection = dataSource.getConnection()) {
            boolean isValid = connection.isValid(2);
            if (isValid) {
                statusMap.put("status", "UP");
                statusMap.put("database", "UP");
                return ResponseEntity.ok(statusMap);
            } else {
                statusMap.put("status", "DOWN");
                statusMap.put("database", "DOWN");
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(statusMap);
            }
        } catch (Exception e) {
            log.error("Database health check failed: {}", e.getMessage());
            statusMap.put("status", "DOWN");
            statusMap.put("database", "DOWN");
            statusMap.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(statusMap);
        }
    }
}
