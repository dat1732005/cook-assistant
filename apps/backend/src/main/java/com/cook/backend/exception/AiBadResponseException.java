package com.cook.backend.exception;

public class AiBadResponseException extends RuntimeException {
    public AiBadResponseException(String message) {
        super(message);
    }
}
