package com.portfolioplanner.exception;

/**
 * Thrown when the LLM backend (Ollama via portfolio-planner-ai, or a cloud
 * provider) is unreachable and the request cannot be fulfilled without it.
 *
 * <p>Strategies that can silently degrade (e.g. falling back to a lower-tier
 * strategy) should swallow errors internally.  This exception is reserved for
 * call sites where LLM availability is a hard requirement and an explicit 503
 * response is the correct outcome.
 */
public class LlmUnavailableException extends RuntimeException {

    public LlmUnavailableException(String message) {
        super(message);
    }

    public LlmUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
