package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AppErrorLog;
import com.portfolioplanner.domain.repository.AppErrorLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/error-logs")
@PreAuthorize("hasRole('ADMIN')")   // S2.3 — error logs are admin-only
@RequiredArgsConstructor
public class AppErrorLogController {

    private final AppErrorLogRepository errorLogRepo;

    /** Submit a new error log entry (called from frontend error boundary or backend interceptor). */
    @PostMapping
    public ResponseEntity<AppErrorLog> log(@RequestBody Map<String, Object> body,
                                            Authentication auth) {
        AppErrorLog log = new AppErrorLog();
        log.setSource(body.getOrDefault("source", "FRONTEND").toString());
        log.setSeverity(body.getOrDefault("severity", "ERROR").toString());
        log.setErrorType(body.get("errorType") != null ? body.get("errorType").toString() : null);
        log.setMessage(body.get("message") != null ? body.get("message").toString() : "Unknown error");
        log.setStackTrace(body.get("stackTrace") != null ? body.get("stackTrace").toString() : null);
        log.setPageUrl(body.get("pageUrl") != null ? body.get("pageUrl").toString() : null);
        log.setApiEndpoint(body.get("apiEndpoint") != null ? body.get("apiEndpoint").toString() : null);
        log.setHttpStatus(body.get("httpStatus") != null ? ((Number) body.get("httpStatus")).intValue() : null);
        log.setUserAgent(body.get("userAgent") != null ? body.get("userAgent").toString() : null);
        log.setComponent(body.get("component") != null ? body.get("component").toString() : null);
        log.setUsername(auth != null ? auth.getName() : (body.get("username") != null ? body.get("username").toString() : null));
        return ResponseEntity.status(HttpStatus.CREATED).body(errorLogRepo.save(log));
    }

    /** Fetch all error logs (most recent first). */
    @GetMapping
    public ResponseEntity<List<AppErrorLog>> getAll() {
        return ResponseEntity.ok(errorLogRepo.findAllByOrderByCreatedAtDesc());
    }

    /** Fetch summary counts. */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> summary() {
        return ResponseEntity.ok(Map.of(
            "total", errorLogRepo.count(),
            "unresolved", errorLogRepo.countByResolvedFalse(),
            "frontend", errorLogRepo.countBySource("FRONTEND"),
            "backend", errorLogRepo.countBySource("BACKEND"),
            "errors", errorLogRepo.countBySeverity("ERROR"),
            "warnings", errorLogRepo.countBySeverity("WARN")
        ));
    }

    /** Mark error as resolved. */
    @PutMapping("/{id}/resolve")
    public ResponseEntity<AppErrorLog> resolve(@PathVariable Long id) {
        AppErrorLog log = errorLogRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Error log not found: " + id));
        log.setResolved(true);
        return ResponseEntity.ok(errorLogRepo.save(log));
    }

    /** Delete an error log entry. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        errorLogRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /** Bulk clear resolved errors. */
    @DeleteMapping("/clear-resolved")
    public ResponseEntity<Map<String, Long>> clearResolved() {
        List<AppErrorLog> resolved = errorLogRepo.findAllByOrderByCreatedAtDesc().stream()
                .filter(l -> Boolean.TRUE.equals(l.getResolved()))
                .toList();
        long count = resolved.size();
        errorLogRepo.deleteAll(resolved);
        return ResponseEntity.ok(Map.of("deleted", count));
    }
}
