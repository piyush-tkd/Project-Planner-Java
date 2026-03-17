package com.portfolioplanner.service.jira;

import com.portfolioplanner.config.JiraProperties;
import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
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

        // ── Sprint-level aggregates ───────────────────────────────────
        int    totalIssues = 0, doneIssues = 0, inProgress = 0, todoIssues = 0;
        double totalSP = 0, doneSP = 0, hoursLogged = 0, estimatedHours = 0, remainingHours = 0;

        // ── Team breakdowns ───────────────────────────────────────────
        Map<String, Double>  hoursByMember    = new LinkedHashMap<>();
        Map<String, Integer> spByMember       = new LinkedHashMap<>();
        Map<String, Integer> memberIssueCount = new LinkedHashMap<>();

        // ── Issue breakdowns ──────────────────────────────────────────
        Map<String, Integer> issueTypeBreakdown  = new LinkedHashMap<>();
        Map<String, Integer> priorityBreakdown   = new LinkedHashMap<>();
        Map<String, Integer> statusBreakdown     = new LinkedHashMap<>();
        Map<String, Integer> labelBreakdown      = new LinkedHashMap<>();
        Map<String, Integer> epicBreakdown       = new LinkedHashMap<>();
        Map<String, Integer> releaseBreakdown    = new LinkedHashMap<>();
        Map<String, Integer> componentBreakdown  = new LinkedHashMap<>();

        // ── Worklog time-series (for burndown charts) ─────────────────
        // date (yyyy-MM-dd) → total hours logged that day
        Map<String, Double>              dailyHoursLogged = new TreeMap<>();
        // member → date → hours (per-person burndown)
        Map<String, Map<String, Double>> memberDailyHours = new LinkedHashMap<>();

        // ── Cycle time ────────────────────────────────────────────────
        long cycleTimeSum   = 0;
        int  cycleTimeCount = 0;

        // ── Board / sprint metadata ───────────────────────────────────
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

                // ── Determine the SP field this board uses ─────────────────
                // /rest/agile/1.0/board/{id}/configuration → estimation.field.fieldId
                String spFieldId = null;
                try {
                    Map<String, Object> boardConfig = jiraClient.getBoardConfiguration(boardId);
                    Map<String, Object> estimation  = asMap(boardConfig.get("estimation"));
                    if (estimation != null) {
                        Map<String, Object> fieldObj = asMap(estimation.get("field"));
                        if (fieldObj != null) spFieldId = str(fieldObj, "fieldId");
                    }
                } catch (Exception e) {
                    log.debug("Could not get board config for boardId={}: {}", boardId, e.getMessage());
                }
                if (spFieldId == null) spFieldId = "customfield_10016"; // safe default
                log.debug("Board {} ({}) SP field: {}", boardId, projectKey, spFieldId);

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
                final String boardSpField = spFieldId; // effectively final for lambda

                for (Map<String, Object> issue : issues) {
                    try {
                        Map<String, Object> fields = asMap(issue.get("fields"));
                        if (fields == null) fields = Map.of();

                        // ── Status ──────────────────────────────────────────
                        Map<String, Object> statusObj = asMap(fields.get("status"));
                        Map<String, Object> statusCat = asMap(statusObj != null ? statusObj.get("statusCategory") : null);
                        String statusKey  = statusCat != null ? nvl(str(statusCat, "key"), "") : "";
                        String statusName = statusObj  != null ? nvl(str(statusObj,  "name"), "Unknown") : "Unknown";
                        statusBreakdown.merge(statusName, 1, Integer::sum);
                        totalIssues++;

                        if      ("done".equalsIgnoreCase(statusKey))          doneIssues++;
                        else if ("indeterminate".equalsIgnoreCase(statusKey)) inProgress++;
                        else                                                   todoIssues++;

                        // ── Story points — use board-configured field first, then fallbacks ──
                        Object sp = fields.get(boardSpField);
                        if (!(sp instanceof Number)) sp = fields.get("customfield_10016");
                        if (!(sp instanceof Number)) sp = fields.get("customfield_10028");
                        double issueSP = sp instanceof Number ? ((Number) sp).doubleValue() : 0;
                        if (issueSP == 0) {
                            String issueKey = issue.get("key") instanceof String ? (String) issue.get("key") : "?";
                            List<String> spCandidates = fields.entrySet().stream()
                                    .filter(e -> e.getKey().startsWith("customfield_") && e.getValue() instanceof Number)
                                    .map(e -> e.getKey() + "=" + e.getValue())
                                    .collect(Collectors.toList());
                            log.warn("SP=0 for {} [status={}, spField={}] — numeric customfields: {}",
                                    issueKey, statusName, boardSpField,
                                    spCandidates.isEmpty() ? "none" : spCandidates);
                        }
                        totalSP += issueSP;
                        if ("done".equalsIgnoreCase(statusKey)) doneSP += issueSP;

                        // ── Time tracking ────────────────────────────────────
                        Object ts      = fields.get("timespent");
                        Object origEst = fields.get("timeoriginalestimate");
                        Object remEst  = fields.get("timeestimate");
                        double hrs = ts      instanceof Number ? ((Number) ts).doubleValue()      / SECONDS_PER_HOUR : 0;
                        double est = origEst instanceof Number ? ((Number) origEst).doubleValue() / SECONDS_PER_HOUR : 0;
                        double rem = remEst  instanceof Number ? ((Number) remEst).doubleValue()  / SECONDS_PER_HOUR : 0;
                        hoursLogged    += hrs;
                        estimatedHours += est;
                        if (!"done".equalsIgnoreCase(statusKey)) remainingHours += rem;

                        // ── Assignee ─────────────────────────────────────────
                        Map<String, Object> assignee = asMap(fields.get("assignee"));
                        String member = assignee != null
                                ? nvl(str(assignee, "displayName"), "Unassigned") : "Unassigned";
                        if (hrs     > 0)  hoursByMember.merge(member, hrs,           Double::sum);
                        if (issueSP > 0)  spByMember.merge(member,    (int) issueSP, Integer::sum);
                        memberIssueCount.merge(member, 1, Integer::sum);

                        // ── Issue type ────────────────────────────────────────
                        Map<String, Object> issueType = asMap(fields.get("issuetype"));
                        String typeName = issueType != null ? nvl(str(issueType, "name"), "Unknown") : "Unknown";
                        issueTypeBreakdown.merge(typeName, 1, Integer::sum);

                        // ── Priority ──────────────────────────────────────────
                        Map<String, Object> priorityObj = asMap(fields.get("priority"));
                        String priorityName = priorityObj != null ? nvl(str(priorityObj, "name"), "None") : "None";
                        priorityBreakdown.merge(priorityName, 1, Integer::sum);

                        // ── Labels ────────────────────────────────────────────
                        if (fields.get("labels") instanceof List) {
                            for (Object lbl : (List<?>) fields.get("labels")) {
                                if (lbl instanceof String && !((String) lbl).isBlank())
                                    labelBreakdown.merge((String) lbl, 1, Integer::sum);
                            }
                        }

                        // ── Fix Versions / Releases ───────────────────────────
                        if (fields.get("fixVersions") instanceof List) {
                            for (Object fv : (List<?>) fields.get("fixVersions")) {
                                Map<String, Object> fvMap = asMap(fv);
                                if (fvMap != null) {
                                    String vName = str(fvMap, "name");
                                    if (vName != null && !vName.isBlank())
                                        releaseBreakdown.merge(vName, 1, Integer::sum);
                                }
                            }
                        }

                        // ── Components ────────────────────────────────────────
                        if (fields.get("components") instanceof List) {
                            for (Object comp : (List<?>) fields.get("components")) {
                                Map<String, Object> compMap = asMap(comp);
                                if (compMap != null) {
                                    String cName = str(compMap, "name");
                                    if (cName != null && !cName.isBlank())
                                        componentBreakdown.merge(cName, 1, Integer::sum);
                                }
                            }
                        }

                        // ── Epic ──────────────────────────────────────────────
                        // classic: customfield_10014 = epic key; next-gen: parent → issuetype=Epic
                        String epicName = null;
                        Object epicLink = fields.get("customfield_10014");
                        if (epicLink instanceof String && !((String) epicLink).isBlank()) {
                            epicName = (String) epicLink;
                        } else {
                            Map<String, Object> parent = asMap(fields.get("parent"));
                            if (parent != null) {
                                Map<String, Object> pf = asMap(parent.get("fields"));
                                if (pf != null) {
                                    Map<String, Object> pIssueType = asMap(pf.get("issuetype"));
                                    String pType = pIssueType != null ? str(pIssueType, "name") : null;
                                    if ("Epic".equalsIgnoreCase(pType))
                                        epicName = nvl(str(pf, "summary"), str(parent, "key"));
                                }
                            }
                        }
                        if (epicName != null) epicBreakdown.merge(epicName, 1, Integer::sum);

                        // ── Worklogs (inline, up to 20 per issue) ────────────
                        Map<String, Object> worklogWrapper = asMap(fields.get("worklog"));
                        if (worklogWrapper != null && worklogWrapper.get("worklogs") instanceof List) {
                            for (Object wl : (List<?>) worklogWrapper.get("worklogs")) {
                                Map<String, Object> wlMap = asMap(wl);
                                if (wlMap == null) continue;
                                Map<String, Object> wlAuthor = asMap(wlMap.get("author"));
                                String wlMember = wlAuthor != null
                                        ? nvl(str(wlAuthor, "displayName"), "Unknown") : "Unknown";
                                Object wlSecs = wlMap.get("timeSpentSeconds");
                                double wlHrs  = wlSecs instanceof Number
                                        ? ((Number) wlSecs).doubleValue() / SECONDS_PER_HOUR : 0;
                                // started may be a String like "2024-03-11T10:00:00.000+0000"
                                Object startedObj = wlMap.get("started");
                                String started = startedObj instanceof String ? (String) startedObj : null;
                                if (started != null && started.length() >= 10 && wlHrs > 0) {
                                    String date = started.substring(0, 10); // yyyy-MM-dd
                                    dailyHoursLogged.merge(date, wlHrs, Double::sum);
                                    memberDailyHours
                                            .computeIfAbsent(wlMember, k -> new TreeMap<>())
                                            .merge(date, wlHrs, Double::sum);
                                }
                            }
                        }

                        // ── Cycle time (done issues with resolution date) ─────
                        if ("done".equalsIgnoreCase(statusKey)) {
                            String created  = str(fields, "created");
                            String resolved = str(fields, "resolutiondate");
                            if (created != null && resolved != null) {
                                try {
                                    long days = ChronoUnit.DAYS.between(
                                            OffsetDateTime.parse(created),
                                            OffsetDateTime.parse(resolved));
                                    cycleTimeSum += Math.max(0, days);
                                    cycleTimeCount++;
                                } catch (Exception ignored) {}
                            }
                        }

                    } catch (Exception e) {
                        String issueKey = issue.get("key") instanceof String ? (String) issue.get("key") : "?";
                        log.warn("Skipping issue {} due to parse error: {}", issueKey, e.getMessage());
                    }
                }

            } catch (Exception e) {
                log.warn("Error fetching board {} for POD [{}]: {}",
                        projectKey, pod.getPodDisplayName(), e.getMessage());
            }
        }

        double avgCycleTimeDays = cycleTimeCount > 0 ? round((double) cycleTimeSum / cycleTimeCount) : 0;

        // Round daily hours map values
        dailyHoursLogged.replaceAll((d, v) -> round(v));
        memberDailyHours.values().forEach(m -> m.replaceAll((d, v) -> round(v)));

        SprintInfo activeSprint = null;
        if (hasActiveSprint) {
            String combinedName = sprintNames.isEmpty() ? "Active Sprint"
                    : sprintNames.size() == 1           ? sprintNames.get(0)
                    : sprintNames.get(0) + " (+" + (sprintNames.size() - 1) + " more)";
            activeSprint = SprintInfo.of(
                    firstSprintId, combinedName, "active",
                    startDate, endDate,
                    totalIssues, doneIssues, inProgress, todoIssues,
                    round(totalSP), round(doneSP),
                    round(hoursLogged), round(estimatedHours), round(remainingHours),
                    avgCycleTimeDays);
        }

        String boardDisplay = boardNames.isEmpty() ? null
                : boardNames.size() == 1           ? boardNames.get(0)
                : boardNames.size() <= 2           ? String.join(", ", boardNames)
                : boardNames.size() + " boards";

        return new PodMetrics(
                pod.getId(), pod.getPodDisplayName(), boardKeys, boardDisplay,
                activeSprint, List.of(),
                backlogSize,
                // Team
                hoursByMember, spByMember, memberIssueCount,
                // Issue breakdowns
                issueTypeBreakdown, priorityBreakdown, statusBreakdown,
                labelBreakdown, epicBreakdown, releaseBreakdown, componentBreakdown,
                // Time-series
                dailyHoursLogged, memberDailyHours,
                // Estimates & cycle time
                round(estimatedHours), round(remainingHours), avgCycleTimeDays,
                null);
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
                        if (!(sp instanceof Number)) sp = fields.get("customfield_10028");
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
        if (m == null) return null;
        Object v = m.get(key); return v instanceof String ? (String) v : null;
    }

    /** Safe cast to Map — returns null instead of throwing ClassCastException. */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : null;
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
            // Team breakdown
            Map<String, Double>  hoursByMember,
            Map<String, Integer> spByMember,
            Map<String, Integer> memberIssueCount,
            // Issue breakdowns (current sprint)
            Map<String, Integer> issueTypeBreakdown,
            Map<String, Integer> priorityBreakdown,
            Map<String, Integer> statusBreakdown,
            Map<String, Integer> labelBreakdown,
            Map<String, Integer> epicBreakdown,
            Map<String, Integer> releaseBreakdown,
            Map<String, Integer> componentBreakdown,
            // Time-series for burndown / activity charts
            Map<String, Double>              dailyHoursLogged,   // date → hours
            Map<String, Map<String, Double>> memberDailyHours,   // member → date → hours
            // Estimates & cycle time
            double totalEstimatedHours,
            double totalRemainingHours,
            double avgCycleTimeDays,
            String errorMessage) {

        private static PodMetrics empty(Long podId, String name, String err) {
            return new PodMetrics(podId, name, List.of(), null, null,
                    List.of(), 0,
                    Map.of(), Map.of(), Map.of(),
                    Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                    Map.of(), Map.of(),
                    0, 0, 0, err);
        }
        static PodMetrics error(Long podId, String name, String msg) { return empty(podId, name, msg); }
        static PodMetrics noBoards(Long podId, String name)           { return empty(podId, name, null); }
    }

    public record SprintInfo(
            int id, String name, String state,
            String startDate, String endDate,
            // Issue counts
            int totalIssues, int doneIssues, int inProgressIssues, int todoIssues,
            // Story points
            double totalSP, double doneSP,
            // Time (hours)
            double hoursLogged, double estimatedHours, double remainingHours,
            // Pre-computed percentages (record components → Jackson serialises them)
            double progressPct, double spProgressPct,
            // Cycle time
            double avgCycleTimeDays) {

        static SprintInfo of(int id, String name, String state,
                             String startDate, String endDate,
                             int totalIssues, int doneIssues, int inProgressIssues, int todoIssues,
                             double totalSP, double doneSP,
                             double hoursLogged, double estimatedHours, double remainingHours,
                             double avgCycleTimeDays) {
            double pct   = totalIssues == 0 ? 0 : Math.round(doneIssues * 100.0 / totalIssues * 10) / 10.0;
            double spPct = totalSP     == 0 ? 0 : Math.round(doneSP     * 100.0 / totalSP     * 10) / 10.0;
            return new SprintInfo(id, name, state, startDate, endDate,
                    totalIssues, doneIssues, inProgressIssues, todoIssues,
                    totalSP, doneSP, hoursLogged, estimatedHours, remainingHours,
                    pct, spPct, avgCycleTimeDays);
        }
    }

    public record SprintVelocity(String sprintName, double committedSP, double completedSP) {}
}
