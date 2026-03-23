package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraAnalyticsService;
import com.portfolioplanner.service.jira.JiraCredentialsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Jira Analytics dashboard — aggregated data across all enabled PODs,
 * ready for charting and slicing by type/status/priority/assignee/pod/time.
 */
@RestController
@RequestMapping("/api/jira/analytics")
@RequiredArgsConstructor
@Slf4j
public class JiraAnalyticsController {

    private final JiraAnalyticsService analyticsService;
    private final JiraCredentialsService creds;

    /**
     * GET /api/jira/analytics
     *
     * Returns a comprehensive analytics payload for the dashboard.
     *
     * @param months  Lookback period (default 3)
     * @param pods    Optional comma-separated POD IDs to filter
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getAnalytics(
            @RequestParam(defaultValue = "3") int months,
            @RequestParam(required = false) String pods) {

        if (!creds.isConfigured()) {
            return ResponseEntity.ok(Map.of("error", "Jira not configured"));
        }

        List<Long> podIds = null;
        if (pods != null && !pods.isBlank()) {
            try {
                podIds = Arrays.stream(pods.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(Long::parseLong)
                        .collect(Collectors.toList());
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid pod IDs: " + pods));
            }
        }

        try {
            Map<String, Object> result = analyticsService.getAnalytics(months, podIds);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Analytics fetch failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(Map.of("error", "Failed to fetch analytics: " + e.getMessage()));
        }
    }

    /**
     * GET /api/jira/analytics/filters
     *
     * Returns available filter options (pod list, etc.)
     */
    @GetMapping("/filters")
    public ResponseEntity<Map<String, Object>> getFilters() {
        if (!creds.isConfigured()) {
            return ResponseEntity.ok(Map.of("error", "Jira not configured"));
        }
        return ResponseEntity.ok(analyticsService.getAvailableFilters());
    }
}
