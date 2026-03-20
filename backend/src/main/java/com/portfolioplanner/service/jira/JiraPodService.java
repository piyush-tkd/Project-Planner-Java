package com.portfolioplanner.service.jira;

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
    private final JiraCredentialsService creds;
    private final JiraPodRepository podRepo;

    private static final double SECONDS_PER_HOUR     = 3600.0;
    private static final int    VELOCITY_SPRINT_COUNT = 6;
    // Limit parallel POD processing to 2 threads so we don't flood Jira with
    // 40+ simultaneous API calls after a cache clear and trigger rate limiting.
    private static final ExecutorService POOL = Executors.newFixedThreadPool(2);

    // ── Public API ────────────────────────────────────────────────────

    public List<PodMetrics> getAllPodMetrics() {
        if (!creds.isConfigured()) return List.of();

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
        if (!creds.isConfigured()) return List.of();
        JiraPod pod = podRepo.findById(podId).orElse(null);
        if (pod == null) return List.of();
        List<String> keys = pod.getBoards().stream()
                .map(JiraPodBoard::getJiraProjectKey).collect(Collectors.toList());
        return buildAggregatedVelocity(keys);
    }

    /** Returns the active-sprint issues for a given POD as a flat list. */
    @SuppressWarnings("unchecked")
    public List<SprintIssueRow> getSprintIssuesForPod(Long podId) {
        if (!creds.isConfigured()) return List.of();
        JiraPod pod = podRepo.findById(podId).orElse(null);
        if (pod == null) return List.of();

        List<SprintIssueRow> result = new ArrayList<>();
        for (JiraPodBoard board : pod.getBoards()) {
            String projectKey = board.getJiraProjectKey();
            try {
                List<Map<String, Object>> boards = jiraClient.getBoards(projectKey);
                if (boards.isEmpty()) continue;
                Map<String, Object> jiraBoard = boards.stream()
                        .filter(b -> "scrum".equalsIgnoreCase(str(b, "type")))
                        .findFirst().orElse(boards.get(0));
                long boardId = ((Number) jiraBoard.get("id")).longValue();

                // SP field
                String spFieldId = "customfield_10016";
                try {
                    Map<String, Object> bc = jiraClient.getBoardConfiguration(boardId);
                    Map<String, Object> est = asMap(bc.get("estimation"));
                    if (est != null) {
                        Map<String, Object> fld = asMap(est.get("field"));
                        if (fld != null && str(fld, "fieldId") != null) spFieldId = str(fld, "fieldId");
                    }
                } catch (Exception ignored) {}

                List<Map<String, Object>> activeSprints = jiraClient.getActiveSprints(boardId);
                if (activeSprints.isEmpty()) continue;
                long sprintId = ((Number) activeSprints.get(0).get("id")).longValue();

                for (Map<String, Object> issue : jiraClient.getSprintIssues(boardId, sprintId, spFieldId)) {
                    try {
                        String key = str(issue, "key");
                        Map<String, Object> fields = asMap(issue.get("fields"));
                        if (fields == null) fields = Map.of();

                        String summary = nvl(str(fields, "summary"), "");

                        Map<String, Object> issueTypeObj = asMap(fields.get("issuetype"));
                        String typeName = issueTypeObj != null ? nvl(str(issueTypeObj, "name"), "Unknown") : "Unknown";
                        boolean isSubtask = issueTypeObj != null && Boolean.TRUE.equals(issueTypeObj.get("subtask"));
                        if (isSubtask) continue; // skip subtasks

                        Map<String, Object> statusObj = asMap(fields.get("status"));
                        Map<String, Object> statusCat = statusObj != null ? asMap(statusObj.get("statusCategory")) : null;
                        String statusCategory = statusCat != null ? nvl(str(statusCat, "key"), "undefined") : "undefined";
                        // Normalise to display-friendly form
                        statusCategory = switch (statusCategory.toLowerCase()) {
                            case "done"          -> "Done";
                            case "indeterminate" -> "In Progress";
                            default              -> "To Do";
                        };
                        String statusName = statusObj != null ? nvl(str(statusObj, "name"), "Unknown") : "Unknown";

                        Map<String, Object> assigneeObj = asMap(fields.get("assignee"));
                        String assignee = assigneeObj != null ? nvl(str(assigneeObj, "displayName"), "Unassigned") : "Unassigned";

                        // SP
                        Object spVal = fields.get(spFieldId);
                        if (!(spVal instanceof Number)) spVal = fields.get("customfield_10016");
                        if (!(spVal instanceof Number)) spVal = fields.get("customfield_10028");
                        double sp = spVal instanceof Number ? ((Number) spVal).doubleValue() : 0;

                        // Hours
                        Object ts = fields.get("timespent");
                        double hours = ts instanceof Number ? ((Number) ts).doubleValue() / SECONDS_PER_HOUR : 0;

                        // Priority
                        Map<String, Object> priorityObj = asMap(fields.get("priority"));
                        String priority = priorityObj != null ? nvl(str(priorityObj, "name"), "None") : "None";

                        result.add(new SprintIssueRow(key, summary, typeName, statusCategory, statusName,
                                assignee, round(sp), round(hours), priority));
                    } catch (Exception e) {
                        log.debug("Error mapping issue in sprint issues for pod {}: {}", podId, e.getMessage());
                    }
                }
            } catch (Exception e) {
                log.warn("Sprint issues failed for board {} in pod {}: {}", projectKey, podId, e.getMessage());
            }
        }
        return result;
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

                final String boardSpField = spFieldId; // effectively final for lambda
                final long   finalBoardId = boardId;

                List<Map<String, Object>> issues = jiraClient.getSprintIssues(finalBoardId, sprintId, boardSpField);

                // SP accumulators — Story-type issues only.
                // Jira's sprint board statistics count only Story-level issues toward SP;
                // Bugs, Tasks, Incidents etc. have SP values but are excluded from the
                // sprint SP totals displayed on the board. We mirror that behaviour here.
                double rawBoardTotalSP = 0, rawBoardDoneSP = 0;

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

                        // ── Issue type — track breakdown and detect sub-tasks ─
                        Map<String, Object> issueType = asMap(fields.get("issuetype"));
                        String typeName  = issueType != null ? nvl(str(issueType, "name"), "Unknown") : "Unknown";
                        boolean isSubTask = issueType != null && Boolean.TRUE.equals(issueType.get("subtask"));
                        issueTypeBreakdown.merge(typeName, 1, Integer::sum);

                        // ── Story points ─────────────────────────────────────
                        // Only "Story" issues count toward SP — this matches Jira's
                        // sprint board statistics which exclude Bugs, Tasks, Incidents etc.
                        Object sp = fields.get(boardSpField);
                        if (!(sp instanceof Number)) sp = fields.get("customfield_10016");
                        if (!(sp instanceof Number)) sp = fields.get("customfield_10028");
                        boolean countsForSP = !isSubTask && "Story".equalsIgnoreCase(typeName);
                        double issueSP = (countsForSP && sp instanceof Number)
                                ? ((Number) sp).doubleValue() : 0;
                        rawBoardTotalSP += issueSP;
                        if ("done".equalsIgnoreCase(statusKey)) rawBoardDoneSP += issueSP;

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
                        // SP and issue counts are attributed to the assignee.
                        // Hours are attributed to worklog authors below (not the assignee),
                        // since multiple people can log time against the same ticket.
                        Map<String, Object> assignee = asMap(fields.get("assignee"));
                        String member = assignee != null
                                ? nvl(str(assignee, "displayName"), "Unassigned") : "Unassigned";
                        if (issueSP > 0)  spByMember.merge(member,    (int) issueSP, Integer::sum);
                        memberIssueCount.merge(member, 1, Integer::sum);

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

                        // ── Worklogs ─────────────────────────────────────────
                        // Use resolveWorklogs() so we get the COMPLETE list even when
                        // the issue has more than 20 entries (the Jira search API limit).
                        // Hours are attributed to each worklog's author — not the assignee —
                        // because multiple people can log time against the same ticket.
                        String issueKey = issue.get("key") instanceof String ? (String) issue.get("key") : null;
                        boolean hasWorklogHours = false;
                        if (issueKey != null) {
                            for (Map<String, Object> wlMap : resolveWorklogs(issueKey, fields)) {
                                if (wlMap == null) continue;
                                Map<String, Object> wlAuthor = asMap(wlMap.get("author"));
                                String wlMember = wlAuthor != null
                                        ? nvl(str(wlAuthor, "displayName"), "Unknown") : "Unknown";
                                Object wlSecs = wlMap.get("timeSpentSeconds");
                                double wlHrs  = wlSecs instanceof Number
                                        ? ((Number) wlSecs).doubleValue() / SECONDS_PER_HOUR : 0;
                                if (wlHrs > 0) {
                                    hoursByMember.merge(wlMember, wlHrs, Double::sum);
                                    hasWorklogHours = true;
                                }
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

                        // If there were no worklog entries embedded, fall back to
                        // timespent attributed to the assignee so the bar chart still shows data.
                        if (!hasWorklogHours && hrs > 0) {
                            hoursByMember.merge(member, hrs, Double::sum);
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

                // ── Accumulate Story-only SP ──────────────────────────────
                totalSP += rawBoardTotalSP;
                doneSP  += rawBoardDoneSP;
                log.info("SP board={} sprint={}: storyTotal={} storyDone={}",
                        finalBoardId, sprintId, rawBoardTotalSP, rawBoardDoneSP);

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

                // Determine SP field for this board (reuse cached config)
                String velSpField = "customfield_10016";
                try {
                    Map<String, Object> bc = jiraClient.getBoardConfiguration(boardId);
                    Map<String, Object> est = asMap(bc.get("estimation"));
                    if (est != null) {
                        Map<String, Object> fld = asMap(est.get("field"));
                        if (fld != null && str(fld, "fieldId") != null) velSpField = str(fld, "fieldId");
                    }
                } catch (Exception ignored) {}

                for (Map<String, Object> sprint : jiraClient.getClosedSprints(boardId, VELOCITY_SPRINT_COUNT)) {
                    String name   = nvl(str(sprint, "name"), "Sprint");
                    long sprintId = ((Number) sprint.get("id")).longValue();
                    double committed = 0, completed = 0;
                    boolean usedSprintReport = false;

                    // ── Prefer sprint report for SP (authoritative source) ────
                    try {
                        Map<String, Object> sprintReport = jiraClient.getSprintReport(boardId, sprintId);
                        Map<String, Object> contents = asMap(sprintReport.get("contents"));
                        if (contents != null) {
                            Map<String, Object> allSum       = asMap(contents.get("allIssuesEstimateSum"));
                            Map<String, Object> completedSum = asMap(contents.get("completedIssuesEstimateSum"));
                            double allSP       = allSum       != null && allSum.get("value")       instanceof Number
                                    ? ((Number) allSum.get("value")).doubleValue()       : -1;
                            double completedSP = completedSum != null && completedSum.get("value") instanceof Number
                                    ? ((Number) completedSum.get("value")).doubleValue() : -1;
                            if (allSP >= 0 && completedSP >= 0) {
                                committed         = allSP;      // velocity: all committed (including punted)
                                completed         = completedSP;
                                usedSprintReport  = true;
                            }
                        }
                    } catch (Exception ex) {
                        log.debug("Sprint report unavailable for velocity board={}, sprint={}: {}",
                                boardId, sprintId, ex.getMessage());
                    }

                    // ── Fallback: compute from raw issues if sprint report failed ─
                    if (!usedSprintReport) {
                        for (Map<String, Object> issue : jiraClient.getSprintIssues(boardId, sprintId, velSpField)) {
                            Map<String, Object> fields = asMap(issue.getOrDefault("fields", Map.of()));
                            if (fields == null) fields = Map.of();
                            // Skip sub-tasks — their SP duplicates the parent's
                            Map<String, Object> vIssueType = asMap(fields.get("issuetype"));
                            if (vIssueType != null && Boolean.TRUE.equals(vIssueType.get("subtask"))) continue;
                            Object sp = fields.get(velSpField);
                            if (!(sp instanceof Number)) sp = fields.get("customfield_10016");
                            if (!(sp instanceof Number)) sp = fields.get("customfield_10028");
                            double issueSP = sp instanceof Number ? ((Number) sp).doubleValue() : 0;
                            committed += issueSP;
                            Map<String, Object> statusObj = asMap(fields.get("status"));
                            Map<String, Object> statusCat = statusObj != null
                                    ? asMap(statusObj.get("statusCategory")) : null;
                            if (statusCat != null && "done".equalsIgnoreCase(str(statusCat, "key"))) completed += issueSP;
                        }
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

    /**
     * Returns the complete worklog list for an issue.
     *
     * Jira's search endpoint embeds only the first 20 worklogs per issue.
     * When {@code worklog.total} exceeds the number of embedded entries we
     * fall back to the dedicated /rest/api/3/issue/{key}/worklog endpoint
     * to get every entry — important for long-running tickets that have
     * accumulated many time-log entries.
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> resolveWorklogs(String issueKey, Map<String, Object> fields) {
        Map<String, Object> worklogWrapper = asMap(fields.get("worklog"));
        if (worklogWrapper == null) return List.of();

        Object embeddedObj = worklogWrapper.get("worklogs");
        List<Map<String, Object>> embedded = embeddedObj instanceof List
                ? (List<Map<String, Object>>) embeddedObj : List.of();

        Object totalObj = worklogWrapper.get("total");
        int total = totalObj instanceof Number ? ((Number) totalObj).intValue() : embedded.size();

        if (total <= embedded.size()) {
            // All worklogs are already embedded — use them directly
            return embedded;
        }

        // More worklogs exist than were returned in the search response.
        // Fetch the complete list from the dedicated endpoint.
        log.debug("Issue {} has {} worklogs but only {} embedded — fetching full list",
                issueKey, total, embedded.size());
        try {
            List<Map<String, Object>> full = jiraClient.getWorklogs(issueKey);
            return full.isEmpty() ? embedded : full;
        } catch (Exception e) {
            log.warn("Could not fetch full worklogs for {}: {} — using embedded subset", issueKey, e.getMessage());
            return embedded;
        }
    }

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

    public record SprintIssueRow(
            String key,
            String summary,
            String issueType,
            String statusCategory,
            String statusName,
            String assignee,
            double storyPoints,
            double hoursLogged,
            String priority) {}
}
