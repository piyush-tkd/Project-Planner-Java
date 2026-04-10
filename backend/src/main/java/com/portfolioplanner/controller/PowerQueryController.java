package com.portfolioplanner.controller;

import com.portfolioplanner.dto.PowerQueryRequest;
import com.portfolioplanner.service.PowerQueryService;
import com.portfolioplanner.service.jira.JiraCredentialsService;
import com.portfolioplanner.service.jira.JiraCustomQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/power-query")
@RequiredArgsConstructor
@Slf4j
public class PowerQueryController {

    private final PowerQueryService powerQueryService;
    private final JiraCustomQueryService customQueryService;
    private final JiraCredentialsService creds;

    /**
     * POST /api/power-query/execute
     * Run a structured query and return results.
     */
    @PostMapping("/execute")
    public ResponseEntity<?> execute(@RequestBody PowerQueryRequest request) {
        if (!creds.isConfigured()) {
            return ResponseEntity.ok(Map.of("error", "Jira not configured"));
        }
        try {
            List<Map<String, Object>> results = powerQueryService.execute(request);
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("data", results);
            response.put("rowCount", results.size());
            response.put("limit", request.getLimit());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Power query execution failed: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Query failed: " + e.getMessage()
            ));
        }
    }

    /**
     * GET /api/power-query/values?field=xxx&pods=1,2&limit=100
     * Get distinct values for a field (autocomplete).
     */
    @GetMapping("/values")
    public ResponseEntity<List<String>> getFieldValues(
            @RequestParam String field,
            @RequestParam(required = false) String pods,
            @RequestParam(defaultValue = "100") int limit) {
        if (!creds.isConfigured()) return ResponseEntity.ok(List.of());
        try {
            return ResponseEntity.ok(powerQueryService.getFieldValues(field, pods, limit));
        } catch (Exception e) {
            log.error("Failed to fetch field values for {}: {}", field, e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    /**
     * GET /api/power-query/operators
     * Returns all supported operators with their display labels and applicable field types.
     */
    @GetMapping("/operators")
    public ResponseEntity<List<Map<String, Object>>> getOperators() {
        List<Map<String, Object>> ops = List.of(
            Map.of("op", "=", "label", "equals", "types", List.of("string", "number", "date")),
            Map.of("op", "!=", "label", "not equals", "types", List.of("string", "number", "date")),
            Map.of("op", "in", "label", "in list", "types", List.of("string", "multi")),
            Map.of("op", "not_in", "label", "not in list", "types", List.of("string", "multi")),
            Map.of("op", ">", "label", "greater than", "types", List.of("number", "date")),
            Map.of("op", "<", "label", "less than", "types", List.of("number", "date")),
            Map.of("op", ">=", "label", "at least", "types", List.of("number", "date")),
            Map.of("op", "<=", "label", "at most", "types", List.of("number", "date")),
            Map.of("op", "contains", "label", "contains text", "types", List.of("string")),
            Map.of("op", "is_empty", "label", "is empty", "types", List.of("string", "multi")),
            Map.of("op", "is_not_empty", "label", "is not empty", "types", List.of("string", "multi"))
        );
        return ResponseEntity.ok(ops);
    }

    /**
     * GET /api/power-query/presets
     * Returns commonly-used query templates/presets.
     */
    @GetMapping("/presets")
    public ResponseEntity<List<Map<String, Object>>> getPresets() {
        List<Map<String, Object>> presets = new ArrayList<>();
        presets.add(Map.of(
            "name", "Bug Distribution by Priority",
            "description", "All open bugs grouped by priority with count and story points",
            "query", Map.of(
                "filters", List.of(Map.of("field", "issueType", "op", "=", "values", List.of("Bug"))),
                "groupBy", List.of("priority"),
                "metrics", List.of(
                    Map.of("field", "count", "aggregation", "count", "alias", "issues"),
                    Map.of("field", "storyPoints", "aggregation", "sum", "alias", "total_sp")
                )
            )
        ));
        presets.add(Map.of(
            "name", "Cycle Time by Issue Type",
            "description", "Average and P90 cycle time broken down by issue type",
            "query", Map.of(
                "groupBy", List.of("issueType"),
                "metrics", List.of(
                    Map.of("field", "cycleTimeDays", "aggregation", "avg", "alias", "avg_cycle"),
                    Map.of("field", "cycleTimeDays", "aggregation", "p90", "alias", "p90_cycle"),
                    Map.of("field", "count", "aggregation", "count", "alias", "issues")
                )
            )
        ));
        presets.add(Map.of(
            "name", "Team Velocity by Quarter",
            "description", "Resolved issues and story points by quarter, grouped by assignee",
            "query", Map.of(
                "groupBy", List.of("resolved", "assignee"),
                "granularity", "quarter",
                "timeField", "resolved",
                "metrics", List.of(
                    Map.of("field", "count", "aggregation", "count", "alias", "resolved"),
                    Map.of("field", "storyPoints", "aggregation", "sum", "alias", "sp_delivered")
                )
            )
        ));
        presets.add(Map.of(
            "name", "High Priority Backlog by Epic",
            "description", "Unresolved high/critical issues grouped by epic",
            "query", Map.of(
                "filters", List.of(
                    Map.of("field", "priority", "op", "in", "values", List.of("High", "Highest", "Critical")),
                    Map.of("field", "statusCategory", "op", "!=", "values", List.of("Done"))
                ),
                "groupBy", List.of("epic"),
                "metrics", List.of(
                    Map.of("field", "count", "aggregation", "count", "alias", "issues"),
                    Map.of("field", "storyPoints", "aggregation", "sum", "alias", "total_sp")
                )
            )
        ));
        presets.add(Map.of(
            "name", "Worklog Hours by Author (Monthly)",
            "description", "Monthly hours logged per person with averages",
            "query", Map.of(
                "groupBy", List.of("assignee", "resolved"),
                "granularity", "month",
                "timeField", "resolved",
                "joins", List.of("worklogs"),
                "metrics", List.of(
                    Map.of("field", "hours", "aggregation", "sum", "alias", "hours_logged"),
                    Map.of("field", "count", "aggregation", "count", "alias", "issues")
                )
            )
        ));
        return ResponseEntity.ok(presets);
    }
}
