package com.portfolioplanner.service.reports;

import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.repository.ResourceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ResourcePerformanceService {

    private final ResourceRepository resourceRepository;
    private final JdbcTemplate jdbcTemplate;

    // ── Response records ──────────────────────────────────────────────────

    public record ResourceMetrics(
        Long resourceId,
        String resourceName,
        String role,
        String location,
        BigDecimal hourlyRate,
        List<PeriodMetrics> periods
    ) {}

    public record PeriodMetrics(
        String periodLabel,        // "Jan 2026", "Q1 2026", "2026"
        int periodIndex,           // 1-12 for months, 1-4 for quarters, year for yearly
        double hoursLogged,
        BigDecimal dollarValue,
        int storyCount,
        int bugCount,
        int taskCount,
        int totalIssues,
        double storyPointsCompleted,
        int commitsCount           // placeholder for future git integration
    ) {}

    public record PerformanceSummary(
        int year,
        String periodType,         // MONTHLY, QUARTERLY, YEARLY
        double totalHours,
        BigDecimal totalDollarValue,
        int totalStories,
        int totalBugs,
        int totalIssues,
        double totalStoryPoints,
        int totalResources,
        int mappedResources,
        List<ResourceMetrics> resources
    ) {}

    // ── Main query ───────────────────────────────────────────────────────

    public PerformanceSummary getPerformance(int year, String periodType) {
        List<Resource> allResources = resourceRepository.findByActiveTrue();

        // Get configured POD project keys
        Set<String> configuredKeys = getConfiguredProjectKeys();
        if (configuredKeys.isEmpty()) {
            return new PerformanceSummary(year, periodType, 0, BigDecimal.ZERO, 0, 0, 0, 0,
                allResources.size(), 0, Collections.emptyList());
        }

        // Get billing rates by role+location
        Map<String, BigDecimal> costRateMap = getCostRates();

        // Get hours logged per resource per period
        Map<String, Map<Integer, Double>> hoursMap = getHoursLogged(year, periodType, configuredKeys);

        // Get issue metrics per resource per period
        Map<String, Map<Integer, IssueMetrics>> issueMap = getIssueMetrics(year, periodType, configuredKeys);

        // Build response
        List<ResourceMetrics> resourceMetricsList = new ArrayList<>();
        double grandTotalHours = 0;
        BigDecimal grandTotalDollars = BigDecimal.ZERO;
        int grandTotalStories = 0, grandTotalBugs = 0, grandTotalIssues = 0;
        double grandTotalSP = 0;
        int mappedCount = 0;

        for (Resource res : allResources) {
            String jiraName = getJiraDisplayName(res);
            if (jiraName == null) continue;
            mappedCount++;

            BigDecimal rate = res.getActualRate() != null ? res.getActualRate() :
                costRateMap.getOrDefault(res.getRole().name() + ":" + res.getLocation().name(), BigDecimal.ZERO);

            Map<Integer, Double> resHours = hoursMap.getOrDefault(jiraName, Collections.emptyMap());
            Map<Integer, IssueMetrics> resIssues = issueMap.getOrDefault(jiraName, Collections.emptyMap());

            List<PeriodMetrics> periods = new ArrayList<>();
            // For yearly, the period key in the SQL result is the year number itself (e.g. 2026)
            int maxPeriod = "MONTHLY".equals(periodType) ? 12 : "QUARTERLY".equals(periodType) ? 4 : 1;
            int startPeriod = "YEARLY".equals(periodType) ? year : 1;
            int endPeriod = "YEARLY".equals(periodType) ? year : maxPeriod;

            for (int p = startPeriod; p <= endPeriod; p++) {
                double hours = resHours.getOrDefault(p, 0.0);
                BigDecimal dollars = rate.multiply(BigDecimal.valueOf(hours)).setScale(2, RoundingMode.HALF_UP);
                IssueMetrics im = resIssues.getOrDefault(p, IssueMetrics.EMPTY);

                String label = periodLabel(year, periodType, p);

                periods.add(new PeriodMetrics(
                    label, p, Math.round(hours * 100.0) / 100.0, dollars,
                    im.stories, im.bugs, im.tasks, im.stories + im.bugs + im.tasks,
                    im.storyPoints, 0  // commits placeholder
                ));

                grandTotalHours += hours;
                grandTotalDollars = grandTotalDollars.add(dollars);
                grandTotalStories += im.stories;
                grandTotalBugs += im.bugs;
                grandTotalIssues += im.stories + im.bugs + im.tasks;
                grandTotalSP += im.storyPoints;
            }

            resourceMetricsList.add(new ResourceMetrics(
                res.getId(), res.getName(), res.getRole().name(), res.getLocation().name(), rate, periods
            ));
        }

        // Sort by total hours descending
        resourceMetricsList.sort((a, b) -> {
            double aTotal = a.periods.stream().mapToDouble(PeriodMetrics::hoursLogged).sum();
            double bTotal = b.periods.stream().mapToDouble(PeriodMetrics::hoursLogged).sum();
            return Double.compare(bTotal, aTotal);
        });

        return new PerformanceSummary(year, periodType,
            Math.round(grandTotalHours * 100.0) / 100.0,
            grandTotalDollars, grandTotalStories, grandTotalBugs, grandTotalIssues,
            grandTotalSP, allResources.size(), mappedCount, resourceMetricsList);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private record IssueMetrics(int stories, int bugs, int tasks, double storyPoints) {
        static final IssueMetrics EMPTY = new IssueMetrics(0, 0, 0, 0);
    }

    private String getJiraDisplayName(Resource res) {
        // Try direct mapping on resource first
        if (res.getJiraDisplayName() != null && !res.getJiraDisplayName().isBlank()) {
            return res.getJiraDisplayName();
        }
        // Try mapping table
        List<String> names = jdbcTemplate.queryForList(
            "SELECT jira_display_name FROM jira_resource_mapping WHERE resource_id = ? AND jira_display_name IS NOT NULL",
            String.class, res.getId());
        return names.isEmpty() ? null : names.get(0);
    }

    private Set<String> getConfiguredProjectKeys() {
        return new HashSet<>(jdbcTemplate.queryForList(
            "SELECT DISTINCT jira_project_key FROM jira_pod_board", String.class));
    }

    private Map<String, BigDecimal> getCostRates() {
        Map<String, BigDecimal> map = new HashMap<>();
        jdbcTemplate.query("SELECT role, location, hourly_rate FROM cost_rate", rs -> {
            map.put(rs.getString("role") + ":" + rs.getString("location"),
                rs.getBigDecimal("hourly_rate"));
        });
        return map;
    }

    /**
     * Get hours logged from worklogs grouped by author and period.
     */
    private Map<String, Map<Integer, Double>> getHoursLogged(int year, String periodType, Set<String> configuredKeys) {
        String periodExpr = periodExpression(periodType);
        String placeholders = configuredKeys.stream().map(k -> "?").collect(Collectors.joining(","));

        String sql = """
            SELECT w.author_display_name AS name,
                   %s AS period,
                   COALESCE(SUM(w.time_spent_seconds), 0) / 3600.0 AS hours
            FROM jira_issue_worklog w
            JOIN jira_issue i ON w.issue_key = i.issue_key
            WHERE EXTRACT(YEAR FROM w.started) = ?
            AND i.project_key IN (%s)
            AND w.author_display_name IS NOT NULL AND w.author_display_name != ''
            GROUP BY w.author_display_name, %s
            """.formatted(periodExpr, placeholders, periodExpr);

        Object[] params = buildParams(year, configuredKeys);

        Map<String, Map<Integer, Double>> result = new HashMap<>();
        jdbcTemplate.query(sql, rs -> {
            String name = rs.getString("name");
            int period = rs.getInt("period");
            double hours = rs.getDouble("hours");
            result.computeIfAbsent(name, k -> new HashMap<>()).put(period, hours);
        }, params);
        return result;
    }

    /**
     * Get issue metrics (stories, bugs, tasks, SPs) grouped by assignee and period.
     * Uses resolution_date for "completed" issues, created_at as fallback.
     */
    private Map<String, Map<Integer, IssueMetrics>> getIssueMetrics(int year, String periodType, Set<String> configuredKeys) {
        String periodExpr = periodExpression(periodType).replace("w.started", "COALESCE(i.resolution_date, i.created_at)");
        String placeholders = configuredKeys.stream().map(k -> "?").collect(Collectors.joining(","));

        String sql = """
            SELECT i.assignee_display_name AS name,
                   %s AS period,
                   COUNT(*) FILTER (WHERE LOWER(i.issue_type) IN ('story', 'user story')) AS stories,
                   COUNT(*) FILTER (WHERE LOWER(i.issue_type) = 'bug') AS bugs,
                   COUNT(*) FILTER (WHERE LOWER(i.issue_type) NOT IN ('story', 'user story', 'bug', 'epic', 'sub-task', 'subtask')) AS tasks,
                   COALESCE(SUM(i.story_points) FILTER (WHERE i.status_category = 'done'), 0) AS sp_completed
            FROM jira_issue i
            WHERE EXTRACT(YEAR FROM COALESCE(i.resolution_date, i.created_at)) = ?
            AND i.project_key IN (%s)
            AND i.assignee_display_name IS NOT NULL AND i.assignee_display_name != ''
            AND i.is_subtask = false
            GROUP BY i.assignee_display_name, %s
            """.formatted(periodExpr, placeholders, periodExpr);

        Object[] params = buildParams(year, configuredKeys);

        Map<String, Map<Integer, IssueMetrics>> result = new HashMap<>();
        jdbcTemplate.query(sql, rs -> {
            String name = rs.getString("name");
            int period = rs.getInt("period");
            result.computeIfAbsent(name, k -> new HashMap<>()).put(period,
                new IssueMetrics(rs.getInt("stories"), rs.getInt("bugs"), rs.getInt("tasks"), rs.getDouble("sp_completed")));
        }, params);
        return result;
    }

    private String periodExpression(String periodType) {
        return switch (periodType) {
            case "QUARTERLY" -> "EXTRACT(QUARTER FROM w.started)::INT";
            case "YEARLY" -> "EXTRACT(YEAR FROM w.started)::INT";
            default -> "EXTRACT(MONTH FROM w.started)::INT"; // MONTHLY
        };
    }

    private String periodLabel(int year, String periodType, int period) {
        return switch (periodType) {
            case "QUARTERLY" -> "Q" + period + " " + year;
            case "YEARLY" -> String.valueOf(year);
            default -> {
                String[] months = {"", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
                yield months[period] + " " + year;
            }
        };
    }

    private Object[] buildParams(int year, Set<String> configuredKeys) {
        Object[] keys = configuredKeys.toArray();
        Object[] params = new Object[1 + keys.length];
        params[0] = year;
        System.arraycopy(keys, 0, params, 1, keys.length);
        return params;
    }

    // ── Drilldown: issues worked by a resource in a period ────────────────

    public record ResourceIssue(
        String issueKey,
        String summary,
        String issueType,
        String status,
        String statusCategory,
        String priority,
        Double storyPoints,
        double hoursLogged,
        String resolutionDate
    ) {}

    public List<ResourceIssue> getResourceIssues(Long resourceId, int year, String periodType, int periodIndex) {
        Resource res = resourceRepository.findById(resourceId).orElse(null);
        if (res == null) return Collections.emptyList();

        String jiraName = getJiraDisplayName(res);
        if (jiraName == null) return Collections.emptyList();

        Set<String> configuredKeys = getConfiguredProjectKeys();
        if (configuredKeys.isEmpty()) return Collections.emptyList();

        String placeholders = configuredKeys.stream().map(k -> "?").collect(Collectors.joining(","));

        // Build worklog subquery period filter
        String worklogPeriodFilter;
        String issuePeriodExpr;
        switch (periodType) {
            case "QUARTERLY":
                worklogPeriodFilter = "AND EXTRACT(QUARTER FROM w.started)::INT = ?";
                issuePeriodExpr = "EXTRACT(QUARTER FROM COALESCE(i.resolution_date, i.created_at))::INT";
                break;
            case "YEARLY":
                worklogPeriodFilter = "";  // already filtered by year
                issuePeriodExpr = "EXTRACT(YEAR FROM COALESCE(i.resolution_date, i.created_at))::INT";
                break;
            default:
                worklogPeriodFilter = "AND EXTRACT(MONTH FROM w.started)::INT = ?";
                issuePeriodExpr = "EXTRACT(MONTH FROM COALESCE(i.resolution_date, i.created_at))::INT";
                break;
        }

        String sql = "SELECT i.issue_key, i.summary, i.issue_type, i.status_name, i.status_category,"
            + " i.priority_name, i.story_points,"
            + " COALESCE((SELECT SUM(w.time_spent_seconds) / 3600.0"
            + " FROM jira_issue_worklog w"
            + " WHERE w.issue_key = i.issue_key"
            + " AND w.author_display_name = ?"
            + " AND EXTRACT(YEAR FROM w.started) = ?"
            + " " + worklogPeriodFilter + "), 0) AS hours_logged,"
            + " i.resolution_date::TEXT"
            + " FROM jira_issue i"
            + " WHERE i.assignee_display_name = ?"
            + " AND EXTRACT(YEAR FROM COALESCE(i.resolution_date, i.created_at)) = ?"
            + " AND " + issuePeriodExpr + " = ?"
            + " AND i.project_key IN (" + placeholders + ")"
            + " AND i.is_subtask = false"
            + " ORDER BY COALESCE(i.resolution_date, i.created_at) DESC";

        // Build parameter list
        List<Object> params = new ArrayList<>();
        // Subquery params
        params.add(jiraName);
        params.add(year);
        if (!"YEARLY".equals(periodType)) {
            params.add(periodIndex);
        }
        // Main query params
        params.add(jiraName);
        params.add(year);
        params.add("YEARLY".equals(periodType) ? year : periodIndex);
        params.addAll(configuredKeys);

        return jdbcTemplate.query(sql, (rs, rowNum) -> new ResourceIssue(
            rs.getString("issue_key"),
            rs.getString("summary"),
            rs.getString("issue_type"),
            rs.getString("status_name"),
            rs.getString("status_category"),
            rs.getString("priority_name"),
            rs.getObject("story_points") != null ? rs.getDouble("story_points") : null,
            rs.getDouble("hours_logged"),
            rs.getString("resolution_date")
        ), params.toArray());
    }
}
