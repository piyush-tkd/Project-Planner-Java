package com.portfolioplanner.service.reports;

import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.repository.ResourceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PodHoursService {

    private final ResourceRepository resourceRepository;
    private final JdbcTemplate jdbcTemplate;

    // ── Period type ──────────────────────────────────────────────────────────
    public enum PeriodType { MONTHLY, QUARTERLY, YEARLY }

    // ── Response records ──────────────────────────────────────────────────

    public record PodInfo(
        Long podId,
        String podName,
        double totalHours,
        int resourceCount,
        int bufferCount
    ) {}

    public record PodHoursEntry(
        Long podId,
        String podName,
        double hours,
        int issueCount,
        boolean buffer   // true if this resource is NOT formally assigned to this POD
    ) {}

    public record ResourceRow(
        Long resourceId,       // null if author not matched to a Resource
        String authorName,
        String role,           // null if unmatched
        String location,       // null if unmatched
        String homePodName,    // null if no formal assignment
        double totalHours,
        List<PodHoursEntry> pods
    ) {}

    public record PodHoursSummary(
        int year,
        String periodType,     // MONTHLY | QUARTERLY | YEARLY
        int periodIndex,       // month 1-12 | quarter 1-4 | 0 for yearly
        String periodLabel,    // e.g. "March 2026", "Q1 2026", "2026"
        double totalHours,
        int totalResources,
        int totalPods,
        double bufferHours,
        List<PodInfo> podSummaries,
        List<ResourceRow> resources
    ) {}

    // ── Main query ───────────────────────────────────────────────────────

    public PodHoursSummary getSummary(int year, PeriodType periodType, int periodIndex) {

        // Resolve month range for the requested period
        int startMonth;
        int endMonth;
        String periodLabel;

        switch (periodType) {
            case MONTHLY -> {
                startMonth = Math.max(1, Math.min(12, periodIndex));
                endMonth   = startMonth;
                periodLabel = monthName(startMonth) + " " + year;
            }
            case QUARTERLY -> {
                int q = Math.max(1, Math.min(4, periodIndex));
                startMonth  = (q - 1) * 3 + 1;
                endMonth    = q * 3;
                periodLabel = "Q" + q + " " + year + " (cumulative)";
            }
            default -> {  // YEARLY
                startMonth  = 1;
                endMonth    = 12;
                periodLabel = String.valueOf(year) + " (full year)";
            }
        }

        // 1. Load all resource metadata (active + inactive for matching)
        List<Resource> allResources = resourceRepository.findAll();
        Map<String, Resource> resourceByJiraName = buildJiraNameLookup(allResources);

        // 2. Build home-pod lookup: resourceId → Pod.name (planning pod name)
        Map<Long, String> homePodByResourceId = buildHomePodLookup();

        // 3. Query: hours logged per (author, jiraPod) within the month range
        String sql = """
            SELECT
                jp.id               AS pod_id,
                jp.pod_display_name AS pod_name,
                w.author_display_name AS author,
                ROUND(SUM(w.time_spent_seconds) / 3600.0, 2) AS hours,
                COUNT(DISTINCT w.issue_key) AS issue_count
            FROM jira_issue_worklog w
            JOIN jira_issue i       ON w.issue_key = i.issue_key
            JOIN jira_pod_board jpb ON i.project_key = jpb.jira_project_key
            JOIN jira_pod jp        ON jpb.pod_id = jp.id
            WHERE EXTRACT(YEAR  FROM w.started) = ?
              AND EXTRACT(MONTH FROM w.started) BETWEEN ? AND ?
              AND w.author_display_name IS NOT NULL
              AND w.author_display_name != ''
              AND jp.enabled = true
            GROUP BY jp.id, jp.pod_display_name, w.author_display_name
            ORDER BY jp.sort_order, jp.pod_display_name, hours DESC
            """;

        record RawRow(long podId, String podName, String author, double hours, int issueCount) {}
        List<RawRow> rawRows = jdbcTemplate.query(sql, (rs, n) -> new RawRow(
            rs.getLong("pod_id"),
            rs.getString("pod_name"),
            rs.getString("author"),
            rs.getDouble("hours"),
            rs.getInt("issue_count")
        ), year, startMonth, endMonth);

        if (rawRows.isEmpty()) {
            return new PodHoursSummary(year, periodType.name(), periodIndex, periodLabel,
                0, 0, 0, 0, Collections.emptyList(), Collections.emptyList());
        }

        // 4. Group by author → list of pod entries
        Map<String, List<RawRow>> byAuthor = rawRows.stream()
            .collect(Collectors.groupingBy(RawRow::author));

        // 5. Per-pod aggregates
        Map<Long, RawRow> firstPodInfo    = new LinkedHashMap<>();
        Map<Long, Double> podTotalHours   = new LinkedHashMap<>();
        Map<Long, Set<String>> podAuthors = new LinkedHashMap<>();
        Map<Long, Integer> podBufferCount = new LinkedHashMap<>();

        // 6. Build ResourceRow list
        List<ResourceRow> resourceRows = new ArrayList<>();
        double grandTotalHours  = 0;
        double grandBufferHours = 0;

        for (Map.Entry<String, List<RawRow>> e : byAuthor.entrySet()) {
            String author     = e.getKey();
            List<RawRow> authorRows = e.getValue();

            Resource res       = resourceByJiraName.get(normalise(author));
            Long resourceId    = res != null ? res.getId() : null;
            String role        = res != null ? res.getRole().name() : null;
            String location    = res != null ? res.getLocation().name() : null;
            String homePodName = resourceId != null ? homePodByResourceId.get(resourceId) : null;

            List<PodHoursEntry> podEntries = new ArrayList<>();
            double authorTotal = 0;

            for (RawRow row : authorRows) {
                boolean isBuffer = !namesMatch(homePodName, row.podName());

                podEntries.add(new PodHoursEntry(
                    row.podId(), row.podName(), row.hours(), row.issueCount(), isBuffer
                ));
                authorTotal += row.hours();

                if (isBuffer) {
                    grandBufferHours += row.hours();
                    podBufferCount.merge(row.podId(), 1, Integer::sum);
                }

                podTotalHours.merge(row.podId(), row.hours(), Double::sum);
                podAuthors.computeIfAbsent(row.podId(), k -> new LinkedHashSet<>()).add(author);
                firstPodInfo.putIfAbsent(row.podId(), row);
            }

            grandTotalHours += authorTotal;
            podEntries.sort(Comparator.comparing(PodHoursEntry::podName));

            resourceRows.add(new ResourceRow(
                resourceId, author, role, location, homePodName,
                Math.round(authorTotal * 100.0) / 100.0, podEntries
            ));
        }

        // Sort: matched resources first (by total hours desc), unmatched last
        resourceRows.sort((a, b) -> {
            if (a.resourceId() != null && b.resourceId() == null) return -1;
            if (a.resourceId() == null && b.resourceId() != null) return  1;
            return Double.compare(b.totalHours(), a.totalHours());
        });

        // Build pod summaries
        List<PodInfo> podSummaries = podTotalHours.entrySet().stream()
            .map(pe -> {
                long podId    = pe.getKey();
                RawRow sample = firstPodInfo.get(podId);
                int authCount = podAuthors.getOrDefault(podId, Set.of()).size();
                int bufCnt    = podBufferCount.getOrDefault(podId, 0);
                return new PodInfo(podId, sample.podName(),
                    Math.round(pe.getValue() * 100.0) / 100.0, authCount, bufCnt);
            })
            .sorted(Comparator.comparing(PodInfo::podName))
            .collect(Collectors.toList());

        Set<String> distinctAuthors = new HashSet<>();
        rawRows.forEach(r -> distinctAuthors.add(r.author()));

        return new PodHoursSummary(
            year, periodType.name(), periodIndex, periodLabel,
            Math.round(grandTotalHours  * 100.0) / 100.0,
            distinctAuthors.size(),
            podSummaries.size(),
            Math.round(grandBufferHours * 100.0) / 100.0,
            podSummaries,
            resourceRows
        );
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private Map<String, Resource> buildJiraNameLookup(List<Resource> resources) {
        Map<String, Resource> map = new HashMap<>();

        // Primary: jiraDisplayName field on Resource
        for (Resource r : resources) {
            if (r.getJiraDisplayName() != null && !r.getJiraDisplayName().isBlank()) {
                map.put(normalise(r.getJiraDisplayName()), r);
            }
        }

        // Secondary: jira_resource_mapping table
        try {
            jdbcTemplate.query(
                "SELECT jrm.resource_id, jrm.jira_display_name FROM jira_resource_mapping jrm " +
                "WHERE jrm.jira_display_name IS NOT NULL",
                (RowCallbackHandler) rs -> {
                    Long rid      = rs.getLong("resource_id");
                    String jiraName = rs.getString("jira_display_name");
                    resources.stream()
                        .filter(r -> r.getId().equals(rid))
                        .findFirst()
                        .ifPresent(r -> map.putIfAbsent(normalise(jiraName), r));
                }
            );
        } catch (Exception ex) {
            log.warn("Could not query jira_resource_mapping: {}", ex.getMessage());
        }

        return map;
    }

    private Map<Long, String> buildHomePodLookup() {
        Map<Long, String> map = new HashMap<>();
        try {
            jdbcTemplate.query(
                "SELECT rpa.resource_id, p.name FROM resource_pod_assignment rpa " +
                "JOIN pod p ON rpa.pod_id = p.id",
                (RowCallbackHandler) rs -> map.put(rs.getLong("resource_id"), rs.getString("name"))
            );
        } catch (Exception ex) {
            log.warn("Could not query resource_pod_assignment: {}", ex.getMessage());
        }
        return map;
    }

    private static String normalise(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean namesMatch(String homePodName, String jiraPodName) {
        if (homePodName == null || jiraPodName == null) return false;
        return normalise(homePodName).equals(normalise(jiraPodName));
    }

    private static String monthName(int m) {
        return new String[]{"", "January","February","March","April","May","June",
            "July","August","September","October","November","December"}[m];
    }
}
