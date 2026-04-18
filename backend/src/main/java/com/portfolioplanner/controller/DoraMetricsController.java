package com.portfolioplanner.controller;

import com.portfolioplanner.service.DoraMetricsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * DORA Metrics Controller.
 *
 * <p>Two data sources, picked automatically:
 * <ul>
 *   <li><b>source=jira</b> — Real-time from Jira REST API (requires configured
 *       Jira credentials + at least one enabled POD).</li>
 *   <li><b>source=release_calendar</b> — Fallback from the internal release_calendar
 *       and sprint tables.</li>
 * </ul>
 *
 * <p>Clients can also force a source via the {@code source} query parameter.
 */
@RestController
@RequestMapping("/api/reports/dora")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class DoraMetricsController {

    private final DoraMetricsService service;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getDoraMetrics(
            @RequestParam(required = false) Integer months,
            @RequestParam(required = false) String source) {
        return ResponseEntity.ok(service.getDoraMetrics(months, source));
    }

    /* ═══════════════════════════════════════════════════════════════════
       Monthly granularity — one DORA scorecard per month (for MBR)
       ═══════════════════════════════════════════════════════════════════ */

    @GetMapping("/monthly")
    public ResponseEntity<Map<String, Object>> getMonthlyDora(
            @RequestParam(required = false) Integer months,
            @RequestParam(required = false) String source) {
        return ResponseEntity.ok(service.getMonthlyDora(months, source));
    }

}
