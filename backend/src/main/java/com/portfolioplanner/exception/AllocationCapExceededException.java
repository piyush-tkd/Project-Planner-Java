package com.portfolioplanner.exception;

/**
 * Thrown by {@code ResourceAllocationService} when a create or update would push a
 * resource's total active allocation above 100%.
 *
 * <p>The controller catches this and returns an HTTP 400 with the structured body
 * {@code { error, current, requested, available }} without embedding that logic in
 * the service itself.
 */
public class AllocationCapExceededException extends RuntimeException {

    private final int current;
    private final int requested;

    public AllocationCapExceededException(int current, int requested) {
        super("Total allocation would exceed 100%");
        this.current   = current;
        this.requested = requested;
    }

    /** Sum of all currently-active allocations for the resource (excluding the one being edited). */
    public int getCurrent() { return current; }

    /** Percentage value of the allocation being created or updated. */
    public int getRequested() { return requested; }

    /** How much allocation capacity remains (100 - current). */
    public int getAvailable() { return 100 - current; }
}
