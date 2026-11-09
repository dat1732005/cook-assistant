package com.cook.backend.controller;

import com.cook.backend.ai.MockAiProvider;
import com.cook.backend.ai.RealAiProvider;
import com.cook.backend.exception.GlobalExceptionHandler;
import com.cook.backend.filter.AiMockHeaderFilter;
import com.cook.backend.filter.RateLimitFilter;
import com.cook.backend.repository.AiUsageLogRepository;
import com.cook.backend.service.AiService;
import com.cook.backend.service.SafetyScanService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@DisplayName("T15-fix: Kiểm tra header X-AI-Mock trên mọi phản hồi AI khi dùng bản giả")
class AiMockHeaderTest {

    @Autowired
    private WebApplicationContext wac;

    @Autowired
    private AiMockHeaderFilter aiMockHeaderFilter;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    @Test
    @DisplayName("Mock mode: POST /v1/ai/substitute (200) và POST /v1/ai/ask bị tắt (403) và vượt giới hạn (429) đều có header X-AI-Mock: true")
    void mockProviderAlwaysReturnsXAiMockHeader() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(wac)
                .addFilters(aiMockHeaderFilter, rateLimitFilter)
                .build();

        String subJson = """
                {
                  "recipeId": "trung-chien-ca-chua",
                  "action": "substitute",
                  "ingredientId": "hanh-la",
                  "role": "flavor"
                }
                """;

        // 1. Gọi /v1/ai/substitute thành công -> có header X-AI-Mock: true
        mockMvc.perform(post("/v1/ai/substitute")
                        .header("X-Device-Id", "mock-header-dev-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(subJson))
                .andExpect(status().isOk())
                .andExpect(header().string(AiController.MOCK_AI_HEADER, "true"));

        // 2. Gọi /v1/ai/ask khi tắt (403) -> vẫn có header X-AI-Mock: true
        mockMvc.perform(post("/v1/ai/ask")
                        .header("X-Device-Id", "mock-header-dev-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"question\":\"Lửa to hay nhỏ?\"}"))
                .andExpect(status().isForbidden())
                .andExpect(header().string(AiController.MOCK_AI_HEADER, "true"));

        // 3. Gọi thêm 2 lượt nữa để vượt ngưỡng 3 lượt -> 429 vẫn có header X-AI-Mock: true
        mockMvc.perform(post("/v1/ai/substitute")
                        .header("X-Device-Id", "mock-header-dev-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(subJson))
                .andExpect(status().isOk());

        mockMvc.perform(post("/v1/ai/substitute")
                        .header("X-Device-Id", "mock-header-dev-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(subJson))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string(AiController.MOCK_AI_HEADER, "true"));
    }

    @Test
    @DisplayName("Mock mode bật ask: POST /v1/ai/ask (200) trả về header X-AI-Mock: true")
    void mockProviderAskEnabledReturnsHeader() throws Exception {
        AiService mockAskService = new AiService(
                new MockAiProvider(),
                new SafetyScanService(),
                mock(AiUsageLogRepository.class),
                true
        );
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AiController(mockAskService)).build();

        mockMvc.perform(post("/v1/ai/ask")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"question\":\"Đun mấy phút?\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string(AiController.MOCK_AI_HEADER, "true"));
    }

    @Test
    @DisplayName("Real mode: phản hồi AI thật KHÔNG đính kèm header X-AI-Mock")
    @SuppressWarnings("unchecked")
    void realProviderDoesNotReturnXAiMockHeader() throws Exception {
        HttpClient mockHttpClient = mock(HttpClient.class);
        HttpResponse<String> subHttpResponse = mock(HttpResponse.class);
        when(subHttpResponse.statusCode()).thenReturn(200);
        when(subHttpResponse.body()).thenReturn(
                "{\"severity\":\"low\",\"impact\":\"Thay được\",\"suggestions\":[],\"confirm_required\":false}"
        );
        HttpResponse<String> askHttpResponse = mock(HttpResponse.class);
        when(askHttpResponse.statusCode()).thenReturn(200);
        when(askHttpResponse.body()).thenReturn(
                "{\"answer\":\"Đun lửa vừa khoảng 2 phút.\",\"action\":null}"
        );
        when(mockHttpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(subHttpResponse, askHttpResponse);

        RealAiProvider configuredRealProvider = new RealAiProvider(
                "dummy",
                "https://ai.example.invalid/v1",
                "pending-model",
                5000L,
                mockHttpClient,
                new ObjectMapper()
        );
        AiService realService = new AiService(
                configuredRealProvider,
                new SafetyScanService(),
                mock(AiUsageLogRepository.class),
                true
        );
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AiController(realService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mockMvc.perform(post("/v1/ai/substitute")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"recipeId\":\"mon-1\",\"action\":\"omit\",\"ingredientId\":\"hanh-la\"}"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist(AiController.MOCK_AI_HEADER));

        mockMvc.perform(post("/v1/ai/ask")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"question\":\"Đun mấy phút?\"}"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist(AiController.MOCK_AI_HEADER));
    }
}
