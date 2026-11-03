package com.cook.backend.ai;

import com.cook.backend.dto.AskRequest;
import com.cook.backend.dto.AskResponse;
import com.cook.backend.dto.SubstituteRequest;
import com.cook.backend.dto.SubstituteResponse;
import com.cook.backend.exception.AiBadResponseException;
import com.cook.backend.exception.AiTimeoutException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@ConditionalOnProperty(name = "cook.ai.provider", havingValue = "mock", matchIfMissing = true)
public class MockAiProvider implements AiProvider {

    private final AtomicInteger callCount = new AtomicInteger(0);
    private boolean simulateTimeout = false;
    private final List<String> simulateResponses = new ArrayList<>();

    public void reset() {
        callCount.set(0);
        simulateTimeout = false;
        simulateResponses.clear();
    }

    public int getCallCount() {
        return callCount.get();
    }

    public void setSimulateTimeout(boolean simulateTimeout) {
        this.simulateTimeout = simulateTimeout;
    }

    public void setSimulateResponses(List<String> responses) {
        this.simulateResponses.clear();
        if (responses != null) {
            this.simulateResponses.addAll(responses);
        }
    }

    @Override
    public SubstituteResponse substitute(SubstituteRequest request) {
        int attempt = callCount.incrementAndGet();

        if (simulateTimeout || "U5".equals(request.scenarioId())) {
            throw new AiTimeoutException("AI request timed out after 5000ms");
        }

        // Kiểm tra kịch bản giả lập schema theo lượt gọi
        if (!simulateResponses.isEmpty()) {
            int index = Math.min(attempt - 1, simulateResponses.size() - 1);
            String responseType = simulateResponses.get(index);
            if ("invalid".equalsIgnoreCase(responseType)) {
                throw new AiBadResponseException("AI returned invalid JSON response format");
            }
        } else if ("U4".equals(request.scenarioId())) {
            throw new AiBadResponseException("AI returned invalid JSON response format");
        } else if ("U6".equals(request.scenarioId()) && attempt == 1) {
            throw new AiBadResponseException("AI returned invalid JSON response format on attempt 1");
        }

        // U1: Preservation role
        if ("preservation".equalsIgnoreCase(request.role()) || "U1".equals(request.scenarioId())) {
            return new SubstituteResponse("low", "Bỏ nguyên liệu bảo quản", List.of(), false);
        }

        // U2: Gợi ý dau-phong
        if ("U2".equals(request.scenarioId())) {
            return new SubstituteResponse("low", "Có thể thay thế", List.of("dau-phong"), false);
        }

        // U3: Gợi ý ngo-ri
        if ("U3".equals(request.scenarioId())) {
            return new SubstituteResponse("low", "Có thể thay thế", List.of("ngo-ri"), false);
        }

        return new SubstituteResponse("low", "Thay thế an toàn", List.of("hanh-la"), false);
    }

    @Override
    public AskResponse ask(AskRequest request) {
        callCount.incrementAndGet();
        if (request.question() != null && !request.question().isBlank()) {
            return new AskResponse(request.question(), null);
        }
        return new AskResponse("Bạn có thể đặt thêm 2 phút rồi kiểm tra.", null);
    }
}
