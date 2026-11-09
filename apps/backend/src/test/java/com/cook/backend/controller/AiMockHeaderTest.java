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

                  
                    private WebApplication

                  
                    private AiMockHeaderFilter aiMockH

                  
                    private RateLimitFilter rate

             
                    @DisplayName("Mock mode: POST /v1/ai/substitute (200) và POST /v1/ai/ask bị tắt (403) và vượt giới hạn (429) đều có header X-AI-
                    void mockProviderAlwaysReturnsXAiMockHeader() throws
                                        MockMvc mockMvc = MockMvcBuilders
                                                                                
                                         

                                    
                                 
                                                                    
                                                         
                                                            
                                                  
                                 
                                    

                                        // 1. Gọi /v1/ai/substitute thành công -> c
                                        mockMvc.perform(p
                                                        .header("X-Device-I
                                                        .contentType(Med
                                                  
                                                           
                                                                                .andExpect(header

                                        // 2. Gọi /v1/ai/ask khi tắt (403) -> vẫn c
                                        mockMvc.pe
                                                        .header("X-Device-I
                                                        .contentType(Med
                                                        .content("{\"question\"
                                                                  
                                                                                .andExpect(header

                                        // 3. Gọi thêm 2 lượt nữa để vượt ngưỡng 3 lượt -> 429 
                // ẫn c
                        // ader
                                // I-Mo
                                        // true
                                                pe
                                                            

                
                                
                                        
                                                pe
                                                                .h
                                                                        .contentTy
         

        
            
                
                        @Test
                                    @DisplayName("Moc
                                                void moc
                                                                A
                                      
                                        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AiController(m

                                        mockMvc.pe
                                                        .contentType(Med
                                                        .content("{\"question
                                                           
                                                                                .andExpect(header
         

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

                                                        .
                                                                .andExpe
                                                        
                                                
                                

                                                  
                                                                .andExpe
                                                        
                                                
                                
        