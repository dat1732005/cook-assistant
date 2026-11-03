package com.cook.backend.exception;

public class RateLimitException extends RuntimeException {
    private final long retryAfter;

    public RateLimitException(long retryAfter) {
        super("Rate limit exceeded. Please retry after " + retryAfter + " seconds.");
        this.retryAfter = retryAfter;
    }

    public long getRetryAfter() {
        return retryAfter;
    }
}
