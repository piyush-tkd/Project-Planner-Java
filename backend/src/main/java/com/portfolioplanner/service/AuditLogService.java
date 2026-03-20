package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.AuditLog;
import com.portfolioplanner.domain.repository.AppUserRepository;
import com.portfolioplanner.domain.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Lightweight audit trail service.
 *
 * Usage from other services:
 * <pre>
 *   auditLogService.log("Resource", resource.getId(), resource.getName(),
 *                       "CREATE", null);
 * </pre>
 *
 * The current authenticated username is resolved automatically via the
 * Spring Security context. Pass an explicit actor for system/scheduled tasks.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository repository;
    private final AppUserRepository   userRepository;

    // ── Write ────────────────────────────────────────────────────────────────────

    /**
     * Records an audit event, resolving the current username from the
     * Spring Security context.
     *
     * NOTE: Username MUST be captured here (in the calling request thread)
     * BEFORE the @Async handoff — SecurityContextHolder is thread-local
     * and would not be visible inside the async worker thread.
     */
    public void log(String entityType, Long entityId, String entityName,
                    String action, String details) {
        // Capture username synchronously while still on the request thread
        String actor = currentUsername();
        // Then persist asynchronously (no longer needs SecurityContext)
        logAs(entityType, entityId, entityName, action, actor, details);
    }

    /**
     * Records an audit event with an explicit actor (for scheduled jobs,
     * bulk imports, etc.).
     */
    @Async
    public void logAs(String entityType, Long entityId, String entityName,
                      String action, String actor, String details) {
        persist(entityType, entityId, entityName, action, actor, details);
    }

    // ── Read ─────────────────────────────────────────────────────────────────────

    /** All changes to a specific entity instance. */
    public List<AuditLog> getEntityHistory(String entityType, Long entityId) {
        return repository.findByEntityTypeAndEntityIdOrderByChangedAtDesc(entityType, entityId);
    }

    /** Recent N entries across all entities (for the admin audit trail page). */
    public List<AuditLog> getRecent(int limit) {
        Page<AuditLog> page = repository.findAllByOrderByChangedAtDesc(
                PageRequest.of(0, limit));
        return page.getContent();
    }

    /** All entries in the past N days (useful for the weekly digest). */
    public List<AuditLog> getLastNDays(int days) {
        Instant from = Instant.now().minus(days, ChronoUnit.DAYS);
        return repository.findByChangedAtBetweenOrderByChangedAtDesc(from, Instant.now());
    }

    // ── Private helpers ──────────────────────────────────────────────────────────

    private void persist(String entityType, Long entityId, String entityName,
                         String action, String changedBy, String details) {
        try {
            AuditLog entry = AuditLog.builder()
                    .entityType(entityType)
                    .entityId(entityId)
                    .entityName(entityName)
                    .action(action)
                    .changedBy(changedBy)
                    .changedAt(Instant.now())
                    .details(details)
                    .build();
            repository.save(entry);
        } catch (Exception e) {
            // Audit must never break the main flow
            log.error("AuditLogService: failed to persist audit entry – {}", e.getMessage());
        }
    }

    /**
     * Resolves the current user for audit trail purposes.
     * Returns the user's display name when set, otherwise the username.
     * Falls back to "system" only when there is no authenticated principal.
     */
    private String currentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return "system";
        String username = auth.getName();
        if (username == null || username.isBlank()) return "system";
        // Try to resolve the human-friendly display name
        try {
            return userRepository.findByUsername(username)
                    .map(u -> u.getDisplayName() != null && !u.getDisplayName().isBlank()
                            ? u.getDisplayName() : u.getUsername())
                    .orElse(username);
        } catch (Exception e) {
            return username;
        }
    }
}
