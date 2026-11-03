package com.cook.backend.controller;

import com.cook.backend.dto.AskRequest;
import com.cook.backend.dto.AskResponse;
import com.cook.backend.dto.ErrorResponse;
import com.cook.backend.dto.SubstituteRequest;
import com.cook.backend.dto.SubstituteResponse;
import com.cook.backend.service.AiService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/ai")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/substitute")
    public ResponseEntity<SubstituteResponse> substitute(
            @RequestBody SubstituteRequest request,
            HttpServletRequest servletRequest) {
        String deviceHash = (String) servletRequest.getAttribute("deviceHash");
        SubstituteResponse response = aiService.handleSubstitute(request, deviceHash);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/ask")
    public ResponseEntity<?> ask(
            @RequestBody AskRequest request,
            HttpServletRequest servletRequest) {
        if (!aiService.isAskEnabled()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ErrorResponse("FEATURE_DISABLED", "Chức năng hỏi đáp AI đang tắt theo cờ cấu hình."));
        }

        String deviceHash = (String) servletRequest.getAttribute("deviceHash");
        AskResponse response = aiService.handleAsk(request, deviceHash);
        return ResponseEntity.ok(response);
    }
}
