package com.portfolioplanner.exception;

/**
 * Thrown when an outbound email cannot be delivered.
 *
 * <p>The global exception handler maps this to an HTTP 202 Accepted response
 * so that transient mail failures do not fail the user-facing action that
 * triggered the email (e.g. password-reset, digest delivery).
 */
public class EmailSendException extends RuntimeException {

    public EmailSendException(String message, Throwable cause) {
        super(message, cause);
    }
}
