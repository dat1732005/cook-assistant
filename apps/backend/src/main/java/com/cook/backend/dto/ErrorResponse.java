package com.cook.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
    String code,
    String message,
    @JsonProperty("retry_after")
    Long retryAfter
) {
    public ErrorResponse(String code, String message) {
        this(code, message, null);
    }
}
