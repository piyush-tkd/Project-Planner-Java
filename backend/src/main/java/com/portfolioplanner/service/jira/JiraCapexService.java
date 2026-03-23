package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Builds a monthly CapEx/OpEx (IDS vs NON-IDS) breakdown.
 *
 * <p>For a given month it:
 * <ol>
 *   <li>Queries all Jira issues with worklogs in that calendar month across all
 *       enabled POD project keys.</li>
 *   <li>Filters the embedded worklog entries to only those within the month and
 *       sums the hours by worklog <em>author</em> (not by issue assignee).</li>
 *   <li>Reads the configured custom field (e.g. {@code customfield_10060}) from
 *       each issue to determine the CapEx category (IDS, NON-IDS, or Untagged).</li>
 *   <li>Cross-references worklog authors against the Resource table to assign
 *       a location (US / India); defaults to India when no match is found.</li>
 *   <li>Returns aggregated breakdowns by category, POD, author, and location.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraCapexService {

    private final JiraCredentialsService      creds;
    private final JiraPodRepository           podRepo;
    private final ResourceRepository          resourceRepo;
    private final JiraSyncedIssueRepository   issueRepo;
    private final JiraIssueWorklogRepository  worklogRepo;
    private final JiraIssueCustomFieldRepository customFieldRepo;

    // Category constants
    public static final String CAT_UNTAGGED = "Untagged";

    // Location constants
    public static final String LOC_US    = "US";
    public static final String LOC_INDIA = "India";

    // ── Public API ────────────────────────────────────────────────────

    /**
     * Returns a full monthly CapEx/OpEx report.
     *
     * @param month   "YYYY-MM" (e.g. "2025-01")
     * @param fieldId Jira custom field ID that stores IDS/NON-IDS value.
     *                If null/blank, falls back to the configured value from DB.
     */
    @Transactional(readOnly = true)
    public CapexMonthReport getMonthlyReport(String month, String fieldId) {
        if (!creds.isConfigured()) return CapexMonthReport.empty(month);

        // Resolve field ID — param wins, then DB setting
        String resolvedField = (fieldId != null && !fieldId.isBlank())
                ? fieldId.trim()
                : creds.getCapexFieldId();

        // Parse month → date range
        YearMonth ym   = YearMonth.parse(month);
        LocalDate fromDate = ym.atDay(1);
        LocalDate toDate   = ym.atEndOfMonth();
        LocalDateTime from = fromDate.atStartOfDay();
        LocalDateTime to   = toDate.plusDays(1).atStartOfDay();  // exclusive upper bound

        // Collect all enabled POD project keys
        List<JiraPod> pods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        if (pods.isEmpty()) return CapexMonthReport.empty(month);

        // Map project key → pod name for breakdown
        Map<String, String> keyToPod = new LinkedHashMap<>();
        for (JiraPod pod : pods) {
            for (JiraPodBoard board : pod.getBoards()) {
                keyToPod.put(board.getJiraProjectKey(), pod.getPodDisplayName());
            }
        }

        List<String> projectKeys = new ArrayList<>(keyToPod.keySet());

        log.info("CapEx report [{}]: querying issues for projects {} from {} to {}",
                month, projectKeys, from, to);

        // Query worklogs from DB for the month date range
        List<JiraIssueWorklog> dbWorklogs;
        try {
            dbWorklogs = worklogRepo.findByProjectKeysAndDateRange(projectKeys, from, to);
        } catch (Exception e) {
            log.warn("CapEx worklog query failed for month={}: {}", month, e.getMessage());
            return CapexMonthReport.empty(month);
        }

        if (dbWorklogs.isEmpty()) {
            log.info("CapEx query returned 0 worklogs for month={}", month);
            return CapexMonthReport.empty(month);
        }

        log.info("CapEx worklog query returned {} worklog entries for month={}", dbWorklogs.size(), month);

        // Group worklogs by issueKey to find unique issues
        Map<String, List<JiraIssueWorklog>> worklogsByIssue = dbWorklogs.stream()
                .collect(Collectors.groupingBy(JiraIssueWorklog::getIssueKey));

        Set<String> issueKeys = worklogsByIssue.keySet();

        // Load issues from DB
        List<JiraSyncedIssue> dbIssues;
        try {
            dbIssues = issueRepo.findByIssueKeyIn(new ArrayList<>(issueKeys));
        } catch (Exception e) {
            log.warn("CapEx issue query failed: {}", e.getMessage());
            return CapexMonthReport.empty(month);
        }

        // Create a map for quick lookup
        Map<String, JiraSyncedIssue> issueMap = dbIssues.stream()
                .collect(Collectors.toMap(JiraSyncedIssue::getIssueKey, i -> i));

        // Load custom fields if needed
        Map<String, JiraIssueCustomField> capexFieldMap = new HashMap<>();
        if (resolvedField != null && !resolvedField.isBlank()) {
            try {
                List<JiraIssueCustomField> customFields = customFieldRepo.findByFieldIdAndIssueKeyIn(
                        resolvedField, new ArrayList<>(issueKeys));
                capexFieldMap = customFields.stream()
                        .collect(Collectors.toMap(JiraIssueCustomField::getIssueKey, f -> f));
            } catch (Exception e) {
                log.warn("CapEx custom field query failed: {}", e.getMessage());
            }
        }

        // Build name→location lookup from Resource table
        Map<String, String> nameToLocation = buildNameToLocation();

        // ── Process issues ────────────────────────────────────────────
        List<CapexIssue> issueList = new ArrayList<>();
        Map<String, CapexCategoryAgg> catAgg  = new LinkedHashMap<>();
        Map<String, Map<String, Double>> podAgg = new LinkedHashMap<>();  // pod → category → hours

        // Author-level aggregation: author → AuthorAgg
        Map<String, AuthorAgg> authorAgg = new LinkedHashMap<>();

        for (String issueKey : issueKeys) {
            JiraSyncedIssue dbIssue = issueMap.get(issueKey);
            if (dbIssue == null) continue;

            List<JiraIssueWorklog> issueWorklogs = worklogsByIssue.get(issueKey);

            CapexIssue issue = buildIssueFromDb(issueKey, dbIssue, resolvedField,
                    fromDate, toDate, keyToPod, nameToLocation, issueWorklogs, capexFieldMap.get(issueKey));
            issueList.add(issue);

            String cat = issue.capexCategory() != null ? issue.capexCategory() : CAT_UNTAGGED;
            catAgg.computeIfAbsent(cat, k -> new CapexCategoryAgg(k, 0, 0, 0))
                    .add(issue.monthlyHours(), issue.storyPoints());

            if (issue.podDisplayName() != null) {
                podAgg.computeIfAbsent(issue.podDisplayName(), k -> new LinkedHashMap<>())
                        .merge(cat, issue.monthlyHours(), Double::sum);
            }

            // Collect per-worklog-author hours from DB entities
            collectWorklogAuthorHoursFromDb(cat, issueWorklogs, fromDate, toDate, nameToLocation, authorAgg);
        }

        // Sort issues: untagged first (data quality), then by pod name
        issueList.sort(Comparator
                .comparing((CapexIssue i) -> i.capexCategory() != null ? 1 : 0)
                .thenComparing(i -> i.podDisplayName() != null ? i.podDisplayName() : "")
                .thenComparing(CapexIssue::key));

        // Build category breakdown list (IDS first, then NON-IDS, then Untagged, then others)
        List<CapexCategoryBreakdown> breakdown = catAgg.entrySet().stream()
                .sorted(Comparator.comparingInt(e -> categoryOrder(e.getKey())))
                .map(e -> new CapexCategoryBreakdown(
                        e.getKey(),
                        e.getValue().count(),
                        round2(e.getValue().hours()),
                        round2(e.getValue().sp())))
                .collect(Collectors.toList());

        // Build POD breakdown list
        List<CapexPodBreakdown> podBreakdown = podAgg.entrySet().stream()
                .map(e -> {
                    Map<String, Double> hrs = new LinkedHashMap<>();
                    e.getValue().forEach((k, v) -> hrs.put(k, round2(v)));
                    return new CapexPodBreakdown(e.getKey(), hrs);
                })
                .collect(Collectors.toList());

        // Build author breakdown — sorted by totalHours desc
        List<WorklogAuthorRow> authorBreakdown = authorAgg.values().stream()
                .map(a -> new WorklogAuthorRow(
                        a.author, a.location,
                        round2(a.idsHours), round2(a.nonIdsHours),
                        round2(a.untaggedHours),
                        round2(a.idsHours + a.nonIdsHours + a.untaggedHours)))
                .sorted(Comparator.comparingDouble(WorklogAuthorRow::totalHours).reversed())
                .collect(Collectors.toList());

        // Build location summary
        List<LocationSummary> locationBreakdown = buildLocationBreakdown(authorBreakdown);

        int totalIssues    = issueList.size();
        int untaggedIssues = (int) issueList.stream().filter(i -> i.capexCategory() == null).count();
        double totalHours  = round2(issueList.stream().mapToDouble(CapexIssue::monthlyHours).sum());

        return new CapexMonthReport(
                month, resolvedField,
                totalIssues, totalIssues - untaggedIssues, untaggedIssues,
                totalHours, breakdown, podBreakdown, issueList,
                authorBreakdown, locationBreakdown
        );
    }

    /**
     * Returns available custom fields from the database.
     * This is a stub that returns an empty list since custom fields are now
     * stored in the DB and managed via sync operations.
     */
    public List<Map<String, Object>> getCustomFields() {
        if (!creds.isConfigured()) return List.of();
        // Custom fields are now synced to the DB via JiraIssueCustomField entities
        // This method can be enhanced to return available field definitions if needed
        return List.of();
    }

    // ── Internal helpers ──────────────────────────────────────────────

    /**
     * Builds a lowercase-normalized display-name → location string map
     * from the Resource table. Used for fuzzy worklog-author lookup.
     */
    private Map<String, String> buildNameToLocation() {
        Map<String, String> map = new HashMap<>();
        try {
            for (Resource r : resourceRepo.findByActiveTrue()) {
                String loc = (r.getLocation() == Location.US) ? LOC_US : LOC_INDIA;
                map.put(r.getName().toLowerCase().trim(), loc);
            }
        } catch (Exception e) {
            log.warn("Could not load resources for location lookup: {}", e.getMessage());
        }
        return map;
    }

    /**
     * Fuzzy lookup: checks if the normalized worklog author name contains
     * or is contained by any known resource name. Defaults to India.
     */
    private String resolveLocation(String authorName, Map<String, String> nameToLocation) {
        if (authorName == null || authorName.isBlank()) return LOC_INDIA;
        String norm = authorName.toLowerCase().trim();

        // Exact match
        if (nameToLocation.containsKey(norm)) return nameToLocation.get(norm);

        // Partial match: resource name contained within author name or vice-versa
        for (Map.Entry<String, String> entry : nameToLocation.entrySet()) {
            String rName = entry.getKey();
            if (norm.contains(rName) || rName.contains(norm)) {
                return entry.getValue();
            }
        }
        return LOC_INDIA; // default
    }

    private CapexIssue buildIssueFromDb(
            String issueKey,
            JiraSyncedIssue dbIssue,
            String fieldId,
            LocalDate from,
            LocalDate to,
            Map<String, String> keyToPod,
            Map<String, String> nameToLocation,
            List<JiraIssueWorklog> worklogs,
            JiraIssueCustomField capexField) {

        // Summary from DB
        String summary = dbIssue.getSummary() != null ? dbIssue.getSummary() : "";

        // Issue type from DB
        String issueType = dbIssue.getIssueType() != null ? dbIssue.getIssueType() : "Unknown";

        // Status from DB
        String statusName = dbIssue.getStatusName() != null ? dbIssue.getStatusName() : "Unknown";
        String statusCat = dbIssue.getStatusCategory() != null ? dbIssue.getStatusCategory() : "Unknown";

        // Assignee from DB
        String assignee = dbIssue.getAssigneeDisplayName() != null ? dbIssue.getAssigneeDisplayName() : "Unassigned";

        // Assignee location
        String assigneeLocation = resolveLocation(
                "Unassigned".equals(assignee) ? null : assignee, nameToLocation);

        // Story Points from DB
        double sp = dbIssue.getStoryPoints() != null ? dbIssue.getStoryPoints() : 0.0;

        // CapEx field value (IDS / NON-IDS / null)
        String capexCategory = null;
        if (capexField != null && capexField.getFieldValue() != null) {
            String val = capexField.getFieldValue().trim();
            capexCategory = (!val.isBlank()) ? val : null;
        }

        // Monthly hours — sum worklogs within the month date range
        double monthlyHours = computeMonthlyHoursFromDb(worklogs, dbIssue, from, to);

        // POD name from project key
        String projectKey = dbIssue.getProjectKey();
        String podName = projectKey != null ? keyToPod.get(projectKey) : null;

        return new CapexIssue(issueKey, summary, issueType, statusName, statusCat,
                assignee, assigneeLocation, podName, capexCategory,
                round2(monthlyHours), sp);
    }


    /**
     * Iterates DB worklog entities and accumulates per-author hours
     * (filtered to the month window) into the aggregation map.
     */
    private void collectWorklogAuthorHoursFromDb(
            String category,
            List<JiraIssueWorklog> worklogs,
            LocalDate from,
            LocalDate to,
            Map<String, String> nameToLocation,
            Map<String, AuthorAgg> authorAgg) {

        for (JiraIssueWorklog wl : worklogs) {
            // Check if worklog date is within the month
            if (wl.getStarted() == null) continue;
            LocalDate wlDate = wl.getStarted().toLocalDate();
            if (wlDate.isBefore(from) || wlDate.isAfter(to)) continue;

            // Get time spent in seconds and convert to hours
            Long timeSpentSeconds = wl.getTimeSpentSeconds();
            if (timeSpentSeconds == null || timeSpentSeconds <= 0) continue;
            double hours = timeSpentSeconds.doubleValue() / 3600.0;

            // Author from worklog entry
            String author = wl.getAuthorDisplayName();
            if (author == null || author.isBlank()) author = "Unknown";

            String location = resolveLocation(author, nameToLocation);
            final String authorKey = author;
            final String locKey    = location;

            authorAgg.computeIfAbsent(authorKey, k -> new AuthorAgg(k, locKey))
                    .add(category, hours);
        }
    }

    private List<LocationSummary> buildLocationBreakdown(List<WorklogAuthorRow> authors) {
        // Use insertion-ordered map with US first, India second
        Map<String, double[]> loc = new LinkedHashMap<>();
        loc.put(LOC_US,    new double[4]); // [ids, nonIds, untagged, authorCount]
        loc.put(LOC_INDIA, new double[4]);

        for (WorklogAuthorRow a : authors) {
            double[] arr = loc.computeIfAbsent(a.location(), k -> new double[4]);
            arr[0] += a.idsHours();
            arr[1] += a.nonIdsHours();
            arr[2] += a.untaggedHours();
            arr[3] += 1;
        }

        return loc.entrySet().stream()
                .filter(e -> e.getValue()[3] > 0 || Arrays.stream(e.getValue()).sum() > 0)
                .map(e -> {
                    double[] arr = e.getValue();
                    return new LocationSummary(
                            e.getKey(),
                            round2(arr[0]), round2(arr[1]), round2(arr[2]),
                            round2(arr[0] + arr[1] + arr[2]),
                            (int) arr[3]);
                })
                .collect(Collectors.toList());
    }

    /**
     * Sums worklog hours within the month from the DB worklog list.
     * Falls back to timeSpent field from the issue if no worklog hours found.
     */
    private double computeMonthlyHoursFromDb(List<JiraIssueWorklog> worklogs,
                                             JiraSyncedIssue issue,
                                             LocalDate from, LocalDate to) {
        double hours = 0;
        for (JiraIssueWorklog wl : worklogs) {
            if (wl.getStarted() == null) continue;
            LocalDate wlDate = wl.getStarted().toLocalDate();
            if (!wlDate.isBefore(from) && !wlDate.isAfter(to)) {
                Long ts = wl.getTimeSpentSeconds();
                if (ts != null && ts > 0) {
                    hours += ts.doubleValue() / 3600.0;
                }
            }
        }
        if (hours > 0) return hours;

        // Fallback: use total timeSpent from the issue (issue-level, not filtered to month)
        Long timeSpent = issue.getTimeSpent();
        if (timeSpent != null && timeSpent > 0) {
            return timeSpent.doubleValue() / 3600.0;
        }
        return 0;
    }

    private static int categoryOrder(String cat) {
        return switch (cat) {
            case "IDS"         -> 0;
            case "NON-IDS"     -> 1;
            case CAT_UNTAGGED  -> 3;
            default            -> 2;
        };
    }

    private static double round2(double v) { return Math.round(v * 100.0) / 100.0; }

    // ── Aggregation helpers (mutable) ─────────────────────────────────

    private static class CapexCategoryAgg {
        private final String key;
        private int count;
        private double hours;
        private double sp;
        CapexCategoryAgg(String key, int count, double hours, double sp) {
            this.key = key; this.count = count; this.hours = hours; this.sp = sp;
        }
        void add(double h, double s) { count++; hours += h; sp += s; }
        int count()   { return count; }
        double hours(){ return hours; }
        double sp()   { return sp; }
    }

    private static class AuthorAgg {
        final String author;
        final String location;
        double idsHours;
        double nonIdsHours;
        double untaggedHours;
        AuthorAgg(String author, String location) {
            this.author   = author;
            this.location = location;
        }
        void add(String category, double hours) {
            if ("IDS".equals(category))          idsHours     += hours;
            else if ("NON-IDS".equals(category)) nonIdsHours  += hours;
            else                                 untaggedHours += hours;
        }
    }

    // ── DTOs ──────────────────────────────────────────────────────────

    public record CapexIssue(
            String key,
            String summary,
            String issueType,
            String statusName,
            String statusCategory,
            String assignee,
            String assigneeLocation,   // "US" or "India"
            String podDisplayName,
            String capexCategory,      // "IDS", "NON-IDS", or null = Untagged
            double monthlyHours,
            double storyPoints
    ) {}

    public record CapexCategoryBreakdown(
            String category,
            int    issueCount,
            double totalHours,
            double totalSP
    ) {}

    public record CapexPodBreakdown(
            String podName,
            Map<String, Double> hoursByCategory
    ) {}

    public record WorklogAuthorRow(
            String author,
            String location,       // "US" or "India"
            double idsHours,
            double nonIdsHours,
            double untaggedHours,
            double totalHours
    ) {}

    public record LocationSummary(
            String location,
            double idsHours,
            double nonIdsHours,
            double untaggedHours,
            double totalHours,
            int    authorCount
    ) {}

    public record CapexMonthReport(
            String month,
            String fieldId,
            int    totalIssues,
            int    taggedIssues,
            int    untaggedIssues,
            double totalHours,
            List<CapexCategoryBreakdown> breakdown,
            List<CapexPodBreakdown>      podBreakdown,
            List<CapexIssue>             issues,
            List<WorklogAuthorRow>       authorBreakdown,
            List<LocationSummary>        locationBreakdown
    ) {
        static CapexMonthReport empty(String month) {
            return new CapexMonthReport(month, null, 0, 0, 0, 0,
                    List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }
}
