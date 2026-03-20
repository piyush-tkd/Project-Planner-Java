package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AuditLog;
import com.portfolioplanner.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API for the audit trail.
 *
 * All endpoints require at minimum READ_WRITE role; the entity-history
 * endpoint is open to any authenticated user so team leads can review
 * changes to their own resources/projects.
 */
@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogService auditLogService;

    /**
     * GET /api/audit/recent?limit=50
     * Returns the most recent audit events (admin only).
     */
    @GetMapping("/recent")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AuditLog>> getRecent(
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(auditLogService.getRecent(Math.min(limit, 500)));
    }

    /**
     * GET /api/audit/entity/{type}/{id}
     * Returns the full change history for a specific entity instance.
     */
    @GetMapping("/entity/{entityType}/{entityId}")
    public ResponseEntity<List<AuditLog>> getEntityHistory(
            @PathVariable String entityType,
            @PathVariable Long entityId) {
        return ResponseEntity.ok(auditLogService.getEntityHistory(entityType, entityId));
    }

    /**
     * GET /api/audit/last-days?days=7
     * Returns audit entries from the last N days (admin only).
     */
    @GetMapping("/last-days")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AuditLog>> getLastDays(
            @RequestParam(defaultValue = "7") int days) {
        return ResponseEntity.ok(auditLogService.getLastNDays(Math.min(days, 90)));
    }
}
