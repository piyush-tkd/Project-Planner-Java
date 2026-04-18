package com.portfolioplanner.exception;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;

/**
 * Unified error body returned by {@link GlobalExceptionHandler}.
 *
 * <p>Optional fields ({@code type}, {@code correlationId},
 * {@code retryAfterSeconds}) are omitted from the JSON payload when null so
 * that existing clients are not broken by the new fields.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
        int status,
        String message,
        LocalDateTime timestamp,
        /** Machine-readable error category, e.g. {@code "jira_unavailable"}. */
        String type,
        /** Echoes the {@code X-Correlation-Id} header for support tracing. */
        String correlationId,
        /** Hint from the upstream {@code Retry-After} header, in seconds. */
        Integer retryAfterSeconds
) {
    /** Convenience factory for simple errors (no type / correlation / retry). */
    public static ErrorResponse of(int status, String message) {
        return new ErrorResponse(status, message, LocalDateTime.now(), null, null, null);
    }

    /** Convenience factory that carries a correlation ID (used for 500s). */
    public static ErrorResponse of(int status, String message, String correlationId) {
        return new ErrorResponse(status, message, LocalDateTime.now(), null, correlationId, null);
    }
}
