package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
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

    private final JiraClient             jiraClient;
    private final JiraCredentialsService creds;
    private final JiraPodRepository      podRepo;
    private final ResourceRepository     resourceRepo;

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
        YearMonth ym  = YearMonth.parse(month);
        LocalDate from = ym.atDay(1);
        LocalDate to   = ym.atEndOfMonth();
        DateTimeFormatter jiraFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");

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
        String projectList = projectKeys.stream()
                .map(k -> "\"" + k + "\"")
                .collect(Collectors.joining(","));

        // JQL: issues with any worklog in the month.
        // Use unquoted dates — Jira accepts bare yyyy-MM-dd in worklogDate comparisons
        // and it avoids any quote-escaping / double-encoding issues in HTTP requests.
        String jql = "project in (" + projectList + ")"
                + " AND worklogDate >= " + from.format(jiraFmt)
                + " AND worklogDate <= " + to.format(jiraFmt)
                + " ORDER BY updated DESC";

        // Fields to fetch as a list (used with POST to avoid URL-encoding problems)
        List<String> fieldList = new ArrayList<>(List.of(
                "summary", "status", "issuetype", "assignee",
                "timespent", "worklog",
                "customfield_10016", "customfield_10028", "project",
                "story_points", "customfield_10015", "customfield_10034"));
        if (resolvedField != null && !resolvedField.isBlank()) {
            fieldList.add(resolvedField);
        }

        log.info("CapEx JQL [{}]: {}", month, jql);

        List<Map<String, Object>> rawIssues;
        try {
            // Use POST /search/jql to avoid URL-encoding issues with JQL date literals.
            rawIssues = jiraClient.searchIssuesPost(jql, fieldList, 500);
        } catch (Exception e) {
            log.warn("CapEx query failed for month={}: {}", month, e.getMessage());
            return CapexMonthReport.empty(month);
        }

        log.info("CapEx query returned {} issues for month={}", rawIssues.size(), month);

        // Build name→location lookup from Resource table
        Map<String, String> nameToLocation = buildNameToLocation();

        // ── Process issues ────────────────────────────────────────────
        List<CapexIssue> issueList = new ArrayList<>();
        Map<String, CapexCategoryAgg> catAgg  = new LinkedHashMap<>();
        Map<String, Map<String, Double>> podAgg = new LinkedHashMap<>();  // pod → category → hours

        // Author-level aggregation: author → AuthorAgg
        Map<String, AuthorAgg> authorAgg = new LinkedHashMap<>();

        for (Map<String, Object> raw : rawIssues) {
            String issueKey = raw.get("key") instanceof String ? (String) raw.get("key") : "?";
            @SuppressWarnings("unchecked")
            Map<String, Object> fields = raw.get("fields") instanceof Map
                    ? (Map<String, Object>) raw.get("fields") : Map.of();

            // Resolve worklogs once — shared by issue build and author breakdown
            List<Map<?,?>> worklogs = resolveWorklogs(issueKey, fields);

            CapexIssue issue = buildIssue(issueKey, fields, resolvedField,
                    from, to, keyToPod, nameToLocation, worklogs);
            issueList.add(issue);

            String cat = issue.capexCategory() != null ? issue.capexCategory() : CAT_UNTAGGED;
            catAgg.computeIfAbsent(cat, k -> new CapexCategoryAgg(k, 0, 0, 0))
                    .add(issue.monthlyHours(), issue.storyPoints());

            if (issue.podDisplayName() != null) {
                podAgg.computeIfAbsent(issue.podDisplayName(), k -> new LinkedHashMap<>())
                        .merge(cat, issue.monthlyHours(), Double::sum);
            }

            // Collect per-worklog-author hours (uses the already-resolved worklogs)
            collectWorklogAuthorHours(cat, worklogs, from, to, nameToLocation, authorAgg);
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
     * Returns available custom fields from Jira so the user can pick the right
     * IDS/NON-IDS field ID without guessing.
     */
    public List<Map<String, Object>> getCustomFields() {
        if (!creds.isConfigured()) return List.of();
        try {
            return jiraClient.getFields();
        } catch (Exception e) {
            log.warn("Could not fetch Jira fields: {}", e.getMessage());
            return List.of();
        }
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

    @SuppressWarnings("unchecked")
    private CapexIssue buildIssue(
            String issueKey,
            Map<String, Object> fields,
            String fieldId,
            LocalDate from,
            LocalDate to,
            Map<String, String> keyToPod,
            Map<String, String> nameToLocation,
            List<Map<?,?>> worklogs) {

        // Summary
        String summary = fields.get("summary") instanceof String ? (String) fields.get("summary") : "";

        // Issue type
        String issueType = "Unknown";
        if (fields.get("issuetype") instanceof Map) {
            Object n = ((Map<?,?>) fields.get("issuetype")).get("name");
            if (n instanceof String) issueType = (String) n;
        }

        // Status
        String statusName = "Unknown";
        String statusCat  = "Unknown";
        if (fields.get("status") instanceof Map) {
            Object sn = ((Map<?,?>) fields.get("status")).get("name");
            if (sn instanceof String) statusName = (String) sn;
            Object sc = ((Map<?,?>) fields.get("status")).get("statusCategory");
            if (sc instanceof Map) {
                Object scn = ((Map<?,?>) sc).get("name");
                if (scn instanceof String) statusCat = (String) scn;
            }
        }

        // Assignee
        String assignee = "Unassigned";
        if (fields.get("assignee") instanceof Map) {
            Object dn = ((Map<?,?>) fields.get("assignee")).get("displayName");
            if (dn instanceof String) assignee = (String) dn;
        }

        // Assignee location
        String assigneeLocation = resolveLocation(
                "Unassigned".equals(assignee) ? null : assignee, nameToLocation);

        // Story Points — try multiple common SP fields
        double sp = extractStoryPoints(fields);

        // CapEx field value (IDS / NON-IDS / null)
        String capexCategory = extractCapexCategory(fields, fieldId);

        // Monthly hours — sum worklogs within the month date range
        double monthlyHours = computeMonthlyHours(worklogs, fields, from, to);

        // POD name from project key
        String podName = null;
        if (fields.get("project") instanceof Map) {
            Object pk = ((Map<?,?>) fields.get("project")).get("key");
            if (pk instanceof String) podName = keyToPod.get(pk);
        }

        return new CapexIssue(issueKey, summary, issueType, statusName, statusCat,
                assignee, assigneeLocation, podName, capexCategory,
                round2(monthlyHours), sp);
    }

    /**
     * Tries multiple common story-point field names and returns the first non-zero value.
     * Jira instances vary in which custom field stores story points.
     */
    @SuppressWarnings("unchecked")
    private double extractStoryPoints(Map<String, Object> fields) {
        // Common SP field IDs across Jira Cloud / Server variants
        List<String> spFields = List.of(
                "story_points",
                "customfield_10016",  // Story Points (most common on Cloud)
                "customfield_10028",  // Story Points (older / Server)
                "customfield_10015",  // Story point estimate
                "customfield_10034"   // Another common variant
        );
        for (String key : spFields) {
            Object v = fields.get(key);
            if (v instanceof Number) {
                double val = ((Number) v).doubleValue();
                if (val > 0) return val;
            }
        }
        return 0;
    }

    /**
     * Extracts the CapEx category (IDS / NON-IDS / null) from the configured
     * custom field, handling String, Map (select), and List (multi-select) types.
     */
    @SuppressWarnings("unchecked")
    private String extractCapexCategory(Map<String, Object> fields, String fieldId) {
        if (fieldId == null || fieldId.isBlank()) return null;
        Object cfVal = fields.get(fieldId);
        String category = null;
        if (cfVal instanceof String) {
            category = ((String) cfVal).trim();
        } else if (cfVal instanceof Map) {
            // Select/dropdown field returns { id, value }
            Object val = ((Map<?,?>) cfVal).get("value");
            if (val instanceof String) category = ((String) val).trim();
        } else if (cfVal instanceof List) {
            // Multi-select: take first value
            List<?> list = (List<?>) cfVal;
            if (!list.isEmpty()) {
                Object first = list.get(0);
                if (first instanceof String) category = (String) first;
                else if (first instanceof Map) {
                    Object val = ((Map<?,?>) first).get("value");
                    if (val instanceof String) category = (String) val;
                }
            }
        }
        return (category != null && !category.isBlank()) ? category : null;
    }

    /**
     * Iterates resolved worklogs and accumulates per-author hours
     * (filtered to the month window) into the aggregation map.
     */
    private void collectWorklogAuthorHours(
            String category,
            List<Map<?,?>> worklogs,
            LocalDate from,
            LocalDate to,
            Map<String, String> nameToLocation,
            Map<String, AuthorAgg> authorAgg) {

        DateTimeFormatter fmt = DateTimeFormatter.ISO_LOCAL_DATE;

        for (Map<?,?> wl : worklogs) {
            Object started = wl.get("started");
            if (!(started instanceof String)) continue;
            try {
                LocalDate wlDate = LocalDate.parse(((String) started).substring(0, 10), fmt);
                if (wlDate.isBefore(from) || wlDate.isAfter(to)) continue;

                Object ts = wl.get("timeSpentSeconds");
                if (!(ts instanceof Number)) continue;
                double hours = ((Number) ts).doubleValue() / 3600.0;
                if (hours <= 0) continue;

                // Author from worklog entry
                String author = "Unknown";
                if (wl.get("author") instanceof Map) {
                    Object dn = ((Map<?,?>) wl.get("author")).get("displayName");
                    if (dn instanceof String) author = (String) dn;
                }

                String location = resolveLocation(author, nameToLocation);
                final String authorKey = author;
                final String locKey    = location;

                authorAgg.computeIfAbsent(authorKey, k -> new AuthorAgg(k, locKey))
                        .add(category, hours);

            } catch (Exception ignored) {}
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
     * Sums worklog hours within the month from the already-resolved worklog list.
     * Falls back to timespent (total, not month-filtered) if no worklog hours found.
     */
    private double computeMonthlyHours(List<Map<?,?>> worklogs,
                                        Map<String, Object> fields,
                                        LocalDate from, LocalDate to) {
        double hours = 0;
        for (Map<?,?> wl : worklogs) {
            Object started = wl.get("started");
            if (started instanceof String) {
                try {
                    LocalDate wlDate = LocalDate.parse(
                            ((String) started).substring(0, 10),
                            DateTimeFormatter.ISO_LOCAL_DATE);
                    if (!wlDate.isBefore(from) && !wlDate.isAfter(to)) {
                        Object ts = wl.get("timeSpentSeconds");
                        if (ts instanceof Number) hours += ((Number) ts).doubleValue() / 3600.0;
                    }
                } catch (Exception ignored) {}
            }
        }
        if (hours > 0) return hours;
        // Fallback: use total timespent (issue-level, not filtered to month)
        Object ts = fields.get("timespent");
        if (ts instanceof Number) return ((Number) ts).doubleValue() / 3600.0;
        return 0;
    }

    /**
     * Returns the complete worklog list for an issue.
     * Jira search embeds at most 20 worklogs; fetches the full list via
     * /rest/api/3/issue/{key}/worklog when {@code worklog.total} exceeds
     * the embedded count.
     */
    @SuppressWarnings("unchecked")
    private List<Map<?,?>> resolveWorklogs(String issueKey, Map<String, Object> fields) {
        Object wlObj = fields.get("worklog");
        if (!(wlObj instanceof Map)) return List.of();
        Map<?,?> wrapper = (Map<?,?>) wlObj;

        Object logsObj = wrapper.get("worklogs");
        List<Map<?,?>> embedded = logsObj instanceof List
                ? ((List<?>) logsObj).stream()
                        .filter(e -> e instanceof Map)
                        .map(e -> (Map<?,?>) e)
                        .collect(Collectors.toList())
                : List.of();

        Object totalObj = wrapper.get("total");
        int total = totalObj instanceof Number ? ((Number) totalObj).intValue() : embedded.size();

        if (total <= embedded.size()) return embedded;

        // More worklogs exist — fetch the complete list
        log.debug("Issue {} has {} worklogs but only {} embedded — fetching full list",
                issueKey, total, embedded.size());
        try {
            List<Map<String, Object>> full = jiraClient.getWorklogs(issueKey);
            if (!full.isEmpty()) return (List<Map<?,?>>) (List<?>) full;
        } catch (Exception e) {
            log.warn("Could not fetch full worklogs for {}: {} — using embedded subset",
                    issueKey, e.getMessage());
        }
        return embedded;
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
