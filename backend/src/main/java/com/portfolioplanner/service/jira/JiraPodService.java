package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * DB-backed POD metrics service.
 * All data is read from the locally synced PostgreSQL tables
 * instead of live Jira API calls.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraPodService {

    private final JiraCredentialsService       creds;
    private final JiraPodRepository            podRepo;
    private final JiraSyncedIssueRepository    issueRepo;
    private final JiraSyncedSprintRepository   sprintRepo;
    private final JiraIssueWorklogRepository   worklogRepo;
    private final JiraIssueLabelRepository     labelRepo;
    private final JiraIssueFixVersionRepository fixVersionRepo;
    private final JiraIssueComponentRepository componentRepo;
    private final JiraSprintIssueRepository    sprintIssueRepo;

    private static final double SECONDS_PER_HOUR      = 3600.0;
    private static final int    VELOCITY_SPRINT_COUNT  = 6;
    private static final ExecutorService POOL = Executors.newFixedThreadPool(4);

    // ── Public API ────────────────────────────────────────────────────

    public List<JiraPod> getAllPods() {
        return podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
    }

    public List<PodMetrics> getAllPodMetrics() {
        if (!creds.isConfigured()) return List.of();

        List<JiraPod> pods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        if (pods.isEmpty()) {
            log.info("No PODs configured — returning empty metrics");
            return List.of();
        }

        log.info("Building DB-backed POD metrics for {} configured PODs (parallel)", pods.size());
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

    public List<SprintIssueRow> getSprintIssuesForPod(Long podId) {
        if (!creds.isConfigured()) return List.of();
        JiraPod pod = podRepo.findById(podId).orElse(null);
        if (pod == null) return List.of();

        List<String> boardKeys = pod.getBoards().stream()
                .map(JiraPodBoard::getJiraProjectKey).collect(Collectors.toList());

        List<JiraSyncedIssue> issues = issueRepo.findActiveSprintIssuesByProjectKeys(boardKeys);

        return issues.stream()
                .filter(i -> !Boolean.TRUE.equals(i.getSubtask()))
                .map(i -> {
                    String statusCat = normalizeStatusCategory(i.getStatusCategory());
                    double sp = i.getStoryPoints() != null ? i.getStoryPoints() : 0;
                    double hours = i.getTimeSpent() != null ? i.getTimeSpent() / SECONDS_PER_HOUR : 0;
                    return new SprintIssueRow(
                            i.getIssueKey(),
                            nvl(i.getSummary(), ""),
                            nvl(i.getIssueType(), "Unknown"),
                            statusCat,
                            nvl(i.getStatusName(), "Unknown"),
                            nvl(i.getAssigneeDisplayName(), "Unassigned"),
                            round(sp),
                            round(hours),
                            nvl(i.getPriorityName(), "None"));
                })
                .collect(Collectors.toList());
    }

    // ── Internal builders ─────────────────────────────────────────────

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

        // ── Worklog time-series ─────────────────────────────────────
        Map<String, Double>              dailyHoursLogged = new TreeMap<>();
        Map<String, Map<String, Double>> memberDailyHours = new LinkedHashMap<>();

        // ── Cycle time ────────────────────────────────────────────────
        long cycleTimeSum   = 0;
        int  cycleTimeCount = 0;

        // ── Board / sprint metadata ───────────────────────────────────
        List<String> sprintNames = new ArrayList<>();
        String startDate = null, endDate = null;
        int firstSprintId = 0;
        boolean hasActiveSprint = false;

        // Get backlog count from DB
        long backlogSize = issueRepo.countBacklogByProjectKeys(boardKeys);

        // Get active sprints from DB
        List<JiraSyncedSprint> activeSprints = sprintRepo.findByProjectKeyInAndState(boardKeys, "active");

        if (!activeSprints.isEmpty()) {
            hasActiveSprint = true;
            JiraSyncedSprint first = activeSprints.get(0);
            firstSprintId = first.getSprintJiraId().intValue();
            startDate = first.getStartDate() != null ? first.getStartDate().toString() : null;
            endDate = first.getEndDate() != null ? first.getEndDate().toString() : null;
            for (JiraSyncedSprint s : activeSprints) {
                if (!sprintNames.contains(s.getName())) sprintNames.add(s.getName());
            }
        }

        // Get all active-sprint issues from DB
        List<JiraSyncedIssue> sprintIssues = issueRepo.findActiveSprintIssuesByProjectKeys(boardKeys);
        List<String> issueKeys = sprintIssues.stream()
                .map(JiraSyncedIssue::getIssueKey).collect(Collectors.toList());

        // Pre-load related data in bulk
        Map<String, List<JiraIssueLabel>> labelsByKey = issueKeys.isEmpty() ? Map.of() :
                labelRepo.findByIssueKeyIn(issueKeys).stream()
                        .collect(Collectors.groupingBy(JiraIssueLabel::getIssueKey));
        Map<String, List<JiraIssueFixVersion>> fvByKey = issueKeys.isEmpty() ? Map.of() :
                fixVersionRepo.findByIssueKeyIn(issueKeys).stream()
                        .collect(Collectors.groupingBy(JiraIssueFixVersion::getIssueKey));
        Map<String, List<JiraIssueComponent>> compByKey = issueKeys.isEmpty() ? Map.of() :
                componentRepo.findByIssueKeyIn(issueKeys).stream()
                        .collect(Collectors.groupingBy(JiraIssueComponent::getIssueKey));
        Map<String, List<JiraIssueWorklog>> wlByKey = issueKeys.isEmpty() ? Map.of() :
                worklogRepo.findByIssueKeyIn(issueKeys).stream()
                        .collect(Collectors.groupingBy(JiraIssueWorklog::getIssueKey));

        for (JiraSyncedIssue issue : sprintIssues) {
            String statusKey = nvl(issue.getStatusCategory(), "").toLowerCase();
            String statusName = nvl(issue.getStatusName(), "Unknown");
            statusBreakdown.merge(statusName, 1, Integer::sum);
            totalIssues++;

            if ("done".equals(statusKey)) doneIssues++;
            else if ("indeterminate".equals(statusKey)) inProgress++;
            else todoIssues++;

            // Issue type
            String typeName = nvl(issue.getIssueType(), "Unknown");
            boolean isSubTask = Boolean.TRUE.equals(issue.getSubtask());
            issueTypeBreakdown.merge(typeName, 1, Integer::sum);

            // Story points — only Story issues count toward SP (mirrors Jira board stats)
            boolean countsForSP = !isSubTask && "Story".equalsIgnoreCase(typeName);
            double issueSP = (countsForSP && issue.getStoryPoints() != null) ? issue.getStoryPoints() : 0;
            totalSP += issueSP;
            if ("done".equals(statusKey)) doneSP += issueSP;

            // Time tracking
            double hrs = issue.getTimeSpent() != null ? issue.getTimeSpent() / SECONDS_PER_HOUR : 0;
            double est = issue.getTimeOriginalEstimate() != null ? issue.getTimeOriginalEstimate() / SECONDS_PER_HOUR : 0;
            double rem = issue.getTimeEstimate() != null ? issue.getTimeEstimate() / SECONDS_PER_HOUR : 0;
            hoursLogged += hrs;
            estimatedHours += est;
            if (!"done".equals(statusKey)) remainingHours += rem;

            // Assignee
            String member = nvl(issue.getAssigneeDisplayName(), "Unassigned");
            if (issueSP > 0) spByMember.merge(member, (int) issueSP, Integer::sum);
            memberIssueCount.merge(member, 1, Integer::sum);

            // Priority
            priorityBreakdown.merge(nvl(issue.getPriorityName(), "None"), 1, Integer::sum);

            // Labels
            List<JiraIssueLabel> labels = labelsByKey.getOrDefault(issue.getIssueKey(), List.of());
            for (JiraIssueLabel lbl : labels) {
                if (lbl.getLabel() != null && !lbl.getLabel().isBlank())
                    labelBreakdown.merge(lbl.getLabel(), 1, Integer::sum);
            }

            // Fix Versions / Releases
            List<JiraIssueFixVersion> fvs = fvByKey.getOrDefault(issue.getIssueKey(), List.of());
            for (JiraIssueFixVersion fv : fvs) {
                if (fv.getVersionName() != null && !fv.getVersionName().isBlank())
                    releaseBreakdown.merge(fv.getVersionName(), 1, Integer::sum);
            }

            // Components
            List<JiraIssueComponent> comps = compByKey.getOrDefault(issue.getIssueKey(), List.of());
            for (JiraIssueComponent c : comps) {
                if (c.getComponentName() != null && !c.getComponentName().isBlank())
                    componentBreakdown.merge(c.getComponentName(), 1, Integer::sum);
            }

            // Epic
            if (issue.getEpicName() != null && !issue.getEpicName().isBlank()) {
                epicBreakdown.merge(issue.getEpicName(), 1, Integer::sum);
            } else if (issue.getEpicKey() != null && !issue.getEpicKey().isBlank()) {
                epicBreakdown.merge(issue.getEpicKey(), 1, Integer::sum);
            }

            // Worklogs — attribute hours to worklog authors
            List<JiraIssueWorklog> worklogs = wlByKey.getOrDefault(issue.getIssueKey(), List.of());
            boolean hasWorklogHours = false;
            for (JiraIssueWorklog wl : worklogs) {
                String wlMember = nvl(wl.getAuthorDisplayName(), "Unknown");
                double wlHrs = wl.getTimeSpentSeconds() != null ? wl.getTimeSpentSeconds() / SECONDS_PER_HOUR : 0;
                if (wlHrs > 0) {
                    hoursByMember.merge(wlMember, wlHrs, Double::sum);
                    hasWorklogHours = true;
                }
                if (wl.getStarted() != null && wlHrs > 0) {
                    String date = wl.getStarted().toLocalDate().toString();
                    dailyHoursLogged.merge(date, wlHrs, Double::sum);
                    memberDailyHours
                            .computeIfAbsent(wlMember, k -> new TreeMap<>())
                            .merge(date, wlHrs, Double::sum);
                }
            }
            if (!hasWorklogHours && hrs > 0) {
                hoursByMember.merge(member, hrs, Double::sum);
            }

            // Cycle time
            if ("done".equals(statusKey) && issue.getCreatedAt() != null && issue.getResolutionDate() != null) {
                long days = ChronoUnit.DAYS.between(issue.getCreatedAt(), issue.getResolutionDate());
                cycleTimeSum += Math.max(0, days);
                cycleTimeCount++;
            }
        }

        double avgCycleTimeDays = cycleTimeCount > 0 ? round((double) cycleTimeSum / cycleTimeCount) : 0;

        // Round daily hours
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

        return new PodMetrics(
                pod.getId(), pod.getPodDisplayName(), boardKeys, null,
                activeSprint, List.of(),
                (int) backlogSize,
                hoursByMember, spByMember, memberIssueCount,
                issueTypeBreakdown, priorityBreakdown, statusBreakdown,
                labelBreakdown, epicBreakdown, releaseBreakdown, componentBreakdown,
                dailyHoursLogged, memberDailyHours,
                round(estimatedHours), round(remainingHours), avgCycleTimeDays,
                null);
    }

    private List<SprintVelocity> buildAggregatedVelocity(List<String> boardKeys) {
        // Get closed sprints from DB, limit to most recent N
        List<JiraSyncedSprint> closedSprints = sprintRepo.findClosedByProjectKeys(boardKeys);
        if (closedSprints.size() > VELOCITY_SPRINT_COUNT * boardKeys.size()) {
            closedSprints = closedSprints.subList(0, VELOCITY_SPRINT_COUNT * boardKeys.size());
        }

        // Deduplicate by sprint name (same sprint may appear across boards)
        Map<String, double[]> bySprint = new LinkedHashMap<>();
        Set<Long> processed = new HashSet<>();

        for (JiraSyncedSprint sprint : closedSprints) {
            if (!processed.add(sprint.getSprintJiraId())) continue;

            String name = nvl(sprint.getName(), "Sprint");

            // Get issues that were in this sprint via sprint_issue join table
            List<JiraSprintIssue> sprintIssueLinks = sprintIssueRepo.findBySprintJiraId(sprint.getSprintJiraId());
            List<String> sprintIssueKeys = sprintIssueLinks.stream()
                    .map(JiraSprintIssue::getIssueKey).collect(Collectors.toList());

            if (sprintIssueKeys.isEmpty()) {
                // Fallback: use issues whose current sprintId matches
                List<JiraSyncedIssue> issues = issueRepo.findBySprintId(sprint.getSprintJiraId());
                sprintIssueKeys = issues.stream()
                        .map(JiraSyncedIssue::getIssueKey).collect(Collectors.toList());
            }

            if (sprintIssueKeys.isEmpty()) continue;

            List<JiraSyncedIssue> issues = issueRepo.findByIssueKeyIn(sprintIssueKeys);
            double committed = 0, completed = 0;

            for (JiraSyncedIssue issue : issues) {
                if (Boolean.TRUE.equals(issue.getSubtask())) continue;
                double sp = issue.getStoryPoints() != null ? issue.getStoryPoints() : 0;
                committed += sp;
                if ("done".equalsIgnoreCase(nvl(issue.getStatusCategory(), ""))) {
                    completed += sp;
                }
            }

            bySprint.computeIfAbsent(name, k -> new double[]{0, 0});
            bySprint.get(name)[0] += committed;
            bySprint.get(name)[1] += completed;
        }

        return bySprint.entrySet().stream()
                .map(e -> new SprintVelocity(e.getKey(), round(e.getValue()[0]), round(e.getValue()[1])))
                .collect(Collectors.toList());
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private static String normalizeStatusCategory(String cat) {
        if (cat == null) return "To Do";
        return switch (cat.toLowerCase()) {
            case "done"          -> "Done";
            case "indeterminate" -> "In Progress";
            default              -> "To Do";
        };
    }

    private static double round(double v) { return Math.round(v * 10.0) / 10.0; }

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
            Map<String, Integer> memberIssueCount,
            Map<String, Integer> issueTypeBreakdown,
            Map<String, Integer> priorityBreakdown,
            Map<String, Integer> statusBreakdown,
            Map<String, Integer> labelBreakdown,
            Map<String, Integer> epicBreakdown,
            Map<String, Integer> releaseBreakdown,
            Map<String, Integer> componentBreakdown,
            Map<String, Double>              dailyHoursLogged,
            Map<String, Map<String, Double>> memberDailyHours,
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
            int totalIssues, int doneIssues, int inProgressIssues, int todoIssues,
            double totalSP, double doneSP,
            double hoursLogged, double estimatedHours, double remainingHours,
            double progressPct, double spProgressPct,
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
