package com.cook.backend.service;

import com.cook.backend.ai.AiProvider;
import com.cook.backend.dto.AskRequest;
import com.cook.backend.dto.AskResponse;
import com.cook.backend.dto.SubstituteRequest;
import com.cook.backend.dto.SubstituteResponse;
import com.cook.backend.entity.AiUsageLog;
import com.cook.backend.exception.AiBadResponseException;
import com.cook.backend.exception.AiTimeoutException;
import com.cook.backend.repository.AiUsageLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    private final AiProvider aiProvider;
    private final SafetyScanService safetyScanService;
    private final AiUsageLogRepository aiUsageLogRepository;
    private final boolean askEnabled;

    public AiService(AiProvider aiProvider,
                     SafetyScanService safetyScanService,
                     AiUsageLogRepository aiUsageLogRepository,
                     @Value("${cook.ai.ask-enabled:false}") boolean askEnabled) {
        this.aiProvider = aiProvider;
        this.safetyScanService = safetyScanService;
        this.aiUsageLogRepository = aiUsageLogRepository;
        this.askEnabled = askEnabled;
    }

    public boolean isAskEnabled() {
        return askEnabled;
    }

    /**
     * Làm gì: Kiểm tra backend hiện tại có đang sử dụng bản AI giả (mock) hay không.
     * Vào: Không có.
     * Ra: true nếu đang dùng MockAiProvider, false nếu dùng RealAiProvider.
     * Gọi bởi: AiController khi đính kèm header X-AI-Mock.
     */
    public boolean isMockAi() {
        return aiProvider.isMock();
    }

    /**
     * Xử lý thay thế hoặc bỏ nguyên liệu (U1-U6).
     */
    public SubstituteResponse handleSubstitute(SubstituteRequest request, String deviceHash) {
        SubstituteResponse rawResponse = null;
        int maxAttempts = 2; // Thử lại đúng 1 lần nếu sai schema (U4, U6)
        int attemptsMade = 0;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            attemptsMade = attempt;
            try {
                rawResponse = aiProvider.substitute(request);
                logAiUsage(deviceHash, "/v1/ai/substitute", 100, 50, 150, 0.001, "SUCCESS");
                break; // Thành công
            } catch (AiTimeoutException e) {
                logAiUsage(deviceHash, "/v1/ai/substitute", 100, 0, 100, 0.0, "TIMEOUT");
                throw e; // Timeout không thử lại vô hạn
            } catch (AiBadResponseException e) {
                logAiUsage(deviceHash, "/v1/ai/substitute", 100, 0, 100, 0.0, "BAD_RESPONSE_ATTEMPT_" + attempt);
                if (attempt == maxAttempts) {
                    throw e; // Thử lại 2 lần đều lỗi -> quăng lỗi AI_BAD_RESPONSE
                }
                log.warn("Lần gọi AI thứ {} sai schema, thử lại lần 2...", attempt);
            }
        }

        if (rawResponse == null) {
            throw new AiBadResponseException("AI response could not be parsed after " + attemptsMade + " attempts");
        }

        // Quy tắc U1: Nếu nguyên liệu có role = preservation -> luôn severity = high, confirm_required = true
        String finalSeverity = rawResponse.severity();
        Boolean finalConfirm = rawResponse.confirmRequired();
        if ("preservation".equalsIgnoreCase(request.role())) {
            finalSeverity = "high";
            finalConfirm = true;
        }

        // Lọc danh sách gợi ý thay thế
        List<String> rawSuggestions = rawResponse.suggestions() != null ? rawResponse.suggestions() : Collections.emptyList();
        List<String> filteredSuggestions = new ArrayList<>();

        for (String suggestion : rawSuggestions) {
            // Quy tắc U3: Gợi ý không có trong bảng nguyên liệu chuẩn -> loại
            if (request.knownIngredients() != null && !request.knownIngredients().isEmpty()) {
                if (!request.knownIngredients().contains(suggestion)) {
                    continue; // Bỏ qua vì là nguyên liệu lạ
                }
            }

            // Quy tắc U2: Gợi ý dính mã dị ứng người dùng -> loại
            if (request.allergies() != null && !request.allergies().isEmpty()
                    && request.ingredientAllergens() != null) {
                List<String> allergensOfIngredient = request.ingredientAllergens().getOrDefault(suggestion, Collections.emptyList());
                boolean hasAllergyConflict = allergensOfIngredient.stream().anyMatch(request.allergies()::contains);
                if (hasAllergyConflict) {
                    continue; // Bỏ qua vì gây dị ứng
                }
            }

            filteredSuggestions.add(suggestion);
        }

        return new SubstituteResponse(finalSeverity, rawResponse.impact(), filteredSuggestions, finalConfirm);
    }

    /**
     * Xử lý câu hỏi nấu ăn (S1-S8).
     */
    public AskResponse handleAsk(AskRequest request, String deviceHash) {
        if (!askEnabled) {
            throw new IllegalStateException("FEATURE_DISABLED: Chức năng hỏi đáp AI đang tắt theo cờ cấu hình.");
        }

        AskResponse rawResponse = aiProvider.ask(request);
        logAiUsage(deviceHash, "/v1/ai/ask", 80, 40, 120, 0.0008, "SUCCESS");

        // Quét an toàn nội dung trả về (S1-S8)
        String sanitizedAnswer = safetyScanService.filterSafety(rawResponse.answer());

        return new AskResponse(sanitizedAnswer, rawResponse.action());
    }

    private void logAiUsage(String deviceHash, String endpoint, int promptTokens, int completionTokens,
                            int totalTokens, double cost, String status) {
        try {
            String hash = (deviceHash != null && !deviceHash.isBlank()) ? deviceHash : "anonymous";
            AiUsageLog usageLog = new AiUsageLog(hash, endpoint, promptTokens, completionTokens, totalTokens, cost, status);
            aiUsageLogRepository.save(usageLog);
        } catch (Exception e) {
            log.error("Không thể ghi log ai_usage_log: {}", e.getMessage());
        }
    }
}
