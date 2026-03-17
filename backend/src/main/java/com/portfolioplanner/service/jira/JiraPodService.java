package com.portfolioplanner.service.jira;

import com.portfolioplanner.config.JiraProperties;
import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class JiraPodService {

    private final JiraClient     jiraClient;
    private final JiraProperties props;
    private final JiraPodRepository podRepo;

    private static final double SECONDS_PER_HOUR     = 3600.0;
    private static final int    VELOCITY_SPRINT_COUNT = 6;
    private static final ExecutorService POOL = Executors.newFixedThreadPool(8);

    // ── Public API ────────────────────────────────────────────────────

    public List<PodMetrics> getAllPodMetrics() {
        if (!props.isConfigured()) return List.of();

        List<JiraPod> pods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();

        if (pods.isEmpty()) {
            log.info("No PODs configured — building metrics for all Jira projects");
            return getAllProjectsAsDefaultPods();
        }

        log.info("Building POD metrics for {} configured PODs (parallel)", pods.size());
        long t0 = System.currentTimeMillis();

        List<CompletableFuture<PodMetrics>> futures = pods.stream()
                .map(pod -> CompletableFuture.supplyAsync(() -> {
                    try { return buildPodMetrics(pod); }
                    catch (Exception e) {
                        log.warn("POD metrics failed for [{}]: {}", pod.getPodDisplayName(), e.getMessage());
                        return PodMetrics.error(pod.getId(), pod.getPodDisplayName(), e.getMessage());
                    }
                }, POOL))
                .collect(Collectors.toList());

        List<PodMetrics> result = futures.stream()
                .map(f -> { try { return f.join(); } catch (Exception e) { return null; } })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        log.info("POD metrics done in {}ms for {} PODs", System.currentTimeMillis() - t0, result.size());
        return result;
    }

    public List<SprintVelocity> getVelocityForPod(Long podId) {
        if (!props.isConfigured()) return List.of();
        JiraPod pod = podRepo.findById(podId).orElse(null);
        if (pod == null) return List.of();
        List<String> keys = pod.getBoards().stream()
                .map(JiraPodBoard::getJiraProjectKey).collect(Collectors.toList());
        return buildAggregatedVelocity(keys);
    }

    // ── Internal builders ─────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private PodMetrics buildPodMetrics(JiraPod pod) {
        List<String> boardKeys = pod.getBoards().stream()
                .map(JiraPodBoard::getJiraProjectKey).collect(Collectors.toList());

        if (boardKeys.isEmpty()) return PodMetrics.noBoards(pod.getId(), pod.getPodDisplayName());

        int    totalIssues = 0, doneIssues = 0, inProgress = 0;
        double totalSP = 0, doneSP = 0, hoursLogged = 0;
        Map<String, Double>  hoursByMember = new LinkedHashMap<>();
        Map<String, Integer> spByMember   = new LinkedHashMap<>();
        List<String> boardNames  = new ArrayList<>();
        List<String> sprintNames = new ArrayList<>();
        String startDate = null, endDate = null;
        int    firstSprintId = 0;
        boolean hasActiveSprint = false;
        int backlogSize = 0;

        for (String projectKey : boardKeys) {
            try {
                List<Map<String, Object>> boards = jiraClient.getBoards(projectKey);
                if (boards.isEmpty()) continue;

                Map<String, Object> board = boards.stream()
                        .filter(b -> "scrum".equalsIgnoreCase(str(b, "type")))
                        .findFirst().orElse(boards.get(0));

                String bName = str(board, "name");
                if (bName != null) boardNames.add(bName);
                long boardId = ((Number) board.get("id")).longValue();

                try { backlogSize += jiraClient.getBacklogIssues(boardId).size(); }
                catch (Exception e) { log.debug("Backlog unavailable for {}: {}", projectKey, e.getMessage()); }

                List<Map<String, Object>> activeSprints = jiraClient.getActiveSprints(boardId);
                if (activeSprints.isEmpty()) continue;

                Map<String, Object> sprint = activeSprints.get(0);
                long sprintId = ((Number) sprint.get("id")).longValue();
                if (!hasActiveSprint) {
                    firstSprintId = (int) sprintId;
                    startDate     = str(sprint, "startDate");
                    endDate       = str(sprint, "endDate");
                }
                hasActiveSprint = true;
                String sName = str(sprint, "name");
                if (sName != null && !sprintNames.contains(sName)) sprintNames.add(sName);

                List<Map<String, Object>> issues = jiraClient.getSprintIssues(sprintId);
                totalIssues += issues.size();

                for (Map<String, Object> issue : issues) {
                    Map<String, Object> fields = (Map<String, Object>) issue.getOrDefault("fields", Map.of());
                    Map<String, Object> statusObj = (Map<String, Object>) fields.get("status");
                    Map<String, Object> statusCat = statusObj != null
                            ? (Map<String, Object>) statusObj.get("statusCategory") : null;
                    String statusKey = statusCat != null ? nvl(str(statusCat, "key"), "") : "";

                    if ("done".equalsIgnoreCase(statusKey))               doneIssues++;
                    else if ("indeterminate".equalsIgnoreCase(statusKey)) inProgress++;

                    Object sp      = fields.get("customfield_10016");
                    double issueSP = sp instanceof Number ? ((Number) sp).doubleValue() : 0;
                    totalSP += issueSP;
                    if ("done".equalsIgnoreCase(statusKey)) doneSP += issueSP;

                    Map<String, Object> assignee = (Map<String, Object>) fields.get("assignee");
                    String member = assignee != null
                            ? nvl((String) assignee.get("displayName"), "Unassigned") : "Unassigned";
                    Object ts  = fields.get("timespent");
                    double hrs = ts instanceof Number ? ((Number) ts).doubleValue() / SECONDS_PER_HOUR : 0;
                    hoursLogged += hrs;
                    if (hrs > 0)     hoursByMember.merge(member, hrs, Double::sum);
                    if (issueSP > 0) spByMember.merge(member, (int) issueSP, Integer::sum);
                }

            } catch (Exception e) {
                log.warn("Error fetching board {} for POD [{}]: {}",
                        projectKey, pod.getPodDisplayName(), e.getMessage());
            }
        }

        SprintInfo activeSprint = null;
        if (hasActiveSprint) {
            String combinedName = sprintNames.isEmpty() ? "Active Sprint"
                    : sprintNames.size() == 1           ? sprintNames.get(0)
                    : sprintNames.get(0) + " (+" + (sprintNames.size() - 1) + " more)";
            activeSprint = new SprintInfo(firstSprintId, combinedName, "active",
                    startDate, endDate,
                    totalIssues, doneIssues, inProgress,
                    round(totalSP), round(doneSP), round(hoursLogged));
        }

        String boardDisplay = boardNames.isEmpty() ? null
                : boardNames.size() == 1           ? boardNames.get(0)
                : boardNames.size() <= 2           ? String.join(", ", boardNames)
                : boardNames.size() + " boards";

        return new PodMetrics(pod.getId(), pod.getPodDisplayName(), boardKeys,
                boardDisplay, activeSprint, List.of(),
                backlogSize, hoursByMember, spByMember, null);
    }

    private List<PodMetrics> getAllProjectsAsDefaultPods() {
        return jiraClient.getProjects().stream()
                .filter(p -> str(p, "key") != null)
                .map(p -> {
                    String key  = str(p, "key");
                    String name = nvl(str(p, "name"), key);
                    JiraPod synthetic = new JiraPod();
                    synthetic.setPodDisplayName(name);
                    synthetic.getBoards().add(new JiraPodBoard(synthetic, key));
                    return CompletableFuture.supplyAsync(() -> {
                        try { return buildPodMetrics(synthetic); }
                        catch (Exception e) { return PodMetrics.error(null, name, e.getMessage()); }
                    }, POOL);
                })
                .map(f -> { try { return f.join(); } catch (Exception e) { return null; } })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private List<SprintVelocity> buildAggregatedVelocity(List<String> boardKeys) {
        Map<String, double[]> bySprint = new LinkedHashMap<>();

        for (String projectKey : boardKeys) {
            try {
                List<Map<String, Object>> boards = jiraClient.getBoards(projectKey);
                if (boards.isEmpty()) continue;
                Map<String, Object> board = boards.stream()
                        .filter(b -> "scrum".equalsIgnoreCase(str(b, "type")))
                        .findFirst().orElse(boards.get(0));
                long boardId = ((Number) board.get("id")).longValue();

                for (Map<String, Object> sprint : jiraClient.getClosedSprints(boardId, VELOCITY_SPRINT_COUNT)) {
                    String name   = nvl(str(sprint, "name"), "Sprint");
                    long sprintId = ((Number) sprint.get("id")).longValue();
                    double committed = 0, completed = 0;

                    for (Map<String, Object> issue : jiraClient.getSprintIssues(sprintId)) {
                        Map<String, Object> fields = (Map<String, Object>) issue.getOrDefault("fields", Map.of());
                        Object sp = fields.get("customfield_10016");
                        double issueSP = sp instanceof Number ? ((Number) sp).doubleValue() : 0;
                        committed += issueSP;
                        Map<String, Object> statusObj = (Map<String, Object>) fields.get("status");
                        Map<String, Object> statusCat = statusObj != null
                                ? (Map<String, Object>) statusObj.get("statusCategory") : null;
                        if (statusCat != null && "done".equalsIgnoreCase(str(statusCat, "key"))) completed += issueSP;
                    }
                    bySprint.computeIfAbsent(name, k -> new double[]{0, 0});
                    bySprint.get(name)[0] += committed;
                    bySprint.get(name)[1] += completed;
                }
            } catch (Exception e) {
                log.warn("Velocity failed for board {}: {}", projectKey, e.getMessage());
            }
        }

        return bySprint.entrySet().stream()
                .map(e -> new SprintVelocity(e.getKey(), round(e.getValue()[0]), round(e.getValue()[1])))
                .collect(Collectors.toList());
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private static double round(double v) { return Math.round(v * 10.0) / 10.0; }
    private static String str(Map<String, Object> m, String key) {
        Object v = m.get(key); return v instanceof String ? (String) v : null;
    }
    private static String nvl(String s, String def) {
        return (s != null && !s.isBlank()) ? s : def;
    }

    // ── DTOs ──────────────────────────────────────────────────────────

    public record PodMetrics(
            Long   podId,
            String podDisplayName,
            List<String> boardKeys,
            String boardName,
            SprintInfo activeSprint,
            List<SprintVelocity> velocity,
            int    backlogSize,
            Map<String, Double>  hoursByMember,
            Map<String, Integer> spByMember,
            String errorMessage) {

        static PodMetrics error(Long podId, String name, String msg) {
            return new PodMetrics(podId, name, List.of(), null, null,
                    List.of(), 0, Map.of(), Map.of(), msg);
        }
        static PodMetrics noBoards(Long podId, String name) {
            return new PodMetrics(podId, name, List.of(), null, null,
                    List.of(), 0, Map.of(), Map.of(), null);
        }
    }

    public record SprintInfo(
            int id, String name, String state,
            String startDate, String endDate,
            int totalIssues, int doneIssues, int inProgressIssues,
            double totalSP, double doneSP, double hoursLogged) {

        public double progressPct()   { return totalIssues == 0 ? 0 : round(doneIssues * 100.0 / totalIssues); }
        public double spProgressPct() { return totalSP     == 0 ? 0 : round(doneSP     * 100.0 / totalSP); }
    }

    public record SprintVelocity(String sprintName, double committedSP, double completedSP) {}
}
