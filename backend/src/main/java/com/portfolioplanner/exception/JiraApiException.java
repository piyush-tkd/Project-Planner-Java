package com.portfolioplanner.exception;

/**
 * Thrown when the Jira API is unreachable or returns a terminal error after all
 * retry attempts are exhausted.  Carries an optional {@link #retryAfterSeconds}
 * hint surfaced from the {@code Retry-After} response header so the caller and
 * the global exception handler can propagate it to the UI.
 */
public class JiraApiException extends RuntimeException {

    private final Integer retryAfterSeconds;

    public JiraApiException(String message, Throwable cause) {
        super(message, cause);
        this.retryAfterSeconds = null;
    }

    public JiraApiException(String message, Throwable cause, int retryAfterSeconds) {
        super(message, cause);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    /** May be {@code null} when no {@code Retry-After} header was present. */
    public Integer getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
