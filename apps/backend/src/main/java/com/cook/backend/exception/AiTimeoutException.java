package com.cook.backend.exception;

public class AiTimeoutException extends RuntimeException {
    public AiTimeoutException(String message) {
        super(message);
    }
}
