package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Aggregates per-release metrics for every configured POD.
 *
 * <p>For each POD → tracked release version, it fetches all non-subtask issues
 * with that fix version and computes:
 * <ul>
 *   <li>Issue-type breakdown (Story / Bug / Task / Incident / …)</li>
 *   <li>Status breakdown (exact status names)</li>
 *   <li>Status-category breakdown (To Do / In Progress / Done)</li>
 *   <li>Story-Points totals (total &amp; done)</li>
 *   <li>Assignee breakdown (issue count per person)</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraReleaseService {

    private final JiraCredentialsService  creds;
    private final JiraPodRepository       podRepo;
    private final JiraPodReleaseRepository releaseRepo;
    private final JiraSyncedIssueRepository issueRepo;
    private final JiraIssueFixVersionRepository fixVersionRepo;
    private final JiraIssueWorklogRepository worklogRepo;
    private final JiraSyncedSprintRepository sprintRepo;

    // ── Public API ────────────────────────────────────────────────────

    /** Returns one {@link ReleaseMetrics} per (pod, version) combination. */
    @Transactional(readOnly = true)
    public List<ReleaseMetrics> getAllReleaseMetrics() {
        if (!creds.isConfigured()) return List.of();

        List<JiraPod> pods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        List<ReleaseMetrics> result = new ArrayList<>();

        for (JiraPod pod : pods) {
            List<JiraPodRelease> tracked = releaseRepo.findByPodOrderByVersionNameAsc(pod);
            if (tracked.isEmpty()) continue;

            List<String> projectKeys = pod.getBoards().stream()
                    .map(JiraPodBoard::getJiraProjectKey)
                    .sorted()
                    .collect(Collectors.toList());

            for (JiraPodRelease rel : tracked) {
                try {
                    ReleaseMetrics m = buildReleaseMetrics(pod, projectKeys, rel);
                    result.add(m);
                } catch (Exception e) {
                    log.warn("Release metrics failed for pod=[{}] version=[{}]: {}",
                            pod.getPodDisplayName(), rel.getVersionName(), e.getMessage());
                    result.add(ReleaseMetrics.error(
                            pod.getId(), pod.getPodDisplayName(), rel.getVersionName(), e.getMessage()));
                }
            }
        }
        return result;
    }

    /** Returns configuration for all PODs — used to render the Release Settings page. */
    @Transactional(readOnly = true)
    public List<ReleaseConfigResponse> getConfig() {
        return podRepo.findAllByOrderBySortOrderAscPodDisplayNameAsc().stream()
                .map(pod -> {
                    List<JiraPodRelease> rels = releaseRepo.findByPodOrderByVersionNameAsc(pod);
                    List<String> versions = rels.stream()
                            .map(JiraPodRelease::getVersionName).collect(Collectors.toList());
                    Map<String, String> notes = rels.stream()
                            .filter(r -> r.getNotes() != null && !r.getNotes().isBlank())
                            .collect(Collectors.toMap(
                                    JiraPodRelease::getVersionName, JiraPodRelease::getNotes,
                                    (a, b) -> a, LinkedHashMap::new));
                    List<String> keys = pod.getBoards().stream()
                            .map(JiraPodBoard::getJiraProjectKey).collect(Collectors.toList());
                    return new ReleaseConfigResponse(pod.getId(), pod.getPodDisplayName(),
                            pod.getEnabled(), versions, keys, notes);
                })
                .collect(Collectors.toList());
    }

    /**
     * Replaces the tracked versions for each POD in the request list.
     * PODs not mentioned are left untouched.
     */
    @Transactional
    public void saveConfig(List<ReleaseConfigRequest> requests) {
        for (ReleaseConfigRequest req : requests) {
            JiraPod pod = podRepo.findById(req.podId()).orElse(null);
            if (pod == null) {
                log.warn("saveConfig: unknown podId={}", req.podId());
                continue;
            }
            releaseRepo.deleteByPodId(pod.getId());
            releaseRepo.flush();

            if (req.versions() != null) {
                for (String v : req.versions()) {
                    if (v != null && !v.isBlank()) {
                        JiraPodRelease rel = new JiraPodRelease(pod, v.trim());
                        if (req.versionNotes() != null) {
                            rel.setNotes(req.versionNotes().get(v.trim()));
                        }
                        releaseRepo.save(rel);
                    }
                }
            }
        }
    }

    /**
     * Debug helper — returns database-backed information about tracked releases on a POD.
     *
     * <p>Call: GET /api/jira/releases/debug/{podId}
     */
    @Transactional(readOnly = true)
    @org.springframework.cache.annotation.CacheEvict(value = "jira-release-issues", allEntries = true)
    public Map<String, Object> debugRelease(Long podId) {
        JiraPod pod = podRepo.findById(podId).orElse(null);
        if (pod == null) return Map.of("error", "Pod not found: " + podId);

        List<String> projectKeys = pod.getBoards().stream()
                .map(JiraPodBoard::getJiraProjectKey).sorted().collect(Collectors.toList());
        List<JiraPodRelease> tracked = releaseRepo.findByPodOrderByVersionNameAsc(pod);

        List<Map<String, Object>> versionResults = new ArrayList<>();

        for (JiraPodRelease rel : tracked) {
            String ver = rel.getVersionName();
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("releaseId",   rel.getId());
            r.put("versionName", ver);
            r.put("projectKeys", projectKeys);

            // ── Query DB for issues with this fix version ──────────────────
            try {
                List<JiraSyncedIssue> issues = issueRepo.findByFixVersionAndProjectKeys(ver, projectKeys);
                r.put("dbIssueCount", issues.size());
                r.put("dbSample", issues.stream().limit(3).map(i ->
                        Map.of("key", i.getIssueKey(),
                               "summary", i.getSummary() != null ? i.getSummary() : "")).collect(Collectors.toList()));
            } catch (Exception e) {
                r.put("dbError", e.getMessage());
            }

            // ── Available fix versions in DB for first project ────────────
            if (!projectKeys.isEmpty()) {
                try {
                    List<JiraIssueFixVersion> fv = fixVersionRepo.findByProjectKeys(List.of(projectKeys.get(0)));
                    r.put("fixVersionsInProject_" + projectKeys.get(0),
                            fv.stream().map(v -> Map.of(
                                    "name", v.getVersionName() != null ? v.getVersionName() : "",
                                    "id",   v.getVersionId() != null ? v.getVersionId() : "",
                                    "released", v.getReleased() != null ? v.getReleased() : false
                            )).collect(Collectors.toList()));
                } catch (Exception e) {
                    r.put("fixVersionsError", e.getMessage());
                }
            }

            versionResults.add(r);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("podId",          pod.getId());
        result.put("podDisplayName", pod.getPodDisplayName());
        result.put("projectKeys",    projectKeys);
        result.put("trackedReleases", tracked.size());
        result.put("versions",       versionResults);
        return result;
    }

    /**
     * Returns all fix versions available in DB for a POD's project boards.
     * Used to populate the version picker in Release Settings.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getFixVersionsForPod(Long podId) {
        if (!creds.isConfigured()) return List.of();
        JiraPod pod = podRepo.findById(podId).orElse(null);
        if (pod == null) return List.of();

        List<String> projectKeys = pod.getBoards().stream()
                .map(JiraPodBoard::getJiraProjectKey)
                .collect(Collectors.toList());
        return fetchAndMergeVersionsFromDb(projectKeys);
    }

    /**
     * Returns all fix versions across every enabled POD's project boards,
     * de-duplicated by version name. Used to populate the global version search picker.
     * Versions from each POD are annotated with which POD they came from.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllFixVersions() {
        if (!creds.isConfigured()) return List.of();

        List<JiraPod> pods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();

        // Collect all versions across all pods, keeping track of which pod each version belongs to
        // Key: version name → merged map (first occurrence wins for metadata; pods list accumulates)
        Map<String, Map<String, Object>> byName = new LinkedHashMap<>();
        for (JiraPod pod : pods) {
            List<String> projectKeys = pod.getBoards().stream()
                    .map(JiraPodBoard::getJiraProjectKey)
                    .collect(Collectors.toList());
            if (projectKeys.isEmpty()) continue;

            try {
                List<JiraIssueFixVersion> versions = fixVersionRepo.findByProjectKeys(projectKeys);
                for (JiraIssueFixVersion v : versions) {
                    String name = v.getVersionName();
                    if (name == null) continue;
                    if (!byName.containsKey(name)) {
                        Map<String, Object> enriched = new LinkedHashMap<>();
                        enriched.put("name", name);
                        enriched.put("id", v.getVersionId());
                        enriched.put("released", v.getReleased() != null ? v.getReleased() : false);
                        enriched.put("releaseDate", v.getReleaseDate() != null ? v.getReleaseDate() : "");
                        // Track which pods carry this version
                        List<String> podNames = new ArrayList<>();
                        podNames.add(pod.getPodDisplayName());
                        enriched.put("podNames", podNames);
                        byName.put(name, enriched);
                    } else {
                        // Add this pod to the existing entry's pod list
                        @SuppressWarnings("unchecked")
                        List<String> podNames = (List<String>) byName.get(name).get("podNames");
                        if (podNames != null && !podNames.contains(pod.getPodDisplayName())) {
                            podNames.add(pod.getPodDisplayName());
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Could not fetch fix versions for pod [{}]: {}",
                        pod.getPodDisplayName(), e.getMessage());
            }
        }

        // Sort: unreleased first, then released sorted by releaseDate desc (most recent first)
        List<Map<String, Object>> sorted = new ArrayList<>(byName.values());
        sorted.sort(Comparator
                .comparing((Map<String, Object> v) -> Boolean.TRUE.equals(v.get("released")))
                .thenComparing(Comparator.comparing(
                        (Map<String, Object> v) -> String.valueOf(v.getOrDefault("releaseDate", "")),
                        Comparator.reverseOrder()
                )));
        return sorted;
    }

    /** Shared helper: merges fix versions from DB project keys, deduped by name, sorted unreleased-first. */
    private List<Map<String, Object>> fetchAndMergeVersionsFromDb(List<String> projectKeys) {
        Map<String, Map<String, Object>> byName = new LinkedHashMap<>();
        try {
            List<JiraIssueFixVersion> versions = fixVersionRepo.findByProjectKeys(projectKeys);
            for (JiraIssueFixVersion v : versions) {
                String name = v.getVersionName();
                if (name != null) {
                    byName.putIfAbsent(name, Map.of(
                            "name", name,
                            "id", v.getVersionId() != null ? v.getVersionId() : "",
                            "released", v.getReleased() != null ? v.getReleased() : false,
                            "releaseDate", v.getReleaseDate() != null ? v.getReleaseDate() : ""
                    ));
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch fix versions from DB for projects {}: {}",
                    projectKeys, e.getMessage());
        }
        List<Map<String, Object>> sorted = new ArrayList<>(byName.values());
        sorted.sort(Comparator
                .comparing((Map<String, Object> v) -> Boolean.TRUE.equals(v.get("released")))
                .thenComparing(v -> String.valueOf(v.getOrDefault("name", ""))));
        return sorted;
    }

    // ── Internal builders ─────────────────────────────────────────────

    /**
     * Story-Points detection no longer needed since storyPoints is directly on JiraSyncedIssue entity.
     * Returns null always.
     */
    String detectSpFieldId(JiraPod pod) {
        return null;
    }

    private ReleaseMetrics buildReleaseMetrics(JiraPod pod, List<String> projectKeys, JiraPodRelease rel) {
        String versionName = rel.getVersionName();
        List<JiraSyncedIssue> issues = issueRepo.findByFixVersionAndProjectKeys(versionName, projectKeys);
        return computeMetrics(pod.getId(), pod.getPodDisplayName(), versionName, rel.getNotes(), issues);
    }

    /**
     * Ad-hoc search for a fix version, broken down one {@link ReleaseMetrics} per enabled POD.
     * Only PODs that have at least one issue tagged with the given version are included.
     */
    @Transactional(readOnly = true)
    public List<ReleaseMetrics> searchRelease(String versionName) {
        if (!creds.isConfigured()) {
            return List.of(ReleaseMetrics.error(null, "Search", versionName, "Jira not configured"));
        }
        List<JiraPod> pods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        if (pods.isEmpty()) {
            return List.of(ReleaseMetrics.error(null, "Search", versionName, "No Jira PODs configured"));
        }

        List<ReleaseMetrics> results = new ArrayList<>();
        for (JiraPod pod : pods) {
            List<String> projectKeys = pod.getBoards().stream()
                    .map(JiraPodBoard::getJiraProjectKey)
                    .distinct().sorted().collect(Collectors.toList());
            if (projectKeys.isEmpty()) continue;

            try {
                List<JiraSyncedIssue> issues = issueRepo.findByFixVersionAndProjectKeys(versionName, projectKeys);
                if (!issues.isEmpty()) {
                    results.add(computeMetrics(pod.getId(), pod.getPodDisplayName(), versionName, null, issues));
                }
            } catch (Exception e) {
                log.warn("Ad-hoc release search failed for pod=[{}] version=[{}]: {}",
                        pod.getPodDisplayName(), versionName, e.getMessage());
                results.add(ReleaseMetrics.error(pod.getId(), pod.getPodDisplayName(), versionName, e.getMessage()));
            }
        }
        return results;
    }

    /**
     * Processes a list of {@link JiraSyncedIssue} entities into a {@link ReleaseMetrics} object.
     * Shared by {@link #buildReleaseMetrics}, {@link #searchRelease}, and {@link JiraSprintIssueService}.
     */
    ReleaseMetrics computeMetrics(Long podId, String podDisplayName,
                                          String versionName, String notes,
                                          List<JiraSyncedIssue> issues) {
        int totalIssues = issues.size();
        Map<String, Integer> issueTypeBreakdown  = new LinkedHashMap<>();
        Map<String, Integer> statusBreakdown      = new LinkedHashMap<>();
        Map<String, Integer> statusCatBreakdown   = new LinkedHashMap<>();
        Map<String, Integer> assigneeBreakdown    = new LinkedHashMap<>();
        Map<String, Double>  assigneeHours        = new LinkedHashMap<>();
        double totalSP           = 0;
        double doneSP            = 0;
        double totalHoursLogged  = 0;
        List<IssueRow> issueRows = new ArrayList<>();

        for (JiraSyncedIssue issue : issues) {
            String issueKey = issue.getIssueKey() != null ? issue.getIssueKey() : "?";

            // ── Issue type ────────────────────────────────────────────
            String typeName = issue.getIssueType() != null ? issue.getIssueType() : "Unknown";
            issueTypeBreakdown.merge(typeName, 1, Integer::sum);

            // ── Status ────────────────────────────────────────────────
            String statusName = issue.getStatusName() != null ? issue.getStatusName() : "Unknown";
            String statusCatName = issue.getStatusCategory() != null ? issue.getStatusCategory() : "Unknown";
            statusBreakdown.merge(statusName, 1, Integer::sum);
            statusCatBreakdown.merge(statusCatName, 1, Integer::sum);

            // ── Assignee ─────────────────────────────────────────────
            String assigneeName = issue.getAssigneeDisplayName() != null ? issue.getAssigneeDisplayName() : "Unassigned";
            assigneeBreakdown.merge(assigneeName, 1, Integer::sum);

            // ── Story Points ──────────────────────────────────────────
            double sp = issue.getStoryPoints() != null ? issue.getStoryPoints() : 0.0;
            if (sp > 0) {
                totalSP += sp;
                if ("Done".equalsIgnoreCase(statusCatName)) doneSP += sp;
            }

            // ── Hours logged (timeSpent is in seconds) ─────────────
            double hours = 0;
            if (issue.getTimeSpent() != null && issue.getTimeSpent() > 0) {
                hours = issue.getTimeSpent() / 3600.0;
            }
            totalHoursLogged += hours;
            assigneeHours.merge(assigneeName, hours, Double::sum);

            // ── Summary ───────────────────────────────────────────────
            String summary = issue.getSummary() != null ? issue.getSummary() : "";

            // ── Parent key (for subtask grouping) ────────────────────
            String parentKey = null;
            if (issue.getSubtask() != null && issue.getSubtask()) {
                // If this is a subtask, we might need to load parent separately
                // For now, we'll leave parentKey as null
                parentKey = null;
            }

            issueRows.add(new IssueRow(issueKey, summary, typeName, statusName, statusCatName,
                    assigneeName, sp, hours, parentKey));
        }

        issueRows.sort(Comparator
                .comparingInt((IssueRow r) -> switch (r.statusCategory()) {
                    case "In Progress" -> 0;
                    case "To Do"       -> 1;
                    default            -> 2;
                })
                .thenComparing(IssueRow::key));

        Map<String, Double> sortedAssigneeHours = assigneeHours.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue,
                        (a, b) -> a, LinkedHashMap::new));

        return new ReleaseMetrics(
                podId, podDisplayName, versionName, notes,
                totalIssues,
                sortByValueDesc(issueTypeBreakdown),
                sortByValueDesc(statusBreakdown),
                sortByValueDesc(statusCatBreakdown),
                totalSP, doneSP,
                Math.round(totalHoursLogged * 10.0) / 10.0,
                sortedAssigneeHours,
                sortByValueDesc(assigneeBreakdown),
                issueRows,
                null
        );
    }

    /** Returns a new map sorted by value descending. */
    private static <K> Map<K, Integer> sortByValueDesc(Map<K, Integer> map) {
        return map.entrySet().stream()
                .sorted(Map.Entry.<K, Integer>comparingByValue().reversed())
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (a, b) -> a,
                        LinkedHashMap::new));
    }

    // ── DTOs ──────────────────────────────────────────────────────────

    /** Lightweight summary of a single Jira issue, returned inside ReleaseMetrics. */
    public record IssueRow(
            String key,
            String summary,
            String issueType,
            String statusName,
            String statusCategory,
            String assignee,
            double storyPoints,
            double hoursLogged,
            String parentKey
    ) {}

    public record ReleaseMetrics(
            Long   podId,
            String podDisplayName,
            String versionName,
            String notes,
            int    totalIssues,
            Map<String, Integer> issueTypeBreakdown,
            Map<String, Integer> statusBreakdown,
            Map<String, Integer> statusCategoryBreakdown,
            double totalSP,
            double doneSP,
            double totalHoursLogged,
            Map<String, Double>  assigneeHoursLogged,
            Map<String, Integer> assigneeBreakdown,
            List<IssueRow>       issues,
            String errorMessage
    ) {
        static ReleaseMetrics error(Long podId, String podDisplayName, String versionName, String msg) {
            return new ReleaseMetrics(podId, podDisplayName, versionName, null,
                    0, Map.of(), Map.of(), Map.of(), 0, 0, 0, Map.of(), Map.of(), List.of(), msg);
        }
    }

    public record ReleaseConfigResponse(
            Long         podId,
            String       podDisplayName,
            Boolean      enabled,
            List<String> versions,
            List<String> boardKeys,
            Map<String, String> versionNotes   // versionName → notes
    ) {}

    public record ReleaseConfigRequest(
            Long                podId,
            List<String>        versions,
            Map<String, String> versionNotes   // versionName → notes
    ) {}
}
