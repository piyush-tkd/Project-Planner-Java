package com.portfolioplanner.exception;

import com.portfolioplanner.filter.CorrelationIdFilter;
import com.portfolioplanner.service.EmailService;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.validation.ConstraintViolationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    private final MeterRegistry meterRegistry;

    // ── Existing handlers (status codes unchanged) ────────────────────────────

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse.of(HttpStatus.NOT_FOUND.value(), ex.getMessage()));
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ErrorResponse> handleValidation(ValidationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of(HttpStatus.BAD_REQUEST.value(), ex.getMessage()));
    }

    @ExceptionHandler(DuplicateNameException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateName(DuplicateNameException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of(HttpStatus.CONFLICT.value(), ex.getMessage()));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex) {
        String message = ex.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of(HttpStatus.BAD_REQUEST.value(), message));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of(HttpStatus.BAD_REQUEST.value(), message));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of(HttpStatus.BAD_REQUEST.value(), ex.getMessage()));
    }

    // ── New specific handlers ─────────────────────────────────────────────────

    /**
     * Jira API is unreachable or returned a terminal error after retries.
     * Returns 502 Bad Gateway so the UI can show a targeted "Jira unavailable" banner.
     */
    @ExceptionHandler(JiraApiException.class)
    public ResponseEntity<ErrorResponse> handleJiraApi(JiraApiException ex) {
        log.error("Jira API failure: {}", ex.getMessage(), ex);
        increment("jira_unavailable");

        Integer retryAfterSec = ex.getRetryAfterSeconds();
        int effectiveRetry = (retryAfterSec != null && retryAfterSec > 0) ? retryAfterSec : 30;

        ErrorResponse body = new ErrorResponse(
                HttpStatus.BAD_GATEWAY.value(),
                "Jira is temporarily unavailable. Please try again shortly.",
                LocalDateTime.now(),
                "jira_unavailable",
                correlationId(),
                effectiveRetry
        );
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(body);
    }

    /**
     * LLM backend is unreachable.
     * Returns 503 Service Unavailable.
     */
    @ExceptionHandler(LlmUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleLlmUnavailable(LlmUnavailableException ex) {
        log.error("LLM unavailable: {}", ex.getMessage(), ex);
        increment("llm_unavailable");

        ErrorResponse body = new ErrorResponse(
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                "The AI service is temporarily unavailable.",
                LocalDateTime.now(),
                "llm_unavailable",
                correlationId(),
                null
        );
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }

    /**
     * Email delivery failed.
     * Returns 202 Accepted — the user action succeeded; only the notification
     * failed, which is not worth surfacing as an error to the end-user.
     */
    @ExceptionHandler({EmailSendException.class, EmailService.EmailDeliveryException.class})
    public ResponseEntity<ErrorResponse> handleEmailSend(RuntimeException ex) {
        log.error("Email delivery failure: {}", ex.getMessage(), ex);
        increment("email_send_failure");

        ErrorResponse body = new ErrorResponse(
                HttpStatus.ACCEPTED.value(),
                "Your request was processed successfully. Email notification could not be delivered.",
                LocalDateTime.now(),
                "email_send_failure",
                correlationId(),
                null
        );
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(body);
    }

    // ── Catch-all (last resort) ───────────────────────────────────────────────

    /**
     * Catch-all for unhandled exceptions.
     * Returns 500 with a correlation ID so support can trace the server-side log.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        String cid = correlationId();
        log.error("Unhandled exception [correlationId={}]: {}", cid, ex.getMessage(), ex);
        increment("unhandled_error");

        ErrorResponse body = new ErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "An unexpected error occurred. Reference ID: " + cid,
                LocalDateTime.now(),
                "internal_error",
                cid,
                null
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String correlationId() {
        String cid = MDC.get(CorrelationIdFilter.MDC_KEY);
        return (cid != null && !cid.isBlank()) ? cid : "unknown";
    }

    private void increment(String errorType) {
        meterRegistry.counter("app.errors", "type", errorType).increment();
    }
}
