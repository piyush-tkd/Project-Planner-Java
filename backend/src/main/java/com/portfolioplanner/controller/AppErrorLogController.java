package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AppErrorLog;
import com.portfolioplanner.service.AppErrorLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/error-logs")
@RequiredArgsConstructor
public class AppErrorLogController {

    private final AppErrorLogService service;

    /**
     * Submit a new error log entry (called from frontend error boundary or backend interceptor).
     * Intentionally unauthenticated — errors may occur before the user has a valid JWT.
     * Permitted without a token via SecurityConfig.
     */
    @PostMapping
    public ResponseEntity<AppErrorLog> log(@RequestBody Map<String, Object> body,
                                            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.logError(body, auth));
    }

    /** Fetch all error logs (most recent first). */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<AppErrorLog>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    /** Fetch summary counts. */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> summary() {
        return ResponseEntity.ok(service.getSummary());
    }

    /** Mark error as resolved. */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/resolve")
    public ResponseEntity<AppErrorLog> resolve(@PathVariable Long id) {
        return ResponseEntity.ok(service.resolve(id));
    }

    /** Delete an error log entry. */
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Bulk clear resolved errors. */
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/clear-resolved")
    public ResponseEntity<Map<String, Long>> clearResolved() {
        long count = service.clearResolved();
        return ResponseEntity.ok(Map.of("deleted", count));
    }
}
