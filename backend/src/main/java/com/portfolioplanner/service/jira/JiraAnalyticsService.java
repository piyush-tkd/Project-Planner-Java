package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import org.springframework.cache.annotation.Cacheable;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Aggregates Jira issue data across all enabled PODs for the analytics dashboard.
 * NOW READS FROM LOCAL POSTGRESQL (synced by JiraIssueSyncService) instead of live API.
 * Output format is identical to before for frontend compatibility.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraAnalyticsService {

    private final JiraCredentialsService creds;
    private final JiraPodRepository podRepo;
    private final JiraSyncedIssueRepository issueRepo;
    private final JiraIssueLabelRepository labelRepo;
    private final JiraIssueComponentRepository componentRepo;
    private final JiraIssueFixVersionRepository fixVersionRepo;
    private final JiraIssueWorklogRepository worklogRepo;
    private final JiraSyncStatusRepository syncStatusRepo;
    private final JiraSupportBoardRepository supportBoardRepo;

    /* ── Main aggregation (now from DB) ───────────────────────────────── */

    @Cacheable(value = "jira-analytics", key = "#months + '-' + (#podIds != null ? #podIds.toString() : 'all') + '-sb-' + (#supportBoardIds != null ? #supportBoardIds.toString() : 'none')")
    public Map<String, Object> getAnalytics(int months, List<Long> podIds, List<Long> supportBoardIds) {

        List<JiraPod> pods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        if (podIds != null && !podIds.isEmpty()) {
            pods = pods.stream().filter(p -> podIds.contains(p.getId())).collect(Collectors.toList());
        }

        List<String> projectKeys = pods.stream()
                .flatMap(p -> p.getBoards().stream())
                .map(JiraPodBoard::getJiraProjectKey)
                .distinct()
                .collect(Collectors.toList());

        // Also add project keys from selected support boards
        if (supportBoardIds != null && !supportBoardIds.isEmpty()) {
            List<String> sbKeys = supportBoardRepo.findByEnabledTrue().stream()
                    .filter(sb -> supportBoardIds.contains(sb.getId()) && sb.getProjectKey() != null)
                    .map(JiraSupportBoard::getProjectKey)
                    .distinct()
                    .collect(Collectors.toList());
            sbKeys.forEach(k -> { if (!projectKeys.contains(k)) projectKeys.add(k); });
        }

        if (projectKeys.isEmpty()) {
            return Map.of("error", "No Jira PODs configured or selected.");
        }

        // Check if we have any synced data
        long issueCount = issueRepo.findByProjectKeyIn(projectKeys).size();
        if (issueCount == 0) {
            return Map.of("error", "No synced data yet. Please trigger a Jira sync first.",
                          "needsSync", true);
        }

        // Build a POD name lookup: projectKey → podDisplayName
        Map<String, String> keyToPod = new LinkedHashMap<>();
        for (JiraPod pod : pods) {
            for (JiraPodBoard board : pod.getBoards()) {
                keyToPod.putIfAbsent(board.getJiraProjectKey(), pod.getPodDisplayName());
            }
        }

        LocalDateTime cutoff = LocalDate.now().minusMonths(months).atStartOfDay();

        // ── 1. Resolved issues in period (from DB) ────────────────────────
        List<JiraSyncedIssue> resolvedIssues = issueRepo.findResolvedSince(projectKeys, cutoff);

        // ── 2. Created issues in period (from DB) ─────────────────────────
        List<JiraSyncedIssue> createdIssues = issueRepo.findCreatedSince(projectKeys, cutoff);

        // ── 3. Currently open issues (from DB) ────────────────────────────
        List<JiraSyncedIssue> openIssues = issueRepo.findOpenByProjectKeys(projectKeys);

        // ── Deduplicated all issues (union of created + resolved) ─────────
        Map<String, JiraSyncedIssue> issueIndex = new LinkedHashMap<>();
        for (var issue : createdIssues) issueIndex.putIfAbsent(issue.getIssueKey(), issue);
        for (var issue : resolvedIssues) issueIndex.putIfAbsent(issue.getIssueKey(), issue);
        List<JiraSyncedIssue> allIssues = new ArrayList<>(issueIndex.values());

        // Collect all issue keys for multi-value lookups
        List<String> allKeys = allIssues.stream().map(JiraSyncedIssue::getIssueKey).collect(Collectors.toList());
        List<String> openKeys = openIssues.stream().map(JiraSyncedIssue::getIssueKey).collect(Collectors.toList());

        // Bulk-load multi-value data
        Map<String, List<String>> labelsByKey = groupLabels(allKeys);
        Map<String, List<String>> componentsByKey = groupComponents(allKeys);
        Map<String, List<String>> fixVersionsByKey = groupFixVersions(allKeys);

        // ── Build result ──────────────────────────────────────────────────
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("lookbackMonths", months);
        result.put("projectKeys", projectKeys);
        result.put("podNames", pods.stream().map(JiraPod::getPodDisplayName).collect(Collectors.toList()));
        result.put("totalResolved", resolvedIssues.size());
        result.put("totalCreated", createdIssues.size());
        result.put("totalOpen", openIssues.size());

        // Add sync info
        result.put("lastSyncAt", getLastSyncTime(projectKeys));

        // ── KPI Cards ─────────────────────────────────────────────────────
        result.put("kpis", buildKpis(resolvedIssues, createdIssues, openIssues));

        // ── Distribution breakdowns ───────────────────────────────────────
        result.put("byType", countByField(allIssues, JiraSyncedIssue::getIssueType));
        result.put("byStatus", countByField(allIssues, JiraSyncedIssue::getStatusName));
        result.put("byPriority", countByField(allIssues, JiraSyncedIssue::getPriorityName));
        result.put("byAssignee", countByAssignee(allIssues));
        result.put("byLabel", countByMultiValue(allIssues, labelsByKey));
        result.put("byComponent", countByMultiValue(allIssues, componentsByKey));
        result.put("byPod", countByPod(allIssues, keyToPod));
        result.put("byFixVersion", countByMultiValue(allIssues, fixVersionsByKey));

        // ── Extended dimension breakdowns ─────────────────────────────────
        result.put("byEpic", countByField(allIssues, JiraSyncedIssue::getEpicName));
        result.put("byReporter", countByField(allIssues, JiraSyncedIssue::getReporterDisplayName));
        result.put("byResolution", countByField(resolvedIssues, JiraSyncedIssue::getResolution));
        result.put("bySprint", countByField(allIssues, JiraSyncedIssue::getSprintName));
        result.put("byProject", countByField(allIssues, JiraSyncedIssue::getProjectKey));
        result.put("byStatusCategory", countByField(allIssues, JiraSyncedIssue::getStatusCategory));
        result.put("byCreator", countByField(allIssues, JiraSyncedIssue::getCreatorDisplayName));
        result.put("byCreatedMonth", countByMonth(allIssues, JiraSyncedIssue::getCreatedAt));
        result.put("byResolvedMonth", countByMonth(resolvedIssues, JiraSyncedIssue::getResolutionDate));

        // ── Created vs Resolved trend (weekly) ────────────────────────────
        result.put("createdVsResolved", buildCreatedVsResolved(createdIssues, resolvedIssues, months));

        // ── Workload (open issues per assignee) ───────────────────────────
        result.put("workload", buildWorkload(openIssues));

        // ── Issue aging ───────────────────────────────────────────────────
        result.put("aging", buildAging(openIssues));

        // ── Cycle time distribution ───────────────────────────────────────
        result.put("cycleTime", buildCycleTime(resolvedIssues));

        // ── Bug trend ─────────────────────────────────────────────────────
        result.put("bugTrend", buildBugTrend(createdIssues, months));

        // ── Status category breakdown ─────────────────────────────────────
        result.put("statusCategoryBreakdown", buildStatusCategoryBreakdown(openIssues));

        // ── Worklog by author (time logged per person) ─────────────────────
        result.put("byWorklogAuthor", buildWorklogByAuthor(allKeys));

        log.info("Analytics built from DB: {} resolved, {} created, {} open ({} total unique)",
                resolvedIssues.size(), createdIssues.size(), openIssues.size(), allIssues.size());

        return result;
    }

    /* ── Available filters ───────────────────────────────────────────── */

    public Map<String, Object> getAvailableFilters() {
        List<JiraPod> pods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        List<Map<String, Object>> podList = pods.stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("name", p.getPodDisplayName());
            m.put("projectKeys", p.getBoards().stream().map(JiraPodBoard::getJiraProjectKey).collect(Collectors.toList()));
            return m;
        }).collect(Collectors.toList());

        List<JiraSupportBoard> supportBoards = supportBoardRepo.findByEnabledTrue();
        List<Map<String, Object>> sbList = supportBoards.stream().map(sb -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", sb.getId());
            m.put("name", sb.getName());
            m.put("projectKey", sb.getProjectKey());
        return m;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("pods", podList);
        result.put("supportBoards", sbList);
        return result;
    }

    /* ── KPI computation ─────────────────────────────────────────────── */

    private Map<String, Object> buildKpis(
            List<JiraSyncedIssue> resolved,
            List<JiraSyncedIssue> created,
            List<JiraSyncedIssue> open) {

        Map<String, Object> kpis = new LinkedHashMap<>();
        kpis.put("totalOpen", open.size());
        kpis.put("totalCreated", created.size());
        kpis.put("totalResolved", resolved.size());

        long bugCount = created.stream().filter(i -> isBugType(i.getIssueType())).count();
        double bugRatio = created.isEmpty() ? 0 : Math.round(bugCount * 1000.0 / created.size()) / 10.0;
        kpis.put("bugCount", bugCount);
        kpis.put("bugRatio", bugRatio);

        double avgCycle = resolved.stream()
                .mapToDouble(this::cycleTimeDays)
                .filter(d -> d > 0)
                .average().orElse(0);
        kpis.put("avgCycleTimeDays", Math.round(avgCycle * 10.0) / 10.0);

        // Throughput per week
        double weeks = 1;
        if (!resolved.isEmpty()) {
            LocalDate earliest = resolved.stream()
                    .map(JiraSyncedIssue::getResolutionDate)
                    .filter(Objects::nonNull)
                    .map(LocalDateTime::toLocalDate)
                    .min(Comparator.naturalOrder())
                    .orElse(LocalDate.now());
            weeks = Math.max(1, ChronoUnit.WEEKS.between(earliest, LocalDate.now()));
        }
        kpis.put("throughputPerWeek", Math.round(resolved.size() * 10.0 / weeks) / 10.0);

        double totalSP = resolved.stream()
                .mapToDouble(i -> i.getStoryPoints() != null ? i.getStoryPoints() : 0)
                .sum();
        kpis.put("totalSPResolved", Math.round(totalSP));

        double totalHours = resolved.stream()
                .mapToDouble(i -> i.getTimeSpent() != null ? i.getTimeSpent() / 3600.0 : 0)
                .sum();
        kpis.put("totalHoursLogged", Math.round(totalHours * 10.0) / 10.0);

        return kpis;
    }

    /* ── Distribution helpers (DB-backed) ─────────────────────────────── */

    private List<Map<String, Object>> countByField(List<JiraSyncedIssue> issues,
                                                     java.util.function.Function<JiraSyncedIssue, String> extractor) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (var issue : issues) {
            String val = extractor.apply(issue);
            counts.merge(val != null ? val : "Unset", 1, Integer::sum);
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", e.getKey());
                    m.put("count", e.getValue());
                    return m;
                })
                .collect(Collectors.toList());
    }

    /** Group issues by year-month of a LocalDateTime field (e.g. createdAt, resolutionDate). */
    private List<Map<String, Object>> countByMonth(List<JiraSyncedIssue> issues,
                                                     java.util.function.Function<JiraSyncedIssue, java.time.LocalDateTime> extractor) {
        Map<String, Integer> counts = new java.util.TreeMap<>();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM");
        for (var issue : issues) {
            java.time.LocalDateTime dt = extractor.apply(issue);
            if (dt == null) continue;
            String key = dt.format(fmt);
            counts.merge(key, 1, Integer::sum);
        }
        return counts.entrySet().stream()
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", e.getKey());
                    m.put("count", e.getValue());
                    return m;
                })
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> countByAssignee(List<JiraSyncedIssue> issues) {
        Map<String, double[]> data = new LinkedHashMap<>(); // [count, sp, hours]
        for (var issue : issues) {
            String assignee = issue.getAssigneeDisplayName() != null ? issue.getAssigneeDisplayName() : "Unassigned";
            double[] arr = data.computeIfAbsent(assignee, k -> new double[3]);
            arr[0]++;
            arr[1] += issue.getStoryPoints() != null ? issue.getStoryPoints() : 0;
            arr[2] += issue.getTimeSpent() != null ? issue.getTimeSpent() / 3600.0 : 0;
        }
        return data.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue()[0], a.getValue()[0]))
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", e.getKey());
                    m.put("count", (int) e.getValue()[0]);
                    m.put("sp", (int) e.getValue()[1]);
                    m.put("hours", (int) e.getValue()[2]);
                    return m;
                })
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> countByMultiValue(List<JiraSyncedIssue> issues,
                                                          Map<String, List<String>> valuesByKey) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (var issue : issues) {
            List<String> values = valuesByKey.getOrDefault(issue.getIssueKey(), List.of());
            for (String val : values) {
                counts.merge(val, 1, Integer::sum);
            }
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(30)
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", e.getKey());
                    m.put("count", e.getValue());
                    return m;
                })
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> countByPod(List<JiraSyncedIssue> issues, Map<String, String> keyToPod) {
        Map<String, double[]> data = new LinkedHashMap<>(); // [count, sp]
        for (var issue : issues) {
            String podName = keyToPod.getOrDefault(issue.getProjectKey(), issue.getProjectKey());
            double[] arr = data.computeIfAbsent(podName, k -> new double[2]);
            arr[0]++;
            arr[1] += issue.getStoryPoints() != null ? issue.getStoryPoints() : 0;
        }
        return data.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue()[0], a.getValue()[0]))
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", e.getKey());
                    m.put("count", (int) e.getValue()[0]);
                    m.put("sp", (int) e.getValue()[1]);
                    return m;
                })
                .collect(Collectors.toList());
    }

    /* ── Trend builders ──────────────────────────────────────────────── */

    private List<Map<String, Object>> buildCreatedVsResolved(
            List<JiraSyncedIssue> created, List<JiraSyncedIssue> resolved, int months) {

        Map<String, int[]> buckets = new TreeMap<>();
        LocalDate cutoff = LocalDate.now().minusMonths(months);

        for (var issue : created) {
            if (issue.getCreatedAt() == null) continue;
            LocalDate d = issue.getCreatedAt().toLocalDate();
            if (!d.isBefore(cutoff)) {
                buckets.computeIfAbsent(weekKey(d), k -> new int[2])[0]++;
            }
        }
        for (var issue : resolved) {
            if (issue.getResolutionDate() == null) continue;
            LocalDate d = issue.getResolutionDate().toLocalDate();
            if (!d.isBefore(cutoff)) {
                buckets.computeIfAbsent(weekKey(d), k -> new int[2])[1]++;
            }
        }

        return buckets.entrySet().stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("week", e.getKey());
            m.put("created", e.getValue()[0]);
            m.put("resolved", e.getValue()[1]);
            return m;
        }).collect(Collectors.toList());
    }

    private List<Map<String, Object>> buildBugTrend(List<JiraSyncedIssue> created, int months) {
        Map<String, int[]> buckets = new TreeMap<>();
        LocalDate cutoff = LocalDate.now().minusMonths(months);

        for (var issue : created) {
            if (issue.getCreatedAt() == null) continue;
            LocalDate d = issue.getCreatedAt().toLocalDate();
            if (!d.isBefore(cutoff)) {
                String mk = d.format(DateTimeFormatter.ofPattern("yyyy-MM"));
                int[] arr = buckets.computeIfAbsent(mk, k -> new int[2]);
                if (isBugType(issue.getIssueType())) arr[0]++;
                arr[1]++;
            }
        }

        return buckets.entrySet().stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("month", e.getKey());
            m.put("bugs", e.getValue()[0]);
            m.put("total", e.getValue()[1]);
            m.put("bugRate", e.getValue()[1] > 0
                    ? Math.round(e.getValue()[0] * 1000.0 / e.getValue()[1]) / 10.0 : 0);
            return m;
        }).collect(Collectors.toList());
    }

    /* ── Workload & Aging ────────────────────────────────────────────── */

    private List<Map<String, Object>> buildWorkload(List<JiraSyncedIssue> open) {
        Map<String, double[]> data = new LinkedHashMap<>(); // [total, bugs, highPri, sp]
        for (var issue : open) {
            String assignee = issue.getAssigneeDisplayName() != null ? issue.getAssigneeDisplayName() : "Unassigned";
            double[] arr = data.computeIfAbsent(assignee, k -> new double[4]);
            arr[0]++;
            if (isBugType(issue.getIssueType())) arr[1]++;
            if (isHighPriority(issue.getPriorityName())) arr[2]++;
            arr[3] += issue.getStoryPoints() != null ? issue.getStoryPoints() : 0;
        }
        return data.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue()[0], a.getValue()[0]))
                .limit(25)
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("assignee", e.getKey());
                    m.put("total", (int) e.getValue()[0]);
                    m.put("bugs", (int) e.getValue()[1]);
                    m.put("highPriority", (int) e.getValue()[2]);
                    m.put("sp", (int) e.getValue()[3]);
                    return m;
                })
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> buildAging(List<JiraSyncedIssue> open) {
        int[] buckets = new int[5];
        String[] labels = {"0–7 days", "8–14 days", "15–30 days", "31–90 days", "90+ days"};

        for (var issue : open) {
            if (issue.getCreatedAt() == null) continue;
            long age = ChronoUnit.DAYS.between(issue.getCreatedAt().toLocalDate(), LocalDate.now());
            if (age <= 7) buckets[0]++;
            else if (age <= 14) buckets[1]++;
            else if (age <= 30) buckets[2]++;
            else if (age <= 90) buckets[3]++;
            else buckets[4]++;
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < labels.length; i++) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("bucket", labels[i]);
            m.put("count", buckets[i]);
            result.add(m);
        }
        return result;
    }

    /* ── Cycle time distribution ──────────────────────────────────────── */

    private List<Map<String, Object>> buildCycleTime(List<JiraSyncedIssue> resolved) {
        int[] buckets = new int[6];
        String[] labels = {"< 1 day", "1–3 days", "4–7 days", "8–14 days", "15–30 days", "30+ days"};

        for (var issue : resolved) {
            double days = cycleTimeDays(issue);
            if (days <= 0) continue;
            if (days < 1) buckets[0]++;
            else if (days <= 3) buckets[1]++;
            else if (days <= 7) buckets[2]++;
            else if (days <= 14) buckets[3]++;
            else if (days <= 30) buckets[4]++;
            else buckets[5]++;
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < labels.length; i++) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("bucket", labels[i]);
            m.put("count", buckets[i]);
            result.add(m);
        }
        return result;
    }

    /* ── Status category flow ─────────────────────────────────────────── */

    private Map<String, Object> buildStatusCategoryBreakdown(List<JiraSyncedIssue> open) {
        Map<String, Integer> cats = new LinkedHashMap<>();
        cats.put("To Do", 0);
        cats.put("In Progress", 0);

        for (var issue : open) {
            String cat = issue.getStatusCategory();
            if (cat == null) continue;
            // Map Jira status category keys to display names
            String displayName = switch (cat) {
                case "new" -> "To Do";
                case "indeterminate" -> "In Progress";
                case "done" -> "Done";
                default -> cat;
            };
            cats.merge(displayName, 1, Integer::sum);
        }
        return new LinkedHashMap<>(cats);
    }

    /* ── Worklog aggregation ─────────────────────────────────────────── */

    private List<Map<String, Object>> buildWorklogByAuthor(List<String> issueKeys) {
        if (issueKeys.isEmpty()) return List.of();
        List<Object[]> rows = worklogRepo.sumTimeByAuthor(issueKeys);
        return rows.stream()
                .sorted((a, b) -> Long.compare((Long) b[1], (Long) a[1]))
                .limit(30)
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", row[0] != null ? row[0] : "Unknown");
                    m.put("hours", Math.round(((Long) row[1]) / 3600.0 * 10.0) / 10.0);
                    return m;
                })
                .collect(Collectors.toList());
    }

    /* ── Multi-value field loaders ────────────────────────────────────── */

    private Map<String, List<String>> groupLabels(List<String> issueKeys) {
        if (issueKeys.isEmpty()) return Map.of();
        return labelRepo.findByIssueKeyIn(issueKeys).stream()
                .collect(Collectors.groupingBy(
                        JiraIssueLabel::getIssueKey,
                        Collectors.mapping(JiraIssueLabel::getLabel, Collectors.toList())));
    }

    private Map<String, List<String>> groupComponents(List<String> issueKeys) {
        if (issueKeys.isEmpty()) return Map.of();
        return componentRepo.findByIssueKeyIn(issueKeys).stream()
                .collect(Collectors.groupingBy(
                        JiraIssueComponent::getIssueKey,
                        Collectors.mapping(JiraIssueComponent::getComponentName, Collectors.toList())));
    }

    private Map<String, List<String>> groupFixVersions(List<String> issueKeys) {
        if (issueKeys.isEmpty()) return Map.of();
        return fixVersionRepo.findByIssueKeyIn(issueKeys).stream()
                .collect(Collectors.groupingBy(
                        JiraIssueFixVersion::getIssueKey,
                        Collectors.mapping(JiraIssueFixVersion::getVersionName, Collectors.toList())));
    }

    /* ── Helpers ──────────────────────────────────────────────────────── */

    private double cycleTimeDays(JiraSyncedIssue issue) {
        if (issue.getCreatedAt() == null || issue.getResolutionDate() == null) return 0;
        return ChronoUnit.DAYS.between(issue.getCreatedAt().toLocalDate(),
                                        issue.getResolutionDate().toLocalDate());
    }

    private String weekKey(LocalDate d) {
        LocalDate monday = d.minusDays(d.getDayOfWeek().getValue() - 1L);
        return monday.format(DateTimeFormatter.ofPattern("MMM dd"));
    }

    private boolean isBugType(String type) {
        if (type == null) return false;
        String lower = type.toLowerCase();
        return lower.contains("bug") || lower.contains("defect")
                || lower.contains("incident") || lower.contains("hotfix");
    }

    private boolean isHighPriority(String priority) {
        if (priority == null) return false;
        String lower = priority.toLowerCase();
        return lower.equals("highest") || lower.equals("high")
                || lower.equals("critical") || lower.equals("blocker");
    }

    private String getLastSyncTime(List<String> projectKeys) {
        return syncStatusRepo.findAllByOrderByProjectKeyAsc().stream()
                .filter(s -> projectKeys.contains(s.getProjectKey()))
                .map(JiraSyncStatus::getLastSyncAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .map(dt -> dt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")))
                .orElse(null);
    }
}
