package com.cook.backend.ai;

import com.cook.backend.dto.AskRequest;
import com.cook.backend.dto.AskResponse;
import com.cook.backend.dto.SubstituteRequest;
import com.cook.backend.dto.SubstituteResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnProperty(name = "cook.ai.provider", havingValue = "real")
public class RealAiProvider implements AiProvider {

    private static final Logger log = LoggerFactory.getLogger(RealAiProvider.class);

    private final String apiKey;

    public RealAiProvider(@Value("${cook.ai.api-key:}") String apiKey) {
        this.apiKey = apiKey;
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RealAiProvider được bật nhưng chưa cấu hình cook.ai.api-key");
        }
    }

    @Override
    public SubstituteResponse substitute(SubstituteRequest request) {
        log.info("Gọi RealAiProvider cho substitute món={}", request.recipeId());
        // Khi gọi AI thật (production), thực hiện HTTP request tới API bên ngoài
        return new SubstituteResponse("low", "Đề xuất từ mô hình AI thật", List.of(), false);
    }

    @Override
    public AskResponse ask(AskRequest request) {
        log.info("Gọi RealAiProvider cho ask");
        return new AskResponse("Câu trả lời từ mô hình AI thật.", null);
    }
}
