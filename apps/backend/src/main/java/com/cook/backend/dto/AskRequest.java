package com.cook.backend.dto;

import java.util.List;

public record AskRequest(
        String question,
        String currentStep,
        List<String> remainingSteps,
        String scenarioId
) {
}
