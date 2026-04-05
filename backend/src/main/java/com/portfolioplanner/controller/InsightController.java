package com.portfolioplanner.controller;

import com.portfolioplanner.dto.InsightDto;
import com.portfolioplanner.service.InsightService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API for the AI Proactive Insights Engine.
 *
 * GET  /api/insights           — list unacknowledged insights
 * GET  /api/insights/all       — list all insights including acknowledged (history)
 * GET  /api/insights/summary   — {high, medium, low, total} counts
 * POST /api/insights/run       — trigger a full detection run (ADMIN only)
 * PUT  /api/insights/{id}/ack  — acknowledge a single insight
 */
@Slf4j
@RestController
@RequestMapping("/api/insights")
@RequiredArgsConstructor
public class InsightController {

    private final InsightService insightService;

    /** Returns all active (unacknowledged) insights — HIGH first. */
    @GetMapping
    public ResponseEntity<List<InsightDto>> listActive() {
        return ResponseEntity.ok(insightService.listUnacknowledged());
    }

    /** Returns all insights including acknowledged ones (history view). */
    @GetMapping("/all")
    public ResponseEntity<List<InsightDto>> listAll() {
        return ResponseEntity.ok(insightService.listAll());
    }

    /** Returns {high, medium, low, total} counts of unacknowledged insights. */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Long>> summary() {
        return ResponseEntity.ok(insightService.summaryCounts());
    }

    /**
     * Triggers a full detection run and returns the refreshed active list.
     * ADMIN-only — expensive operation, should not be called by end-users.
     */
    @PostMapping("/run")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<List<InsightDto>> run() {
        log.info("InsightController: manual detection run triggered by admin");
        return ResponseEntity.ok(insightService.runDetectors());
    }

    /** Acknowledges an insight so it no longer appears in the active feed. */
    @PutMapping("/{id}/ack")
    public ResponseEntity<InsightDto> acknowledge(@PathVariable Long id) {
        return ResponseEntity.ok(insightService.acknowledge(id));
    }
}
