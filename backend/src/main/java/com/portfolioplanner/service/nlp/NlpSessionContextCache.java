package com.portfolioplanner.service.nlp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Short-lived in-memory cache that stores the most recent NLP query result
 * per authenticated user, enabling pronoun resolution in follow-up questions.
 *
 * Example: "show me P0 projects" → stores entity list → next query "which of those
 * are at risk?" can be resolved to "which P0 projects are at risk?"
 *
 * TTL: 30 minutes of inactivity. Cleaned up lazily on each get().
 */
@Component
public class NlpSessionContextCache {

    private static final Logger log = LoggerFactory.getLogger(NlpSessionContextCache.class);

    /** Session expires after 30 minutes of inactivity. */
    private static final long TTL_MS = 30 * 60 * 1_000L;

    /**
     * Snapshot of a resolved NLP query — everything a follow-up resolver needs
     * to substitute pronouns with concrete entities.
     */
    public record SessionContext(
            String toolName,            // e.g. "list_projects"
            Map<String, String> params, // e.g. {priority: "P0"}
            List<String> entityNames,   // display names from the result (first 10)
            int resultCount,            // total number of items returned
            String intent,              // e.g. "DATA_QUERY"
            String listType,            // e.g. "PROJECTS", "RESOURCES"
            Instant timestamp
    ) {}

    private final ConcurrentHashMap<Long, SessionContext> cache = new ConcurrentHashMap<>();

    /**
     * Store a session context for a user.
     * Overwrites any previous context for that user.
     */
    public void put(Long userId, SessionContext ctx) {
        if (userId == null) return;
        cache.put(userId, ctx);
        log.debug("Session context stored for user {}: tool={} entities={} count={}",
                userId, ctx.toolName(), ctx.entityNames().size(), ctx.resultCount());
    }

    /**
     * Retrieve the session context for a user, or empty if expired / not found.
     * Expired entries are removed lazily on retrieval.
     */
    public Optional<SessionContext> get(Long userId) {
        if (userId == null) return Optional.empty();
        SessionContext ctx = cache.get(userId);
        if (ctx == null) return Optional.empty();

        // TTL check
        if (Instant.now().toEpochMilli() - ctx.timestamp().toEpochMilli() > TTL_MS) {
            cache.remove(userId);
            log.debug("Session context expired for user {}", userId);
            return Optional.empty();
        }
        return Optional.of(ctx);
    }

    /** Clear the session context for a user (e.g. on logout). */
    public void clear(Long userId) {
        if (userId != null) cache.remove(userId);
    }

    /** Number of currently cached sessions (for monitoring). */
    public int size() {
        return cache.size();
    }
}
