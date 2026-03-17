package com.portfolioplanner.service.jira;

import com.portfolioplanner.config.JiraProperties;
import com.portfolioplanner.domain.model.JiraPodWatch;
import com.portfolioplanner.domain.repository.JiraPodWatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * Aggregates Jira Agile metrics per POD (= Jira project).
 *
 * Performance notes:
 * - getAllPodMetrics() processes projects in parallel (up to 8 threads) and
 *   skips the velocity calculation (which requires N*6 extra API calls).
 *   Active sprint data only — fast path.
 * - getVelocityForPod() is the on-demand heavy path, called per-card.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraPodService {

    private final JiraClient jiraClient;
    private final JiraProperties props;
    private final JiraPodWatchRepository watchRepo;

    private static final double SECONDS_PER_HOUR = 3600.0;
    private static final int VELOCITY_SPRINT_COUNT = 6;

    // Thread pool for parallel project fetching — 8 threads is safe for Jira's rate limits
    private static final ExecutorService POOL = Executors.newFixedThreadPool(8);

    // ── Public API ────────────────────────────────────────────────────

    /**
     * Fast path: active sprint + backlog for watched PODs in parallel.
     * If no watchlist is configured, falls back to all Jira projects.
     * Velocity is NOT fetched here — request per-pod via getVelocityForPod().
     */
    public List<PodMetrics> getAllPodMetrics() {
        if (!props.isConfigured()) return List.of();

        // Build watch map: jiraKey → displayName (respects sort order + enabled flag)
        List<JiraPodWatch> watches = watchRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();

        // If watchlist is configured, use only those projects (in order)
        // Otherwise fall back to ALL Jira projects (unconfigured state)
        final Map<String, String> keyToDisplayName;
        final List<String> orderedKeys;

        if (!watches.isEmpty()) {
            keyToDisplayName = new LinkedHashMap<>();
            watches.forEach(w -> keyToDisplayName.put(w.getJiraProjectKey(), w.getPodDisplayName()));
            orderedKeys = watches.stream().map(JiraPodWatch::getJiraProjectKey).collect(Collectors.toList());
            log.info("Building POD metrics for {} watched projects (parallel)", orderedKeys.size());
        } else {
            // Fallback: all Jira projects, use their Jira name as display name
            List<Map<String, Object>> allProjects = jiraClient.getProjects();
            keyToDisplayName = new LinkedHashMap<>();
            allProjects.stream()
                    .filter(p -> str(p, "key") != null)
                    .forEach(p -> keyToDisplayName.put(str(p, "key"), str(p, "name")));
            orderedKeys = new ArrayList<>(keyToDisplayName.keySet());
            log.info("No watchlist configured — building POD metrics for all {} projects", orderedKeys.size());
        }

        long t0 = System.currentTimeMillis();

        // Fire off all project fetches concurrently
        List<CompletableFuture<PodMetrics>> futures = orderedKeys.stream()
                .map(key -> CompletableFuture.supplyAsync(() -> {
                    String displayName = keyToDisplayName.get(key);
                    try {
                        return buildPodMetrics(key, displayName, false);
                    } catch (Exception e) {
                        log.warn("POD metrics failed for {}: {}", key, e.getMessage());
                        return PodMetrics.error(key, displayName, e.getMessage());
                    }
                }, POOL))
                .collect(Collectors.toList());

        // Wait for all to complete (will respect the RestTemplate 20s read timeout per call)
        List<PodMetrics> result = futures.stream()
                .map(f -> {
                    try {
                        return f.join();
                    } catch (Exception e) {
                        log.warn("POD future failed: {}", e.getMessage());
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        log.info("POD metrics done in {}ms for {} projects", System.currentTimeMillis() - t0, result.size());
        return result;
    }

    /**
     * Velocity for a single POD — call this on-demand from the per-card expand.
     */
    public List<SprintVelocity> getVelocityForPod(String projectKey) {
        if (!props.isConfigured()) return List.of();
        List<Map<String, Object>> boards = jiraClient.getBoards(projectKey);
        if (boards.isEmpty()) return List.of();

        Map<String, Object> board = boards.stream()
                .filter(b -> "scrum".equalsIgnoreCase(str(b, "type")))
                .findFirst().orElse(boards.get(0));

        long boardId = ((Number) board.get("id")).longValue();
        return buildVelocity(boardId);
    }

    // ── Internal builder ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private PodMetrics buildPodMetrics(String projectKey, String projectName, boolean fetchVelocity) {
        // 1. Find the board
        List<Map<String, Object>> boards = jiraClient.getBoards(projectKey);
        if (boards.isEmpty()) {
            return PodMetrics.noBoard(projectKey, projectName);
        }

        Map<String, Object> board = boards.stream()
                .filter(b -> "scrum".equalsIgnoreCase(str(b, "type")))
                .findFirst()
                .orElse(boards.get(0));

        long boardId = ((Number) board.get("id")).longValue();

        // 2. Active sprint
        List<Map<String, Object>> activeSprints = jiraClient.getActiveSprints(boardId);
        SprintInfo activeSprint = null;
        Map<String, Double> hoursByMember = new LinkedHashMap<>();
        Map<String, Integer> spByMember   = new LinkedHashMap<>();

        if (!activeSprints.isEmpty()) {
            Map<String, Object> sprint = activeSprints.get(0);
            long sprintId = ((Number) sprint.get("id")).longValue();
            List<Map<String, Object>> issues = jiraClient.getSprintIssues(sprintId);

            int totalIssues = issues.size();
            int doneIssues  = 0;
            int inProgress  = 0;
            double totalSP  = 0;
            double doneSP   = 0;
            double hoursLogged = 0;

            for (Map<String, Object> issue : issues) {
                Map<String, Object> fields = (Map<String, Object>) issue.getOrDefault("fields", Map.of());

                Map<String, Object> statusObj = (Map<String, Object>) fields.get("status");
                Map<String, Object> statusCat = statusObj != null
                        ? (Map<String, Object>) statusObj.get("statusCategory") : null;
                String statusKey = statusCat != null ? nvl(str(statusCat, "key"), "") : "";

                if ("done".equalsIgnoreCase(statusKey)) doneIssues++;
                else if ("indeterminate".equalsIgnoreCase(statusKey)) inProgress++;

                Object sp = fields.get("customfield_10016");
                double issueSP = sp instanceof Number ? ((Number) sp).doubleValue() : 0;
                totalSP += issueSP;
                if ("done".equalsIgnoreCase(statusKey)) doneSP += issueSP;

                Map<String, Object> assignee = (Map<String, Object>) fields.get("assignee");
                String member = assignee != null
                        ? nvl((String) assignee.get("displayName"), "Unassigned")
                        : "Unassigned";

                Object ts = fields.get("timespent");
                double hrs = ts instanceof Number
                        ? ((Number) ts).doubleValue() / SECONDS_PER_HOUR : 0;
                hoursLogged += hrs;
                if (hrs > 0) hoursByMember.merge(member, hrs, Double::sum);
                if (issueSP > 0) spByMember.merge(member, (int) issueSP, Integer::sum);
            }

            activeSprint = new SprintInfo(
                    (int) sprintId,
                    str(sprint, "name"),
                    str(sprint, "state"),
                    str(sprint, "startDate"),
                    str(sprint, "endDate"),
                    totalIssues, doneIssues, inProgress,
                    Math.round(totalSP  * 10.0) / 10.0,
                    Math.round(doneSP   * 10.0) / 10.0,
                    Math.round(hoursLogged * 10.0) / 10.0);
        }

        // 3. Velocity — only when explicitly requested
        List<SprintVelocity> velocity = fetchVelocity ? buildVelocity(boardId) : List.of();

        // 4. Backlog count
        int backlogSize = 0;
        try {
            backlogSize = jiraClient.getBacklogIssues(boardId).size();
        } catch (Exception e) {
            log.debug("Backlog unavailable for {}: {}", projectKey, e.getMessage());
        }

        return new PodMetrics(
                projectKey, projectName,
                str(board, "name"),
                activeSprint, velocity,
                backlogSize, hoursByMember, spByMember, null);
    }

    @SuppressWarnings("unchecked")
    private List<SprintVelocity> buildVelocity(long boardId) {
        List<SprintVelocity> result = new ArrayList<>();
        try {
            List<Map<String, Object>> closed = jiraClient.getClosedSprints(boardId, VELOCITY_SPRINT_COUNT);
            for (Map<String, Object> sprint : closed) {
                long sprintId = ((Number) sprint.get("id")).longValue();
                List<Map<String, Object>> issues = jiraClient.getSprintIssues(sprintId);

                double committed = 0, completed = 0;
                for (Map<String, Object> issue : issues) {
                    Map<String, Object> fields = (Map<String, Object>) issue.getOrDefault("fields", Map.of());
                    Object sp = fields.get("customfield_10016");
                    double issueSP = sp instanceof Number ? ((Number) sp).doubleValue() : 0;
                    committed += issueSP;

                    Map<String, Object> statusObj = (Map<String, Object>) fields.get("status");
                    Map<String, Object> statusCat = statusObj != null
                            ? (Map<String, Object>) statusObj.get("statusCategory") : null;
                    String statusKey = statusCat != null ? nvl(str(statusCat, "key"), "") : "";
                    if ("done".equalsIgnoreCase(statusKey)) completed += issueSP;
                }
                result.add(new SprintVelocity(
                        str(sprint, "name"),
                        Math.round(committed * 10.0) / 10.0,
                        Math.round(completed * 10.0) / 10.0));
            }
        } catch (Exception e) {
            log.warn("Velocity calculation failed for board {}: {}", boardId, e.getMessage());
        }
        return result;
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private static String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v instanceof String ? (String) v : null;
    }

    private static String nvl(String s, String def) {
        return (s != null && !s.isBlank()) ? s : def;
    }

    // ── DTOs ──────────────────────────────────────────────────────────

    public record PodMetrics(
            String jiraProjectKey,
            String jiraProjectName,
            String boardName,
            SprintInfo activeSprint,
            List<SprintVelocity> velocity,
            int backlogSize,
            Map<String, Double> hoursByMember,
            Map<String, Integer> spByMember,
            String errorMessage) {

        static PodMetrics error(String key, String name, String msg) {
            return new PodMetrics(key, name, null, null,
                    List.of(), 0, Map.of(), Map.of(), msg);
        }

        static PodMetrics noBoard(String key, String name) {
            return new PodMetrics(key, name, null, null,
                    List.of(), 0, Map.of(), Map.of(), null);
        }
    }

    public record SprintInfo(
            int id,
            String name,
            String state,
            String startDate,
            String endDate,
            int totalIssues,
            int doneIssues,
            int inProgressIssues,
            double totalSP,
            double doneSP,
            double hoursLogged) {

        public double progressPct() {
            return totalIssues == 0 ? 0
                    : Math.round((doneIssues * 100.0 / totalIssues) * 10.0) / 10.0;
        }

        public double spProgressPct() {
            return totalSP == 0 ? 0
                    : Math.round((doneSP * 100.0 / totalSP) * 10.0) / 10.0;
        }
    }

    public record SprintVelocity(
            String sprintName,
            double committedSP,
            double completedSP) {}
}
