package com.portfolioplanner.controller;

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
 * Admin-only endpoint to trigger a weekly digest on demand.
 * Useful for testing the email template before enabling the schedule.
 *
 * POST /api/digest/send  — requires ADMIN role
 */
@Slf4j
@RestController
@RequestMapping("/api/digest")
@RequiredArgsConstructor
public class DigestController {

    private final WeeklyDigestService weeklyDigestService;

    @PostMapping("/send")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> sendDigest() {
        log.info("DigestController: manual digest triggered by admin");
        weeklyDigestService.sendDigest();
        return ResponseEntity.ok(Map.of("status", "digest sent"));
    }
}
