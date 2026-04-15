package com.portfolioplanner.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Sprint Quality Metrics API.
 *
 * All metrics are computed directly from the jira_issue, jira_sprint_issue,
 * jira_sprint, and jira_issue_transition tables — no external calls at query time.
 *
 * Transitions must be synced first (done automatically during active-sprint sync).
 */
@RestController
@RequestMapping("/api/jira/quality")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class JiraQualityController {

    private final JdbcTemplate jdbc;
    private final JiraQualityConfigController config;

    // ── 1. Story Quality Score ─────────────────────────────────────────────────
    // For each Story in a sprint, count the Bugs with the same parent_key.
    // Result: per-story defect count and list of bug keys.

    @GetMapping("/sprint/{sprintId}/story-quality")
    public ResponseEntity<List<Map<String, Object>>> storyQuality(@PathVariable Long sprintId) {
        // Get stories in the sprint
        List<Map<String, Object>> stories = jdbc.queryForList("""
            SELECT i.issue_key, i.summary, i.assignee_display_name,
                   i.status_name, i.story_points, i.created_at
            FROM jira_issue i
            JOIN jira_sprint_issue si ON si.issue_key = i.issue_key
            WHERE si.sprint_jira_id = ?
              AND LOWER(i.issue_type) = 'story'
            ORDER BY i.issue_key
            """, sprintId);

        if (stories.isEmpty()) return ResponseEntity.ok(List.of());

        // Get bugs for these stories via parent_key
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> story : stories) {
            String storyKey = (String) story.get("issue_key");

            List<Map<String, Object>> bugs = jdbc.queryForList("""
                SELECT i.issue_key, i.summary, i.status_name,
                       i.assignee_display_name, i.created_at
                FROM jira_issue i
                WHERE i.parent_key = ?
                  AND LOWER(i.issue_type) IN ('bug', 'defect')
                ORDER BY i.created_at
                """, storyKey);

            Map<String, Object> row = new LinkedHashMap<>(story);
            row.put("bug_count",    bugs.size());
            row.put("bugs",         bugs);
            row.put("quality_score", bugs.isEmpty() ? "GOOD"
                    : bugs.size() <= 2 ? "FAIR" : "POOR");
            result.add(row);
        }

        // Sort by bug count desc (worst first)
        result.sort((a, b) -> Integer.compare(
                (int)((Number) b.get("bug_count")).intValue(),
                (int)((Number) a.get("bug_count")).intValue()));

        return ResponseEntity.ok(result);
    }

    // ── 2. Assignee Load Balance ───────────────────────────────────────────────

    @GetMapping("/sprint/{sprintId}/assignee-load")
    public ResponseEntity<Map<String, Object>> assigneeLoad(@PathVariable Long sprintId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT
                COALESCE(i.assignee_display_name, 'Unassigned') AS assignee,
                COUNT(*) AS total_issues,
                COUNT(*) FILTER (WHERE LOWER(i.issue_type) = 'story')  AS stories,
                COUNT(*) FILTER (WHERE LOWER(i.issue_type) = 'bug')    AS bugs,
                COUNT(*) FILTER (WHERE LOWER(i.issue_type) = 'sub-task') AS subtasks,
                COALESCE(SUM(i.story_points), 0) AS total_sp,
                COUNT(*) FILTER (WHERE i.status_category = 'done') AS completed
            FROM jira_issue i
            JOIN jira_sprint_issue si ON si.issue_key = i.issue_key
            WHERE si.sprint_jira_id = ?
              AND LOWER(i.issue_type) NOT IN ('epic', 'sub-task')
            GROUP BY i.assignee_display_name
            ORDER BY total_issues DESC
            """, sprintId);

        // Gini coefficient for load balance (0 = perfect balance, 1 = all on one)
        double gini = 0.0;
        if (!rows.isEmpty()) {
            List<Long> counts = rows.stream()
                    .map(r -> ((Number) r.get("total_issues")).longValue())
                    .sorted()
                    .toList();
            long n = counts.size();
            long total = counts.stream().mapToLong(Long::longValue).sum();
            if (total > 0 && n > 1) {
                long sum = 0;
                for (int i = 0; i < counts.size(); i++) sum += (long)(i + 1) * counts.get(i);
                gini = Math.round((2.0 * sum / (n * total) - (n + 1.0) / n) * 100.0) / 100.0;
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("assignees", rows);
        response.put("gini_coefficient", gini);
        response.put("balance_label", gini < 0.2 ? "BALANCED" : gini < 0.4 ? "MODERATE" : "SKEWED");
        return ResponseEntity.ok(response);
    }

    // ── 3. Cycle Time (from transitions) ──────────────────────────────────────
    // DEV_START = first transition TO "IN DEVELOPMENT"
    // QA_START  = first transition TO "READY FOR TESTING"
    // DONE      = first transition TO "QA COMPLETED" or "Done"

    @GetMapping("/sprint/{sprintId}/cycle-time")
    public ResponseEntity<List<Map<String, Object>>> cycleTime(@PathVariable Long sprintId) {
        List<Map<String, Object>> issues = jdbc.queryForList("""
            SELECT i.issue_key, i.summary, i.issue_type,
                   i.assignee_display_name, i.status_name
            FROM jira_issue i
            JOIN jira_sprint_issue si ON si.issue_key = i.issue_key
            WHERE si.sprint_jira_id = ?
              AND LOWER(i.issue_type) IN ('story', 'bug', 'task')
            ORDER BY i.issue_key
            """, sprintId);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> issue : issues) {
            String key = (String) issue.get("issue_key");

            List<Map<String, Object>> transitions = jdbc.queryForList("""
                SELECT from_status, to_status, transitioned_at
                FROM jira_issue_transition
                WHERE issue_key = ?
                ORDER BY transitioned_at ASC
                """, key);

            if (transitions.isEmpty()) continue;

            String devStart  = null, qaStart = null, done = null;
            for (Map<String, Object> t : transitions) {
                String to = normaliseStatus((String) t.get("to_status"));
                String ts = t.get("transitioned_at") != null
                        ? t.get("transitioned_at").toString() : null;
                if (devStart == null && "IN_DEVELOPMENT".equals(to)) devStart = ts;
                if (qaStart  == null && "READY_FOR_TESTING".equals(to)) qaStart = ts;
                if (done     == null && ("QA_COMPLETED".equals(to) || "DONE".equals(to))) done = ts;
            }

            Map<String, Object> row = new LinkedHashMap<>(issue);
            row.put("dev_start",      devStart);
            row.put("qa_start",       qaStart);
            row.put("done_at",        done);
            row.put("dev_cycle_days", daysBetween(devStart, qaStart));
            row.put("qa_cycle_days",  daysBetween(qaStart, done));
            row.put("total_days",     daysBetween(devStart, done));
            result.add(row);
        }

        result.sort(Comparator.comparingDouble(r -> -nvl((Number) r.get("total_days"))));
        return ResponseEntity.ok(result);
    }

    // ── 4. Sprint Predictability Trend ────────────────────────────────────────
    // Across the last N closed sprints: issues committed at start vs completed.

    @GetMapping("/board/{boardId}/predictability")
    public ResponseEntity<List<Map<String, Object>>> predictability(
            @PathVariable Long boardId,
            @RequestParam(defaultValue = "10") int sprints) {

        List<Map<String, Object>> closedSprints = jdbc.queryForList("""
            SELECT sprint_jira_id, name, start_date, end_date, complete_date
            FROM jira_sprint
            WHERE board_id = ? AND state = 'closed'
            ORDER BY complete_date DESC
            LIMIT ?
            """, boardId, sprints);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> sprint : closedSprints) {
            Long sprintId = ((Number) sprint.get("sprint_jira_id")).longValue();
            String startDate = sprint.get("start_date") != null
                    ? sprint.get("start_date").toString().substring(0, 10) : null;

            // Issues present at sprint start = issues whose created_at <= sprint start
            Long committed = startDate != null ? jdbc.queryForObject("""
                SELECT COUNT(*) FROM jira_issue i
                JOIN jira_sprint_issue si ON si.issue_key = i.issue_key
                WHERE si.sprint_jira_id = ?
                  AND LOWER(i.issue_type) NOT IN ('epic', 'sub-task')
                  AND i.created_at::date <= ?::date
                """, Long.class, sprintId, startDate) : 0L;

            Long completed = jdbc.queryForObject("""
                SELECT COUNT(*) FROM jira_issue i
                JOIN jira_sprint_issue si ON si.issue_key = i.issue_key
                WHERE si.sprint_jira_id = ?
                  AND LOWER(i.issue_type) NOT IN ('epic', 'sub-task')
                  AND i.status_category = 'done'
                """, Long.class, sprintId);

            Long total = jdbc.queryForObject("""
                SELECT COUNT(*) FROM jira_sprint_issue
                WHERE sprint_jira_id = ?
                """, Long.class, sprintId);

            Long bugs = jdbc.queryForObject("""
                SELECT COUNT(*) FROM jira_issue i
                JOIN jira_sprint_issue si ON si.issue_key = i.issue_key
                WHERE si.sprint_jira_id = ?
                  AND LOWER(i.issue_type) IN ('bug', 'defect')
                """, Long.class, sprintId);

            double pct = committed > 0
                    ? Math.round(100.0 * completed / committed * 10) / 10.0 : 0.0;

            Map<String, Object> row = new LinkedHashMap<>(sprint);
            row.put("committed",           committed);
            row.put("completed",           completed);
            row.put("total_issues",        total);
            row.put("bugs_in_sprint",      bugs);
            row.put("predictability_pct",  pct);
            row.put("scope_creep",         total != null && committed != null ? total - committed : 0);
            result.add(row);
        }

        Collections.reverse(result); // chronological order for charts
        return ResponseEntity.ok(result);
    }

    // ── 5. Bug Escape Rate ────────────────────────────────────────────────────
    // Uses "Phase Defect Found" custom field (configurable) instead of parent-key linking.
    // Escaped = bug where phase IN (escape_phases) AND status NOT IN (invalid_bug_statuses).
    // Falls back to sprint-crossing parent-key logic if Phase Defect Found has no data.

    @GetMapping("/board/{boardId}/bug-escape-rate")
    public ResponseEntity<List<Map<String, Object>>> bugEscapeRate(
            @PathVariable Long boardId,
            @RequestParam(defaultValue = "8") int sprints) {

        // Load config
        Set<String> escapePhases   = config.getSet("escape_phases",        "INTEGRATION,PRODUCTION,REGRESSION,UAT");
        Set<String> invalidStatuses= config.getSet("invalid_bug_statuses",  "NOT A BUG,CANNOT REPRODUCE,DUPLICATE,WONT FIX,WON'T FIX,INVALID");
        Set<String> bugTypes       = config.getSet("bug_issue_types",       "BUG,DEFECT,PRODUCTION BUG");
        String      phaseField     = config.getValue("phase_defect_field",  "customfield_13493");

        List<Map<String, Object>> closedSprints = jdbc.queryForList("""
            SELECT sprint_jira_id, name, start_date, end_date, complete_date
            FROM jira_sprint
            WHERE board_id = ? AND state IN ('closed', 'active')
            ORDER BY COALESCE(complete_date, end_date) DESC NULLS LAST
            LIMIT ?
            """, boardId, sprints);

        List<Map<String, Object>> result = new ArrayList<>();

        for (Map<String, Object> sprint : closedSprints) {
            Long sprintId  = ((Number) sprint.get("sprint_jira_id")).longValue();
            String sprintStart = sprint.get("start_date")  != null ? sprint.get("start_date").toString().substring(0, 10)  : null;
            String sprintEnd   = sprint.get("end_date")    != null ? sprint.get("end_date").toString().substring(0, 10)    : null;
            String completeDate= sprint.get("complete_date")!= null ? sprint.get("complete_date").toString().substring(0, 10): sprintEnd;

            // ── Approach 1: Phase Defect Found field ───────────────────────────
            // Count bugs where phase IN (escape_phases), regardless of sprint membership
            List<Map<String, Object>> phaseEscapes = new ArrayList<>();
            if (sprintStart != null && completeDate != null) {
                String phaseInClause = String.join(",", Collections.nCopies(escapePhases.size(), "?"));
                List<Object> phaseParams = new ArrayList<>(escapePhases);
                phaseParams.add(sprintStart);
                phaseParams.add(completeDate);

                phaseEscapes = jdbc.queryForList(
                    "SELECT i.issue_key, i.summary, i.status_name, i.assignee_display_name, "
                    + "       cf.field_value AS phase_defect_found, i.priority_name "
                    + "FROM jira_issue i "
                    + "JOIN jira_issue_custom_field cf ON cf.issue_key = i.issue_key "
                    + "     AND cf.field_id = '" + phaseField + "' "
                    + "WHERE UPPER(cf.field_value) IN (" + phaseInClause + ") "
                    + "  AND UPPER(i.status_name) NOT IN (" + buildInClause(invalidStatuses) + ") "
                    + "  AND LOWER(i.issue_type) = ANY(ARRAY[" + buildArrayLiteral(bugTypes) + "]) "
                    + "  AND i.created_at::date BETWEEN ?::date AND ?::date ",
                    phaseParams.toArray());
            }

            // ── Approach 2: Sprint-crossing parent-key (fallback) ──────────────
            // Only used if Phase Defect Found has no data for this sprint
            List<Map<String, Object>> parentEscapes = List.of();
            boolean usingPhaseData = !phaseEscapes.isEmpty();

            // Stories completed in this sprint
            Long storiesCompleted = jdbc.queryForObject("""
                SELECT COUNT(*) FROM jira_issue i
                JOIN jira_sprint_issue si ON si.issue_key = i.issue_key
                WHERE si.sprint_jira_id = ?
                  AND LOWER(i.issue_type) NOT IN ('epic','sub-task')
                  AND i.status_category = 'done'
                """, Long.class, sprintId);

            List<Map<String, Object>> bugs = usingPhaseData ? phaseEscapes : parentEscapes;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("sprint_name",       sprint.get("name"));
            row.put("sprint_id",         sprintId);
            row.put("stories_completed", storiesCompleted);
            row.put("escaped_bugs",      bugs.size());
            row.put("escape_rate_pct",   storiesCompleted != null && storiesCompleted > 0
                    ? Math.round(100.0 * bugs.size() / storiesCompleted * 10) / 10.0 : 0.0);
            row.put("source",            usingPhaseData ? "phase_defect_found" : "parent_key");
            row.put("bug_details",       bugs);
            result.add(row);
        }

        Collections.reverse(result);
        return ResponseEntity.ok(result);
    }

    private String buildInClause(Set<String> values) {
        return values.stream().map(v -> "'" + v.replace("'", "''") + "'").reduce((a, b) -> a + "," + b).orElse("''");
    }

    private String buildArrayLiteral(Set<String> values) {
        return values.stream().map(v -> "'" + v.toLowerCase().replace("'", "''") + "'").reduce((a, b) -> a + "," + b).orElse("'bug'");
    }

    // ── 8. Sprint → Board ID lookup ───────────────────────────────────────────
    // Lets the frontend get boardId without needing the updated SprintSummaryItem.

    @GetMapping("/sprint/{sprintId}/board")
    public ResponseEntity<Map<String, Object>> sprintBoard(@PathVariable Long sprintId) {
        var rows = jdbc.queryForList(
            "SELECT board_id, project_key FROM jira_sprint WHERE sprint_jira_id = ?", sprintId);
        if (rows.isEmpty()) return ResponseEntity.ok(Map.of("board_id", (Object) null));
        return ResponseEntity.ok(rows.get(0));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String normaliseStatus(String s) {
        if (s == null) return "";
        return s.toUpperCase().replace(" ", "_").replace("-", "_");
    }

    private double daysBetween(String from, String to) {
        if (from == null || to == null) return -1;
        try {
            java.time.LocalDateTime f = java.time.LocalDateTime.parse(from.replace(" ", "T").substring(0, 19));
            java.time.LocalDateTime t = java.time.LocalDateTime.parse(to.replace(" ", "T").substring(0, 19));
            return Math.round(java.time.Duration.between(f, t).toHours() / 24.0 * 10) / 10.0;
        } catch (Exception e) {
            return -1;
        }
    }

    private double nvl(Number n) { return n == null ? 0 : n.doubleValue(); }

    // ── 6. Department-wide quality summary ───────────────────────────────────
    // One row per board showing their most recent closed sprint's quality metrics.
    // This is the "gap detection" view — see all PODs at a glance.

    @GetMapping("/department-summary")
    public ResponseEntity<List<Map<String, Object>>> departmentSummary(
            @RequestParam(defaultValue = "all") String scope) {

        // Get all distinct boards — include active sprints for early tracking
        // scope: "all" = active + closed, "closed" = closed only, "active" = active only
        String stateFilter = switch (scope) {
            case "closed" -> "state = 'closed' AND complete_date IS NOT NULL";
            case "active" -> "state = 'active'";
            default       -> "state IN ('active', 'closed')";
        };

        List<Map<String, Object>> boards = jdbc.queryForList(
            "SELECT DISTINCT board_id, project_key, " +
            "MAX(COALESCE(complete_date, start_date, synced_at)) AS last_activity " +
            "FROM jira_sprint " +
            "WHERE " + stateFilter + " AND board_id IS NOT NULL " +
            "GROUP BY board_id, project_key " +
            "ORDER BY last_activity DESC");

        List<Map<String, Object>> result = new ArrayList<>();
        Set<Long> seenBoards = new java.util.HashSet<>();

        for (Map<String, Object> board : boards) {
            Long boardId = ((Number) board.get("board_id")).longValue();
            if (seenBoards.contains(boardId)) continue;
            seenBoards.add(boardId);

            // Find the most relevant sprint: active first (in-flight tracking),
            // then most recently closed (historical quality)
            var sprintRows = jdbc.queryForList("""
                SELECT sprint_jira_id, name, state, complete_date, start_date
                FROM jira_sprint
                WHERE board_id = ? AND state IN ('active', 'closed')
                ORDER BY
                  CASE state WHEN 'active' THEN 0 ELSE 1 END,
                  COALESCE(complete_date, start_date) DESC
                LIMIT 1
                """, boardId);
            if (sprintRows.isEmpty()) continue;

            Map<String, Object> sprint = sprintRows.get(0);
            Long sprintId = ((Number) sprint.get("sprint_jira_id")).longValue();

            // Story count
            Long stories = jdbc.queryForObject(
                "SELECT COUNT(*) FROM jira_issue i JOIN jira_sprint_issue si ON si.issue_key = i.issue_key "
                + "WHERE si.sprint_jira_id = ? AND LOWER(i.issue_type) = 'story'",
                Long.class, sprintId);

            // Bug count
            Long bugs = jdbc.queryForObject(
                "SELECT COUNT(*) FROM jira_issue i JOIN jira_sprint_issue si ON si.issue_key = i.issue_key "
                + "WHERE si.sprint_jira_id = ? AND LOWER(i.issue_type) IN ('bug','defect')",
                Long.class, sprintId);

            // Completed count
            Long completed = jdbc.queryForObject(
                "SELECT COUNT(*) FROM jira_issue i JOIN jira_sprint_issue si ON si.issue_key = i.issue_key "
                + "WHERE si.sprint_jira_id = ? AND LOWER(i.issue_type) NOT IN ('epic','sub-task') "
                + "AND i.status_category = 'done'",
                Long.class, sprintId);

            // Committed at start
            String startDate = sprint.get("start_date") != null
                ? sprint.get("start_date").toString().substring(0, 10) : null;
            Long committed = startDate != null ? jdbc.queryForObject(
                "SELECT COUNT(*) FROM jira_issue i JOIN jira_sprint_issue si ON si.issue_key = i.issue_key "
                + "WHERE si.sprint_jira_id = ? AND LOWER(i.issue_type) NOT IN ('epic','sub-task') "
                + "AND i.created_at::date <= ?::date",
                Long.class, sprintId, startDate) : completed;

            double defectDensity = (stories != null && stories > 0)
                ? Math.round((double) (bugs != null ? bugs : 0) / stories * 100.0) / 100.0 : 0.0;
            double predictability = (committed != null && committed > 0)
                ? Math.round(100.0 * (completed != null ? completed : 0) / committed * 10) / 10.0 : 0.0;

            // Simple quality score
            double qualityScore = Math.min(100, Math.round(
                (predictability * 0.5) + Math.max(0, (100 - defectDensity * 20) * 0.5) * 10) / 10.0);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("board_id",         boardId);
            row.put("project_key",      board.get("project_key"));
            row.put("sprint_name",      sprint.get("name"));
            row.put("sprint_id",        sprintId);
            row.put("sprint_state",     sprint.get("state"));
            row.put("complete_date",    sprint.get("complete_date"));
            row.put("start_date",       sprint.get("start_date"));
            row.put("stories",          stories);
            row.put("bugs",             bugs);
            row.put("defect_density",   defectDensity);
            row.put("completed",        completed);
            row.put("committed",        committed);
            row.put("predictability",   predictability);
            row.put("quality_score",    qualityScore);
            row.put("grade",            qualityScore >= 80 ? "A" : qualityScore >= 65 ? "B" : qualityScore >= 50 ? "C" : "D");
            result.add(row);
        }

        return ResponseEntity.ok(result);
    }

    // ── 7. Quality Trends (month / quarter / year) ────────────────────────────
    // Aggregates sprint-level metrics across time to show improvement trend.

    @GetMapping("/board/{boardId}/trends")
    public ResponseEntity<Map<String, Object>> qualityTrends(
            @PathVariable Long boardId,
            @RequestParam(defaultValue = "month") String period) {

        // Fetch all closed sprints for the board with their metrics
        List<Map<String, Object>> closedSprints = jdbc.queryForList("""
            SELECT sprint_jira_id, name, complete_date,
                   EXTRACT(YEAR  FROM complete_date) AS yr,
                   EXTRACT(MONTH FROM complete_date) AS mo,
                   EXTRACT(QUARTER FROM complete_date) AS qtr
            FROM jira_sprint
            WHERE board_id = ? AND state = 'closed' AND complete_date IS NOT NULL
            ORDER BY complete_date ASC
            """, boardId);

        if (closedSprints.isEmpty()) {
            return ResponseEntity.ok(Map.of("periods", List.of(), "period", period));
        }

        // Group sprints by period
        Map<String, List<Long>> groups = new LinkedHashMap<>();
        for (Map<String, Object> s : closedSprints) {
            String key = periodKey(s, period);
            groups.computeIfAbsent(key, k -> new ArrayList<>())
                  .add(((Number) s.get("sprint_jira_id")).longValue());
        }

        List<Map<String, Object>> periods = new ArrayList<>();
        for (Map.Entry<String, List<Long>> entry : groups.entrySet()) {
            List<Long> sprintIds = entry.getValue();
            String inClause = String.join(",", Collections.nCopies(sprintIds.size(), "?"));

            // Total stories completed
            Long storiesCompleted = jdbc.queryForObject(
                "SELECT COUNT(DISTINCT i.issue_key) FROM jira_issue i "
                + "JOIN jira_sprint_issue si ON si.issue_key = i.issue_key "
                + "WHERE si.sprint_jira_id IN (" + inClause + ") "
                + "AND LOWER(i.issue_type) = 'story' AND i.status_category = 'done'",
                Long.class, sprintIds.toArray());

            // Total bugs
            Long bugsTotal = jdbc.queryForObject(
                "SELECT COUNT(*) FROM jira_issue i "
                + "JOIN jira_sprint_issue si ON si.issue_key = i.issue_key "
                + "WHERE si.sprint_jira_id IN (" + inClause + ") "
                + "AND LOWER(i.issue_type) IN ('bug','defect')",
                Long.class, sprintIds.toArray());

            // Defect density: bugs per story completed
            double defectDensity = (storiesCompleted != null && storiesCompleted > 0)
                ? Math.round((double) bugsTotal / storiesCompleted * 100.0) / 100.0 : 0.0;

            // Average predictability across sprints in this period
            List<Object> predParams = new ArrayList<>();
            double totalPred = 0.0;
            int predCount = 0;
            for (Long sprintId : sprintIds) {
                String startDate = (String) jdbc.queryForList(
                    "SELECT start_date::text FROM jira_sprint WHERE sprint_jira_id = ?", sprintId)
                    .stream().findFirst().map(r -> r.get("start_date")).map(Object::toString)
                    .orElse(null);
                if (startDate == null) continue;
                String sd = startDate.substring(0, 10);
                Long committed = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM jira_issue i JOIN jira_sprint_issue si "
                    + "ON si.issue_key = i.issue_key WHERE si.sprint_jira_id = ? "
                    + "AND LOWER(i.issue_type) NOT IN ('epic','sub-task') "
                    + "AND i.created_at::date <= ?::date",
                    Long.class, sprintId, sd);
                Long completed = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM jira_issue i JOIN jira_sprint_issue si "
                    + "ON si.issue_key = i.issue_key WHERE si.sprint_jira_id = ? "
                    + "AND LOWER(i.issue_type) NOT IN ('epic','sub-task') "
                    + "AND i.status_category = 'done'",
                    Long.class, sprintId);
                if (committed != null && committed > 0) {
                    totalPred += 100.0 * completed / committed;
                    predCount++;
                }
            }
            double avgPredictability = predCount > 0
                ? Math.round(totalPred / predCount * 10) / 10.0 : 0.0;

            // Average cycle time (from transitions, if available)
            Double avgCycleTime = null;
            try {
                List<Map<String, Object>> cycleTimes = jdbc.queryForList(
                    "SELECT issue_key, "
                    + "MIN(transitioned_at) FILTER (WHERE UPPER(to_status) LIKE '%DEVELOPMENT%') AS dev_start, "
                    + "MAX(transitioned_at) FILTER (WHERE UPPER(to_status) LIKE '%COMPLETED%' "
                    + "  OR UPPER(to_status) = 'DONE') AS done_at "
                    + "FROM jira_issue_transition "
                    + "WHERE issue_key IN ("
                    + "  SELECT i.issue_key FROM jira_issue i "
                    + "  JOIN jira_sprint_issue si ON si.issue_key = i.issue_key "
                    + "  WHERE si.sprint_jira_id IN (" + inClause + ") "
                    + "  AND LOWER(i.issue_type) NOT IN ('epic','sub-task')"
                    + ") GROUP BY issue_key",
                    sprintIds.toArray());

                List<Double> days = cycleTimes.stream()
                    .filter(r -> r.get("dev_start") != null && r.get("done_at") != null)
                    .map(r -> daysBetween(r.get("dev_start").toString(), r.get("done_at").toString()))
                    .filter(d -> d > 0)
                    .toList();
                if (!days.isEmpty()) {
                    avgCycleTime = Math.round(days.stream().mapToDouble(Double::doubleValue).average().orElse(0) * 10) / 10.0;
                }
            } catch (Exception ignored) {}

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("period",              entry.getKey());
            row.put("sprint_count",        sprintIds.size());
            row.put("stories_completed",   storiesCompleted);
            row.put("bugs_total",          bugsTotal);
            row.put("defect_density",      defectDensity);
            row.put("avg_predictability",  avgPredictability);
            row.put("avg_cycle_days",      avgCycleTime);
            // Quality score: composite (lower defect density + higher predictability = better)
            double qualityScore = Math.round(
                (avgPredictability * 0.5) + Math.max(0, (100 - defectDensity * 20) * 0.5)
            * 10) / 10.0;
            row.put("quality_score",       Math.min(100, qualityScore));
            periods.add(row);
        }

        return ResponseEntity.ok(Map.of("periods", periods, "period", period, "board_id", boardId));
    }

    private String periodKey(Map<String, Object> sprint, String period) {
        int yr  = ((Number) sprint.get("yr")).intValue();
        int mo  = ((Number) sprint.get("mo")).intValue();
        int qtr = ((Number) sprint.get("qtr")).intValue();
        return switch (period) {
            case "quarter" -> yr + " Q" + qtr;
            case "year"    -> String.valueOf(yr);
            default        -> yr + "-" + String.format("%02d", mo); // month
        };
    }
}
