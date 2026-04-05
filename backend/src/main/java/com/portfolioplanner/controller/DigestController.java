package com.portfolioplanner.controller;

import com.portfolioplanner.service.SupportStalenessService;
import com.portfolioplanner.service.WeeklyDigestService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Admin-only endpoints to trigger notification emails on demand.
 *
 * POST /api/digest/send            — weekly portfolio digest (requires ADMIN)
 * POST /api/digest/send-staleness  — stale support-ticket alert (requires ADMIN)
 */
@Slf4j
@RestController
@RequestMapping("/api/digest")
@RequiredArgsConstructor
public class DigestController {

    private final WeeklyDigestService      weeklyDigestService;
    private final SupportStalenessService  supportStalenessService;

    @PostMapping("/send")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> sendDigest() {
        log.info("DigestController: manual digest triggered by admin");
        weeklyDigestService.sendDigest();
        return ResponseEntity.ok(Map.of("status", "digest sent"));
    }

    /**
     * Immediately checks all enabled support boards for stale tickets
     * and sends the staleness-alert email.  No-ops if SMTP is disabled,
     * no boards are configured, or no stale tickets exist.
     */
    @PostMapping("/send-staleness")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> sendStalenessAlert() {
        log.info("DigestController: manual staleness alert triggered by admin");
        supportStalenessService.sendStalenessAlert();
        return ResponseEntity.ok(Map.of("status", "staleness alert sent"));
    }
}
