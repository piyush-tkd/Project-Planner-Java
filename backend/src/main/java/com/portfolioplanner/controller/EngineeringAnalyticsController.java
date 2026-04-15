package com.portfolioplanner.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Engineering Analytics API — 23 metrics across 5 categories.
 *
 * All metrics derive from: jira_issue, jira_sprint, jira_sprint_issue,
 * jira_issue_transition, jira_issue_worklog, jira_issue_custom_field.
 *
 * Categories:
 *   QUALITY      → Flow Efficiency, Re-open Rate, Bug Clustering, First-Time Pass, Bug Resolution, Rework Loops
 *   PRODUCTIVITY → Individual Throughput, Throughput vs WIP, Estimation Accuracy
 *   EFFICIENCY   → Aging WIP, Queue Time, Batch Size vs Cycle Time, Context Switching
 *   TRACKING     → Sprint Carryover, Epic Burndown, Release Readiness
 *   FORECASTING  → Velocity Forecast, Optimal Capacity, Risk Detection, Developer Growth,
 *                  Cross-team Dependencies, Seasonal Patterns
 */
@RestController
@RequestMapping("/api/engineering-analytics")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class EngineeringAnalyticsController {

    private final JdbcTemplate jdbc;
    private final com.portfolioplanner.service.jira.JiraClient jiraClient;
    private final com.portfolioplanner.domain.repository.JiraIssueTransitionRepository transitionRepo;

    // ══════════════════════════════════════════════════════════════════════════
    // QUALITY
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * P0 — Flow Efficiency
     * Active time (In Development + QA In Progress) vs total lead time per issue.
     * Low flow efficiency = lots of waiting time → process bottleneck, not people problem.
     */
    @GetMapping("/quality/flow-efficiency")
    public ResponseEntity<Map<String, Object>> flowEfficiency(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "30") int days) {

        String projectFilter = projectKey != null ? "AND i.project_key = '" + projectKey + "'" : "";

        // Total lead time = created_at → done_at (use COALESCE(resolution_date, updated_at) because
        // Jira only sets resolution_date for "Resolved" status — issues moved to "Done" status category
        // typically have resolution_date = NULL. We fall back to updated_at as the completion timestamp.
        // Active time = sum of time IN active statuses, capped at total lead time.
        // Efficiency capped at 100% to prevent data anomalies.
        List<Map<String, Object>> issues = jdbc.queryForList("""
            SELECT
                i.issue_key,
                i.summary,
                i.issue_type,
                i.assignee_display_name,
                i.project_key,
                ROUND(EXTRACT(EPOCH FROM (
                    COALESCE(i.resolution_date, i.updated_at) - i.created_at
                )) / 3600.0, 1) AS total_hours,
                ROUND(LEAST(
                    COALESCE(active.active_hours, 0),
                    EXTRACT(EPOCH FROM (COALESCE(i.resolution_date, i.updated_at) - i.created_at)) / 3600.0
                ), 1) AS active_hours
            FROM jira_issue i
            LEFT JOIN (
                -- Step 1: compute LEAD (next transition time) over ALL transitions,
                -- THEN filter to active statuses and aggregate.
                -- Must be two levels because window functions run before GROUP BY.
                SELECT windowed.issue_key,
                    SUM(GREATEST(0,
                        EXTRACT(EPOCH FROM (
                            LEAST(
                                COALESCE(windowed.next_at,
                                    COALESCE(j.resolution_date, j.updated_at),
                                    windowed.transitioned_at + INTERVAL '30 days'
                                ),
                                COALESCE(j.resolution_date, j.updated_at, NOW())
                            ) - windowed.transitioned_at
                        )) / 3600.0
                    )) AS active_hours
                FROM (
                    SELECT t1.issue_key, t1.to_status, t1.transitioned_at,
                        LEAD(t1.transitioned_at) OVER (
                            PARTITION BY t1.issue_key ORDER BY t1.transitioned_at
                        ) AS next_at
                    FROM jira_issue_transition t1
                ) windowed
                JOIN jira_issue j ON j.issue_key = windowed.issue_key
                WHERE UPPER(windowed.to_status) IN (
                    'IN DEVELOPMENT','DEV IN PROGRESS','QA IN PROGRESS','IN REVIEW','TESTING','IN PROGRESS'
                )
                GROUP BY windowed.issue_key
            ) active ON active.issue_key = i.issue_key
            WHERE i.status_category = 'done'
              AND COALESCE(i.resolution_date, i.updated_at) > i.created_at
              AND i.created_at >= NOW() - INTERVAL '1 day' * ?
              AND LOWER(i.issue_type) NOT IN ('epic', 'sub-task')
              """ + projectFilter + """
            ORDER BY
                COALESCE(active.active_hours, 0) /
                NULLIF(EXTRACT(EPOCH FROM (COALESCE(i.resolution_date, i.updated_at) - i.created_at)) / 3600.0, 0) ASC
            LIMIT 100
            """, days);

        // Compute averages
        double avgTotal  = issues.stream().mapToDouble(r -> nvl(r.get("total_hours"))).average().orElse(0);
        double avgActive = issues.stream().mapToDouble(r -> nvl(r.get("active_hours"))).average().orElse(0);
        // Cap avg efficiency at 100%
        double avgEfficiency = avgTotal > 0
            ? Math.min(100.0, Math.round(avgActive / avgTotal * 1000) / 10.0) : 0;

        // Enrich with flow_efficiency_pct — hard-capped at 100%
        // Only include issues where total_hours > 0 (exclude same-day transitions)
        issues.forEach(r -> {
            double total  = nvl(r.get("total_hours"));
            double active = Math.min(nvl(r.get("active_hours")), total); // can never exceed total
            double pct    = total > 0.5 ? Math.min(100.0, Math.round(active / total * 1000) / 10.0) : 0.0;
            r.put("flow_efficiency_pct", pct);
            r.put("wait_hours", Math.round(Math.max(0, total - active) * 10) / 10.0);
            r.put("active_hours", Math.round(active * 10) / 10.0); // update to capped value
        });

        return ResponseEntity.ok(Map.of(
            "issues", issues,
            "avg_flow_efficiency_pct", avgEfficiency,
            "avg_total_hours", Math.round(avgTotal * 10) / 10.0,
            "avg_active_hours", Math.round(avgActive * 10) / 10.0,
            "days_range", days
        ));
    }

    /**
     * P0 — Re-open Rate
     * Issues that transitioned from a "done" state back to "in development".
     * A team with 30% re-open rate is shipping incomplete work.
     */
    @GetMapping("/quality/reopen-rate")
    public ResponseEntity<Map<String, Object>> reopenRate(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "90") int days) {

        String projectFilter = projectKey != null ? "AND i.project_key = '" + projectKey + "'" : "";

        List<Map<String, Object>> reopened = jdbc.queryForList("""
            SELECT i.issue_key, i.summary, i.issue_type, i.assignee_display_name,
                   i.project_key, i.priority_name,
                   COUNT(*) AS reopen_count,
                   MAX(t.transitioned_at) AS last_reopen
            FROM jira_issue i
            JOIN jira_issue_transition t ON t.issue_key = i.issue_key
            WHERE UPPER(t.from_status) IN (
                    'QA COMPLETED','DONE','CLOSED','RESOLVED','READY FOR TESTING'
                  )
              AND UPPER(t.to_status) IN (
                    'IN DEVELOPMENT','DEVELOPMENT','IN PROGRESS','REOPENED','OPEN'
                  )
              AND t.transitioned_at >= NOW() - INTERVAL '1 day' * ?
              AND LOWER(i.issue_type) NOT IN ('epic')
              """ + projectFilter + """
            GROUP BY i.issue_key, i.summary, i.issue_type,
                     i.assignee_display_name, i.project_key, i.priority_name
            ORDER BY reopen_count DESC, last_reopen DESC
            LIMIT 100
            """, days);

        Long totalCompleted = jdbc.queryForObject("""
            SELECT COUNT(DISTINCT i.issue_key) FROM jira_issue i
            WHERE i.status_category = 'done'
              AND i.created_at >= NOW() - INTERVAL '1 day' * ?
            """, Long.class, days);

        double reopenRate = totalCompleted != null && totalCompleted > 0
            ? Math.round((double) reopened.size() / totalCompleted * 1000) / 10.0 : 0.0;

        // Assignee breakdown
        Map<String, Long> byAssignee = new LinkedHashMap<>();
        reopened.forEach(r -> {
            String a = str(r.get("assignee_display_name"), "Unassigned");
            byAssignee.merge(a, ((Number) r.get("reopen_count")).longValue(), Long::sum);
        });

        return ResponseEntity.ok(Map.of(
            "reopened_issues", reopened,
            "reopen_count", reopened.size(),
            "total_completed", totalCompleted != null ? totalCompleted : 0,
            "reopen_rate_pct", reopenRate,
            "by_assignee", sortByValueDesc(byAssignee),
            "days_range", days
        ));
    }

    /**
     * P2 — Bug Clustering by Epic/Component
     * Which epics/areas of the codebase generate the most bugs? Find the hot zones.
     */
    @GetMapping("/quality/bug-clustering")
    public ResponseEntity<Map<String, Object>> bugClustering(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "90") int days) {

        String projectFilter = projectKey != null ? "AND i.project_key = '" + projectKey + "'" : "";

        // Use COALESCE(epic_key, parent_key) to find the parent epic/story for next-gen projects
        List<Map<String, Object>> byEpic = jdbc.queryForList("""
            SELECT COALESCE(i.epic_key, i.parent_key) AS epic_key,
                   COALESCE(e.summary, p.summary, COALESCE(i.epic_key, i.parent_key)) AS epic_name,
                   COUNT(*) AS bug_count,
                   COUNT(*) FILTER (WHERE i.status_category != 'done') AS open_bugs,
                   ROUND(AVG(CASE i.priority_name
                       WHEN 'Highest' THEN 5 WHEN 'High' THEN 4 WHEN 'Medium' THEN 3
                       WHEN 'Low' THEN 2 WHEN 'Lowest' THEN 1 ELSE 2 END)::numeric, 1) AS avg_priority_score
            FROM jira_issue i
            LEFT JOIN jira_issue e ON e.issue_key = i.epic_key
            LEFT JOIN jira_issue p ON p.issue_key = i.parent_key
            WHERE LOWER(i.issue_type) IN ('bug','defect')
              AND i.created_at >= NOW() - INTERVAL '1 day' * ?
              AND COALESCE(i.epic_key, i.parent_key) IS NOT NULL
              """ + projectFilter + """
            GROUP BY COALESCE(i.epic_key, i.parent_key),
                     COALESCE(e.summary, p.summary, COALESCE(i.epic_key, i.parent_key))
            ORDER BY bug_count DESC
            LIMIT 20
            """, days);

        List<Map<String, Object>> byProject = jdbc.queryForList("""
            SELECT i.project_key,
                   COUNT(*) AS bug_count,
                   COUNT(*) FILTER (WHERE i.status_category != 'done') AS open_bugs,
                   COUNT(*) FILTER (WHERE UPPER(i.priority_name) IN ('HIGH','HIGHEST')) AS high_priority_bugs
            FROM jira_issue i
            WHERE LOWER(i.issue_type) IN ('bug','defect')
              AND i.created_at >= NOW() - INTERVAL '1 day' * ?
            GROUP BY i.project_key
            ORDER BY bug_count DESC
            """, days);

        return ResponseEntity.ok(Map.of(
            "by_epic", byEpic,
            "by_project", byProject,
            "days_range", days
        ));
    }

    /**
     * P1 — First-Time Pass Rate
     * Stories that went Ready for Testing → QA Completed without bouncing back.
     */
    @GetMapping("/quality/first-time-pass-rate")
    public ResponseEntity<Map<String, Object>> firstTimePassRate(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "90") int days) {

        String projectFilter = projectKey != null ? "AND i.project_key = '" + projectKey + "'" : "";

        // Stories that went to QA
        List<Map<String, Object>> qaIssues = jdbc.queryForList("""
            SELECT i.issue_key, i.summary, i.assignee_display_name, i.project_key,
                   -- Did it ever go BACK to In Dev after being in QA?
                   EXISTS(
                       SELECT 1 FROM jira_issue_transition t2
                       WHERE t2.issue_key = i.issue_key
                         AND UPPER(t2.from_status) IN ('READY FOR TESTING','QA IN PROGRESS')
                         AND UPPER(t2.to_status) IN ('IN DEVELOPMENT','DEVELOPMENT','IN PROGRESS')
                   ) AS was_rejected
            FROM jira_issue i
            WHERE LOWER(i.issue_type) = 'story'
              AND i.status_category = 'done'
              AND i.created_at >= NOW() - INTERVAL '1 day' * ?
              AND EXISTS(
                  SELECT 1 FROM jira_issue_transition t
                  WHERE t.issue_key = i.issue_key
                    AND UPPER(t.to_status) IN ('READY FOR TESTING','QA IN PROGRESS')
              )
              """ + projectFilter + """
            ORDER BY i.created_at DESC
            LIMIT 200
            """, days);

        long total     = qaIssues.size();
        long passed    = qaIssues.stream().filter(r -> !Boolean.TRUE.equals(r.get("was_rejected"))).count();
        long failed    = total - passed;
        double ftprPct = total > 0 ? Math.round((double) passed / total * 1000) / 10.0 : 0.0;

        // By assignee
        Map<String, long[]> assigneeMap = new LinkedHashMap<>();
        qaIssues.forEach(r -> {
            String a = str(r.get("assignee_display_name"), "Unassigned");
            assigneeMap.computeIfAbsent(a, k -> new long[]{0, 0});
            assigneeMap.get(a)[0]++;
            if (!Boolean.TRUE.equals(r.get("was_rejected"))) assigneeMap.get(a)[1]++;
        });
        List<Map<String, Object>> byAssignee = new ArrayList<>();
        assigneeMap.forEach((a, counts) -> byAssignee.add(Map.of(
            "assignee", a, "total", counts[0], "passed", counts[1],
            "pass_rate_pct", counts[0] > 0 ? Math.round((double) counts[1] / counts[0] * 1000) / 10.0 : 0.0
        )));
        byAssignee.sort((x, y) -> Double.compare(nvl(y.get("pass_rate_pct")), nvl(x.get("pass_rate_pct"))));

        return ResponseEntity.ok(Map.of(
            "total_qa_stories", total,
            "passed_first_time", passed,
            "rejected", failed,
            "first_time_pass_rate_pct", ftprPct,
            "by_assignee", byAssignee,
            "days_range", days
        ));
    }

    /**
     * P1 — Bug Resolution Time by Priority
     * How fast are P1 vs P3 bugs resolved? Slow P1 resolution = process problem.
     */
    @GetMapping("/quality/bug-resolution-time")
    public ResponseEntity<Map<String, Object>> bugResolutionTime(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "90") int days) {

        String projectFilter = projectKey != null ? "AND project_key = '" + projectKey + "'" : "";

        List<Map<String, Object>> byPriority = jdbc.queryForList("""
            SELECT priority_name,
                   COUNT(*) AS bug_count,
                   ROUND(AVG(EXTRACT(EPOCH FROM (resolution_date - created_at)) / 3600.0)::numeric, 1)
                       AS avg_resolution_hours,
                   ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
                       ORDER BY EXTRACT(EPOCH FROM (resolution_date - created_at)) / 3600.0
                   )::numeric, 1) AS median_resolution_hours,
                   ROUND(MIN(EXTRACT(EPOCH FROM (resolution_date - created_at)) / 3600.0)::numeric, 1)
                       AS min_hours,
                   ROUND(MAX(EXTRACT(EPOCH FROM (resolution_date - created_at)) / 3600.0)::numeric, 1)
                       AS max_hours
            FROM jira_issue
            WHERE LOWER(issue_type) IN ('bug','defect')
              AND status_category = 'done'
              AND resolution_date IS NOT NULL
              AND created_at >= NOW() - INTERVAL '1 day' * ?
              """ + projectFilter + """
            GROUP BY priority_name
            ORDER BY CASE priority_name
                WHEN 'Highest' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3
                WHEN 'Low' THEN 4 WHEN 'Lowest' THEN 5 ELSE 6 END
            """, days);

        // SLA breach: bugs open > threshold by priority
        List<Map<String, Object>> breaches = jdbc.queryForList("""
            SELECT issue_key, summary, priority_name, assignee_display_name,
                   ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0::numeric, 1) AS open_hours
            FROM jira_issue
            WHERE LOWER(issue_type) IN ('bug','defect')
              AND status_category != 'done'
              AND (
                (UPPER(priority_name) IN ('HIGHEST','BLOCKER') AND created_at < NOW() - INTERVAL '24 hours')
                OR (UPPER(priority_name) = 'HIGH' AND created_at < NOW() - INTERVAL '48 hours')
                OR (UPPER(priority_name) = 'MEDIUM' AND created_at < NOW() - INTERVAL '120 hours')
              )
              """ + projectFilter + """
            ORDER BY created_at ASC
            LIMIT 50
            """);

        return ResponseEntity.ok(Map.of(
            "by_priority", byPriority,
            "sla_breaches", breaches,
            "breach_count", breaches.size(),
            "days_range", days
        ));
    }

    /**
     * P2 — Rework Loops
     * Stories that bounced between In Dev ↔ QA multiple times.
     */
    @GetMapping("/quality/rework-loops")
    public ResponseEntity<Map<String, Object>> reworkLoops(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "90") int days) {

        String projectFilter = projectKey != null ? "AND i.project_key = '" + projectKey + "'" : "";

        List<Map<String, Object>> issues = jdbc.queryForList("""
            SELECT i.issue_key, i.summary, i.assignee_display_name, i.project_key,
                   COUNT(*) AS loop_count
            FROM jira_issue i
            JOIN jira_issue_transition t ON t.issue_key = i.issue_key
            WHERE UPPER(t.from_status) IN ('READY FOR TESTING','QA IN PROGRESS','QA COMPLETED')
              AND UPPER(t.to_status)   IN ('IN DEVELOPMENT','DEVELOPMENT','IN PROGRESS')
              AND i.created_at >= NOW() - INTERVAL '1 day' * ?
              """ + projectFilter + """
            GROUP BY i.issue_key, i.summary, i.assignee_display_name, i.project_key
            HAVING COUNT(*) >= 1
            ORDER BY loop_count DESC
            LIMIT 50
            """, days);

        Map<Integer, Long> distribution = new LinkedHashMap<>();
        issues.forEach(r -> {
            int loops = ((Number) r.get("loop_count")).intValue();
            distribution.merge(loops, 1L, Long::sum);
        });

        double avgLoops = issues.stream().mapToInt(r -> ((Number) r.get("loop_count")).intValue())
                                 .average().orElse(0);

        return ResponseEntity.ok(Map.of(
            "issues_with_rework", issues,
            "total_rework_issues", issues.size(),
            "avg_loops", Math.round(avgLoops * 10) / 10.0,
            "loop_distribution", distribution,
            "days_range", days
        ));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRODUCTIVITY
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * P1 — Individual Throughput
     * Issues completed per person per sprint. Spots sudden drops (blocked) or spikes (overloaded).
     */
    @GetMapping("/productivity/individual-throughput")
    public ResponseEntity<Map<String, Object>> individualThroughput(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "10") int sprints) {

        String projectFilter = projectKey != null ? "AND js.project_key = '" + projectKey + "'" : "";

        // Show ALL issues per assignee per sprint (not just done) so we can see
        // total workload vs completed. Story: who is delivering consistently?
        List<Map<String, Object>> data = jdbc.queryForList("""
            SELECT
                i.assignee_display_name AS assignee,
                js.name AS sprint_name,
                js.sprint_jira_id,
                js.complete_date,
                COUNT(*) AS total_assigned,
                COUNT(*) FILTER (WHERE i.status_category = 'done') AS issues_completed,
                COALESCE(SUM(i.story_points), 0) AS sp_total,
                COALESCE(SUM(i.story_points) FILTER (WHERE i.status_category = 'done'), 0) AS sp_completed
            FROM jira_issue i
            JOIN jira_sprint_issue si ON si.issue_key = i.issue_key
            JOIN jira_sprint js ON js.sprint_jira_id = si.sprint_jira_id
            WHERE js.state IN ('closed','active')
              AND LOWER(i.issue_type) NOT IN ('epic','sub-task')
              AND i.assignee_display_name IS NOT NULL
              AND i.assignee_display_name != 'Unassigned'
              """ + projectFilter + """
              AND js.sprint_jira_id IN (
                  SELECT sprint_jira_id FROM jira_sprint
                  WHERE state IN ('closed','active')
                    AND complete_date IS NOT NULL
                  """ + (projectKey != null ? "AND project_key = '" + projectKey + "'" : "") + """
                  ORDER BY complete_date DESC LIMIT ?
              )
            GROUP BY i.assignee_display_name, js.name, js.sprint_jira_id, js.complete_date
            ORDER BY js.complete_date DESC NULLS FIRST, issues_completed DESC
            """, sprints);

        // Pivot: assignee → [sprint velocities], sorted by total completed desc
        Map<String, List<Map<String, Object>>> byPerson = new LinkedHashMap<>();
        data.forEach(r -> {
            String a = str(r.get("assignee"), "Unassigned");
            byPerson.computeIfAbsent(a, k -> new ArrayList<>()).add(r);
        });

        // Sort by total issues completed across all sprints (highest first)
        Map<String, List<Map<String, Object>>> sorted = new LinkedHashMap<>();
        byPerson.entrySet().stream()
            .sorted((a, b) -> {
                long sumA = a.getValue().stream().mapToLong(r -> ((Number) r.getOrDefault("issues_completed", 0)).longValue()).sum();
                long sumB = b.getValue().stream().mapToLong(r -> ((Number) r.getOrDefault("issues_completed", 0)).longValue()).sum();
                return Long.compare(sumB, sumA);
            })
            .forEach(e -> sorted.put(e.getKey(), e.getValue()));

        return ResponseEntity.ok(Map.of("by_person", sorted, "raw", data, "sprints_range", sprints, "total_people", sorted.size()));
    }

    /**
     * P1 — Throughput vs WIP (Little's Law)
     * As WIP goes up, throughput typically goes DOWN. Plot weekly to show the relationship.
     */
    @GetMapping("/productivity/throughput-wip")
    public ResponseEntity<List<Map<String, Object>>> throughputVsWip(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "12") int weeks) {

        String projectFilter = projectKey != null ? "AND project_key = '" + projectKey + "'" : "";

        // Generate weekly series using CTE (avoids JDBC parameter issues with generate_series)
        String projectCol = projectKey != null
            ? "AND project_key = '" + projectKey.replace("'", "''") + "'"
            : "";

        List<Map<String, Object>> weekly = jdbc.queryForList(
            "WITH week_series AS (" +
            "  SELECT generate_series(" +
            "    date_trunc('week', now() - (interval '1 week' * " + weeks + "))," +
            "    date_trunc('week', now())," +
            "    interval '1 week'" +
            "  )::date AS week_start" +
            ")," +
            "weekly_throughput AS (" +
            "  SELECT date_trunc('week', resolution_date)::date AS wk, COUNT(*) AS completed" +
            "  FROM jira_issue" +
            "  WHERE resolution_date IS NOT NULL AND status_category = 'done'" +
            "    AND LOWER(issue_type) NOT IN ('epic','sub-task')" +
            "    AND resolution_date >= now() - interval '" + weeks + " weeks'" +
            "    " + projectCol +
            "  GROUP BY 1" +
            ")" +
            "SELECT" +
            "  ws.week_start," +
            "  COALESCE(wt.completed, 0) AS throughput," +
            "  (SELECT COUNT(*) FROM jira_issue wi" +
            "   WHERE wi.created_at::date < ws.week_start" +
            "     AND (wi.resolution_date IS NULL OR wi.resolution_date::date >= ws.week_start)" +
            "     AND wi.status_category NOT IN ('done','new')" +
            "     AND LOWER(wi.issue_type) NOT IN ('epic','sub-task')" +
            "     " + projectCol + ") AS wip_at_start" +
            " FROM week_series ws" +
            " LEFT JOIN weekly_throughput wt ON wt.wk = ws.week_start" +
            " ORDER BY ws.week_start");

        return ResponseEntity.ok(weekly);
    }

    /**
     * P1 — Estimation Accuracy
     * Compare original estimate vs actual time spent. Identifies systematic under/over-estimation.
     */
    @GetMapping("/productivity/estimation-accuracy")
    public ResponseEntity<Map<String, Object>> estimationAccuracy(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "90") int days) {

        String projectFilter = projectKey != null ? "AND i.project_key = '" + projectKey + "'" : "";

        // Accuracy = (actual / estimated) * 100, capped at 300% to avoid outliers skewing averages
        // Issues where estimate < 1 hour are excluded as likely data entry errors
        List<Map<String, Object>> issues = jdbc.queryForList("""
            SELECT i.issue_key, i.summary, i.issue_type, i.assignee_display_name,
                   ROUND(i.time_original_estimate / 3600.0, 1) AS estimated_hours,
                   ROUND(COALESCE(w.total_spent, i.time_spent, 0) / 3600.0, 1) AS actual_hours,
                   LEAST(300.0, ROUND(
                       (COALESCE(w.total_spent, i.time_spent, 0)::numeric /
                        i.time_original_estimate * 100
                   ), 1)) AS accuracy_pct
            FROM jira_issue i
            LEFT JOIN (
                SELECT issue_key, SUM(time_spent_seconds) AS total_spent
                FROM jira_issue_worklog GROUP BY issue_key
            ) w ON w.issue_key = i.issue_key
            WHERE i.time_original_estimate >= 3600  -- at least 1 hour estimated (filter noise)
              AND i.status_category = 'done'
              AND i.created_at >= NOW() - INTERVAL '1 day' * ?
              AND LOWER(i.issue_type) NOT IN ('epic','sub-task')
              """ + projectFilter + """
            ORDER BY ABS(COALESCE(w.total_spent, i.time_spent, 0)::numeric /
                NULLIF(i.time_original_estimate, 0) - 1) DESC
            LIMIT 100
            """, days);

        // Summary stats
        // Cap avg at 200% — extreme outliers from issues with tiny estimates skew the mean
        double avgAccuracy = Math.min(200.0, issues.stream()
            .filter(r -> r.get("accuracy_pct") != null)
            .mapToDouble(r -> nvl(r.get("accuracy_pct")))
            .average().orElse(100));

        long overEstimated  = issues.stream().filter(r -> nvl(r.get("accuracy_pct")) < 80).count();
        long underEstimated = issues.stream().filter(r -> nvl(r.get("accuracy_pct")) > 130).count();
        long accurate       = issues.size() - overEstimated - underEstimated;

        return ResponseEntity.ok(Map.of(
            "issues", issues,
            "avg_accuracy_pct", Math.round(avgAccuracy * 10) / 10.0,
            "over_estimated", overEstimated,   // took less time than planned
            "under_estimated", underEstimated, // took more time than planned
            "accurate", accurate,
            "days_range", days
        ));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // EFFICIENCY
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * P0 — Aging WIP
     * Issues currently in progress, color-coded by how long they've been stuck.
     */
    @GetMapping("/efficiency/aging-wip")
    public ResponseEntity<Map<String, Object>> agingWip(
            @RequestParam(required = false) String projectKey) {

        String projectFilter = projectKey != null ? "AND i.project_key = '" + projectKey + "'" : "";

        List<Map<String, Object>> wip = jdbc.queryForList("""
            SELECT
                i.issue_key, i.summary, i.issue_type, i.status_name,
                i.assignee_display_name, i.priority_name, i.project_key,
                i.epic_key,
                ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(
                    -- Time since last status change
                    (SELECT MAX(t.transitioned_at) FROM jira_issue_transition t WHERE t.issue_key = i.issue_key),
                    i.updated_at, i.created_at
                ))) / 86400.0, 1) AS days_in_current_status,
                ROUND(EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 86400.0, 1) AS total_age_days,
                CASE
                    WHEN EXTRACT(EPOCH FROM (NOW() - COALESCE(
                        (SELECT MAX(t.transitioned_at) FROM jira_issue_transition t WHERE t.issue_key = i.issue_key),
                        i.updated_at, i.created_at
                    ))) / 86400.0 > 14 THEN 'RED'
                    WHEN EXTRACT(EPOCH FROM (NOW() - COALESCE(
                        (SELECT MAX(t.transitioned_at) FROM jira_issue_transition t WHERE t.issue_key = i.issue_key),
                        i.updated_at, i.created_at
                    ))) / 86400.0 > 7 THEN 'YELLOW'
                    ELSE 'GREEN'
                END AS age_status
            FROM jira_issue i
            WHERE i.status_category NOT IN ('done','new')
              AND LOWER(i.issue_type) NOT IN ('epic','sub-task')
              """ + projectFilter + """
            ORDER BY days_in_current_status DESC
            LIMIT 200
            """);

        Map<String, Long> byColor = new LinkedHashMap<>();
        byColor.put("RED",    wip.stream().filter(r -> "RED".equals(r.get("age_status"))).count());
        byColor.put("YELLOW", wip.stream().filter(r -> "YELLOW".equals(r.get("age_status"))).count());
        byColor.put("GREEN",  wip.stream().filter(r -> "GREEN".equals(r.get("age_status"))).count());

        return ResponseEntity.ok(Map.of(
            "wip_items", wip,
            "total_wip", wip.size(),
            "by_age_color", byColor
        ));
    }

    /**
     * P1 — Queue Time Analysis
     * Time issues spend WAITING between stages. Long queues = process bottleneck.
     */
    @GetMapping("/efficiency/queue-time")
    public ResponseEntity<Map<String, Object>> queueTime(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "90") int days) {

        String projectFilter = projectKey != null ? "AND i.project_key = '" + projectKey + "'" : "";

        // Dev → QA handoff queue: time between "READY FOR TESTING" → "QA IN PROGRESS"
        // Uses DISTINCT ON to avoid Cartesian product when issues bounce multiple times.
        // Takes the EARLIEST QA pick-up after each "ready" state.
        // NOTE: We do NOT filter on status_category='done' because that would exclude
        // issues currently in QA. We include ALL issues that have transitions in the window.
        List<Map<String, Object>> devToQa = jdbc.queryForList("""
            SELECT DISTINCT ON (i.issue_key)
                i.issue_key, i.summary, i.assignee_display_name, i.project_key,
                ROUND(EXTRACT(EPOCH FROM (
                    (SELECT MIN(tqa.transitioned_at)
                     FROM jira_issue_transition tqa
                     WHERE tqa.issue_key = i.issue_key
                       AND UPPER(tqa.to_status) IN (
                           'QA IN PROGRESS','QA STARTED','IN QA','TESTING IN PROGRESS',
                           'QA COMPLETED','READY FOR TESTING'
                       )
                       AND tqa.transitioned_at > tdev.transitioned_at
                    ) - tdev.transitioned_at
                )) / 3600.0, 1) AS queue_hours
            FROM jira_issue i
            JOIN jira_issue_transition tdev ON tdev.issue_key = i.issue_key
                AND UPPER(tdev.to_status) IN (
                    'READY FOR TESTING','DEVELOPMENT COMPLETE','READY FOR QA',
                    'QA READY','WAITING FOR QA','IN TESTING','QA COMPLETED'
                )
            WHERE i.created_at >= NOW() - INTERVAL '1 day' * ?
              AND LOWER(i.issue_type) NOT IN ('epic','sub-task')
              """ + projectFilter + """
              AND EXISTS (
                  SELECT 1 FROM jira_issue_transition tqa2
                  WHERE tqa2.issue_key = i.issue_key
                    AND UPPER(tqa2.to_status) IN (
                        'QA IN PROGRESS','QA STARTED','IN QA','TESTING IN PROGRESS',
                        'QA COMPLETED','READY FOR TESTING'
                    )
                    AND tqa2.transitioned_at > tdev.transitioned_at
              )
            ORDER BY i.issue_key, tdev.transitioned_at DESC
            LIMIT 100
            """, days);

        // Also show the actual status names in the transition table so users can verify
        List<Map<String, Object>> actualStatuses = jdbc.queryForList("""
            SELECT UPPER(to_status) AS status, COUNT(*) AS cnt
            FROM jira_issue_transition
            WHERE issue_key IN (
                SELECT issue_key FROM jira_issue WHERE created_at >= NOW() - INTERVAL '1 day' * ?
            )
            GROUP BY UPPER(to_status)
            ORDER BY cnt DESC
            LIMIT 20
            """, days);

        double avgDevToQa = devToQa.stream().mapToDouble(r -> nvl(r.get("queue_hours"))).average().orElse(0);

        return ResponseEntity.ok(Map.of(
            "dev_to_qa_queue", devToQa,
            "avg_dev_to_qa_hours", Math.round(avgDevToQa * 10) / 10.0,
            "days_range", days,
            "actual_statuses_in_db", actualStatuses,  // debug: shows what statuses exist in transitions table
            "data_available", !actualStatuses.isEmpty(),
            "insight", devToQa.isEmpty() && actualStatuses.isEmpty()
                ? "NO DATA: Transition history not yet synced. Click 'Backfill History' on the page header to load historical data."
                : avgDevToQa > 8
                ? "HIGH: Dev → QA queue exceeds 8 hours. Consider dedicated QA slots or pull-based QA workflow."
                : avgDevToQa > 4 ? "MODERATE: Dev → QA queue is 4-8 hours."
                : "GOOD: Dev → QA queue is under 4 hours."
        ));
    }

    /**
     * P2 — Batch Size vs Cycle Time
     * Do smaller stories ship faster? Plot story_points vs cycle_time to prove it.
     */
    @GetMapping("/efficiency/batch-size-vs-cycle-time")
    public ResponseEntity<Map<String, Object>> batchSizeVsCycleTime(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "90") int days) {

        String projectFilter = projectKey != null ? "AND i.project_key = '" + projectKey + "'" : "";

        // Cycle time = first "In Dev" transition → last "Done/Closed" transition
        // Use COALESCE(resolution_date, updated_at) as fallback for cycle end when no transitions
        List<Map<String, Object>> data = jdbc.queryForList("""
            SELECT
                i.issue_key, i.summary,
                COALESCE(i.story_points, 0) AS story_points,
                (SELECT COUNT(*) FROM jira_issue s2
                 WHERE s2.parent_key = i.issue_key AND LOWER(s2.issue_type) = 'sub-task') AS subtask_count,
                COALESCE(
                    -- prefer transition-based cycle time when transitions exist
                    ROUND(EXTRACT(EPOCH FROM (
                        COALESCE(
                            (SELECT MAX(td.transitioned_at) FROM jira_issue_transition td
                             WHERE td.issue_key = i.issue_key
                               AND UPPER(td.to_status) IN ('QA COMPLETED','DONE','CLOSED','RESOLVED')),
                            COALESCE(i.resolution_date, i.updated_at)
                        ) -
                        (SELECT MIN(ts.transitioned_at) FROM jira_issue_transition ts
                         WHERE ts.issue_key = i.issue_key
                           AND UPPER(ts.to_status) IN ('IN DEVELOPMENT','IN PROGRESS','DEVELOPMENT','IN DEV'))
                    )) / 3600.0, 1),
                    -- fallback: total calendar time from created to done
                    ROUND(EXTRACT(EPOCH FROM (COALESCE(i.resolution_date, i.updated_at) - i.created_at)) / 3600.0, 1)
                ) AS cycle_hours
            FROM jira_issue i
            WHERE LOWER(i.issue_type) IN ('story','task','user story')
              AND i.status_category = 'done'
              AND i.created_at >= NOW() - INTERVAL '1 day' * ?
              AND COALESCE(i.resolution_date, i.updated_at) > i.created_at
              """ + projectFilter + """
            ORDER BY story_points ASC
            LIMIT 200
            """, days);

        // Bucket by SP
        Map<String, Double> avgByBucket = new LinkedHashMap<>();
        Map<String, Long>   countByBucket = new LinkedHashMap<>();
        data.forEach(r -> {
            int sp = ((Number) r.get("story_points")).intValue();
            String bucket = sp <= 1 ? "1 SP" : sp <= 3 ? "2-3 SP" : sp <= 5 ? "4-5 SP" : "6+ SP";
            avgByBucket.merge(bucket, nvl(r.get("cycle_hours")), Double::sum);
            countByBucket.merge(bucket, 1L, Long::sum);
        });
        avgByBucket.replaceAll((k, v) -> Math.round(v / countByBucket.get(k) * 10) / 10.0);

        return ResponseEntity.ok(Map.of("data", data, "avg_cycle_by_sp_bucket", avgByBucket, "days_range", days));
    }

    /**
     * P2 — Context Switching Score
     * Per developer per sprint: how many different epics/projects did they touch?
     * High context switching → low completion rate.
     */
    @GetMapping("/efficiency/context-switching")
    public ResponseEntity<Map<String, Object>> contextSwitching(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "5") int sprints) {

        String projectFilter = projectKey != null ? "AND js.project_key = '" + projectKey + "'" : "";

        // Context Switching: use both closed AND active sprints, sorted by recency
        // When no project filter, show data from ALL recent sprints across projects
        String sprintProjectFilter = projectKey != null ? "AND project_key = '" + projectKey + "'" : "";
        List<Map<String, Object>> data = jdbc.queryForList("""
            SELECT
                i.assignee_display_name AS assignee,
                js.name AS sprint_name,
                js.sprint_jira_id,
                COUNT(DISTINCT i.issue_key) AS total_issues,
                COUNT(DISTINCT COALESCE(i.epic_key, i.project_key)) AS contexts,
                COUNT(DISTINCT i.project_key) AS projects,
                COUNT(*) FILTER (WHERE i.status_category = 'done') AS completed
            FROM jira_issue i
            JOIN jira_sprint_issue si ON si.issue_key = i.issue_key
            JOIN jira_sprint js ON js.sprint_jira_id = si.sprint_jira_id
            WHERE js.state IN ('closed','active')
              AND i.assignee_display_name IS NOT NULL
              AND LOWER(i.issue_type) NOT IN ('epic','sub-task')
              """ + projectFilter + """
              AND js.sprint_jira_id IN (
                  SELECT sprint_jira_id FROM jira_sprint
                  WHERE state IN ('closed','active')
                    AND complete_date IS NOT NULL
                  """ + sprintProjectFilter + """
                  ORDER BY complete_date DESC NULLS LAST LIMIT ?
              )
            GROUP BY i.assignee_display_name, js.name, js.sprint_jira_id
            HAVING COUNT(DISTINCT i.issue_key) > 0
            ORDER BY contexts DESC, total_issues DESC
            """, sprints);

        // Compute completion rate per person
        data.forEach(r -> {
            long total = ((Number) r.get("total_issues")).longValue();
            long done  = ((Number) r.get("completed")).longValue();
            r.put("completion_rate_pct", total > 0 ? Math.round((double) done / total * 1000) / 10.0 : 0.0);
        });

        return ResponseEntity.ok(Map.of("data", data, "sprints_range", sprints));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TRACKING
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * P1 — Sprint Carryover Debt
     * Issues appearing in multiple consecutive sprints without being completed.
     */
    @GetMapping("/tracking/sprint-carryover")
    public ResponseEntity<Map<String, Object>> sprintCarryover(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "3") int minSprints) {

        String projectFilter = projectKey != null ? "AND i.project_key = '" + projectKey + "'" : "";

        List<Map<String, Object>> zombies = jdbc.queryForList("""
            SELECT i.issue_key, i.summary, i.issue_type, i.assignee_display_name,
                   i.status_name, i.priority_name, i.project_key,
                   COUNT(DISTINCT si.sprint_jira_id) AS sprint_count,
                   MIN(js.start_date)  AS first_seen,
                   MAX(js.start_date)  AS last_seen
            FROM jira_issue i
            JOIN jira_sprint_issue si ON si.issue_key = i.issue_key
            JOIN jira_sprint js ON js.sprint_jira_id = si.sprint_jira_id
            WHERE i.status_category != 'done'
              AND LOWER(i.issue_type) NOT IN ('epic')
              """ + projectFilter + """
            GROUP BY i.issue_key, i.summary, i.issue_type, i.assignee_display_name,
                     i.status_name, i.priority_name, i.project_key
            HAVING COUNT(DISTINCT si.sprint_jira_id) >= ?
            ORDER BY sprint_count DESC, first_seen ASC
            LIMIT 50
            """, minSprints);

        return ResponseEntity.ok(Map.of(
            "zombie_issues", zombies,
            "zombie_count", zombies.size(),
            "min_sprints_threshold", minSprints
        ));
    }

    /**
     * P1 — Epic Burndown + Completion Prediction
     * Per epic: % of child stories done. Predicts completion based on current velocity.
     */
    @GetMapping("/tracking/epic-burndown")
    public ResponseEntity<List<Map<String, Object>>> epicBurndown(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "2") int velocitySprintAvg) {

        String projectFilter = projectKey != null ? "AND e.project_key = '" + projectKey + "'" : "";

        // Join on BOTH classic epic link (epic_key) AND next-gen parent link (parent_key).
        // Jira classic projects: stories have epic_key = epic's issue_key
        // Jira next-gen/team-managed: stories have parent_key = epic's issue_key
        // Without joining both, next-gen stories are invisible → shows fake 100%.
        List<Map<String, Object>> epics = jdbc.queryForList("""
            SELECT
                e.issue_key AS epic_key,
                e.summary AS epic_name,
                e.status_name, e.project_key,
                COUNT(s.issue_key) AS total_stories,
                COUNT(s.issue_key) FILTER (WHERE s.status_category = 'done') AS done_stories,
                COUNT(s.issue_key) FILTER (WHERE s.status_category != 'done') AS remaining_stories,
                ROUND((COUNT(s.issue_key) FILTER (WHERE s.status_category = 'done')::numeric /
                    NULLIF(COUNT(s.issue_key), 0) * 100), 1) AS completion_pct
            FROM jira_issue e
            LEFT JOIN jira_issue s ON (
                    s.epic_key  = e.issue_key    -- classic Jira: epic link custom field
                 OR s.parent_key = e.issue_key   -- next-gen Jira: parent relationship
                )
                AND LOWER(s.issue_type) NOT IN ('epic','sub-task')
            WHERE LOWER(e.issue_type) = 'epic'
              AND e.status_category != 'done'
              """ + projectFilter + """
            GROUP BY e.issue_key, e.summary, e.status_name, e.project_key
            HAVING COUNT(s.issue_key) > 0
            ORDER BY completion_pct ASC, remaining_stories DESC  -- least complete first
            LIMIT 30
            """);

        // Add velocity-based prediction
        epics.forEach(r -> {
            long remaining = ((Number) r.get("remaining_stories")).longValue();
            // Simple: assume velocity of 3 stories/sprint if no data
            double sprintsNeeded = velocitySprintAvg > 0 ? Math.ceil((double) remaining / velocitySprintAvg) : -1;
            r.put("estimated_sprints_remaining", remaining > 0 ? sprintsNeeded : 0);
        });

        return ResponseEntity.ok(epics);
    }

    /**
     * P2 — Release Readiness Score
     * For each fix_version: completion %, blockers, outstanding count.
     */
    @GetMapping("/tracking/release-readiness")
    public ResponseEntity<List<Map<String, Object>>> releaseReadiness(
            @RequestParam(required = false) String projectKey) {

        String projectFilter = projectKey != null ? "AND i.project_key = '" + projectKey + "'" : "";

        return ResponseEntity.ok(jdbc.queryForList("""
            SELECT
                fv.fix_version AS version_name,
                COUNT(DISTINCT i.issue_key) AS total_issues,
                COUNT(DISTINCT i.issue_key) FILTER (WHERE i.status_category = 'done') AS done,
                COUNT(DISTINCT i.issue_key) FILTER (WHERE i.status_category != 'done') AS remaining,
                ROUND(COUNT(DISTINCT i.issue_key) FILTER (WHERE i.status_category = 'done')::numeric /
                    NULLIF(COUNT(DISTINCT i.issue_key), 0) * 100, 1) AS completion_pct,
                COUNT(DISTINCT i.issue_key) FILTER (
                    WHERE UPPER(i.status_name) IN ('BLOCKED','IMPEDIMENT')
                ) AS blockers
            FROM jira_issue i
            JOIN jira_issue_fix_version fv ON fv.issue_key = i.issue_key
            WHERE LOWER(i.issue_type) NOT IN ('epic','sub-task')
              """ + projectFilter + """
            GROUP BY fv.fix_version
            ORDER BY completion_pct DESC
            LIMIT 20
            """));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FORECASTING
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * P2 — Velocity Forecasting (Monte Carlo)
     * Given current backlog size, predict completion date with confidence intervals.
     */
    @GetMapping("/forecasting/velocity-forecast")
    public ResponseEntity<Map<String, Object>> velocityForecast(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "6") int historySprints,
            @RequestParam(defaultValue = "30") int backlogSize) {

        String projectFilter = projectKey != null ? "AND js.project_key = '" + projectKey + "'" : "";

        List<Map<String, Object>> sprintVelocities = jdbc.queryForList("""
            SELECT js.name, js.sprint_jira_id,
                   COUNT(i.issue_key) AS throughput
            FROM jira_sprint js
            JOIN jira_sprint_issue si ON si.sprint_jira_id = js.sprint_jira_id
            JOIN jira_issue i ON i.issue_key = si.issue_key
                AND i.status_category = 'done'
                AND LOWER(i.issue_type) NOT IN ('epic','sub-task')
            WHERE js.state = 'closed'
              """ + projectFilter + """
            GROUP BY js.name, js.sprint_jira_id
            ORDER BY js.sprint_jira_id DESC
            LIMIT ?
            """, historySprints);

        if (sprintVelocities.isEmpty()) {
            return ResponseEntity.ok(Map.of("error", "No closed sprint data available for forecasting"));
        }

        double[] velocities = sprintVelocities.stream()
            .mapToDouble(r -> ((Number) r.get("throughput")).doubleValue()).toArray();

        double avg  = Arrays.stream(velocities).average().orElse(1);
        double min  = Arrays.stream(velocities).min().orElse(1);
        double max  = Arrays.stream(velocities).max().orElse(avg);
        double stdDev = Math.sqrt(Arrays.stream(velocities).map(v -> Math.pow(v - avg, 2)).average().orElse(0));

        // Monte Carlo: 1000 simulations
        int SIMS = 1000;
        int[] sprintsNeeded = new int[SIMS];
        Random rnd = new Random(42);
        for (int sim = 0; sim < SIMS; sim++) {
            int remaining = backlogSize;
            int s = 0;
            while (remaining > 0 && s < 50) {
                // Sample velocity from normal distribution around historical avg
                double sampledV = Math.max(1, avg + (rnd.nextGaussian() * stdDev));
                remaining -= (int) sampledV;
                s++;
            }
            sprintsNeeded[sim] = s;
        }
        Arrays.sort(sprintsNeeded);

        return ResponseEntity.ok(Map.of(
            "history", sprintVelocities,
            "avg_velocity", Math.round(avg * 10) / 10.0,
            "min_velocity", (int) min,
            "max_velocity", (int) max,
            "backlog_size", backlogSize,
            "forecast_50th_pct_sprints", sprintsNeeded[SIMS / 2],
            "forecast_80th_pct_sprints", sprintsNeeded[(int)(SIMS * 0.8)],
            "forecast_90th_pct_sprints", sprintsNeeded[(int)(SIMS * 0.9)]
        ));
    }

    /**
     * P2 — Optimal Sprint Capacity
     * What sprint size gives the best predictability?
     */
    @GetMapping("/forecasting/optimal-capacity")
    public ResponseEntity<Map<String, Object>> optimalCapacity(
            @RequestParam(required = false) String projectKey) {

        String projectFilter = projectKey != null ? "AND js.project_key = '" + projectKey + "'" : "";

        List<Map<String, Object>> data = jdbc.queryForList("""
            SELECT
                js.sprint_jira_id, js.name,
                COUNT(si.issue_key) FILTER (
                    WHERE i.created_at::date <= js.start_date::date
                ) AS committed,
                COUNT(si.issue_key) FILTER (
                    WHERE i.status_category = 'done'
                ) AS completed
            FROM jira_sprint js
            JOIN jira_sprint_issue si ON si.sprint_jira_id = js.sprint_jira_id
            JOIN jira_issue i ON i.issue_key = si.issue_key
                AND LOWER(i.issue_type) NOT IN ('epic','sub-task')
            WHERE js.state = 'closed'
              AND js.start_date IS NOT NULL
              """ + projectFilter + """
            GROUP BY js.sprint_jira_id, js.name
            HAVING COUNT(si.issue_key) FILTER (
                WHERE i.created_at::date <= js.start_date::date
            ) > 0
            ORDER BY js.sprint_jira_id DESC
            LIMIT 20
            """);

        // Bucket sprints by committed size
        Map<String, List<Double>> buckets = new LinkedHashMap<>();
        data.forEach(r -> {
            long committed = ((Number) r.get("committed")).longValue();
            long completed = ((Number) r.get("completed")).longValue();
            String bucket = committed <= 5 ? "1-5" : committed <= 10 ? "6-10"
                          : committed <= 15 ? "11-15" : committed <= 20 ? "16-20" : "21+";
            double pct = committed > 0 ? (double) completed / committed * 100 : 0;
            buckets.computeIfAbsent(bucket, k -> new ArrayList<>()).add(pct);
        });

        Map<String, Object> analysis = new LinkedHashMap<>();
        buckets.forEach((k, v) -> analysis.put(k, Map.of(
            "sprint_count", v.size(),
            "avg_predictability_pct", Math.round(v.stream().mapToDouble(d -> d).average().orElse(0) * 10) / 10.0
        )));

        return ResponseEntity.ok(Map.of("by_sprint_size", analysis, "raw", data));
    }

    /**
     * P2 — Risk Auto-Detection
     * Flag teams/sprints showing warning patterns: high WIP + dropping velocity + rising bugs.
     */
    @GetMapping("/forecasting/risk-detection")
    public ResponseEntity<List<Map<String, Object>>> riskDetection(
            @RequestParam(required = false) String projectKey) {

        String projectFilter = projectKey != null ? "AND js.project_key = '" + projectKey + "'" : "";

        List<Map<String, Object>> boards = jdbc.queryForList("""
            SELECT DISTINCT board_id, project_key FROM jira_sprint
            WHERE state IN ('active','closed') AND board_id IS NOT NULL
            """ + (projectKey != null ? "AND project_key = '" + projectKey + "'" : "") + """
            ORDER BY board_id
            """);

        List<Map<String, Object>> risks = new ArrayList<>();
        for (Map<String, Object> board : boards) {
            Long boardId = ((Number) board.get("board_id")).longValue();
            String pk    = (String) board.get("project_key");

            // Get last 3 sprints velocity
            List<Map<String, Object>> recentSprints = jdbc.queryForList("""
                SELECT js.name, COUNT(i.issue_key) AS done
                FROM jira_sprint js
                JOIN jira_sprint_issue si ON si.sprint_jira_id = js.sprint_jira_id
                JOIN jira_issue i ON i.issue_key = si.issue_key AND i.status_category = 'done'
                WHERE js.board_id = ? AND js.state = 'closed'
                GROUP BY js.name, js.sprint_jira_id ORDER BY js.sprint_jira_id DESC LIMIT 3
                """, boardId);

            if (recentSprints.size() < 2) continue;

            double v1 = nvl(recentSprints.get(0).get("done"));
            double v2 = nvl(recentSprints.get(1).get("done"));
            boolean velocityDropping = v1 < v2 * 0.7; // >30% drop

            long currentWip = jdbc.queryForObject(
                "SELECT COUNT(*) FROM jira_issue WHERE project_key = ? AND status_category NOT IN ('done','new') "
                + "AND LOWER(issue_type) NOT IN ('epic','sub-task')", Long.class, pk);

            long recentBugs = jdbc.queryForObject(
                "SELECT COUNT(*) FROM jira_issue WHERE project_key = ? "
                + "AND LOWER(issue_type) IN ('bug','defect') AND created_at >= NOW() - INTERVAL '14 days'",
                Long.class, pk);

            List<String> flags = new ArrayList<>();
            int riskScore = 0;
            if (velocityDropping) { flags.add("Velocity dropped >30% vs previous sprint"); riskScore += 3; }
            if (currentWip > 20)  { flags.add("High WIP (" + currentWip + " items in progress)"); riskScore += 2; }
            if (recentBugs > 10)  { flags.add("Bug spike (" + recentBugs + " bugs in last 14 days)"); riskScore += 2; }

            if (riskScore > 0) {
                risks.add(Map.of(
                    "board_id", boardId, "project_key", pk,
                    "risk_score", riskScore,
                    "risk_level", riskScore >= 5 ? "HIGH" : riskScore >= 3 ? "MEDIUM" : "LOW",
                    "flags", flags,
                    "current_wip", currentWip,
                    "recent_bugs", recentBugs,
                    "velocity_trend", Map.of("last", v1, "previous", v2)
                ));
            }
        }
        risks.sort((a, b) -> Integer.compare(((Number)b.get("risk_score")).intValue(),
                                             ((Number)a.get("risk_score")).intValue()));
        return ResponseEntity.ok(risks);
    }

    /**
     * P2 — Developer Growth Tracking
     * Over 6 months, is a developer's cycle time improving? Are they taking harder stories?
     */
    @GetMapping("/forecasting/developer-growth")
    public ResponseEntity<List<Map<String, Object>>> developerGrowth(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "6") int months) {

        String projectFilter = projectKey != null ? "AND i.project_key = '" + projectKey + "'" : "";

        return ResponseEntity.ok(jdbc.queryForList("""
            SELECT
                i.assignee_display_name AS developer,
                DATE_TRUNC('month', i.created_at) AS month,
                COUNT(i.issue_key) AS issues_completed,
                ROUND(AVG(COALESCE(i.story_points, 0))::numeric, 1) AS avg_complexity,
                ROUND(AVG(EXTRACT(EPOCH FROM (i.resolution_date - i.created_at)) / 86400.0)::numeric, 1)
                    AS avg_cycle_days
            FROM jira_issue i
            WHERE i.status_category = 'done'
              AND i.resolution_date IS NOT NULL
              AND i.assignee_display_name IS NOT NULL
              AND i.created_at >= NOW() - INTERVAL '1 month' * ?
              AND LOWER(i.issue_type) NOT IN ('epic','sub-task')
              """ + projectFilter + """
            GROUP BY i.assignee_display_name, DATE_TRUNC('month', i.created_at)
            ORDER BY i.assignee_display_name, month
            """, months));
    }

    /**
     * P2 — Cross-team Dependency Map
     * Issues in one project blocked by / linked to issues in another project.
     */
    @GetMapping("/forecasting/cross-team-dependencies")
    public ResponseEntity<Map<String, Object>> crossTeamDependencies() {
        // Use parent_key relationships across projects as proxy for dependencies
        List<Map<String, Object>> deps = jdbc.queryForList("""
            SELECT child.issue_key AS blocked_issue,
                   child.summary   AS blocked_summary,
                   child.project_key AS blocked_project,
                   child.status_name,
                   parent.issue_key AS blocks_issue,
                   parent.summary   AS blocks_summary,
                   parent.project_key AS blocks_project,
                   parent.status_category AS blocker_status
            FROM jira_issue child
            JOIN jira_issue parent ON parent.issue_key = child.parent_key
            WHERE child.project_key != parent.project_key
              AND child.status_category != 'done'
            ORDER BY child.project_key, parent.project_key
            LIMIT 100
            """);

        // Matrix: which project blocks which
        Map<String, Map<String, Long>> matrix = new LinkedHashMap<>();
        deps.forEach(r -> {
            String blocked = (String) r.get("blocked_project");
            String blocker = (String) r.get("blocks_project");
            matrix.computeIfAbsent(blocked, k -> new LinkedHashMap<>())
                  .merge(blocker, 1L, Long::sum);
        });

        return ResponseEntity.ok(Map.of("dependencies", deps, "matrix", matrix));
    }

    /**
     * P2 — Seasonal Patterns
     * Aggregate productivity by month across years. Find dips and spikes.
     */
    @GetMapping("/forecasting/seasonal-patterns")
    public ResponseEntity<List<Map<String, Object>>> seasonalPatterns(
            @RequestParam(required = false) String projectKey) {

        String projectFilter = projectKey != null ? "AND project_key = '" + projectKey + "'" : "";

        return ResponseEntity.ok(jdbc.queryForList("""
            SELECT
                EXTRACT(YEAR  FROM resolution_date) AS year,
                EXTRACT(MONTH FROM resolution_date) AS month,
                TO_CHAR(resolution_date, 'Mon') AS month_name,
                COUNT(*)  AS issues_completed,
                COUNT(*) FILTER (WHERE LOWER(issue_type) IN ('bug','defect')) AS bugs_resolved,
                COUNT(*) FILTER (WHERE LOWER(issue_type) = 'story') AS stories_completed,
                ROUND(AVG(COALESCE(story_points, 0))::numeric, 1) AS avg_sp
            FROM jira_issue
            WHERE resolution_date IS NOT NULL
              AND status_category = 'done'
              AND LOWER(issue_type) NOT IN ('epic','sub-task')
              AND resolution_date >= NOW() - INTERVAL '2 years'
              """ + projectFilter + """
            GROUP BY EXTRACT(YEAR FROM resolution_date),
                     EXTRACT(MONTH FROM resolution_date),
                     TO_CHAR(resolution_date, 'Mon')
            ORDER BY year, month
            """));
    }

    /**
     * Returns distinct project keys for the project filter dropdown.
     */
    @GetMapping("/projects")
    public ResponseEntity<Map<String, Object>> getProjects() {
        List<String> keys = jdbc.queryForList(
            "SELECT DISTINCT project_key FROM jira_issue WHERE project_key IS NOT NULL ORDER BY project_key",
            String.class);
        return ResponseEntity.ok(Map.of("projects", keys));
    }

    /**
     * Returns the status of transition data sync — used by the Backfill History button
     * to show last synced timestamp and coverage.
     */
    @GetMapping("/backfill-status")
    public ResponseEntity<Map<String, Object>> backfillStatus() {
        Long totalIssues = jdbc.queryForObject(
            "SELECT COUNT(DISTINCT i.issue_key) FROM jira_issue i "
            + "JOIN jira_sprint_issue si ON si.issue_key = i.issue_key "
            + "JOIN jira_sprint js ON js.sprint_jira_id = si.sprint_jira_id "
            + "WHERE js.state IN ('closed','active') AND LOWER(i.issue_type) NOT IN ('epic','sub-task')",
            Long.class);

        Long synced = jdbc.queryForObject(
            "SELECT COUNT(DISTINCT issue_key) FROM jira_issue_transition", Long.class);

        Object lastSynced = jdbc.queryForList(
            "SELECT MAX(transitioned_at) FROM jira_issue_transition").stream()
            .findFirst().map(r -> r.get("max")).orElse(null);

        long pending = Math.max(0, (totalIssues != null ? totalIssues : 0) - (synced != null ? synced : 0));
        int coverage = (totalIssues != null && totalIssues > 0 && synced != null)
            ? (int)(synced * 100 / totalIssues) : 0;

        return ResponseEntity.ok(Map.of(
            "total_sprint_issues", totalIssues != null ? totalIssues : 0,
            "issues_with_transitions", synced != null ? synced : 0,
            "issues_pending", pending,
            "coverage_pct", Math.min(100, coverage),
            "last_synced_at", lastSynced != null ? lastSynced.toString() : null,
            "is_complete", pending == 0
        ));
    }

    /**
     * Backfill historical transitions — fetches Jira changelogs for issues in closed sprints
     * that don't yet have transition records. Runs async, returns progress count.
     * Call once to populate jira_issue_transition for all historical sprint issues.
     */
    @PostMapping("/backfill-transitions")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Map<String, Object>> backfillTransitions(
            @RequestParam(defaultValue = "10000") int maxIssues) {

        // Find issues in closed sprints that have no transition records yet
        List<String> issueKeys = jdbc.queryForList("""
            SELECT DISTINCT i.issue_key
            FROM jira_issue i
            JOIN jira_sprint_issue si ON si.issue_key = i.issue_key
            JOIN jira_sprint js ON js.sprint_jira_id = si.sprint_jira_id
            WHERE js.state = 'closed'
              AND LOWER(i.issue_type) NOT IN ('epic', 'sub-task')
              AND NOT EXISTS (
                  SELECT 1 FROM jira_issue_transition t WHERE t.issue_key = i.issue_key
              )
            ORDER BY i.issue_key
            LIMIT ?
            """, String.class, maxIssues);

        if (issueKeys.isEmpty()) {
            return ResponseEntity.ok(Map.of("status", "COMPLETE", "message",
                "All closed sprint issues already have transition data.", "synced", 0));
        }

        // Run backfill async so request returns immediately
        int[] counter = {0};
        new Thread(() -> {
            for (String key : issueKeys) {
                try {
                    List<Map<String, Object>> changes = jiraClient.getIssueChangelog(key);
                    if (changes.isEmpty()) continue;
                    for (Map<String, Object> c : changes) {
                        com.portfolioplanner.domain.model.JiraIssueTransition t =
                                new com.portfolioplanner.domain.model.JiraIssueTransition();
                        t.setIssueKey(key);
                        t.setFromStatus((String) c.get("fromStatus"));
                        t.setToStatus((String) c.get("toStatus"));
                        t.setAuthorName((String) c.get("authorName"));
                        String created = (String) c.get("created");
                        if (created != null) {
                            // Use shared parser that handles Jira's "+0000" (no-colon) timezone format
                            t.setTransitionedAt(com.portfolioplanner.service.jira.JiraIssueSyncService.parseJiraTimestamp(created));
                        }
                        // Use upsert to skip duplicates (constraint: issue_key + transitioned_at + to_status)
                        jdbc.update("""
                            INSERT INTO jira_issue_transition
                              (issue_key, from_status, to_status, author_name, transitioned_at)
                            VALUES (?, ?, ?, ?, ?)
                            ON CONFLICT ON CONSTRAINT uq_issue_transition DO NOTHING
                            """,
                            t.getIssueKey(), t.getFromStatus(), t.getToStatus(),
                            t.getAuthorName(), t.getTransitionedAt());
                    }
                    counter[0]++;
                    // Small delay to avoid Jira rate limiting
                    if (counter[0] % 50 == 0) {
                        try { Thread.sleep(1000); } catch (InterruptedException ignored) {}
                    }
                } catch (Exception e) {
                    log.warn("Backfill skipped for {}: {}", key, e.getMessage());
                }
            }
            log.info("Transition backfill complete: {} issues processed", counter[0]);
        }, "transition-backfill").start();

        return ResponseEntity.accepted().body(Map.of(
            "status", "RUNNING",
            "message", "Backfilling transitions for " + issueKeys.size() + " issues in background. Check back in a few minutes.",
            "issues_to_process", issueKeys.size(),
            "max_requested", maxIssues
        ));
    }

    /**
     * Returns a map of assignee_display_name → avatar_url for all known assignees.
     * Used by the frontend to show Jira avatars next to names.
     */
    @GetMapping("/assignee-avatars")
    public ResponseEntity<Map<String, String>> assigneeAvatars() {
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT DISTINCT assignee_display_name, assignee_avatar_url
            FROM jira_issue
            WHERE assignee_display_name IS NOT NULL
              AND assignee_avatar_url IS NOT NULL
            ORDER BY assignee_display_name
            """);
        Map<String, String> result = new LinkedHashMap<>();
        rows.forEach(r -> result.put(
            (String) r.get("assignee_display_name"),
            (String) r.get("assignee_avatar_url")
        ));
        return ResponseEntity.ok(result);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    private double nvl(Object o) { return o == null ? 0 : ((Number) o).doubleValue(); }

    private String str(Object o, String def) { return o == null ? def : o.toString(); }

    @SuppressWarnings("unchecked")
    private <K> Map<K, Long> sortByValueDesc(Map<K, Long> map) {
        return map.entrySet().stream()
            .sorted(Map.Entry.<K, Long>comparingByValue().reversed())
            .collect(java.util.stream.Collectors.toMap(
                Map.Entry::getKey, Map.Entry::getValue,
                (e1, e2) -> e1, LinkedHashMap::new));
    }
}
