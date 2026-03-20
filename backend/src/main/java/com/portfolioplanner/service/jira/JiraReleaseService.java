package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.domain.model.JiraPodRelease;
import com.portfolioplanner.domain.repository.JiraPodReleaseRepository;
import com.portfolioplanner.domain.repository.JiraPodRepository;
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

    private final JiraClient              jiraClient;
    private final JiraCredentialsService  creds;
    private final JiraPodRepository       podRepo;
    private final JiraPodReleaseRepository releaseRepo;

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
     * Debug helper — evicts the release-issues cache, then bypasses all caching and runs
     * both the scoped and unscoped JQL variants for every tracked release on a POD.
     *
     * <p>Call: GET /api/jira/releases/debug/{podId}
     */
    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
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

            // Resolve version ID for diagnostic purposes only
            String resolvedId = resolveVersionId(projectKeys, ver);
            r.put("resolvedVersionId", resolvedId);

            // ── Check actual issue counts via Jira versions API ─────────
            if (resolvedId != null) {
                r.put("versionIssueCounts", jiraClient.getVersionRelatedIssueCounts(resolvedId));
            }

            // ── JQL 1: scoped (name-based, via POST) ────────────────────
            String projectList = projectKeys.stream()
                    .map(k -> "\"" + k + "\"")
                    .collect(Collectors.joining(","));
            String quotedName = "\"" + ver.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
            String fixVersionClause = "fixVersion = " + quotedName;
            String scopedJql = "project in (" + projectList + ") AND " + fixVersionClause;
            try {
                List<Map<String, Object>> issues = jiraClient.searchIssuesPost(scopedJql,
                        List.of("summary", "status", "issuetype", "fixVersions"), 10);
                r.put("scopedJql",    scopedJql);
                r.put("scopedCount",  issues.size());
                r.put("scopedSample", issues.stream().limit(3).map(i ->
                        Map.of("key", i.getOrDefault("key", "?"),
                               "summary", extractSummary(i))).collect(Collectors.toList()));
            } catch (Exception e) {
                r.put("scopedJql",   scopedJql);
                r.put("scopedError", e.getMessage());
            }

            // ── JQL 2: unscoped (name-based) ────────────────────────────
            try {
                List<Map<String, Object>> issues = jiraClient.searchIssuesPost(fixVersionClause,
                        List.of("summary", "status", "issuetype", "fixVersions", "project"), 10);
                r.put("unscopedJql",    fixVersionClause);
                r.put("unscopedCount",  issues.size());
                r.put("unscopedSample", issues.stream().limit(3).map(i ->
                        Map.of("key", i.getOrDefault("key", "?"),
                               "summary", extractSummary(i),
                               "project", extractProject(i))).collect(Collectors.toList()));
            } catch (Exception e) {
                r.put("unscopedJql",   fixVersionClause);
                r.put("unscopedError", e.getMessage());
            }

            // ── Available fix versions in first project ─────────────────
            if (!projectKeys.isEmpty()) {
                try {
                    List<Map<String, Object>> fv = jiraClient.getFixVersions(projectKeys.get(0));
                    r.put("fixVersionsInProject_" + projectKeys.get(0),
                            fv.stream().map(v -> Map.of(
                                    "name", v.getOrDefault("name", ""),
                                    "id",   v.getOrDefault("id", ""),
                                    "released", v.getOrDefault("released", false)
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

    @SuppressWarnings("unchecked")
    private static String extractSummary(Map<String, Object> issue) {
        Object fields = issue.get("fields");
        if (fields instanceof Map) {
            Object s = ((Map<?,?>) fields).get("summary");
            if (s instanceof String) return (String) s;
        }
        return "";
    }

    @SuppressWarnings("unchecked")
    private static String extractProject(Map<String, Object> issue) {
        Object fields = issue.get("fields");
        if (fields instanceof Map) {
            Object p = ((Map<?,?>) fields).get("project");
            if (p instanceof Map) {
                Object k = ((Map<?,?>) p).get("key");
                if (k instanceof String) return (String) k;
            }
        }
        return "";
    }

    /**
     * Returns all fix versions available in Jira for a POD's project boards.
     * Used to populate the version picker in Release Settings.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getFixVersionsForPod(Long podId) {
        if (!creds.isConfigured()) return List.of();
        JiraPod pod = podRepo.findById(podId).orElse(null);
        if (pod == null) return List.of();

        return fetchAndMergeVersions(pod.getBoards());
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

        // Collect all boards across all pods, keeping track of which pod each version belongs to
        // Key: version name → merged map (first occurrence wins for metadata; pods list accumulates)
        Map<String, Map<String, Object>> byName = new LinkedHashMap<>();
        for (JiraPod pod : pods) {
            for (JiraPodBoard board : pod.getBoards()) {
                try {
                    List<Map<String, Object>> versions = jiraClient.getFixVersions(board.getJiraProjectKey());
                    for (Map<String, Object> v : versions) {
                        String name = (String) v.get("name");
                        if (name == null) continue;
                        if (!byName.containsKey(name)) {
                            Map<String, Object> enriched = new LinkedHashMap<>(v);
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
                    log.warn("Could not fetch fix versions for project [{}] in pod [{}]: {}",
                            board.getJiraProjectKey(), pod.getPodDisplayName(), e.getMessage());
                }
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

    /** Shared helper: merges fix versions from a list of boards, deduped by name, sorted unreleased-first. */
    private List<Map<String, Object>> fetchAndMergeVersions(List<JiraPodBoard> boards) {
        Map<String, Map<String, Object>> byName = new LinkedHashMap<>();
        for (JiraPodBoard board : boards) {
            try {
                List<Map<String, Object>> versions = jiraClient.getFixVersions(board.getJiraProjectKey());
                for (Map<String, Object> v : versions) {
                    String name = (String) v.get("name");
                    if (name != null) byName.putIfAbsent(name, v);
                }
            } catch (Exception e) {
                log.warn("Could not fetch fix versions for project [{}]: {}",
                        board.getJiraProjectKey(), e.getMessage());
            }
        }
        List<Map<String, Object>> sorted = new ArrayList<>(byName.values());
        sorted.sort(Comparator
                .comparing((Map<String, Object> v) -> Boolean.TRUE.equals(v.get("released")))
                .thenComparing(v -> String.valueOf(v.getOrDefault("name", ""))));
        return sorted;
    }

    // ── Internal builders ─────────────────────────────────────────────

    /**
     * Looks up the Jira numeric version ID for {@code versionName} across the POD's
     * project keys. Returns the first match, or {@code null} if not found.
     *
     * <p>Uses the cached {@code jira-fix-versions} result so this is typically free.
     */
    private String resolveVersionId(List<String> projectKeys, String versionName) {
        for (String projectKey : projectKeys) {
            try {
                for (Map<String, Object> v : jiraClient.getFixVersions(projectKey)) {
                    if (versionName.equals(v.get("name"))) {
                        Object id = v.get("id");
                        if (id != null) {
                            String sid = String.valueOf(id);
                            log.info("Resolved version '{}' → id={} in project {}", versionName, sid, projectKey);
                            return sid;
                        }
                    }
                }
            } catch (Exception e) {
                log.debug("Could not resolve version id for '{}' in {}: {}", versionName, projectKey, e.getMessage());
            }
        }
        log.warn("Could not resolve version id for '{}' in any of {}", versionName, projectKeys);
        return null;
    }

    /**
     * Attempts to detect the Story-Points custom field ID from the first Scrum board
     * belonging to the POD. Returns null if detection fails (caller falls back to
     * the hard-coded field list).
     */
    @SuppressWarnings("unchecked")
    String detectSpFieldId(JiraPod pod) {
        try {
            if (pod.getBoards().isEmpty()) return null;
            String firstKey = pod.getBoards().get(0).getJiraProjectKey();
            List<Map<String, Object>> boards = jiraClient.getBoards(firstKey);
            if (boards.isEmpty()) return null;
            long boardId = ((Number) boards.get(0).get("id")).longValue();
            Map<String, Object> config = jiraClient.getBoardConfiguration(boardId);
            Object est = config.get("estimation");
            if (est instanceof Map) {
                Object field = ((Map<?, ?>) est).get("field");
                if (field instanceof Map) {
                    Object fid = ((Map<?, ?>) field).get("fieldId");
                    if (fid instanceof String && !((String) fid).isBlank()) {
                        log.debug("Detected SP field '{}' from board {} config", fid, boardId);
                        return (String) fid;
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not detect SP field for pod [{}]: {}", pod.getPodDisplayName(), e.getMessage());
        }
        return null;
    }

    private ReleaseMetrics buildReleaseMetrics(JiraPod pod, List<String> projectKeys, JiraPodRelease rel) {
        String versionName = rel.getVersionName();
        String cacheKey    = "release:" + rel.getId();
        String versionId   = resolveVersionId(projectKeys, versionName);
        String spFieldId   = detectSpFieldId(pod);

        List<Map<String, Object>> rawIssues = jiraClient.getReleaseIssues(
                cacheKey, projectKeys, versionName, versionId, spFieldId);

        return computeMetrics(pod.getId(), pod.getPodDisplayName(), versionName, rel.getNotes(), rawIssues);
    }

    /**
     * Ad-hoc search for a fix version, broken down one {@link ReleaseMetrics} per enabled POD.
     * Only PODs that have at least one issue tagged with the given version are included.
     * Results are cached under an "adhoc-pod:{podId}:{version}" key.
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

            String versionId = resolveVersionId(projectKeys, versionName);
            String spFieldId = detectSpFieldId(pod);
            String cacheKey  = "adhoc-pod:" + pod.getId() + ":" + versionName;

            try {
                List<Map<String, Object>> rawIssues = jiraClient.getReleaseIssues(
                        cacheKey, projectKeys, versionName, versionId, spFieldId);
                if (!rawIssues.isEmpty()) {
                    results.add(computeMetrics(pod.getId(), pod.getPodDisplayName(), versionName, null, rawIssues));
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
     * Processes a list of raw Jira issue maps into a {@link ReleaseMetrics} object.
     * Shared by {@link #buildReleaseMetrics}, {@link #searchRelease}, and {@link JiraSprintIssueService}.
     */
    @SuppressWarnings("unchecked")
    ReleaseMetrics computeMetrics(Long podId, String podDisplayName,
                                          String versionName, String notes,
                                          List<Map<String, Object>> rawIssues) {
        int totalIssues = rawIssues.size();
        Map<String, Integer> issueTypeBreakdown  = new LinkedHashMap<>();
        Map<String, Integer> statusBreakdown      = new LinkedHashMap<>();
        Map<String, Integer> statusCatBreakdown   = new LinkedHashMap<>();
        Map<String, Integer> assigneeBreakdown    = new LinkedHashMap<>();
        Map<String, Double>  assigneeHours        = new LinkedHashMap<>();
        double totalSP           = 0;
        double doneSP            = 0;
        double totalHoursLogged  = 0;
        List<IssueRow> issueRows = new ArrayList<>();

        for (Map<String, Object> issue : rawIssues) {
            String issueKey = issue.get("key") instanceof String ? (String) issue.get("key") : "?";
            Object fieldsObj = issue.get("fields");
            if (!(fieldsObj instanceof Map)) continue;
            Map<String, Object> fields = (Map<String, Object>) fieldsObj;

            // ── Issue type ────────────────────────────────────────────
            String typeName = "Unknown";
            Object itObj = fields.get("issuetype");
            if (itObj instanceof Map) {
                Object n = ((Map<?, ?>) itObj).get("name");
                if (n instanceof String) typeName = (String) n;
            }
            issueTypeBreakdown.merge(typeName, 1, Integer::sum);

            // ── Status ────────────────────────────────────────────────
            String statusName    = "Unknown";
            String statusCatName = "Unknown";
            Object stObj = fields.get("status");
            if (stObj instanceof Map) {
                Object sn = ((Map<?, ?>) stObj).get("name");
                if (sn instanceof String) statusName = (String) sn;
                Object scObj = ((Map<?, ?>) stObj).get("statusCategory");
                if (scObj instanceof Map) {
                    Object scn = ((Map<?, ?>) scObj).get("name");
                    if (scn instanceof String) statusCatName = (String) scn;
                }
            }
            statusBreakdown.merge(statusName, 1, Integer::sum);
            statusCatBreakdown.merge(statusCatName, 1, Integer::sum);

            // ── Assignee ─────────────────────────────────────────────
            String assigneeName = "Unassigned";
            Object asnObj = fields.get("assignee");
            if (asnObj instanceof Map) {
                Object dn = ((Map<?, ?>) asnObj).get("displayName");
                if (dn instanceof String) assigneeName = (String) dn;
            }
            assigneeBreakdown.merge(assigneeName, 1, Integer::sum);

            // ── Story Points ──────────────────────────────────────────
            double sp = extractSP(fields);
            if (sp > 0) {
                totalSP += sp;
                if ("Done".equalsIgnoreCase(statusCatName)) doneSP += sp;
            }

            // ── Hours logged (timespent is in seconds) ─────────────
            double hours = 0;
            Object ts = fields.get("timespent");
            if (ts instanceof Number) hours = ((Number) ts).doubleValue() / 3600.0;
            totalHoursLogged += hours;
            assigneeHours.merge(assigneeName, hours, Double::sum);

            // ── Summary ───────────────────────────────────────────────
            String summary = "";
            Object sumObj = fields.get("summary");
            if (sumObj instanceof String) summary = (String) sumObj;

            // ── Parent key (for subtask grouping) ────────────────────
            String parentKey = null;
            Object parentObj = fields.get("parent");
            if (parentObj instanceof Map) {
                Object pk = ((Map<?, ?>) parentObj).get("key");
                if (pk instanceof String) parentKey = (String) pk;
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

    /**
     * Extracts story points from the issue fields map.
     * Tries a broad list of known SP custom field IDs used across different Jira Cloud
     * configurations, then falls back to scanning ALL numeric custom fields for a
     * plausible SP value (positive integer ≤ 100).
     */
    @SuppressWarnings("unchecked")
    private double extractSP(Map<String, Object> fields) {
        // Try all well-known SP field IDs (in order of prevalence)
        for (String field : List.of(
                "customfield_10016",   // most common Jira Cloud
                "customfield_10028",   // secondary
                "customfield_10034",   // story point estimate (next-gen)
                "customfield_10106",   // some older Cloud instances
                "customfield_10162",   // some Data Center configs
                "customfield_10014",   // epic link sometimes reused
                "story_points"         // some legacy configs
        )) {
            Object v = fields.get(field);
            if (v instanceof Number) {
                double d = ((Number) v).doubleValue();
                if (d > 0) return d;
            }
        }
        // Last-resort: scan all customfield_XXXXX for a plausible SP value
        // (positive, integer-like, ≤ 200 — avoids picking up huge time-in-seconds fields)
        for (Map.Entry<String, Object> e : fields.entrySet()) {
            String key = e.getKey();
            if (!key.startsWith("customfield_")) continue;
            // Skip fields we know are NOT story points
            if (key.equals("customfield_10014") || key.equals("customfield_10020")) continue;
            Object v = e.getValue();
            if (v instanceof Number) {
                double d = ((Number) v).doubleValue();
                if (d > 0 && d <= 200 && d == Math.floor(d)) return d;
            }
        }
        return 0;
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
