package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.JiraIssueWorklog;
import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.domain.model.JiraSyncedIssue;
import com.portfolioplanner.domain.repository.JiraIssueWorklogRepository;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import com.portfolioplanner.domain.repository.JiraSyncedIssueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * Builds a monthly worklog report showing how many hours each person logged
 * in Jira and which issues they worked on.
 *
 * <p>All data is read from the locally synced PostgreSQL tables
 * instead of live Jira API calls.</p>
 *
 * <p>For a given month it:
 * <ol>
 *   <li>Queries all worklogs in that calendar month from the DB across all
 *       enabled POD project keys (optionally filtered to a single project).</li>
 *   <li>Filters the worklog entries to only those within the month.</li>
 *   <li>Groups by worklog <em>author</em> (not by issue assignee).</li>
 *   <li>Returns per-user totals, per-issue-type breakdown, and the list of
 *       individual issues each person worked on.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraWorklogService {

    private final JiraCredentialsService       creds;
    private final JiraPodRepository            podRepo;
    private final JiraIssueWorklogRepository   worklogRepo;
    private final JiraSyncedIssueRepository    issueRepo;

    // ── DTOs ──────────────────────────────────────────────────────────

    public record WorklogIssueEntry(
            String issueKey,
            String summary,
            String issueType,
            String projectKey,
            double hoursLogged
    ) {}

    public record WorklogUserRow(
            String author,
            double totalHours,
            Map<String, Double> issueTypeBreakdown,  // e.g. {"Story":12.5,"Bug":4.0}
            List<WorklogIssueEntry> issues
    ) {}

    public record WorklogMonthReport(
            String month,
            int totalUsers,
            double totalHours,
            Map<String, Double> issueTypeBreakdown,   // team-wide by type
            List<WorklogUserRow> users
    ) {
        public static WorklogMonthReport empty(String month) {
            return new WorklogMonthReport(month, 0, 0, Map.of(), List.of());
        }
    }

    /** One data-point in the user history trend. */
    public record UserMonthPoint(
            String month,           // "YYYY-MM"
            String monthLabel,      // "March 2026"
            double totalHours,
            Map<String, Double> issueTypeBreakdown
    ) {}

    /** Full history response for a single author. */
    public record UserHistoryReport(
            String author,
            List<UserMonthPoint> months   // oldest → newest
    ) {}

    // ── Public API ────────────────────────────────────────────────────

    /**
     * Returns a worklog report for the given month.
     *
     * @param month      "YYYY-MM", e.g. "2025-03"
     * @param projectKey optional Jira project key to restrict results; null = all configured PODs
     */
    @Transactional(readOnly = true)
    public WorklogMonthReport getMonthlyReport(String month, String projectKey) {
        if (!creds.isConfigured()) return WorklogMonthReport.empty(month);

        YearMonth ym = YearMonth.parse(month);
        LocalDateTime from = ym.atDay(1).atStartOfDay();
        LocalDateTime to   = ym.plusMonths(1).atDay(1).atStartOfDay(); // exclusive upper bound

        LocalDate fromDate = ym.atDay(1);
        LocalDate toDate   = ym.atEndOfMonth();

        // Collect project keys to query
        List<String> projectKeys = resolveProjectKeys(projectKey);
        if (projectKeys.isEmpty()) return WorklogMonthReport.empty(month);

        log.info("Worklog DB query [{}]: projects={}", month, projectKeys);

        // Query worklogs from DB for the month date range and project keys
        List<JiraIssueWorklog> dbWorklogs;
        try {
            dbWorklogs = worklogRepo.findByProjectKeysAndDateRange(projectKeys, from, to);
        } catch (Exception e) {
            log.warn("Worklog query failed for month={}: {}", month, e.getMessage());
            return WorklogMonthReport.empty(month);
        }

        if (dbWorklogs.isEmpty()) {
            log.info("Worklog query returned 0 entries for month={}", month);
            return WorklogMonthReport.empty(month);
        }

        log.info("Worklog query returned {} entries for month={}", dbWorklogs.size(), month);

        // Group worklogs by issueKey to load issue metadata
        Map<String, List<JiraIssueWorklog>> worklogsByIssue = dbWorklogs.stream()
                .collect(Collectors.groupingBy(JiraIssueWorklog::getIssueKey));

        // Load issue metadata from DB
        List<JiraSyncedIssue> dbIssues = issueRepo.findByIssueKeyIn(
                new ArrayList<>(worklogsByIssue.keySet()));
        Map<String, JiraSyncedIssue> issueMap = dbIssues.stream()
                .collect(Collectors.toMap(JiraSyncedIssue::getIssueKey, i -> i, (a, b) -> a));

        // author → { issueType → hours, issues }
        Map<String, AuthorAgg> authorMap = new LinkedHashMap<>();
        Map<String, Double> teamTypeBreakdown = new LinkedHashMap<>();

        for (JiraIssueWorklog wl : dbWorklogs) {
            // Verify worklog date is within the month
            if (wl.getStarted() == null) continue;
            LocalDate wlDate = wl.getStarted().toLocalDate();
            if (wlDate.isBefore(fromDate) || wlDate.isAfter(toDate)) continue;

            // Get time spent
            Long timeSpentSeconds = wl.getTimeSpentSeconds();
            if (timeSpentSeconds == null || timeSpentSeconds <= 0) continue;
            double hours = timeSpentSeconds.doubleValue() / 3600.0;

            // Get author
            String author = wl.getAuthorDisplayName();
            if (author == null || author.isBlank()) continue;

            // Get issue metadata
            String issueKey = wl.getIssueKey();
            JiraSyncedIssue issue = issueMap.get(issueKey);
            String summary = issue != null ? nvl(issue.getSummary(), "(no title)") : "(no title)";
            String issueType = issue != null ? nvl(issue.getIssueType(), "Task") : "Task";
            String issueProjectKey = issue != null ? nvl(issue.getProjectKey(), "?") : "?";

            AuthorAgg agg = authorMap.computeIfAbsent(author, AuthorAgg::new);
            agg.addHours(issueType, hours);
            agg.addIssue(issueKey, summary, issueType, issueProjectKey, hours);

            teamTypeBreakdown.merge(issueType, hours, Double::sum);
        }

        // Build sorted user rows: highest total hours first
        List<WorklogUserRow> users = authorMap.values().stream()
                .map(AuthorAgg::toRow)
                .sorted(Comparator.comparingDouble(WorklogUserRow::totalHours).reversed())
                .collect(Collectors.toList());

        double totalHours = users.stream().mapToDouble(WorklogUserRow::totalHours).sum();

        // Round team breakdown
        teamTypeBreakdown.replaceAll((k, v) -> round2(v));

        return new WorklogMonthReport(
                month,
                users.size(),
                round2(totalHours),
                teamTypeBreakdown,
                users
        );
    }

    /**
     * Returns month-by-month worklog totals for a specific author over the
     * last {@code months} calendar months (including current month), oldest first.
     *
     * @param author exact display name as it appears in Jira worklogs
     * @param months number of months to look back (1–24)
     */
    @Transactional(readOnly = true)
    public UserHistoryReport getUserHistory(String author, int months) {
        if (!creds.isConfigured() || author == null || author.isBlank()) {
            return new UserHistoryReport(author, List.of());
        }
        int cap = Math.min(Math.max(months, 1), 24);
        YearMonth current = YearMonth.now();

        // Build list of months oldest → newest
        List<String> monthKeys = IntStream.range(0, cap)
                .mapToObj(i -> current.minusMonths(cap - 1 - i).toString())
                .collect(Collectors.toList());

        List<UserMonthPoint> points = new ArrayList<>();
        for (String m : monthKeys) {
            WorklogMonthReport report = getMonthlyReport(m, null);
            // Find this author's row
            WorklogUserRow row = report.users().stream()
                    .filter(u -> u.author().equalsIgnoreCase(author))
                    .findFirst()
                    .orElse(null);

            double totalHrs = row != null ? row.totalHours() : 0;
            Map<String, Double> breakdown = row != null ? row.issueTypeBreakdown() : Map.of();

            YearMonth ym = YearMonth.parse(m);
            String label = ym.atDay(1).getMonth().getDisplayName(
                    java.time.format.TextStyle.FULL, java.util.Locale.ENGLISH)
                    + " " + ym.getYear();

            points.add(new UserMonthPoint(m, label, totalHrs, breakdown));
        }

        return new UserHistoryReport(author, points);
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private List<String> resolveProjectKeys(String projectKey) {
        if (projectKey != null && !projectKey.isBlank()) {
            return List.of(projectKey.trim());
        }
        List<JiraPod> pods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        return pods.stream()
                .flatMap(p -> p.getBoards().stream())
                .map(JiraPodBoard::getJiraProjectKey)
                .distinct()
                .collect(Collectors.toList());
    }

    private static String nvl(String s, String def) {
        return (s != null && !s.isBlank()) ? s : def;
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    // ── Inner aggregator ──────────────────────────────────────────────

    private static class AuthorAgg {
        final String author;
        double totalHours = 0;
        final Map<String, Double> typeHours = new LinkedHashMap<>();
        // issueKey → running hours (deduplicated)
        final Map<String, IssueAgg> issueMap = new LinkedHashMap<>();

        AuthorAgg(String author) { this.author = author; }

        void addHours(String issueType, double hours) {
            totalHours += hours;
            typeHours.merge(issueType, hours, Double::sum);
        }

        void addIssue(String key, String summary, String type, String project, double hours) {
            issueMap.computeIfAbsent(key, k -> new IssueAgg(k, summary, type, project))
                    .addHours(hours);
        }

        WorklogUserRow toRow() {
            Map<String, Double> rounded = new LinkedHashMap<>();
            typeHours.forEach((k, v) -> rounded.put(k, Math.round(v * 100.0) / 100.0));

            List<WorklogIssueEntry> issues = issueMap.values().stream()
                    .map(IssueAgg::toEntry)
                    .sorted(Comparator.comparingDouble(WorklogIssueEntry::hoursLogged).reversed())
                    .collect(Collectors.toList());

            return new WorklogUserRow(author, Math.round(totalHours * 100.0) / 100.0, rounded, issues);
        }
    }

    private static class IssueAgg {
        final String key, summary, type, project;
        double hours = 0;

        IssueAgg(String key, String summary, String type, String project) {
            this.key = key; this.summary = summary; this.type = type; this.project = project;
        }
        void addHours(double h) { hours += h; }
        WorklogIssueEntry toEntry() {
            return new WorklogIssueEntry(key, summary, type, project,
                    Math.round(hours * 100.0) / 100.0);
        }
    }
}
