package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * Builds a monthly worklog report showing how many hours each person logged
 * in Jira and which issues they worked on.
 *
 * <p>For a given month it:
 * <ol>
 *   <li>Queries all Jira issues with worklogs in that calendar month across all
 *       enabled POD project keys (optionally filtered to a single project).</li>
 *   <li>Filters the embedded worklog entries to only those within the month.</li>
 *   <li>Groups by worklog <em>author</em> (not by issue assignee).</li>
 *   <li>Returns per-user totals, per-issue-type breakdown, and the list of
 *       individual issues each person worked on.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraWorklogService {

    private final JiraClient             jiraClient;
    private final JiraCredentialsService creds;
    private final JiraPodRepository      podRepo;

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

        YearMonth ym   = YearMonth.parse(month);
        LocalDate from = ym.atDay(1);
        LocalDate to   = ym.atEndOfMonth();
        DateTimeFormatter jiraFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");

        // Collect project keys to query
        List<String> projectKeys = resolveProjectKeys(projectKey);
        if (projectKeys.isEmpty()) return WorklogMonthReport.empty(month);

        String projectList = projectKeys.stream()
                .map(k -> "\"" + k + "\"")
                .collect(Collectors.joining(","));

        String jql = "project in (" + projectList + ")"
                + " AND worklogDate >= " + from.format(jiraFmt)
                + " AND worklogDate <= " + to.format(jiraFmt)
                + " ORDER BY updated DESC";

        List<String> fieldList = List.of(
                "summary", "issuetype", "assignee", "worklog", "project",
                "timespent", "customfield_10016");

        log.info("Worklog JQL [{}]: {}", month, jql);

        List<Map<String, Object>> rawIssues;
        try {
            rawIssues = jiraClient.searchIssuesPost(jql, fieldList, 500);
        } catch (Exception e) {
            log.warn("Worklog query failed for month={}: {}", month, e.getMessage());
            return WorklogMonthReport.empty(month);
        }

        log.info("Worklog query returned {} issues for month={}", rawIssues.size(), month);

        // author → { issueType → hours, issues }
        Map<String, AuthorAgg> authorMap = new LinkedHashMap<>();
        Map<String, Double> teamTypeBreakdown = new LinkedHashMap<>();

        for (Map<String, Object> raw : rawIssues) {
            String issueKey = raw.get("key") instanceof String ? (String) raw.get("key") : "?";

            @SuppressWarnings("unchecked")
            Map<String, Object> fields = raw.get("fields") instanceof Map
                    ? (Map<String, Object>) raw.get("fields") : Map.of();

            String summary  = fields.get("summary") instanceof String
                    ? (String) fields.get("summary") : "(no title)";

            String issueType = extractIssueType(fields);

            @SuppressWarnings("unchecked")
            String issueProjectKey = fields.get("project") instanceof Map
                    ? (String) ((Map<String, Object>) fields.get("project")).getOrDefault("key", "?")
                    : "?";

            List<Map<?, ?>> worklogs = resolveWorklogs(issueKey, fields);

            for (Map<?, ?> wl : worklogs) {
                String dateStr = wl.get("started") instanceof String
                        ? ((String) wl.get("started")).substring(0, 10) : null;
                if (dateStr == null) continue;

                LocalDate date;
                try { date = LocalDate.parse(dateStr); } catch (Exception e) { continue; }
                if (date.isBefore(from) || date.isAfter(to)) continue;

                double hours = extractSeconds(wl) / 3600.0;
                if (hours <= 0) continue;

                String author = extractAuthorName(wl);
                if (author == null || author.isBlank()) continue;

                AuthorAgg agg = authorMap.computeIfAbsent(author, AuthorAgg::new);
                agg.addHours(issueType, hours);
                agg.addIssue(issueKey, summary, issueType, issueProjectKey, hours);

                teamTypeBreakdown.merge(issueType, hours, Double::sum);
            }
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

            double totalHours = row != null ? row.totalHours() : 0;
            Map<String, Double> breakdown = row != null ? row.issueTypeBreakdown() : Map.of();

            YearMonth ym = YearMonth.parse(m);
            String label = ym.atDay(1).getMonth().getDisplayName(
                    java.time.format.TextStyle.FULL, java.util.Locale.ENGLISH)
                    + " " + ym.getYear();

            points.add(new UserMonthPoint(m, label, totalHours, breakdown));
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

    @SuppressWarnings("unchecked")
    private List<Map<?, ?>> resolveWorklogs(String issueKey, Map<String, Object> fields) {
        // Jira embeds up to 20 worklogs in the issue response; if total > 20
        // we need to fetch them separately.
        Object wlObj = fields.get("worklog");
        if (wlObj instanceof Map) {
            Map<String, Object> wlMap = (Map<String, Object>) wlObj;
            Object total    = wlMap.get("total");
            Object maxResults = wlMap.get("maxResults");
            Object worklogsRaw = wlMap.get("worklogs");

            int totalCount   = total instanceof Number ? ((Number) total).intValue() : 0;
            int embeddedMax  = maxResults instanceof Number ? ((Number) maxResults).intValue() : 20;

            List<Map<?, ?>> embedded = worklogsRaw instanceof List
                    ? (List<Map<?, ?>>) worklogsRaw : List.of();

            if (totalCount > embeddedMax) {
                try {
                    List<Map<String, Object>> fetched = jiraClient.getWorklogs(issueKey);
                    return fetched.stream()
                            .map(m -> (Map<?, ?>) m)
                            .collect(Collectors.toList());
                } catch (Exception e) {
                    log.debug("Could not fetch worklogs for {}: {}", issueKey, e.getMessage());
                    return embedded;
                }
            }
            return embedded;
        }
        return List.of();
    }

    private String extractIssueType(Map<String, Object> fields) {
        Object it = fields.get("issuetype");
        if (it instanceof Map) {
            Object name = ((Map<?, ?>) it).get("name");
            if (name instanceof String) return (String) name;
        }
        return "Task";
    }

    private String extractAuthorName(Map<?, ?> worklog) {
        Object author = worklog.get("author");
        if (!(author instanceof Map)) return null;
        Map<?, ?> authorMap = (Map<?, ?>) author;

        // displayName first, then emailAddress, then accountId
        Object dn = authorMap.get("displayName");
        if (dn instanceof String && !((String) dn).isBlank()) return (String) dn;

        Object email = authorMap.get("emailAddress");
        if (email instanceof String && !((String) email).isBlank()) return (String) email;

        Object id = authorMap.get("accountId");
        return id instanceof String ? (String) id : null;
    }

    private double extractSeconds(Map<?, ?> worklog) {
        Object ts = worklog.get("timeSpentSeconds");
        return ts instanceof Number ? ((Number) ts).doubleValue() : 0;
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
