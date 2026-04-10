package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import com.portfolioplanner.service.jira.JiraAnalyticsService;
import com.portfolioplanner.service.jira.JiraCredentialsService;
import com.portfolioplanner.service.jira.JiraCustomQueryService;
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
    private final JiraCustomQueryService customQueryService;
    private final JiraPodRepository podRepo;

    /**
     * GET /api/jira/analytics
     *
     * Returns a comprehensive analytics payload for the dashboard.
     *
     * @param months         Lookback period (default 3)
     * @param pods           Optional comma-separated Sprint POD IDs to filter
     * @param supportBoards  Optional comma-separated Support Board IDs to filter
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getAnalytics(
            @RequestParam(defaultValue = "3") int months,
            @RequestParam(required = false) String pods,
            @RequestParam(required = false) String supportBoards) {

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

        List<Long> supportBoardIds = null;
        if (supportBoards != null && !supportBoards.isBlank()) {
            try {
                supportBoardIds = Arrays.stream(supportBoards.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(Long::parseLong)
                        .collect(Collectors.toList());
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid support board IDs: " + supportBoards));
            }
        }

        try {
            Map<String, Object> result = analyticsService.getAnalytics(months, podIds, supportBoardIds);
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

    /**
     * GET /api/jira/analytics/fields
     *
     * Returns all groupable field descriptors: standard Jira fields + any custom
     * fields discovered from synced data for the selected PODs.
     *
     * @param pods Optional comma-separated POD IDs to scope custom-field discovery
     */
    @GetMapping("/fields")
    public ResponseEntity<List<Map<String, String>>> getAvailableFields(
            @RequestParam(required = false) String pods) {

        if (!creds.isConfigured()) {
            return ResponseEntity.ok(List.of());
        }

        List<String> projectKeys = resolveProjectKeys(pods);
        try {
            return ResponseEntity.ok(customQueryService.getAvailableFields(projectKeys));
        } catch (Exception e) {
            log.error("Failed to fetch available fields: {}", e.getMessage(), e);
            return ResponseEntity.ok(List.of());
        }
    }

    /**
     * POST /api/jira/analytics/custom-query
     *
     * Executes a custom aggregation query: arbitrary groupBy field, optional JQL
     * filter, optional metric (count | storyPoints), optional time window.
     *
     * Request body (all optional except groupBy):
     * <pre>
     * {
     *   "groupBy":  "issueType",
     *   "metric":   "count",          // "count" | "storyPoints"
     *   "jql":      "priority = High",
     *   "months":   3,
     *   "pods":     "1,2,3",
     *   "limit":    20
     * }
     * </pre>
     */
    @PostMapping("/custom-query")
    public ResponseEntity<List<Map<String, Object>>> runCustomQuery(
            @RequestBody Map<String, Object> body) {

        if (!creds.isConfigured()) {
            return ResponseEntity.ok(List.of());
        }

        String groupBy = (String) body.getOrDefault("groupBy", "issueType");
        String metric  = (String) body.getOrDefault("metric",  "count");
        String jql     = (String) body.getOrDefault("jql",     null);
        String pods    = (String) body.getOrDefault("pods",    null);
        int limit      = body.containsKey("limit")
                ? ((Number) body.get("limit")).intValue() : 20;

        List<String> projectKeys = resolveProjectKeys(pods);
        if (projectKeys.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        try {
            List<Map<String, Object>> result =
                    customQueryService.runQuery(projectKeys, groupBy, metric, jql, limit);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Custom query failed — groupBy={} jql={}: {}", groupBy, jql, e.getMessage(), e);
            return ResponseEntity.ok(List.of());
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /** Resolve a comma-separated list of POD ID strings to Jira project keys. */
    private List<String> resolveProjectKeys(String pods) {
        List<JiraPod> allPods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        if (pods != null && !pods.isBlank()) {
            try {
                List<Long> ids = Arrays.stream(pods.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(Long::parseLong)
                        .collect(Collectors.toList());
                allPods = allPods.stream()
                        .filter(p -> ids.contains(p.getId()))
                        .collect(Collectors.toList());
            } catch (NumberFormatException ignored) { /* return all pods */ }
        }
        return allPods.stream()
                .flatMap(p -> p.getBoards().stream())
                .map(b -> b.getJiraProjectKey())
                .distinct()
                .collect(Collectors.toList());
    }
}
