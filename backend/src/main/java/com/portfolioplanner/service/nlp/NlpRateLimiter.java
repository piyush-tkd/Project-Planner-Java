package com.portfolioplanner.service.nlp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;

/**
 * Rate limiter for the NLP query pipeline.
 *
 * Two limits enforced:
 * 1. Per-user sliding-window rate limit: max 10 queries/minute
 * 2. Ollama concurrency cap: max 3 simultaneous Ollama calls
 *    (prevents CPU saturation when Ollama is running locally)
 *
 * Anonymous users (userId == null) share a single bucket, allowing
 * basic protection without requiring auth.
 */
@Component
public class NlpRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(NlpRateLimiter.class);

    /** Max queries allowed per user per minute. */
    public static final int MAX_REQUESTS_PER_MINUTE = 10;

    /** Max simultaneous Ollama inference calls across all users. */
    public static final int MAX_CONCURRENT_OLLAMA = 3;

    /** Sentinel key for anonymous / unauthenticated users. */
    private static final Long ANON_KEY = -1L;

    /** Window length in milliseconds (1 minute). */
    private static final long WINDOW_MS = 60_000L;

    /**
     * Per-user sliding window of request timestamps (epoch millis).
     * Each deque holds at most MAX_REQUESTS_PER_MINUTE entries.
     */
    private final Map<Long, Deque<Long>> userWindows = new ConcurrentHashMap<>();

    /** Fair semaphore so queued Ollama calls are served in FIFO order. */
    private final Semaphore ollamaSemaphore = new Semaphore(MAX_CONCURRENT_OLLAMA, true);

    // ── Per-user rate limit ───────────────────────────────────────────────────

    /**
     * Check whether the user is within their rate limit.
     * If allowed, records the request timestamp and returns true.
     * If over limit, returns false without recording.
     *
     * @param userId the authenticated user's ID, or null for anonymous
     * @return true if the request is allowed, false if rate-limited
     */
    public boolean tryAcquire(Long userId) {
        Long key = userId != null ? userId : ANON_KEY;
        long now = System.currentTimeMillis();

        Deque<Long> window = userWindows.computeIfAbsent(key, k -> new ArrayDeque<>());

        synchronized (window) {
            // Evict timestamps older than the sliding window
            while (!window.isEmpty() && now - window.peekFirst() > WINDOW_MS) {
                window.pollFirst();
            }

            if (window.size() >= MAX_REQUESTS_PER_MINUTE) {
                long oldestInWindow = window.peekFirst();
                long retryAfterMs = WINDOW_MS - (now - oldestInWindow);
                log.warn("NLP rate limit exceeded for user {} — {} req/min cap reached. Retry after ~{}s",
                        key, MAX_REQUESTS_PER_MINUTE, retryAfterMs / 1000);
                return false;
            }

            window.addLast(now);
            return true;
        }
    }

    /**
     * How many requests remain in the current 1-minute window for this user.
     * Returns MAX_REQUESTS_PER_MINUTE if the user has no recorded requests.
     */
    public int remainingRequests(Long userId) {
        Long key = userId != null ? userId : ANON_KEY;
        long now = System.currentTimeMillis();
        Deque<Long> window = userWindows.get(key);
        if (window == null) return MAX_REQUESTS_PER_MINUTE;
        synchronized (window) {
            long active = window.stream().filter(t -> now - t <= WINDOW_MS).count();
            return (int) Math.max(0, MAX_REQUESTS_PER_MINUTE - active);
        }
    }

    // ── Ollama concurrency cap ────────────────────────────────────────────────

    /**
     * Try to acquire an Ollama slot without blocking.
     * Returns true if acquired, false if all slots are busy.
     * Callers MUST call {@link #releaseOllama()} in a finally block on success.
     */
    public boolean tryAcquireOllama() {
        return ollamaSemaphore.tryAcquire();
    }

    /**
     * Release an Ollama slot. Must be called exactly once per successful
     * {@link #tryAcquireOllama()} call.
     */
    public void releaseOllama() {
        ollamaSemaphore.release();
    }

    /** Number of Ollama slots currently available. */
    public int availableOllamaSlots() {
        return ollamaSemaphore.availablePermits();
    }
}
