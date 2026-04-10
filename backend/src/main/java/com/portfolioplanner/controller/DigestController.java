package com.portfolioplanner.controller;

import com.portfolioplanner.service.WeeklyDigestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * API endpoints for weekly digest email management.
 * Admin-only access to manually trigger digest sends.
 */
@RestController
@RequestMapping("/api/digest")
@RequiredArgsConstructor
public class DigestController {

    private final WeeklyDigestService weeklyDigestService;

    /**
     * Manually trigger the weekly digest send (admin only).
     * Sends portfolio insights digest to all active users.
     *
     * @return Response with status message
     */
    @PostMapping("/send")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> triggerDigest() {
        weeklyDigestService.sendWeeklyDigest();
        return ResponseEntity.ok(Map.of("status", "sent"));
    }
}
