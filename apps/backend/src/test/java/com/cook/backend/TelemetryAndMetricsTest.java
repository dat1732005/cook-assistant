/**
 * File: apps/backend/src/test/java/com/cook/backend/TelemetryAndMetricsTest.java
 * Làm gì: Kiểm thử API POST /v1/events (T19.2) và thực thi truy vấn docs/metrics.sql trên 5 phiên giả (T19.3).
 * Nhận vào: TelemetryEventRepository, AiUsageLogRepository, DeviceAnonymizer, JdbcTemplate và file docs/metrics.sql.
 * Trả ra: Kiểm chứng ẩn danh device_hash, chặn trường nhạy cảm, chống trùng eventId và đúng cả 6 chỉ số thành công.
 * Ai gọi: Maven Surefire (`./mvnw test`).
 * Bám theo: docs/tasks.md mục T19 và docs/plan.md mục "Chỉ số thành công".
 */
package com.cook.backend;

import com.cook.backend.entity.AiUsageLog;
import com.cook.backend.entity.TelemetryEvent;
import com.cook.backend.repository.AiUsageLogRepository;
import com.cook.backend.repository.TelemetryEventRepository;
import com.cook.backend.service.DeviceAnonymizer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@DisplayName("T19: Kiểm thử POST /v1/events ẩn danh và docs/metrics.sql trên 5 phiên giả")
class TelemetryAndMetricsTest {

    @Autowired
    private WebApplicationContext wac;

    @Autowired
    private TelemetryEventRepository telemetryEventRepository;

    @Autowired
    private AiUsageLogRepository aiUsageLogRepository;

    @Autowired
    private DeviceAnonymizer deviceAnonymizer;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
        telemetryEventRepository.deleteAll();
        aiUsageLogRepository.deleteAll();
    }

    @Test
    @DisplayName("T19.2a: POST /v1/events nhận lô sự kiện, băm SHA-256 X-Device-Id và hỗ trợ chống trùng + cập nhật helpful")
    void ingestBatchAnonymizesDeviceAndDeduplicatesEvents() throws Exception {
        String rawDeviceId = "device-raw-secret-001";
        String expectedHash = deviceAnonymizer.anonymize(rawDeviceId);

        String batchJson = """
                {
                  "events": [
                    {
                      "eventId": "evt-1",
                      "eventType": "session_started",
                      "sessionId": "sess-100",
                      "recipeSlug": "trung-chien-ca-chua",
                      "occurredAt": "2026-11-01T10:00:00Z"
                    },
                    {
                      "eventId": "evt-2",
                      "eventType": "ai_asked",
                      "sessionId": "sess-100",
                      "recipeSlug": "trung-chien-ca-chua",
                      "aiKind": "substitute",
                      "occurredAt": "2026-11-01T10:02:00Z"
                    },
                    {
                      "eventId": "evt-3",
                      "eventType": "session_completed",
                      "sessionId": "sess-100",
                      "recipeSlug": "trung-chien-ca-chua",
                      "occurredAt": "2026-11-01T10:15:00Z"
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/v1/events")
                        .header("X-Device-Id", rawDeviceId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(batchJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accepted").value(3))
                .andExpect(jsonPath("$.deduplicated").value(0));

        List<TelemetryEvent> stored = telemetryEventRepository.findByDeviceHash(expectedHash);
        assertEquals(3, stored.size(), "Phải lưu đủ 3 sự kiện gắn với device_hash đã băm");
        assertTrue(telemetryEventRepository.findByDeviceHash(rawDeviceId).isEmpty(),
                "Tuyệt đối không được lưu rawDeviceId trực tiếp vào CSDL");

        // Gửi lại evt-2 kèm đánh giá helpful=true -> deduplicated=1 và cập nhật helpful
        String retryWithHelpful = """
                {
                  "events": [
                    {
                      "eventId": "evt-2",
                      "eventType": "ai_asked",
                      "sessionId": "sess-100",
                      "recipeSlug": "trung-chien-ca-chua",
                      "aiKind": "substitute",
                      "helpful": true,
                      "occurredAt": "2026-11-01T10:02:00Z"
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/v1/events")
                        .header("X-Device-Id", rawDeviceId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(retryWithHelpful))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accepted").value(0))
                .andExpect(jsonPath("$.deduplicated").value(1));

        TelemetryEvent updatedAi = telemetryEventRepository.findByEventId("evt-2").orElseThrow();
        assertEquals(Boolean.TRUE, updatedAi.getHelpful(), "Sự kiện trùng gửi bổ sung phải cập nhật helpful");
    }

    @Test
    @DisplayName("T19.2b: POST /v1/events từ chối HTTP 400 nếu payload lọt trường nhạy cảm (tên, dị ứng, câu hỏi)")
    void ingestBatchRejectsSensitiveFields() throws Exception {
        String sensitiveEventPayload = """
                {
                  "events": [
                    {
                      "eventId": "evt-bad-1",
                      "eventType": "ai_asked",
                      "sessionId": "sess-bad",
                      "aiKind": "ask",
                      "occurredAt": "2026-11-01T10:02:00Z",
                      "question": "Làm sao nấu không bị mặn?",
                      "allergies": ["peanut"],
                      "name": "Nguyen Van A"
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/v1/events")
                        .header("X-Device-Id", "device-bad-01")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(sensitiveEventPayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));

        assertEquals(0, telemetryEventRepository.count(),
                "Không được phép lưu sự kiện chứa trường nhạy cảm");
    }

    @Test
    @DisplayName("T19.3: Chạy docs/metrics.sql trên 5 phiên giả khớp hoàn toàn với kết quả đếm tay 6 chỉ số")
    void metricsSqlComputesAllSixMetricsAccuratelyOnFiveFakeSessions() throws IOException {
        // Nạp bộ dữ liệu 5 phiên giả (synthetic) cho 3 thiết bị ẩn danh
        String hashA = deviceAnonymizer.anonymize("fake-device-A");
        String hashB = deviceAnonymizer.anonymize("fake-device-B");
        String hashC = deviceAnonymizer.anonymize("fake-device-C");

        List<TelemetryEvent> fakeEvents = List.of(
                // Phiên 1 (dev-A, ngày 1): bắt đầu -> lùi bước -> hỏi AI thay NL (hữu ích) -> hoàn tất -> sửa kho
                new TelemetryEvent("f1", hashA, "s1", "session_started", null, "trung-chien-ca-chua", null, null, Instant.parse("2026-11-01T10:00:00Z")),
                new TelemetryEvent("f2", hashA, "s1", "step_back", "step-2", "trung-chien-ca-chua", null, null, Instant.parse("2026-11-01T10:03:00Z")),
                new TelemetryEvent("f3", hashA, "s1", "ai_asked", null, "trung-chien-ca-chua", "substitute", true, Instant.parse("2026-11-01T10:05:00Z")),
                new TelemetryEvent("f4", hashA, "s1", "session_completed", null, "trung-chien-ca-chua", null, null, Instant.parse("2026-11-01T10:15:00Z")),
                new TelemetryEvent("f5", hashA, "s1", "pantry_adjusted_after_cook", null, "trung-chien-ca-chua", null, null, Instant.parse("2026-11-01T10:16:00Z")),

                // Phiên 2 (dev-A, ngày 3): quay lại nấu món thứ hai -> hỏi AI thay NL (không hữu ích) -> hoàn tất
                new TelemetryEvent("f6", hashA, "s2", "session_started", null, "canh-cai-thit-bam", null, null, Instant.parse("2026-11-03T11:00:00Z")),
                new TelemetryEvent("f7", hashA, "s2", "ai_asked", null, "canh-cai-thit-bam", "substitute", false, Instant.parse("2026-11-03T11:04:00Z")),
                new TelemetryEvent("f8", hashA, "s2", "session_completed", null, "canh-cai-thit-bam", null, null, Instant.parse("2026-11-03T11:20:00Z")),

                // Phiên 3 (dev-B, ngày 1): bắt đầu -> lùi bước -> thoát giữa chừng (chưa xong món đầu)
                new TelemetryEvent("f9", hashB, "s3", "session_started", null, "thit-kho-trung", null, null, Instant.parse("2026-11-01T18:00:00Z")),
                new TelemetryEvent("f10", hashB, "s3", "step_back", "step-3", "thit-kho-trung", null, null, Instant.parse("2026-11-01T18:06:00Z")),
                new TelemetryEvent("f11", hashB, "s3", "session_abandoned", "step-3", "thit-kho-trung", null, null, Instant.parse("2026-11-01T18:10:00Z")),

                // Phiên 4 (dev-B, ngày 5): quay lại trong 14 ngày -> hỏi AI khi nấu (hữu ích) -> hoàn tất -> sửa kho
                new TelemetryEvent("f12", hashB, "s4", "session_started", null, "dau-hu-sot-ca", null, null, Instant.parse("2026-11-05T12:00:00Z")),
                new TelemetryEvent("f13", hashB, "s4", "ai_asked", "step-2", "dau-hu-sot-ca", "ask", true, Instant.parse("2026-11-05T12:05:00Z")),
                new TelemetryEvent("f14", hashB, "s4", "session_completed", null, "dau-hu-sot-ca", null, null, Instant.parse("2026-11-05T12:18:00Z")),
                new TelemetryEvent("f15", hashB, "s4", "pantry_adjusted_after_cook", null, "dau-hu-sot-ca", null, null, Instant.parse("2026-11-05T12:20:00Z")),

                // Phiên 5 (dev-C, ngày 2): hoàn tất món đầu tiên, không quay lại món thứ 2
                new TelemetryEvent("f16", hashC, "s5", "session_started", null, "trung-chien-ca-chua", null, null, Instant.parse("2026-11-02T07:00:00Z")),
                new TelemetryEvent("f17", hashC, "s5", "session_completed", null, "trung-chien-ca-chua", null, null, Instant.parse("2026-11-02T07:10:00Z"))
        );
        telemetryEventRepository.saveAll(fakeEvents);

        // Nạp 3 lượt chi phí AI giả tổng 0.0025 USD vào ai_usage_log
        aiUsageLogRepository.saveAll(List.of(
                new AiUsageLog(hashA, "/v1/ai/substitute", 100, 50, 150, 0.0010, "SUCCESS"),
                new AiUsageLog(hashA, "/v1/ai/substitute", 120, 40, 160, 0.0010, "SUCCESS"),
                new AiUsageLog(hashB, "/v1/ai/ask", 80, 30, 110, 0.0005, "SUCCESS")
        ));

        // Đọc nội dung tệp docs/metrics.sql
        Path sqlPath = Paths.get("../../docs/metrics.sql");
        if (!Files.exists(sqlPath)) {
            sqlPath = Paths.get("docs/metrics.sql");
        }
        assertTrue(Files.exists(sqlPath), "Phải tìm thấy docs/metrics.sql");
        String metricsSql = Files.readString(sqlPath);

        Map<String, Object> row = jdbcTemplate.queryForMap(metricsSql);

        // Kiểm chứng đối chiếu từng con số đếm tay trên 5 phiên giả
        assertEquals(3L, toLong(row.get("tong_nguoi_moi_bat_dau")));
        assertEquals(2L, toLong(row.get("so_nguoi_hoan_tat_mon_dau")));
        assertEquals(0.6667, toDouble(row.get("ti_le_nau_xong_mon_dau_tien")), 0.0001);

        assertEquals(2L, toLong(row.get("so_nguoi_quay_lai_mon_thu_hai")));
        assertEquals(0.6667, toDouble(row.get("ti_le_quay_lai_nau_mon_thu_hai")), 0.0001);

        assertEquals(5L, toLong(row.get("tong_phien_bat_dau")));
        assertEquals(2L, toLong(row.get("so_lan_lui_buoc")));
        assertEquals(1L, toLong(row.get("so_lan_thoat_giua_chung")));
        assertEquals(3L, toLong(row.get("so_buoc_bo_qua_hoac_quay_lai")));
        assertEquals(0.6000, toDouble(row.get("tb_bo_qua_hoac_quay_lai_moi_phien")), 0.0001);

        assertEquals(4L, toLong(row.get("tong_phien_hoan_tat")));
        assertEquals(2L, toLong(row.get("so_lan_sua_kho_sau_nau")));
        assertEquals(0.5000, toDouble(row.get("ti_le_sua_kho_sau_khi_nau")), 0.0001);

        assertEquals(2L, toLong(row.get("so_luot_hoi_ai_thay_nguyen_lieu")));
        assertEquals(3L, toLong(row.get("tong_luot_hoi_ai")));
        assertEquals(0.6000, toDouble(row.get("ti_le_hoi_ai_thay_nguyen_lieu")), 0.0001);
        assertEquals(2L, toLong(row.get("so_danh_gia_huu_ich")));
        assertEquals(1L, toLong(row.get("so_danh_gia_khong_huu_ich")));
        assertEquals(0.6667, toDouble(row.get("ti_le_ai_huu_ich")), 0.0001);

        assertEquals(0.0025, toDouble(row.get("tong_chi_phi_ai")), 0.000001);
        assertEquals(0.0005, toDouble(row.get("chi_phi_ai_trung_binh_moi_phien")), 0.000001);
    }

    @Test
    @DisplayName("T19.3b: Chạy docs/metrics.sql trên dữ liệu giả và kỳ vọng đọc trực tiếp từ khối JSON docs/expected/T19.md")
    void metricsSqlMatchesJsonFixtureFromT19Expected() throws IOException {
        Path t19Path = resolveRepoFile("docs/expected/T19.md");
        String content = Files.readString(t19Path);

        Matcher matcher = Pattern.compile("\\{.*\"case\"\\s*:\\s*\"T19\".*\\}").matcher(content);
        assertTrue(matcher.find(), "docs/expected/T19.md phải chứa khối JSON T19");

        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(matcher.group());
        JsonNode sessionsNode = root.get("sessions");
        JsonNode costsNode = root.get("ai_usage_log_costs");
        JsonNode expectedNode = root.get("expected");
        double tolerance = root.get("tolerance").asDouble();

        assertEquals(5, sessionsNode.size(), "Bộ dữ liệu giả T19.md phải có đúng 5 phiên");
        assertEquals(2, costsNode.size(), "Bộ dữ liệu giả T19.md phải có đúng 2 dòng chi phí AI");

        Instant dayZero = Instant.parse("2026-11-01T00:00:00Z");
        List<TelemetryEvent> fixtureEvents = new ArrayList<>();
        int eventSeq = 1;

        for (JsonNode sessionNode : sessionsNode) {
            String sessionId = sessionNode.get("id").asText();
            String deviceRaw = sessionNode.get("device").asText();
            int day = sessionNode.get("day").asInt();
            String deviceHash = deviceAnonymizer.anonymize(deviceRaw);
            Instant sessionBaseTime = dayZero.plus(day, ChronoUnit.DAYS);

            int stepIndex = 0;
            for (JsonNode evtNode : sessionNode.get("events")) {
                String token = evtNode.asText();
                Instant occurredAt = sessionBaseTime.plusSeconds(stepIndex * 60L);
                stepIndex++;

                String eventId = "t19_evt_" + (eventSeq++);
                switch (token) {
                    case "start" -> fixtureEvents.add(new TelemetryEvent(
                            eventId, deviceHash, sessionId, "session_started",
                            null, "trung-chien-ca-chua", null, null, occurredAt
                    ));
                    case "step_back" -> fixtureEvents.add(new TelemetryEvent(
                            eventId, deviceHash, sessionId, "step_back",
                            "step-1", "trung-chien-ca-chua", null, null, occurredAt
                    ));
                    case "exit" -> fixtureEvents.add(new TelemetryEvent(
                            eventId, deviceHash, sessionId, "session_abandoned",
                            "step-2", "trung-chien-ca-chua", null, null, occurredAt
                    ));
                    case "pantry_edit" -> fixtureEvents.add(new TelemetryEvent(
                            eventId, deviceHash, sessionId, "pantry_adjusted_after_cook",
                            null, "trung-chien-ca-chua", null, null, occurredAt
                    ));
                    case "finish" -> fixtureEvents.add(new TelemetryEvent(
                            eventId, deviceHash, sessionId, "session_completed",
                            null, "trung-chien-ca-chua", null, null, occurredAt
                    ));
                    case "ai_asked:useful" -> fixtureEvents.add(new TelemetryEvent(
                            eventId, deviceHash, sessionId, "ai_asked",
                            null, "trung-chien-ca-chua", null, Boolean.TRUE, occurredAt
                    ));
                    case "ai_asked:not_useful" -> fixtureEvents.add(new TelemetryEvent(
                            eventId, deviceHash, sessionId, "ai_asked",
                            null, "trung-chien-ca-chua", null, Boolean.FALSE, occurredAt
                    ));
                    default -> fail("Không hỗ trợ mã sự kiện T19.md: " + token);
                }
            }
        }
        telemetryEventRepository.saveAll(fixtureEvents);

        String dummyDeviceHash = deviceAnonymizer.anonymize("d1");
        for (JsonNode costNode : costsNode) {
            aiUsageLogRepository.save(new AiUsageLog(
                    dummyDeviceHash, "/v1/ai/substitute", 100, 50, 150, costNode.asDouble(), "SUCCESS"
            ));
        }

        String metricsSql = Files.readString(resolveRepoFile("docs/metrics.sql"));
        Map<String, Object> row = jdbcTemplate.queryForMap(metricsSql);

        double actualFirstCompleted = toDouble(row.get("ti_le_nau_xong_mon_dau_tien"));
        double actualReturned14d = toDouble(row.get("ti_le_quay_lai_nau_mon_thu_hai"));
        double actualBackOrExitTotal = toDouble(row.get("so_buoc_bo_qua_hoac_quay_lai"));
        double actualBackOrExitPerSession = toDouble(row.get("tb_bo_qua_hoac_quay_lai_moi_phien"));
        double actualPantryEditRate = toDouble(row.get("ti_le_sua_kho_sau_khi_nau"));
        double actualAiAsksPerSession = toDouble(row.get("ti_le_hoi_ai_thay_nguyen_lieu"));
        double actualAiUsefulRate = toDouble(row.get("ti_le_ai_huu_ich"));
        double actualAiCostPerSession = toDouble(row.get("chi_phi_ai_trung_binh_moi_phien"));

        System.out.printf(
                "T19_SQL_ACTUAL => first=%.4f, ret14=%.4f, backTotal=%.0f, backPer=%.4f, pantry=%.4f, aiPer=%.4f, aiUseful=%.4f, aiCost=%.6f%n",
                actualFirstCompleted, actualReturned14d, actualBackOrExitTotal, actualBackOrExitPerSession,
                actualPantryEditRate, actualAiAsksPerSession, actualAiUsefulRate, actualAiCostPerSession
        );

        assertEquals(expectedNode.get("first_session_completed").asDouble(), actualFirstCompleted, tolerance);
        assertEquals(expectedNode.get("returned_within_14_days").asDouble(), actualReturned14d, tolerance);
        assertEquals(expectedNode.get("back_or_exit_total").asDouble(), actualBackOrExitTotal, tolerance);
        assertEquals(expectedNode.get("back_or_exit_per_session").asDouble(), actualBackOrExitPerSession, tolerance);
        assertEquals(expectedNode.get("pantry_edit_rate").asDouble(), actualPantryEditRate, tolerance);
        assertEquals(expectedNode.get("ai_asks_per_session").asDouble(), actualAiAsksPerSession, tolerance);
        assertEquals(expectedNode.get("ai_useful_rate").asDouble(), actualAiUsefulRate, tolerance);
        assertEquals(expectedNode.get("ai_cost_per_session").asDouble(), actualAiCostPerSession, tolerance);
    }

    private Path resolveRepoFile(String relativeFromRoot) {
        Path p = Paths.get(relativeFromRoot);
        if (Files.exists(p)) return p;
        p = Paths.get("../../" + relativeFromRoot);
        if (Files.exists(p)) return p;
        p = Paths.get("../../../" + relativeFromRoot);
        assertTrue(Files.exists(p), "Phải tìm thấy tệp: " + relativeFromRoot);
        return p;
    }

    private long toLong(Object val) {
        assertNotNull(val);
        return ((Number) val).longValue();
    }

    private double toDouble(Object val) {
        assertNotNull(val);
        if (val instanceof BigDecimal bd) {
            return bd.doubleValue();
        }
        return ((Number) val).doubleValue();
    }
}

