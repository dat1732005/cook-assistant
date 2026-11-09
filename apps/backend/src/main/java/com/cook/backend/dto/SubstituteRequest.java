package com.cook.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public record SubstituteRequest(
        String recipeId,
        String action,
        String ingredientId,
        String role,
        String flavorGroup,
        List<String> allergies,
        List<String> knownIngredients,
        Map<String, List<String>> ingredientAllergens,
        String scenarioId
) {
}
