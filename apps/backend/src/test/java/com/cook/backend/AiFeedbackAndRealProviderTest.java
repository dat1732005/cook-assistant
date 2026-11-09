/**
 * File: apps/backend/src/test/java/com/cook/backend/AiFeedbackAndRealProviderTest.java
 * Làm gì: Kiểm thử toàn diện hai yêu cầu backend của T20b:
 *         1. POST /v1/ai/feedback nhận X-Device-Id ẩn danh, feedbackType, questionId;
 *            tuyệt đối không lưu nội dung câu hỏi hay câu trả lời và ghi vào telemetry_event kiểu ai_wrong_answer.
 *         2. RealAiProvider thực thi khung gọi HTTP qua interface AiProvider, báo lỗi rõ khi chưa chọn
 *            nhà cung cấp (MISSING) và xử lý thành công / timeout / lỗi HTTP khi có endpoint thử.
 * Nhận vào: MockMvc, TelemetryEventRepository, DeviceAnonymizer, RateLimitFilter và JDK HttpServer cục bộ.
 * Trả ra: Kết quả kiểm thử JUnit 5 xác minh hành vi T20b.
 * Ai gọi: `./mvnw test` và Maven Surefire.
 * Bám theo: Yêu cầu T20b mục (2) và (3).
 */
package com.cook.backend;

import com.cook.backend.ai.RealAiProvider;
import com.cook.backend.dto.AskRequest;
import com.cook.backend.dto.AskResponse;
import com.cook.backend.dto.SubstituteRequest;
import com.cook.backend.dto.SubstituteResponse;
import com.cook.backend.entity.TelemetryEvent;
import com.cook.backend.exception.AiBadResponseException;
import com.cook.backend.exception.AiProviderNotConfiguredException;
import com.cook.backend.exception.AiTimeoutException;
import com.cook.backend.filter.AiMockHeaderFilter;
import com.cook.backend.filter.RateLimitFilter;
import com.cook.backend.repository.TelemetryEventRepository;
import com.cook.backend.service.DeviceAnonymizer;
import com.cook.backend.service.SlidingWindowRateLimiter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@DisplayName("T20b: Kiểm thử POST /v1/ai/feedback ẩn danh và khung HTTP RealAiProvider")
class AiFeedbackAndRealProviderTest {

    @Autowired
    private WebApplicationContext wac;

    @Autowired
    private TelemetryEventRepository telemetryEventRepository;

    @Autowired
    private DeviceAnonymizer deviceAnonymizer;

    @Autowired
    private AiMockHeaderFilter aiMockHeaderFilter;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    @Autowired
    private SlidingWindowRateLimiter rateLimiter;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac)
                .addFilters(aiMockHeaderFilter, rateLimitFilter)
                .build();
        telemetryEventRepository.deleteAll();
        rateLimiter.reset();
    }

    @Test
    @DisplayName("T20b-BE1: POST /v1/ai/feedback ghi sự kiện ai_wrong_answer với deviceHash, feedbackType, questionId và không lưu câu hỏi/trả lời")
    void feedbackEndpointRecordsAiWrongAnswerWithoutStoringQuestionOrAnswer() throws Exception {
        String rawDeviceId = "device-t20b-raw-secret";
        String expectedHash = deviceAnonymizer.anonymize(rawDeviceId);

        // Cố tình gửi kèm question, answer, comment -> backend phải bỏ qua hoàn toàn các trường nội dung này
        String payload = """
                {
                  "questionId": "q_ask_m123_abc",
                  "feedbackType": "ask_wrong_answer",
                  "sessionId": "sess-901",
                  "recipeSlug": "trung-chien-ca-chua",
                  "stepId": "step-2",
                  "question": "Cau hoi bi mat khong duoc luu",
                  "answer": "Cau tra loi bi mat khong duoc luu",
                  "comment": "Binh luan rieng tu"
                }
                """;

        mockMvc.perform(post("/v1/ai/feedback")
                        .header("X-Device-Id", rawDeviceId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.eventType").value("ai_wrong_answer"))
                .andExpect(jsonPath("$.eventId").isNotEmpty());

        List<TelemetryEvent> saved = telemetryEventRepository.findByDeviceHash(expectedHash);
        assertEquals(1, saved.size(), "Phải lưu đúng 1 sự kiện telemetry ẩn danh cho thiết bị");
        assertTrue(telemetryEventRepository.findByDeviceHash(rawDeviceId).isEmpty(),
                "Không được lưu X-Device-Id thô");

        TelemetryEvent evt = saved.get(0);
        assertEquals("ai_wrong_answer", evt.getEventType());
        assertEquals("q_ask_m123_abc", evt.getQuestionId());
        assertEquals("ask_wrong_answer", evt.getFeedbackType());
        assertEquals("ask", evt.getAiKind());
        assertEquals(Boolean.FALSE, evt.getHelpful());
        assertEquals("sess-901", evt.getSessionId());
        assertEquals("trung-chien-ca-chua", evt.getRecipeSlug());
        assertEquals("step-2", evt.getStepId());

        // Bảo đảm chuỗi nhạy cảm không xuất hiện ở bất kỳ thuộc tính nào của entity đã lưu
        String serializedEntity = String.join("|",
                String.valueOf(evt.getEventId()),
                String.valueOf(evt.getDeviceHash()),
                String.valueOf(evt.getQuestionId()),
                String.valueOf(evt.getFeedbackType()),
                String.valueOf(evt.getSessionId()),
                String.valueOf(evt.getRecipeSlug()),
                String.valueOf(evt.getStepId()),
                String.valueOf(evt.getAiKind())
        );
        assertFalse(serializedEntity.contains("Cau hoi bi mat"));
        assertFalse(serializedEntity.contains("Cau tra loi bi mat"));
        assertFalse(serializedEntity.contains("Binh luan rieng tu"));
    }

    @Test
    @DisplayName("T20b-BE2: POST /v1/ai/feedback từ chối thiếu questionId/feedbackType và vẫn gửi được dù đã chạm hạn mức gọi AI")
    void feedbackValidatesRequiredIdsAndWorksEvenAfterAiRateLimit() throws Exception {
        mockMvc.perform(post("/v1/ai/feedback")
                        .header("X-Device-Id", "dev-t20b-valid")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"\",\"feedbackType\":\"wrong_answer\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        // Gọi đủ hạn mức 3 lần /v1/ai/substitute để thiết bị chạm 429
        String subJson = "{\"recipeId\":\"mon-1\",\"action\":\"substitute\",\"ingredientId\":\"hanh-la\",\"role\":\"flavor\"}";
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/v1/ai/substitute")
                            .header("X-Device-Id", "dev-t20b-limit")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(subJson))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(post("/v1/ai/substitute")
                        .header("X-Device-Id", "dev-t20b-limit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(subJson))
                .andExpect(status().isTooManyRequests());

        // Người dùng vẫn bấm được "Câu trả lời sai" cho câu trả lời vừa nhận
        mockMvc.perform(post("/v1/ai/feedback")
                        .header("X-Device-Id", "dev-t20b-limit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\":\"q_sub_after_429\",\"feedbackType\":\"substitute_wrong_answer\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventType").value("ai_wrong_answer"));
    }

    @Test
    @DisplayName("T20b-BE3: RealAiProvider chưa chọn nhà cung cấp (endpoint rỗng/MISSING) -> ném AiProviderNotConfiguredException")
    void realProviderThrowsExplicitErrorWhenProviderNotChosenYet() {
        RealAiProvider unconfigured = new RealAiProvider("secret-token-value");
        assertFalse(unconfigured.isMock());
        assertFalse(unconfigured.hasConfiguredEndpoint());

        SubstituteRequest subReq = new SubstituteRequest(
                "mon-1", "omit", "hanh-la", "flavor", "herb", List.of(), List.of(), Map.of(), null
        );
        AiProviderNotConfiguredException ex = assertThrows(
                AiProviderNotConfiguredException.class,
                () -> unconfigured.substitute(subReq)
        );
        assertTrue(ex.getMessage().contains("COOK_AI_ENDPOINT_URL"));
        assertFalse(ex.getMessage().contains("secret-token-value"), "Tuyệt đối không lộ API key ra lỗi");
    }

    @Test
    @DisplayName("T20b-BE4: RealAiProvider gửi HTTP POST đúng chuẩn qua HttpClient cục bộ và xử lý timeout/lỗi HTTP")
    @SuppressWarnings("unchecked")
    void realProviderHttpSkeletonExecutesPostAndHandlesTimeoutAndErrors() throws Exception {
        AtomicReference<String> capturedAuthHeader = new AtomicReference<>();
        AtomicReference<String> capturedContentType = new AtomicReference<>();
        AtomicReference<String> capturedPath = new AtomicReference<>();

        // Khởi động HttpServer loopback của JDK để kiểm chứng luồng HttpClient thật mà không phụ thuộc AI ngoài
        HttpServer localServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        localServer.createContext("/v1/ask", exchange -> {
            capturedAuthHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
            capturedContentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            capturedPath.set(exchange.getRequestURI().getPath());
            byte[] respBytes = "{\"answer\":\"Giảm lửa nhỏ 1 phút.\",\"action\":null}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, respBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(respBytes);
            }
        });
        localServer.createContext("/v1/substitute", exchange -> {
            byte[] respBytes = "{\"severity\":\"low\",\"impact\":\"Thay bằng hành tây.\",\"suggestions\":[\"hanh-tay\"],\"confirm_required\":false}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, respBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(respBytes);
            }
        });
        localServer.start();

        try {
            String baseUrl = "http://127.0.0.1:" + localServer.getAddress().getPort() + "/v1";
            RealAiProvider provider = new RealAiProvider(
                    "test-api-key-placeholder",
                    baseUrl,
                    "pending-owner-model",
                    3000L,
                    HttpClient.newHttpClient(),
                    new ObjectMapper()
            );

            assertTrue(provider.hasConfiguredEndpoint());
            AskResponse askRes = provider.ask(new AskRequest("Nên để lửa thế nào?", "step-1", List.of("step-2"), null));
            assertEquals("Giảm lửa nhỏ 1 phút.", askRes.answer());
            assertEquals("Bearer test-api-key-placeholder", capturedAuthHeader.get());
            assertEquals("application/json", capturedContentType.get());
            assertEquals("/v1/ask", capturedPath.get());

            SubstituteResponse subRes = provider.substitute(new SubstituteRequest(
                    "mon-1", "substitute", "hanh-la", "flavor", "herb", List.of(), List.of("hanh-tay"), Map.of(), null
            ));
            assertEquals("low", subRes.severity());
            assertEquals(List.of("hanh-tay"), subRes.suggestions());
        } finally {
            localServer.stop(0);
        }

        // Kiểm chứng mapping timeout -> AiTimeoutException và HTTP 500 -> AiBadResponseException
        HttpClient mockTimeoutClient = mock(HttpClient.class);
        when(mockTimeoutClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new HttpTimeoutException("timed out"));
        RealAiProvider timeoutProvider = new RealAiProvider(
                "k", "https://ai.example.invalid/v1", "m", 2000L, mockTimeoutClient, new ObjectMapper()
        );
        assertThrows(AiTimeoutException.class, () -> timeoutProvider.ask(new AskRequest("Test", null, List.of(), null)));

        HttpClient mockErrClient = mock(HttpClient.class);
        HttpResponse<String> errResp = mock(HttpResponse.class);
        when(errResp.statusCode()).thenReturn(502);
        when(mockErrClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(errResp);
        RealAiProvider errProvider = new RealAiProvider(
                "k", "https://ai.example.invalid/v1", "m", 2000L, mockErrClient, new ObjectMapper()
        );
        assertThrows(AiBadResponseException.class, () -> errProvider.ask(new AskRequest("Test", null, List.of(), null)));
    }
}

