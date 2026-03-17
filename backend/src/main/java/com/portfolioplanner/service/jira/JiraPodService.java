package com.portfolioplanner.service.jira;

import com.portfolioplanner.config.JiraProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Aggregates Jira Agile metrics per POD (= Jira project).
 * Fetches board → sprint → issues to produce sprint health, velocity,
 * hours logged, story points, and member-level breakdowns.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraPodService {

    private final JiraClient jiraClient;
    private final JiraProperties props;

    private static final double SECONDS_PER_HOUR = 3600.0;
    private static final int VELOCITY_SPRINT_COUNT = 6;

    // ── Public API ────────────────────────────────────────────────────

    /** Returns POD metrics for every visible Jira project. */
    public List<PodMetrics> getAllPodMetrics() {
        if (!props.isConfigured()) return List.of();

        List<Map<String, Object>> projects = jiraClient.getProjects();
        log.info("Building POD metrics for {} projects", projects.size());

        List<PodMetrics> result = new ArrayList<>();
        for (Map<String, Object> proj : projects) {
            String key  = str(proj, "key");
            String name = str(proj, "name");
            if (key == null || key.isBlank()) continue;
            try {
                result.add(buildPodMetrics(key, name));
            } catch (Exception e) {
                log.warn("Failed to build POD metrics for {}: {}", key, e.getMessage());
                result.add(PodMetrics.error(key, name, e.getMessage()));
            }
        }
        return result;
    }

    // ── Internal builder ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private PodMetrics buildPodMetrics(String projectKey, String projectName) {
        // 1. Find the board for this project
        List<Map<String, Object>> boards = jiraClient.getBoards(projectKey);
        if (boards.isEmpty()) {
            log.debug("No board found for project {}", projectKey);
            return PodMetrics.noBoard(projectKey, projectName);
        }

        // Prefer Scrum boards; fall back to first board
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

            // Aggregate sprint stats
            int totalIssues = issues.size();
            int doneIssues  = 0;
            int inProgress  = 0;
            double totalSP  = 0;
            double doneSP   = 0;
            double hoursLogged = 0;

            for (Map<String, Object> issue : issues) {
                Map<String, Object> fields = (Map<String, Object>) issue.getOrDefault("fields", Map.of());

                // Status
                Map<String, Object> statusObj  = (Map<String, Object>) fields.get("status");
                Map<String, Object> statusCat  = statusObj != null
                        ? (Map<String, Object>) statusObj.get("statusCategory") : null;
                String statusKey = statusCat != null ? str(statusCat, "key") : "";
                if ("done".equalsIgnoreCase(statusKey)) doneIssues++;
                else if ("indeterminate".equalsIgnoreCase(statusKey)) inProgress++;

                // Story points
                Object sp = fields.get("customfield_10016");
                double issueSP = sp instanceof Number ? ((Number) sp).doubleValue() : 0;
                totalSP += issueSP;
                if ("done".equalsIgnoreCase(statusKey)) doneSP += issueSP;

                // Assignee
                Map<String, Object> assignee = (Map<String, Object>) fields.get("assignee");
                String member = assignee != null
                        ? nvl((String) assignee.get("displayName"), "Unassigned")
                        : "Unassigned";

                // Time logged
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
                    Math.round(totalSP * 10.0) / 10.0,
                    Math.round(doneSP * 10.0) / 10.0,
                    Math.round(hoursLogged * 10.0) / 10.0);
        }

        // 3. Velocity: last N closed sprints
        List<SprintVelocity> velocity = buildVelocity(boardId);

        // 4. Backlog size
        int backlogSize = 0;
        try {
            backlogSize = jiraClient.getBacklogIssues(boardId).size();
        } catch (Exception e) {
            log.debug("Backlog unavailable for {}: {}", projectKey, e.getMessage());
        }

        return new PodMetrics(
                projectKey, projectName,
                str(board, "name"),
                activeSprint,
                velocity,
                backlogSize,
                hoursByMember,
                spByMember,
                null);
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
                    String statusKey = statusCat != null ? str(statusCat, "key") : "";
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
