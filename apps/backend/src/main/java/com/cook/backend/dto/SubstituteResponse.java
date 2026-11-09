package com.cook.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record SubstituteResponse(
        String severity,
        String impact,
        List<String> suggestions,
        @JsonProperty("confirm_required")
        Boolean confirmRequired
) {
    public SubstituteResponse withSeverityAndConfirm(String newSeverity, Boolean newConfirm) {
        return new SubstituteResponse(newSeverity, this.impact, this.suggestions, newConfirm);
    }

    public SubstituteResponse withSuggestions(List<String> newSuggestions) {
        return new SubstituteResponse(this.severity, this.impact, newSuggestions, this.confirmRequired);
    }
}
