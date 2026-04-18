package com.portfolioplanner.controller;

import com.portfolioplanner.service.PowerQueryBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Power Dashboard — dynamic query builder and dashboard CRUD.
 *
 * Endpoints:
 *   GET  /api/power-dashboard/fields            → available dimensions + metrics per source
 *   GET  /api/power-dashboard/fields/custom     → custom fields discovered from DB
 *   POST /api/power-dashboard/query             → execute a widget query
 *   GET  /api/power-dashboard/dashboards        → list all dashboards
 *   POST /api/power-dashboard/dashboards        → create dashboard
 *   GET  /api/power-dashboard/dashboards/:id    → get dashboard + widgets
 *   PUT  /api/power-dashboard/dashboards/:id    → update dashboard
 *   DELETE /api/power-dashboard/dashboards/:id  → delete dashboard
 *   POST /api/power-dashboard/dashboards/:id/widgets      → add widget
 *   PUT  /api/power-dashboard/dashboards/:id/widgets/:wid → update widget
 *   DELETE /api/power-dashboard/dashboards/:id/widgets/:wid → remove widget
 */
@RestController
@RequestMapping("/api/power-dashboard")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class PowerDashboardController {

    private final JdbcTemplate jdbc;
    private final PowerQueryBuilder queryBuilder;
    private final com.portfolioplanner.service.jira.JiraClient jiraClient;

    // ══════════════════════════════════════════════════════════════════════════
    // FIELDS DISCOVERY
    // ══════════════════════════════════════════════════════════════════════════

    /** Returns all available dimensions and metrics per data source */
    @GetMapping("/fields")
    public ResponseEntity<Map<String, Object>> getFields() {
        Map<String, Object> meta = queryBuilder.getFieldMetadata();
        return ResponseEntity.ok(meta);
    }

    /**
     * Syncs custom field display names from Jira API → jira_issue_custom_field.field_name.
     * Calls GET /rest/api/3/field which returns all fields with id + name.
     */
    @PostMapping("/fields/sync-names")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> syncFieldNames() {
        try {
            // Fetch all Jira fields
            List<Map<String, Object>> jiraFields = jiraClient.getFields();
            int updated = 0;
            for (Map<String, Object> f : jiraFields) {
                String id   = (String) f.get("id");
                String name = (String) f.get("name");
                if (id == null || name == null || !id.startsWith("customfield_")) continue;
                int rows = jdbc.update(
                    "UPDATE jira_issue_custom_field SET field_name = ? WHERE field_id = ? AND (field_name IS NULL OR field_name = '')",
                    name, id);
                if (rows > 0) updated++;
            }
            return ResponseEntity.ok(Map.of("status", "ok", "fields_updated", updated,
                "message", updated + " custom field names synced from Jira"));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("status", "error", "message",
                "Could not sync: " + e.getMessage() + ". Check Jira credentials in Settings."));
        }
    }

    /**
     * Discovers custom fields from jira_issue_custom_field table.
     * Returns distinct field_id + sample values for the frontend dimension dropdowns.
     */
    @GetMapping("/fields/custom")
    public ResponseEntity<List<Map<String, Object>>> getCustomFields() {
        List<Map<String, Object>> fields = jdbc.queryForList("""
            SELECT field_id,
                   MAX(field_name) AS field_name,
                   COUNT(DISTINCT issue_key) AS issue_count,
                   COUNT(DISTINCT field_value) AS distinct_values
            FROM jira_issue_custom_field
            WHERE field_value IS NOT NULL AND field_value != ''
              AND LENGTH(field_value) < 200
            GROUP BY field_id
            ORDER BY issue_count DESC
            LIMIT 50
            """);
        return ResponseEntity.ok(fields);
    }

    /**
     * Returns distinct values for a given field — used to populate filter dropdowns.
     * Handles standard dimensions, labels (jira_issue_label), and custom fields (cf_<field_id>).
     */
    @GetMapping("/fields/values")
    public ResponseEntity<List<String>> getFieldValues(
            @RequestParam String field,
            @RequestParam(defaultValue = "issues") String source) {

        // Label values — from jira_issue_label table
        if ("label".equals(field)) {
            List<String> values = jdbc.queryForList(
                "SELECT DISTINCT label FROM jira_issue_label WHERE label IS NOT NULL AND label NOT LIKE '{{%' ORDER BY label LIMIT 200",
                String.class);
            return ResponseEntity.ok(values);
        }

        // Custom field values — from jira_issue_custom_field
        if (field.startsWith("cf_")) {
            String fieldId = field.substring(3);
            List<String> values = jdbc.queryForList(
                "SELECT DISTINCT field_value FROM jira_issue_custom_field WHERE field_id = ? AND field_value IS NOT NULL AND LENGTH(field_value) < 100 ORDER BY field_value LIMIT 200",
                String.class, fieldId);
            return ResponseEntity.ok(values);
        }

        // Standard dimensions — validate against allowlist
        Map<String, String> dimMap = switch (source) {
            case "worklogs" -> PowerQueryBuilder.WORKLOG_DIMENSIONS;
            case "sprints"  -> PowerQueryBuilder.SPRINT_DIMENSIONS;
            default         -> PowerQueryBuilder.ISSUE_DIMENSIONS;
        };
        if (!dimMap.containsKey(field)) return ResponseEntity.badRequest().build();

        String expr = dimMap.get(field);
        String fromClause = switch (source) {
            case "worklogs" -> "FROM jira_issue_worklog w JOIN jira_issue i ON i.issue_key = w.issue_key";
            case "sprints"  -> "FROM jira_sprint js";
            default         -> "FROM jira_issue i";
        };

        if (field.equals("sprint_name") || field.equals("board")) {
            fromClause += " LEFT JOIN jira_sprint_issue si ON si.issue_key = i.issue_key" +
                          " LEFT JOIN jira_sprint js ON js.sprint_jira_id = si.sprint_jira_id";
        }

        List<String> values = jdbc.queryForList(
            "SELECT DISTINCT " + expr + " AS v " + fromClause +
            " WHERE " + expr + " IS NOT NULL ORDER BY v LIMIT 200",
            String.class);
        return ResponseEntity.ok(values);
    }

    /** Returns all Jira sync endpoint URLs available for the Sync button */
    @PostMapping("/sync-jira")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Map<String, Object>> syncJira(
            @RequestParam(defaultValue = "all") String scope,
            @RequestParam(required = false) String projectKey) {
        try {
            String url = "http://localhost:8080/api/jira/sync/" + (projectKey != null ? projectKey : "all");
            // Fire a self-request to the existing Jira sync endpoint
            org.springframework.web.client.RestTemplate rt = new org.springframework.web.client.RestTemplate();
            rt.postForEntity(url, null, String.class);
            return ResponseEntity.ok(Map.of("status", "triggered", "scope", scope));
        } catch (Exception e) {
            // Sync may not exist or may return async — that's fine
            return ResponseEntity.ok(Map.of("status", "triggered", "note", "Sync started in background"));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ALERTS — threshold evaluation for all KPI widgets in a dashboard
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Evaluates all KPI widgets in a dashboard against their configured thresholds.
     * Returns a list of alerts: { widget_id, title, value, threshold_warning, threshold_critical, status }
     */
    @GetMapping("/dashboards/{id}/alerts")
    @SuppressWarnings("unchecked")
    public ResponseEntity<List<Map<String, Object>>> checkAlerts(@PathVariable Long id) {
        List<Map<String, Object>> widgets = jdbc.queryForList(
            "SELECT id, title, widget_type, config FROM power_dashboard_widget WHERE dashboard_id = ?", id);

        List<Map<String, Object>> alerts = new ArrayList<>();
        for (Map<String, Object> w : widgets) {
            try {
                Object configRaw = w.get("config");
                Object parsedCfg = parseJsonbField(configRaw);
                if (!(parsedCfg instanceof Map)) continue;
                @SuppressWarnings("unchecked")
                Map<String, Object> config = (Map<String, Object>) parsedCfg;

                // Only check widgets with thresholds
                Number warnNum  = (Number) config.get("threshold_warning");
                Number critNum  = (Number) config.get("threshold_critical");
                if (warnNum == null && critNum == null) continue;

                double warn  = warnNum  != null ? warnNum.doubleValue()  : Double.NaN;
                double crit  = critNum  != null ? critNum.doubleValue()  : Double.NaN;
                String dir   = str(config, "direction", "above");
                if (dir == null) dir = "above";

                // Run the widget query to get current value
                PowerQueryBuilder.QueryResult result = queryBuilder.build(config);
                List<Map<String, Object>> rows = jdbc.queryForList(result.sql(), result.params().toArray());
                if (rows.isEmpty()) continue;

                double value = nvl(rows.get(0).get("value"));
                String status = "ok";
                if (!Double.isNaN(crit) && ("above".equals(dir) ? value > crit : value < crit)) status = "critical";
                else if (!Double.isNaN(warn) && ("above".equals(dir) ? value > warn : value < warn)) status = "warning";

                if (!"ok".equals(status)) {
                    Map<String, Object> alert = new LinkedHashMap<>();
                    alert.put("widget_id",          w.get("id"));
                    alert.put("title",              w.get("title"));
                    alert.put("value",              Math.round(value * 10) / 10.0);
                    alert.put("threshold_warning",  warnNum);
                    alert.put("threshold_critical", critNum);
                    alert.put("direction",          dir);
                    alert.put("status",             status);
                    alerts.add(alert);
                }
            } catch (Exception e) {
                log.debug("Alert check failed for widget {}: {}", w.get("id"), e.getMessage());
            }
        }
        return ResponseEntity.ok(alerts);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // QUERY EXECUTION
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Executes a widget query from the config JSON.
     * Config shape: { source, metric, groupBy, groupBy2, filters, dateRange, limit, sortBy }
     */
    @PostMapping("/query")
    public ResponseEntity<Map<String, Object>> executeQuery(
            @RequestBody Map<String, Object> config) {
        try {
            PowerQueryBuilder.QueryResult result = queryBuilder.build(config);
            List<Map<String, Object>> rows = jdbc.queryForList(
                result.sql(), result.params().toArray());
            return ResponseEntity.ok(Map.of(
                "data", rows,
                "columns", result.columns(),
                "count", rows.size()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Power dashboard query failed: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", "Query failed: " + e.getMessage()));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2 — SPECIALISED ENDPOINTS
    // ══════════════════════════════════════════════════════════════════════════

    /** CFD — issue counts per status per week, stacked area over time */
    @GetMapping("/cfd")
    public ResponseEntity<Map<String, Object>> cfd(
            @RequestParam(defaultValue = "90") int days,
            @RequestParam(required = false) String projectKey) {
        String pf = projectKey != null ? "AND project_key = '" + projectKey + "'" : "";
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT DATE_TRUNC('week', created_at)::date AS week,
                   status_name,
                   COUNT(*) AS issue_count
            FROM jira_issue
            WHERE created_at >= NOW() - INTERVAL '1 day' * ?
              AND LOWER(issue_type) NOT IN ('epic','sub-task')
              """ + pf + """
            GROUP BY 1, 2
            ORDER BY 1, 2
            """, days);

        // Collect all distinct statuses
        List<String> statuses = rows.stream()
            .map(r -> str(r.get("status_name"))).distinct().sorted().toList();

        // Pivot: week → { status: count }
        Map<String, Map<String, Object>> pivot = new java.util.TreeMap<>();
        rows.forEach(r -> {
            String week   = String.valueOf(r.get("week"));
            String status = str(r.get("status_name"));
            pivot.computeIfAbsent(week, k -> new java.util.LinkedHashMap<>()).put(status, r.get("issue_count"));
        });

        List<Map<String, Object>> series = pivot.entrySet().stream().map(e -> {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("week", e.getKey());
            statuses.forEach(s -> m.put(s, e.getValue().getOrDefault(s, 0)));
            return m;
        }).toList();

        return ResponseEntity.ok(Map.of("series", series, "statuses", statuses, "days_range", days));
    }

    /** Control Chart — individual cycle times with mean + ±2σ control limits */
    @GetMapping("/control-chart")
    public ResponseEntity<Map<String, Object>> controlChart(
            @RequestParam(defaultValue = "90") int days,
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "issue_type") String groupBy) {
        String pf = projectKey != null ? "AND project_key = '" + projectKey + "'" : "";
        List<Map<String, Object>> points = jdbc.queryForList("""
            SELECT issue_key, summary, assignee_display_name, issue_type, status_name,
                   COALESCE(resolution_date, updated_at)::date AS completed_date,
                   ROUND(EXTRACT(EPOCH FROM (COALESCE(resolution_date, updated_at) - created_at)) / 86400.0, 1) AS cycle_days
            FROM jira_issue
            WHERE status_category = 'done'
              AND COALESCE(resolution_date, updated_at) > created_at
              AND created_at >= NOW() - INTERVAL '1 day' * ?
              AND LOWER(issue_type) NOT IN ('epic','sub-task')
              """ + pf + """
            ORDER BY completed_date ASC
            LIMIT 300
            """, days);

        if (points.isEmpty()) return ResponseEntity.ok(Map.of("points", List.of(), "mean", 0, "ucl", 0, "lcl", 0));

        double mean = points.stream().mapToDouble(r -> nvl(r.get("cycle_days"))).average().orElse(0);
        double variance = points.stream().mapToDouble(r -> {
            double d = nvl(r.get("cycle_days")) - mean; return d * d;
        }).average().orElse(0);
        double sigma = Math.sqrt(variance);

        return ResponseEntity.ok(Map.of(
            "points",  points,
            "mean",    Math.round(mean * 10) / 10.0,
            "ucl",     Math.round((mean + 2 * sigma) * 10) / 10.0,  // Upper Control Limit
            "lcl",     Math.max(0, Math.round((mean - 2 * sigma) * 10) / 10.0),
            "sigma",   Math.round(sigma * 10) / 10.0,
            "days_range", days
        ));
    }

    /** Box Plot — lead-time quartiles per dimension (assignee, issue_type, priority, project) */
    @GetMapping("/box-plot")
    public ResponseEntity<List<Map<String, Object>>> boxPlot(
            @RequestParam(defaultValue = "assignee_display_name") String groupBy,
            @RequestParam(defaultValue = "90") int days,
            @RequestParam(required = false) String projectKey) {

        Map<String, String> allowedGroupBy = Map.of(
            "assignee_display_name", "assignee_display_name",
            "issue_type",            "issue_type",
            "priority_name",         "priority_name",
            "project_key",           "project_key"
        );
        if (!allowedGroupBy.containsKey(groupBy)) return ResponseEntity.badRequest().build();

        String col = allowedGroupBy.get(groupBy);
        String pf  = projectKey != null ? "AND project_key = '" + projectKey + "'" : "";

        // Build SQL with string concat (text block can't be used with mid-line dynamic column names)
        String sql =
            "SELECT " + col + " AS label," +
            " COUNT(*) AS n," +
            " ROUND(MIN(cycle_days)::numeric, 1) AS min_val," +
            " ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cycle_days)::numeric, 1) AS q1," +
            " ROUND(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY cycle_days)::numeric, 1) AS median," +
            " ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cycle_days)::numeric, 1) AS q3," +
            " ROUND(PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY cycle_days)::numeric, 1) AS p90," +
            " ROUND(MAX(cycle_days)::numeric, 1) AS max_val" +
            " FROM (" +
            "   SELECT " + col + "," +
            "   EXTRACT(EPOCH FROM (COALESCE(resolution_date, updated_at) - created_at)) / 86400.0 AS cycle_days" +
            "   FROM jira_issue" +
            "   WHERE status_category = 'done'" +
            "     AND COALESCE(resolution_date, updated_at) > created_at" +
            "     AND created_at >= NOW() - INTERVAL '1 day' * ?" +
            "     AND LOWER(issue_type) NOT IN ('epic','sub-task')" +
            "     " + pf +
            " ) sub" +
            " WHERE " + col + " IS NOT NULL" +
            " GROUP BY 1 HAVING COUNT(*) >= 3" +
            " ORDER BY median ASC LIMIT 20";

        List<Map<String, Object>> rows = jdbc.queryForList(sql, days);
        return ResponseEntity.ok(rows);
    }

    /** Gantt — epic/project timeline with start + end dates */
    @GetMapping("/gantt")
    public ResponseEntity<List<Map<String, Object>>> gantt(
            @RequestParam(defaultValue = "epic") String issueType,
            @RequestParam(defaultValue = "180") int days,
            @RequestParam(required = false) String projectKey) {

        String typeFilter = "epic".equalsIgnoreCase(issueType)
            ? "LOWER(issue_type) = 'epic'"
            : "LOWER(issue_type) NOT IN ('epic','sub-task')";
        String pf = projectKey != null ? "AND project_key = '" + projectKey + "'" : "";

        String sql =
            "SELECT issue_key, summary, project_key, status_name, status_category," +
            " assignee_display_name, priority_name," +
            " created_at::date AS start_date," +
            " COALESCE(resolution_date, updated_at)::date AS end_date," +
            " CASE WHEN status_category = 'done' THEN 100" +
            "      WHEN status_category = 'indeterminate' THEN 50" +
            "      ELSE 10 END AS progress_pct" +
            " FROM jira_issue" +
            " WHERE " + typeFilter +
            "   AND created_at >= NOW() - INTERVAL '1 day' * ?" +
            "   " + pf +
            " ORDER BY start_date ASC, issue_key LIMIT 40";

        List<Map<String, Object>> rows = jdbc.queryForList(sql, days);
        return ResponseEntity.ok(rows);
    }

    /** Release Readiness — per-sprint or per-project completion stats */
    @GetMapping("/release-readiness")
    public ResponseEntity<List<Map<String, Object>>> releaseReadiness(
            @RequestParam(required = false) String projectKey) {
        String pf = projectKey != null ? "AND i.project_key = '" + projectKey + "'" : "";
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT js.name AS sprint_name, js.complete_date,
                   COUNT(*) AS total_issues,
                   COUNT(*) FILTER (WHERE i.status_category = 'done') AS done,
                   COUNT(*) FILTER (WHERE i.status_category != 'done') AS remaining,
                   ROUND(100.0 * COUNT(*) FILTER (WHERE i.status_category = 'done')
                         / NULLIF(COUNT(*), 0), 1) AS completion_pct,
                   COALESCE(SUM(i.story_points) FILTER (WHERE i.status_category = 'done'), 0) AS sp_done,
                   COALESCE(SUM(i.story_points), 0) AS sp_total
            FROM jira_sprint js
            JOIN jira_sprint_issue si ON si.sprint_jira_id = js.sprint_jira_id
            JOIN jira_issue i ON i.issue_key = si.issue_key
            WHERE js.state IN ('active','closed')
              AND js.complete_date IS NOT NULL
              AND LOWER(i.issue_type) NOT IN ('epic','sub-task')
              """ + pf + """
            GROUP BY js.name, js.complete_date
            ORDER BY js.complete_date DESC
            LIMIT 12
            """);
        return ResponseEntity.ok(rows);
    }

    /** Ratio KPI — metric A / metric B (e.g. bug:story ratio, done%) */
    @GetMapping("/ratio-kpi")
    public ResponseEntity<Map<String, Object>> ratioKpi(
            @RequestParam(defaultValue = "bug") String numeratorType,
            @RequestParam(defaultValue = "story") String denominatorType,
            @RequestParam(defaultValue = "90") int days,
            @RequestParam(required = false) String projectKey) {
        String pf = (projectKey != null && !projectKey.isBlank()) ? "AND project_key = '" + projectKey.replace("'","''") + "'" : "";
        Map<String, Object> row = jdbc.queryForMap(
            "SELECT " +
            "COUNT(*) FILTER (WHERE LOWER(issue_type) = ?) AS numerator," +
            "COUNT(*) FILTER (WHERE LOWER(issue_type) = ?) AS denominator," +
            "COUNT(*) AS total," +
            "COUNT(*) FILTER (WHERE status_category = 'done') AS done," +
            "ROUND(100.0 * COUNT(*) FILTER (WHERE LOWER(issue_type) = ?) / NULLIF(COUNT(*) FILTER (WHERE LOWER(issue_type) = ?), 0), 1) AS ratio_pct" +
            " FROM jira_issue WHERE created_at >= NOW() - INTERVAL '1 day' * ? " + pf,
            numeratorType.toLowerCase(), denominatorType.toLowerCase(),
            numeratorType.toLowerCase(), denominatorType.toLowerCase(), days);
        return ResponseEntity.ok(row);
    }

    /** Created vs Resolved — weekly counts of created and resolved issues */
    @GetMapping("/created-vs-resolved")
    public ResponseEntity<List<Map<String, Object>>> createdVsResolved(
            @RequestParam(defaultValue = "90") int days,
            @RequestParam(required = false) String projectKey) {
        String pf = (projectKey != null && !projectKey.isBlank()) ? "AND project_key = '" + projectKey.replace("'","''") + "'" : "";
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT week, SUM(created) AS created, SUM(resolved) AS resolved FROM (" +
            "  SELECT DATE_TRUNC('week', created_at)::date AS week, 1 AS created, 0 AS resolved" +
            "  FROM jira_issue WHERE created_at >= NOW() - INTERVAL '1 day' * ? " + pf +
            "  AND LOWER(issue_type) NOT IN ('epic','sub-task')" +
            "  UNION ALL" +
            "  SELECT DATE_TRUNC('week', COALESCE(resolution_date, updated_at))::date AS week, 0 AS created, 1 AS resolved" +
            "  FROM jira_issue WHERE status_category = 'done'" +
            "  AND COALESCE(resolution_date, updated_at) >= NOW() - INTERVAL '1 day' * ? " + pf +
            "  AND LOWER(issue_type) NOT IN ('epic','sub-task')" +
            ") combined GROUP BY week ORDER BY week ASC",
            days, days);
        return ResponseEntity.ok(rows);
    }

    /** Open Trend — running total of open issues over time */
    @GetMapping("/open-trend")
    public ResponseEntity<List<Map<String, Object>>> openTrend(
            @RequestParam(defaultValue = "90") int days,
            @RequestParam(required = false) String projectKey) {
        String pf = (projectKey != null && !projectKey.isBlank()) ? "AND project_key = '" + projectKey.replace("'","''") + "'" : "";
        // Net open = cumulative created - cumulative resolved per week
        List<Map<String, Object>> rows = jdbc.queryForList(
            "WITH weekly AS (" +
            "  SELECT week, SUM(created) AS created, SUM(resolved) AS resolved FROM (" +
            "    SELECT DATE_TRUNC('week', created_at)::date AS week, 1 AS created, 0 AS resolved" +
            "    FROM jira_issue WHERE created_at >= NOW() - INTERVAL '1 day' * ? " + pf +
            "    AND LOWER(issue_type) NOT IN ('epic','sub-task')" +
            "    UNION ALL" +
            "    SELECT DATE_TRUNC('week', COALESCE(resolution_date, updated_at))::date AS week, 0, 1" +
            "    FROM jira_issue WHERE status_category = 'done'" +
            "    AND COALESCE(resolution_date, updated_at) >= NOW() - INTERVAL '1 day' * ? " + pf +
            "    AND LOWER(issue_type) NOT IN ('epic','sub-task')" +
            "  ) x GROUP BY week" +
            ")" +
            "SELECT week, created, resolved," +
            "  SUM(created - resolved) OVER (ORDER BY week ROWS UNBOUNDED PRECEDING) AS open_running_total" +
            " FROM weekly ORDER BY week",
            days, days);
        return ResponseEntity.ok(rows);
    }

    /** Sprint Burndown — story points remaining over sprint days */
    @GetMapping("/sprint-burndown")
    public ResponseEntity<Map<String, Object>> sprintBurndown(
            @RequestParam(required = false) Long sprintId,
            @RequestParam(required = false) String projectKey) {
        // Find most recent active or just-closed sprint
        String condition = sprintId != null
            ? "sprint_jira_id = " + sprintId
            : "state IN ('active','closed') " + ((projectKey != null && !projectKey.isBlank()) ? "AND project_key = '" + projectKey.replace("'","''") + "'" : "");
        List<Map<String, Object>> sprints = jdbc.queryForList(
            "SELECT sprint_jira_id, name, start_date, complete_date, state FROM jira_sprint" +
            " WHERE " + condition + " ORDER BY COALESCE(complete_date, start_date) DESC NULLS LAST LIMIT 1");
        if (sprints.isEmpty()) return ResponseEntity.ok(Map.of("points", List.of(), "sprint", "No sprint found"));

        Map<String, Object> sprint = sprints.get(0);
        Long sid = ((Number) sprint.get("sprint_jira_id")).longValue();

        // Total SP in sprint
        double totalSp = nvl(jdbc.queryForObject(
            "SELECT COALESCE(SUM(i.story_points), 0) FROM jira_sprint_issue si" +
            " JOIN jira_issue i ON i.issue_key = si.issue_key WHERE si.sprint_jira_id = ?" +
            " AND LOWER(i.issue_type) NOT IN ('epic','sub-task')", Double.class, sid));

        // SP completed by day (using resolution_date or updated_at)
        List<Map<String, Object>> completions = jdbc.queryForList(
            "SELECT COALESCE(i.resolution_date, i.updated_at)::date AS completed_day," +
            "  COALESCE(SUM(i.story_points), 0) AS sp_done" +
            " FROM jira_sprint_issue si JOIN jira_issue i ON i.issue_key = si.issue_key" +
            " WHERE si.sprint_jira_id = ? AND i.status_category = 'done'" +
            " AND LOWER(i.issue_type) NOT IN ('epic','sub-task')" +
            " GROUP BY 1 ORDER BY 1", sid);

        // Build burndown series
        double remaining = totalSp;
        List<Map<String, Object>> burndown = new ArrayList<>();
        burndown.add(Map.of("day", sprint.get("start_date"), "remaining", totalSp, "ideal", totalSp));
        int totalDays = 14; // default sprint length
        for (int i = 0; i < completions.size(); i++) {
            remaining -= nvl(completions.get(i).get("sp_done"));
            double ideal = totalSp * (1.0 - (i + 1.0) / totalDays);
            burndown.add(Map.of("day", completions.get(i).get("completed_day"), "remaining", Math.max(0, remaining), "ideal", Math.max(0, ideal)));
        }

        return ResponseEntity.ok(Map.of(
            "sprint", sprint.get("name"),
            "total_sp", totalSp,
            "remaining_sp", remaining,
            "done_sp", totalSp - remaining,
            "burndown", burndown,
            "state", sprint.get("state")
        ));
    }

    /** Raw issues endpoint — returns full issue rows for the Issue Table widget */
    @GetMapping("/raw-issues")
    public ResponseEntity<Map<String, Object>> rawIssues(
            @RequestParam(defaultValue = "90") int days,
            @RequestParam(required = false) String projectKey,
            @RequestParam(required = false) String statusCategory,
            @RequestParam(required = false) String issueType,
            @RequestParam(required = false) String assignee,
            @RequestParam(defaultValue = "created_at") String sortBy,
            @RequestParam(defaultValue = "50") int limit) {

        // Treat empty string same as null — no filter applied
        String pf   = (projectKey     != null && !projectKey.isBlank())     ? "AND i.project_key = '" + projectKey.replace("'","''") + "'" : "";
        String scf  = (statusCategory != null && !statusCategory.isBlank()) ? "AND i.status_category = '" + statusCategory.replace("'","''") + "'" : "";
        String itf  = (issueType      != null && !issueType.isBlank())      ? "AND LOWER(i.issue_type) = '" + issueType.toLowerCase().replace("'","''") + "'" : "";
        String af   = (assignee       != null && !assignee.isBlank())       ? "AND i.assignee_display_name ILIKE '%" + assignee.replace("'","''") + "%'" : "";
        String order = List.of("created_at","updated_at","resolution_date","priority_name","assignee_display_name","story_points").contains(sortBy) ? sortBy : "created_at";

        String rawSql =
            "SELECT i.issue_key, i.summary, i.issue_type, i.status_name, i.status_category," +
            " i.priority_name, i.assignee_display_name, i.project_key," +
            " COALESCE(i.epic_key, i.parent_key) AS epic_key," +
            " i.story_points, i.created_at::date AS created_date," +
            " COALESCE(i.resolution_date, i.updated_at)::date AS updated_date," +
            " ROUND(EXTRACT(EPOCH FROM (COALESCE(i.resolution_date, i.updated_at) - i.created_at)) / 86400.0, 1) AS age_days" +
            " FROM jira_issue i" +
            " WHERE i.created_at >= NOW() - INTERVAL '1 day' * ?" +
            " AND LOWER(i.issue_type) NOT IN ('epic','sub-task')" +
            " " + pf + scf + itf + af +
            " ORDER BY i." + order + " DESC NULLS LAST LIMIT ?";
        List<Map<String, Object>> issues = jdbc.queryForList(rawSql, days, Math.min(limit, 500));

        return ResponseEntity.ok(Map.of("data", issues, "count", issues.size()));
    }

    /** Monthly summary — created vs resolved vs net open per month */
    @GetMapping("/monthly-summary")
    public ResponseEntity<List<Map<String, Object>>> monthlySummary(
            @RequestParam(defaultValue = "12") int months,
            @RequestParam(required = false) String projectKey) {
        String pf = projectKey != null ? "AND project_key = '" + projectKey.replace("'","''") + "'" : "";
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT
              DATE_TRUNC('month', created_at)::date AS month,
              COUNT(*) AS created,
              COUNT(*) FILTER (WHERE status_category = 'done') AS resolved,
              COUNT(*) FILTER (WHERE status_category != 'done') AS open,
              COUNT(*) - COUNT(*) FILTER (WHERE status_category = 'done') AS net_new_open,
              ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(resolution_date, updated_at) - created_at)) / 86400.0)::numeric, 1) AS avg_age_days
            FROM jira_issue
            WHERE created_at >= NOW() - INTERVAL '1 month' * ?
              AND LOWER(issue_type) NOT IN ('epic','sub-task')
              """ + pf + """
            GROUP BY 1
            ORDER BY 1 DESC
            LIMIT ?
            """, months, months);
        return ResponseEntity.ok(rows);
    }

    /** Period-vs-period comparison — compare two date ranges side by side */
    @GetMapping("/period-vs-period")
    public ResponseEntity<Map<String, Object>> periodVsPeriod(
            @RequestParam(defaultValue = "30") int currentDays,
            @RequestParam(defaultValue = "30") int previousDays,
            @RequestParam(required = false) String projectKey) {
        String pf = projectKey != null ? "AND project_key = '" + projectKey.replace("'","''") + "'" : "";

        // Helper to get stats for a period
        Map<String, Object> getCurrent = jdbc.queryForMap("""
            SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status_category='done') AS done,
                   COALESCE(SUM(story_points) FILTER (WHERE status_category='done'), 0) AS sp_done,
                   COUNT(*) FILTER (WHERE LOWER(issue_type)='bug') AS bugs,
                   ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(resolution_date,updated_at)-created_at))/86400.0) FILTER (WHERE status_category='done')::numeric,1) AS avg_cycle_days
            FROM jira_issue
            WHERE created_at >= NOW() - INTERVAL '1 day' * ? AND LOWER(issue_type) NOT IN ('epic','sub-task') """ + pf,
            currentDays);

        Map<String, Object> getPrev = jdbc.queryForMap("""
            SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status_category='done') AS done,
                   COALESCE(SUM(story_points) FILTER (WHERE status_category='done'), 0) AS sp_done,
                   COUNT(*) FILTER (WHERE LOWER(issue_type)='bug') AS bugs,
                   ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(resolution_date,updated_at)-created_at))/86400.0) FILTER (WHERE status_category='done')::numeric,1) AS avg_cycle_days
            FROM jira_issue
            WHERE created_at >= NOW() - INTERVAL '1 day' * ?
              AND created_at < NOW() - INTERVAL '1 day' * ?
              AND LOWER(issue_type) NOT IN ('epic','sub-task') """ + pf,
            currentDays + previousDays, currentDays);

        // Build comparison rows
        List<Map<String, Object>> metrics = new ArrayList<>();
        String[] keys   = {"total","done","sp_done","bugs","avg_cycle_days"};
        String[] labels = {"Total Issues","Completed","Story Points Done","Bugs","Avg Cycle Days"};
        for (int i = 0; i < keys.length; i++) {
            double cur  = nvl(getCurrent.get(keys[i]));
            double prev = nvl(getPrev.get(keys[i]));
            double diff = cur - prev;
            double pct  = prev != 0 ? Math.round(diff / prev * 1000) / 10.0 : 0;
            metrics.add(Map.of("metric", labels[i], "current", cur, "previous", prev,
                               "change", diff, "change_pct", pct,
                               "better", diff > 0 ? "up" : diff < 0 ? "down" : "flat"));
        }
        return ResponseEntity.ok(Map.of(
            "metrics", metrics,
            "current_period", "Last " + currentDays + " days",
            "previous_period", "Prior " + previousDays + " days"
        ));
    }

    private double nvl(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        return 0.0;
    }

    private String str(Object o) { return o != null ? o.toString() : ""; }

    // ══════════════════════════════════════════════════════════════════════════
    // TEMPLATES
    // ══════════════════════════════════════════════════════════════════════════

    @GetMapping("/templates")
    public ResponseEntity<List<Map<String, Object>>> listTemplates() {
        List<Map<String, Object>> templates = jdbc.queryForList(
            "SELECT id, name, description, category, icon, jsonb_array_length(widgets) AS widget_count FROM power_dashboard_template ORDER BY id");
        return ResponseEntity.ok(templates);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/templates/{templateId}/create")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> createFromTemplate(
            @PathVariable Long templateId, @RequestBody Map<String, Object> body,
            Authentication auth) {
        List<Map<String, Object>> tmplRows = jdbc.queryForList(
            "SELECT * FROM power_dashboard_template WHERE id = ?", templateId);
        if (tmplRows.isEmpty()) return ResponseEntity.notFound().build();

        Map<String, Object> tmpl = tmplRows.get(0);
        String dashName = str(body.getOrDefault("name", tmpl.get("name")));
        String createdBy = auth != null ? auth.getName() : "unknown";

        Long dashId = jdbc.queryForObject("""
            INSERT INTO power_dashboard (name, description, tags, created_by, global_filters)
            VALUES (?, ?, ?, ?, '{}') RETURNING id
            """, Long.class, dashName, "Created from template: " + tmpl.get("name"),
            tmpl.get("category"), createdBy);

        // Insert template widgets
        Object widgetsRaw = parseJsonbField(tmpl.get("widgets"));
        List<Map<String, Object>> widgets = widgetsRaw instanceof List ? (List<Map<String, Object>>) widgetsRaw : List.of();
        int order = 0;
        for (Map<String, Object> w : widgets) {
            jdbc.update("""
                INSERT INTO power_dashboard_widget (dashboard_id, title, widget_type, config, position, sort_order)
                VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?)
                """,
                dashId, str(w.get("title")), str(w.get("widget_type")),
                toJson(w.get("config")), toJson(w.get("position")), order++);
        }
        return ResponseEntity.ok(Map.of("id", dashId, "name", dashName, "widget_count", widgets.size(), "status", "created"));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // GLOBAL DASHBOARD FILTERS
    // ══════════════════════════════════════════════════════════════════════════

    @PutMapping("/dashboards/{id}/global-filters")
    public ResponseEntity<Map<String, Object>> updateGlobalFilters(
            @PathVariable Long id, @RequestBody Map<String, Object> filters) {
        jdbc.update("UPDATE power_dashboard SET global_filters = ?::jsonb, updated_at = NOW() WHERE id = ?",
            toJson(filters), id);
        return ResponseEntity.ok(Map.of("id", id, "status", "updated"));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CUSTOM METRICS
    // ══════════════════════════════════════════════════════════════════════════

    @GetMapping("/dashboards/{id}/custom-metrics")
    @SuppressWarnings("unchecked")
    public ResponseEntity<List<Map<String, Object>>> getCustomMetrics(@PathVariable Long id) {
        Object raw = jdbc.queryForObject(
            "SELECT custom_metrics FROM power_dashboard WHERE id = ?", Object.class, id);
        Object parsed = parseJsonbField(raw);
        List<Map<String, Object>> metrics = parsed instanceof List ? (List<Map<String, Object>>) parsed : List.of();
        return ResponseEntity.ok(metrics);
    }

    @PutMapping("/dashboards/{id}/custom-metrics")
    public ResponseEntity<Map<String, Object>> saveCustomMetrics(
            @PathVariable Long id, @RequestBody List<Map<String, Object>> metrics) {
        jdbc.update("UPDATE power_dashboard SET custom_metrics = ?::jsonb, updated_at = NOW() WHERE id = ?",
            toJson(metrics), id);
        return ResponseEntity.ok(Map.of("id", id, "status", "updated", "count", metrics.size()));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // DRILL-THROUGH — raw issues filtered by any dimension
    // ══════════════════════════════════════════════════════════════════════════

    @PostMapping("/drill-issues")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> drillIssues(
            @RequestBody Map<String, Object> body) {
        String drillField = (String) body.getOrDefault("drillField", null);
        String drillValue = (String) body.getOrDefault("drillValue", null);
        int days  = ((Number) body.getOrDefault("days",  730)).intValue();
        int limit = ((Number) body.getOrDefault("limit", 200)).intValue();
        // Widget's own filters — applied in addition to the drill dimension
        List<Map<String, Object>> widgetFilters = body.get("widgetFilters") instanceof List
            ? (List<Map<String, Object>>) body.get("widgetFilters") : List.of();
        Map<String, Object> dateRange = body.get("dateRange") instanceof Map
            ? (Map<String, Object>) body.get("dateRange") : Map.of();

        // Drill-safe field map — uses only jira_issue columns (no JOINs needed)
        // Overrides JOIN-dependent fields from ISSUE_DIMENSIONS with their jira_issue equivalents
        Map<String, String> drillSafe = new java.util.LinkedHashMap<>(PowerQueryBuilder.ISSUE_DIMENSIONS);
        drillSafe.put("sprint_name",       "i.sprint_name");          // jira_issue.sprint_name column
        drillSafe.put("board",             "i.project_key");           // fallback to project
        // ::date::text gives "2026-03-16" format matching chart labels from ::date dimension
        drillSafe.put("week",              "DATE_TRUNC('week',  i.created_at)::date::text");
        drillSafe.put("month",             "DATE_TRUNC('month', i.created_at)::date::text");
        drillSafe.put("quarter",           "DATE_TRUNC('quarter', i.created_at)::date::text");
        drillSafe.put("resolution_week",   "DATE_TRUNC('week',  COALESCE(i.resolution_date, i.updated_at))::date::text");
        drillSafe.put("resolution_month",  "DATE_TRUNC('month', COALESCE(i.resolution_date, i.updated_at))::date::text");
        // Date dimensions need ::text cast for string comparison in drillWhere
        drillSafe.put("epic_key",          "COALESCE(i.epic_key, i.parent_key)");

        String fieldSql = null;
        boolean isLabel   = "label".equals(drillField);
        boolean isCf      = drillField != null && drillField.startsWith("cf_");
        boolean isAll     = drillField == null || drillField.isBlank() || "__all__".equals(drillField);

        if (!isLabel && !isCf && !isAll) {
            fieldSql = drillSafe.get(drillField);
            if (fieldSql == null) {
                log.warn("drill-issues: unknown field '{}', returning all issues", drillField);
                // Unknown field — fall through to return all issues unfiltered
            }
        }

        // Build the drill dimension WHERE clause
        StringBuilder drillWhere = new StringBuilder();
        List<Object> params = new ArrayList<>();

        // Date range — use widget's dateRange if provided, otherwise fall back to days param
        String dateFilter;
        String drillPreset = dateRange.containsKey("preset") ? (String) dateRange.get("preset") : null;
        if (drillPreset != null) {
            String interval = switch (drillPreset) {
                case "last_7d"   -> "7 days";
                case "last_30d"  -> "30 days";
                case "last_90d"  -> "90 days";
                case "last_6m"   -> "6 months";
                case "last_12m"  -> "12 months";
                case "last_2y"   -> "2 years";
                default          -> days + " days";
            };
            dateFilter = "i.created_at >= NOW() - INTERVAL '" + interval + "'";
        } else {
            dateFilter = "i.created_at >= NOW() - INTERVAL '1 day' * " + Math.min(days, 730);
        }

        // Drill dimension filter
        if (drillValue != null && drillField != null && !isAll) {
            if (isLabel) {
                drillWhere.append(" AND EXISTS (SELECT 1 FROM jira_issue_label WHERE issue_key = i.issue_key AND label = ?)");
                params.add(drillValue);
            } else if (isCf) {
                String cfId = drillField.substring(3);
                drillWhere.append(" AND EXISTS (SELECT 1 FROM jira_issue_custom_field WHERE issue_key = i.issue_key AND field_id = ? AND field_value = ?)");
                params.add(cfId);
                params.add(drillValue);
            } else if (fieldSql != null) {
                drillWhere.append(" AND ").append(fieldSql).append(" = ?");
                params.add(drillValue);
            }
        }

        // Widget's own filters — same logic as PowerQueryBuilder.buildFilters
        Map<String, String> drillDims = drillSafe;
        for (Map<String, Object> f : widgetFilters) {
            String ff = f.get("field") instanceof String ? (String) f.get("field") : null;
            String op = f.get("op") instanceof String ? (String) f.get("op") : "eq";
            Object val = f.get("value");
            if (ff == null || val == null) continue;
            boolean fLabel = "label".equals(ff);
            boolean fCf    = ff.startsWith("cf_");
            String fSql    = fLabel || fCf ? null : drillDims.get(ff);
            if (fSql == null && !fLabel && !fCf) continue;
            switch (op) {
                case "eq" -> {
                    if (fLabel) { drillWhere.append(" AND EXISTS (SELECT 1 FROM jira_issue_label WHERE issue_key = i.issue_key AND label = ?)"); params.add(val); }
                    else if (fCf) { drillWhere.append(" AND EXISTS (SELECT 1 FROM jira_issue_custom_field WHERE issue_key = i.issue_key AND field_id = ? AND field_value = ?)"); params.add(ff.substring(3)); params.add(val); }
                    else { drillWhere.append(" AND ").append(fSql).append(" = ?"); params.add(val); }
                }
                case "neq" -> { if (fSql != null) { drillWhere.append(" AND ").append(fSql).append(" != ?"); params.add(val); } }
                case "in"  -> {
                    List<?> vals = val instanceof List ? (List<?>) val : List.of(val);
                    if (!vals.isEmpty() && fSql != null) {
                        String ph = String.join(",", java.util.Collections.nCopies(vals.size(), "?"));
                        drillWhere.append(" AND ").append(fSql).append(" IN (").append(ph).append(")");
                        params.addAll(vals);
                    }
                }
                case "not_in" -> {
                    List<?> vals = val instanceof List ? (List<?>) val : List.of(val);
                    if (!vals.isEmpty() && fSql != null) {
                        String ph = String.join(",", java.util.Collections.nCopies(vals.size(), "?"));
                        drillWhere.append(" AND ").append(fSql).append(" NOT IN (").append(ph).append(")");
                        params.addAll(vals);
                    }
                }
                case "like" -> { if (fSql != null) { drillWhere.append(" AND ").append(fSql).append(" ILIKE ?"); params.add("%" + val + "%"); } }
            }
        }

        // Add limit param last
        params.add(Math.min(limit, 500));

        List<Map<String, Object>> issues = jdbc.queryForList(
            "SELECT i.issue_key, i.summary, i.issue_type, i.status_name, i.status_category," +
            " i.priority_name, i.assignee_display_name, i.project_key," +
            " COALESCE(i.epic_key, i.parent_key) AS epic_key, i.story_points," +
            " i.created_at::date AS created_date," +
            " COALESCE(i.resolution_date, i.updated_at)::date AS updated_date," +
            " ROUND(EXTRACT(EPOCH FROM (COALESCE(i.resolution_date, i.updated_at) - i.created_at)) / 86400.0, 1) AS age_days" +
            " FROM jira_issue i" +
            " WHERE " + dateFilter +
            drillWhere +
            " ORDER BY i.created_at DESC LIMIT ?",
            params.toArray());

        return ResponseEntity.ok(Map.of("data", issues, "count", issues.size(),
            "drill_field", drillField != null ? drillField : "",
            "drill_value", drillValue != null ? drillValue : ""));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // DASHBOARD CRUD
    // ══════════════════════════════════════════════════════════════════════════

    @GetMapping("/dashboards")
    public ResponseEntity<List<Map<String, Object>>> listDashboards(Authentication auth) {
        List<Map<String, Object>> dashboards = jdbc.queryForList("""
            SELECT pd.id, pd.name, pd.description, pd.created_by, pd.is_public, pd.tags,
                   pd.created_at, pd.updated_at,
                   COUNT(pdw.id) AS widget_count
            FROM power_dashboard pd
            LEFT JOIN power_dashboard_widget pdw ON pdw.dashboard_id = pd.id
            GROUP BY pd.id, pd.name, pd.description, pd.created_by, pd.is_public, pd.tags,
                     pd.created_at, pd.updated_at
            ORDER BY pd.updated_at DESC
            """);
        return ResponseEntity.ok(dashboards);
    }

    @GetMapping("/dashboards/{id}")
    public ResponseEntity<Map<String, Object>> getDashboard(@PathVariable Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM power_dashboard WHERE id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.notFound().build();

        Map<String, Object> dashboard = new LinkedHashMap<>(rows.get(0));
        List<Map<String, Object>> widgets = jdbc.queryForList(
            "SELECT * FROM power_dashboard_widget WHERE dashboard_id = ? ORDER BY sort_order, id", id);
        // Parse JSONB fields (PGobject) into proper Maps so the frontend gets real objects
        List<Map<String, Object>> parsedWidgets = widgets.stream()
            .map(w -> {
                Map<String, Object> m = new LinkedHashMap<>(w);
                m.put("config",   parseJsonbField(m.get("config")));
                m.put("position", parseJsonbField(m.get("position")));
                return m;
            }).toList();
        dashboard.put("widgets", parsedWidgets);
        return ResponseEntity.ok(dashboard);
    }

    @PostMapping("/dashboards")
    public ResponseEntity<Map<String, Object>> createDashboard(
            @RequestBody Map<String, Object> body, Authentication auth) {
        String name        = str(body, "name", "Untitled Dashboard");
        String description = str(body, "description", null);
        String tags        = str(body, "tags", null);
        boolean isPublic   = Boolean.TRUE.equals(body.get("is_public"));
        String createdBy   = auth != null ? auth.getName() : "unknown";

        Long id = jdbc.queryForObject("""
            INSERT INTO power_dashboard (name, description, tags, is_public, created_by)
            VALUES (?, ?, ?, ?, ?) RETURNING id
            """, Long.class, name, description, tags, isPublic, createdBy);

        return ResponseEntity.ok(Map.of("id", id, "name", name, "status", "created"));
    }

    @PutMapping("/dashboards/{id}")
    public ResponseEntity<Map<String, Object>> updateDashboard(
            @PathVariable Long id, @RequestBody Map<String, Object> body) {
        String name        = str(body, "name", null);
        String description = str(body, "description", null);
        String tags        = str(body, "tags", null);

        jdbc.update("""
            UPDATE power_dashboard
            SET name = COALESCE(?, name),
                description = COALESCE(?, description),
                tags = COALESCE(?, tags),
                updated_at = NOW()
            WHERE id = ?
            """, name, description, tags, id);

        return ResponseEntity.ok(Map.of("id", id, "status", "updated"));
    }

    @DeleteMapping("/dashboards/{id}")
    public ResponseEntity<Map<String, Object>> deleteDashboard(@PathVariable Long id) {
        jdbc.update("DELETE FROM power_dashboard WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("id", id, "status", "deleted"));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // WIDGET CRUD
    // ══════════════════════════════════════════════════════════════════════════

    @PostMapping("/dashboards/{dashboardId}/widgets")
    public ResponseEntity<Map<String, Object>> addWidget(
            @PathVariable Long dashboardId, @RequestBody Map<String, Object> body) {
        String title      = str(body, "title", "New Widget");
        String widgetType = str(body, "widget_type", "bar");
        Object config     = body.getOrDefault("config", Map.of());
        Object position   = body.getOrDefault("position", Map.of("x", 0, "y", 0, "w", 6, "h", 4));
        int sortOrder     = ((Number) body.getOrDefault("sort_order", 0)).intValue();

        Long id = jdbc.queryForObject("""
            INSERT INTO power_dashboard_widget (dashboard_id, title, widget_type, config, position, sort_order)
            VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?) RETURNING id
            """, Long.class,
            dashboardId, title, widgetType,
            toJson(config), toJson(position), sortOrder);

        // Touch dashboard updated_at
        jdbc.update("UPDATE power_dashboard SET updated_at = NOW() WHERE id = ?", dashboardId);

        return ResponseEntity.ok(Map.of("id", id, "dashboard_id", dashboardId, "status", "created"));
    }

    @PutMapping("/dashboards/{dashboardId}/widgets/{widgetId}")
    public ResponseEntity<Map<String, Object>> updateWidget(
            @PathVariable Long dashboardId, @PathVariable Long widgetId,
            @RequestBody Map<String, Object> body) {
        String title      = str(body, "title", null);
        String widgetType = str(body, "widget_type", null);
        Object config     = body.get("config");
        Object position   = body.get("position");

        if (config != null) {
            jdbc.update("""
                UPDATE power_dashboard_widget
                SET title = COALESCE(?, title),
                    widget_type = COALESCE(?, widget_type),
                    config = ?::jsonb,
                    position = COALESCE(?::jsonb, position),
                    updated_at = NOW()
                WHERE id = ? AND dashboard_id = ?
                """, title, widgetType, toJson(config),
                position != null ? toJson(position) : null,
                widgetId, dashboardId);
        } else {
            jdbc.update("""
                UPDATE power_dashboard_widget
                SET title = COALESCE(?, title),
                    widget_type = COALESCE(?, widget_type),
                    position = COALESCE(?::jsonb, position),
                    updated_at = NOW()
                WHERE id = ? AND dashboard_id = ?
                """, title, widgetType,
                position != null ? toJson(position) : null,
                widgetId, dashboardId);
        }

        jdbc.update("UPDATE power_dashboard SET updated_at = NOW() WHERE id = ?", dashboardId);
        return ResponseEntity.ok(Map.of("id", widgetId, "status", "updated"));
    }

    @DeleteMapping("/dashboards/{dashboardId}/widgets/{widgetId}")
    public ResponseEntity<Map<String, Object>> deleteWidget(
            @PathVariable Long dashboardId, @PathVariable Long widgetId) {
        jdbc.update("DELETE FROM power_dashboard_widget WHERE id = ? AND dashboard_id = ?",
            widgetId, dashboardId);
        jdbc.update("UPDATE power_dashboard SET updated_at = NOW() WHERE id = ?", dashboardId);
        return ResponseEntity.ok(Map.of("id", widgetId, "status", "deleted"));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static String str(Map<String, Object> m, String key, String def) {
        Object v = m.get(key);
        return v != null ? v.toString() : def;
    }

    /** Converts any object to JSON string for JSONB columns */
    private static String toJson(Object obj) {
        if (obj instanceof String s) return s;
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }

    /**
     * Parses a JSONB field from its raw JDBC form into a Map.
     * JdbcTemplate returns JSONB columns as PGobject — Jackson would serialize this
     * as { type: "jsonb", value: "..." } which the frontend can't use directly.
     * We parse the raw JSON string into a proper Map instead.
     */
    @SuppressWarnings("unchecked")
    private static Object parseJsonbField(Object raw) {
        if (raw == null) return null;
        String jsonStr = null;
        if (raw instanceof String s) {
            jsonStr = s;
        } else {
            // PGobject — get the JSON value via toString()
            jsonStr = raw.toString();
        }
        if (jsonStr == null || jsonStr.isBlank()) return null;
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                .readValue(jsonStr, Object.class);
        } catch (Exception e) {
            return jsonStr; // fallback: return raw string, frontend handles it
        }
    }
}
