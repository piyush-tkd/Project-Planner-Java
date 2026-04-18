package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Business logic for the Sprint Backlog feature.
 * Handles pod listing and per-pod sprint + backlog data aggregation.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SprintBacklogService {

    private final JiraPodRepository               podRepo;
    private final JiraSyncedSprintRepository      sprintRepo;
    private final JiraSyncedIssueRepository       issueRepo;
    private final JiraSprintIssueRepository       sprintIssueRepo;
    private final JiraIssueFixVersionRepository   fixVersionRepo;
    private final JiraIssueTransitionRepository   transitionRepo;
    private final JiraIssueCustomFieldRepository  customFieldRepo;

    // ── Pod list ──────────────────────────────────────────────────────────────

    public List<PodSummary> listPods() {
        return podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc().stream()
                .map(p -> new PodSummary(
                        p.getId(),
                        p.getPodDisplayName(),
                        p.getBoards().stream().map(JiraPodBoard::getJiraProjectKey).collect(Collectors.toList())))
                .collect(Collectors.toList());
    }

    // ── Backlog for one POD ───────────────────────────────────────────────────

    /**
     * @param view  active (default) | future | closed | all
     */
    public BacklogResult getBacklog(Long podId, String view) {
        JiraPod pod = podRepo.findByIdWithBoards(podId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "POD not found"));

        List<String> keys = pod.getBoards().stream()
                .map(JiraPodBoard::getJiraProjectKey)
                .collect(Collectors.toList());

        if (keys.isEmpty()) {
            return new BacklogResult(podId, pod.getPodDisplayName(), keys,
                    List.of(), new BacklogGroup(0, List.of()), null);
        }

        // ── Sprint selection ──────────────────────────────────────────────────
        List<JiraSyncedSprint> activeSprints = sprintRepo.findByProjectKeyInAndState(keys, "active");
        List<JiraSyncedSprint> futureSprints = sprintRepo.findByProjectKeyInAndState(keys, "future");
        List<JiraSyncedSprint> closedSprints = new ArrayList<>();

        LocalDateTime staleCutoff = LocalDateTime.now().minusDays(7);
        activeSprints = activeSprints.stream()
                .filter(s -> s.getEndDate() == null || s.getEndDate().isAfter(staleCutoff))
                .collect(Collectors.toList());

        if ("closed".equals(view) || "all".equals(view)) {
            LocalDateTime closedCutoff = LocalDateTime.now().minusDays(90);
            closedSprints = sprintRepo.findByProjectKeyInAndState(keys, "closed").stream()
                    .filter(s -> s.getEndDate() == null || s.getEndDate().isAfter(closedCutoff))
                    .sorted(Comparator.comparing(
                            (JiraSyncedSprint s) -> s.getEndDate() != null ? s.getEndDate() : LocalDateTime.MIN)
                            .reversed())
                    .collect(Collectors.toList());
        }

        futureSprints.sort(Comparator.comparing(
                s -> s.getStartDate() != null ? s.getStartDate() : LocalDateTime.MAX));

        List<JiraSyncedSprint> allSprints = new ArrayList<>();
        if (!"closed".equals(view))                                allSprints.addAll(activeSprints);
        if ("future".equals(view) || "all".equals(view))           allSprints.addAll(futureSprints);
        if ("closed".equals(view) || "all".equals(view))           allSprints.addAll(closedSprints);

        // ── Load issues ───────────────────────────────────────────────────────
        List<JiraSyncedIssue> allIssues = issueRepo.findByProjectKeyIn(keys);
        Map<String, JiraSyncedIssue> issueByKey = allIssues.stream()
                .collect(Collectors.toMap(JiraSyncedIssue::getIssueKey, i -> i, (a, b) -> a));

        List<String> allIssueKeys = allIssues.stream().map(JiraSyncedIssue::getIssueKey).collect(Collectors.toList());
        Map<String, String> fvByKey = allIssueKeys.isEmpty() ? Map.of() :
                fixVersionRepo.findByIssueKeyIn(allIssueKeys).stream()
                        .collect(Collectors.toMap(
                                JiraIssueFixVersion::getIssueKey,
                                JiraIssueFixVersion::getVersionName,
                                (a, b) -> a));

        // Batch-load the most recent transition per issue to compute time-in-current-status.
        // We keep only the latest transition per key to avoid N+1 queries.
        Map<String, LocalDateTime> latestTransitionAt = allIssueKeys.isEmpty() ? Map.of() :
                transitionRepo.findByIssueKeyIn(allIssueKeys).stream()
                        .collect(Collectors.toMap(
                                JiraIssueTransition::getIssueKey,
                                JiraIssueTransition::getTransitionedAt,
                                (a, b) -> a.isAfter(b) ? a : b));

        // Batch-load all custom fields per issue key.
        // Groups into Map<issueKey, Map<fieldName, fieldValue>> for O(1) lookup.
        Map<String, Map<String, String>> customFieldsByIssue = allIssueKeys.isEmpty() ? Map.of() :
                customFieldRepo.findByIssueKeyIn(allIssueKeys).stream()
                        .filter(cf -> cf.getFieldName() != null && cf.getFieldValue() != null)
                        .collect(Collectors.groupingBy(
                                JiraIssueCustomField::getIssueKey,
                                Collectors.toMap(
                                        JiraIssueCustomField::getFieldName,
                                        JiraIssueCustomField::getFieldValue,
                                        (a, b) -> a)));

        // ── Build sprint groups ───────────────────────────────────────────────
        List<SprintGroup> sprintGroups = new ArrayList<>();
        Set<String> assignedToSprintKeys = new HashSet<>();

        for (JiraSyncedSprint sprint : allSprints) {
            List<JiraSprintIssue> links = sprintIssueRepo.findBySprintJiraId(sprint.getSprintJiraId());
            List<String> linkedKeys = links.stream().map(JiraSprintIssue::getIssueKey).collect(Collectors.toList());

            if (linkedKeys.isEmpty()) {
                linkedKeys = allIssues.stream()
                        .filter(i -> sprint.getSprintJiraId().equals(i.getSprintId()))
                        .map(JiraSyncedIssue::getIssueKey)
                        .collect(Collectors.toList());
            }
            assignedToSprintKeys.addAll(linkedKeys);

            Map<String, List<IssueRow>> sprintSubtasksByParent = linkedKeys.stream()
                    .map(issueByKey::get).filter(Objects::nonNull)
                    .filter(i -> Boolean.TRUE.equals(i.getSubtask()) && i.getParentKey() != null)
                    .collect(Collectors.groupingBy(
                            JiraSyncedIssue::getParentKey,
                            Collectors.mapping(i -> toRow(i, fvByKey, latestTransitionAt, customFieldsByIssue), Collectors.toList())));

            List<IssueRow> rows = linkedKeys.stream()
                    .map(issueByKey::get).filter(Objects::nonNull)
                    .filter(i -> !Boolean.TRUE.equals(i.getSubtask()))
                    .map(i -> toRowWithSubtasks(i, sprintSubtasksByParent, fvByKey, latestTransitionAt, customFieldsByIssue))
                    .collect(Collectors.toList());

            int todo   = (int) rows.stream().filter(r -> "to do".equalsIgnoreCase(r.statusCategory()) || r.statusCategory() == null).count();
            int inProg = (int) rows.stream().filter(r -> "indeterminate".equalsIgnoreCase(r.statusCategory())).count();
            int done   = (int) rows.stream().filter(r -> "done".equalsIgnoreCase(r.statusCategory())).count();

            sprintGroups.add(new SprintGroup(
                    sprint.getSprintJiraId(), sprint.getBoardId(), sprint.getName(), sprint.getState(),
                    sprint.getStartDate() != null ? sprint.getStartDate().toLocalDate().toString() : null,
                    sprint.getEndDate()   != null ? sprint.getEndDate().toLocalDate().toString()   : null,
                    sprint.getGoal(), todo, inProg, done, rows.size(), rows));
        }

        // ── Backlog ───────────────────────────────────────────────────────────
        Map<String, List<IssueRow>> backlogSubtasksByParent = allIssues.stream()
                .filter(i -> Boolean.TRUE.equals(i.getSubtask()) && i.getParentKey() != null)
                .filter(i -> !assignedToSprintKeys.contains(i.getIssueKey()))
                .filter(i -> !"done".equalsIgnoreCase(i.getStatusCategory()))
                .collect(Collectors.groupingBy(
                        JiraSyncedIssue::getParentKey,
                        Collectors.mapping(i -> toRow(i, fvByKey, latestTransitionAt, customFieldsByIssue), Collectors.toList())));

        List<IssueRow> backlogRows = allIssues.stream()
                .filter(i -> !Boolean.TRUE.equals(i.getSubtask()))
                .filter(i -> !assignedToSprintKeys.contains(i.getIssueKey()))
                .filter(i -> !"done".equalsIgnoreCase(i.getStatusCategory()))
                .map(i -> toRowWithSubtasks(i, backlogSubtasksByParent, fvByKey, latestTransitionAt, customFieldsByIssue))
                .collect(Collectors.toList());

        backlogRows.sort(Comparator
                .comparingInt((IssueRow r) -> priorityOrder(r.priorityName()))
                .thenComparing(IssueRow::key));

        String syncedAt = allIssues.stream()
                .map(JiraSyncedIssue::getSyncedAt).filter(Objects::nonNull)
                .max(Comparator.naturalOrder()).map(Object::toString).orElse(null);

        return new BacklogResult(podId, pod.getPodDisplayName(), keys, sprintGroups,
                new BacklogGroup(backlogRows.size(), backlogRows), syncedAt);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private IssueRow toRow(JiraSyncedIssue i, Map<String, String> fvByKey,
                           Map<String, LocalDateTime> latestTransitionAt,
                           Map<String, Map<String, String>> customFieldsByIssue) {
        return new IssueRow(
                i.getIssueKey(), i.getSummary(), i.getIssueType(),
                i.getStatusName(), i.getStatusCategory(), i.getPriorityName(),
                i.getAssigneeDisplayName(), i.getAssigneeAvatarUrl(),
                i.getStoryPoints(), i.getEpicName(), i.getEpicKey(),
                fvByKey.get(i.getIssueKey()), i.getSubtask(), i.getParentKey(), List.of(),
                i.getCreatedAt() != null ? i.getCreatedAt().toLocalDate().toString() : null,
                i.getDueDate() != null ? i.getDueDate().toString() : null,
                timeInStatusDays(i, latestTransitionAt),
                customFieldsByIssue.getOrDefault(i.getIssueKey(), Map.of()));
    }

    private IssueRow toRowWithSubtasks(JiraSyncedIssue i,
                                        Map<String, List<IssueRow>> subtasksByParent,
                                        Map<String, String> fvByKey,
                                        Map<String, LocalDateTime> latestTransitionAt,
                                        Map<String, Map<String, String>> customFieldsByIssue) {
        return new IssueRow(
                i.getIssueKey(), i.getSummary(), i.getIssueType(),
                i.getStatusName(), i.getStatusCategory(), i.getPriorityName(),
                i.getAssigneeDisplayName(), i.getAssigneeAvatarUrl(),
                i.getStoryPoints(), i.getEpicName(), i.getEpicKey(),
                fvByKey.get(i.getIssueKey()), i.getSubtask(), i.getParentKey(),
                subtasksByParent.getOrDefault(i.getIssueKey(), List.of()),
                i.getCreatedAt() != null ? i.getCreatedAt().toLocalDate().toString() : null,
                i.getDueDate() != null ? i.getDueDate().toString() : null,
                timeInStatusDays(i, latestTransitionAt),
                customFieldsByIssue.getOrDefault(i.getIssueKey(), Map.of()));
    }

    /** Days the issue has been in its current status (falls back to days since created). */
    private static int timeInStatusDays(JiraSyncedIssue i,
                                         Map<String, LocalDateTime> latestTransitionAt) {
        LocalDateTime since = latestTransitionAt.getOrDefault(i.getIssueKey(), i.getCreatedAt());
        if (since == null) return 0;
        return (int) ChronoUnit.DAYS.between(since.toLocalDate(), LocalDate.now());
    }

    private static int priorityOrder(String priority) {
        if (priority == null) return 99;
        return switch (priority.toLowerCase()) {
            case "highest", "critical", "blocker" -> 1;
            case "high"                           -> 2;
            case "medium"                         -> 3;
            case "low"                            -> 4;
            case "lowest"                         -> 5;
            default                               -> 9;
        };
    }

    // ── Result / DTO types ────────────────────────────────────────────────────

    public record PodSummary(Long id, String displayName, List<String> projectKeys) {}

    public record IssueRow(
            String key, String summary, String issueType,
            String statusName, String statusCategory, String priorityName,
            String assignee, String assigneeAvatarUrl,
            Double storyPoints, String epicName, String epicKey,
            String fixVersionName, Boolean subtask, String parentKey,
            List<IssueRow> subtasks, String createdAt,
            /** ISO date string (yyyy-MM-dd) or null if no due date set in Jira. */
            String dueDate,
            /** Days the issue has been in its current status (0 if unknown). */
            Integer timeInCurrentStatusDays,
            /** All custom fields for this issue, keyed by field name (e.g. "BA Owner"). */
            Map<String, String> customFields
    ) {}

    public record SprintGroup(
            Long sprintJiraId, Long boardId, String name, String state,
            String startDate, String endDate, String goal,
            int todoCount, int inProgressCount, int doneCount, int totalCount,
            List<IssueRow> issues
    ) {}

    public record BacklogGroup(int totalCount, List<IssueRow> issues) {}

    public record BacklogResult(
            Long podId, String podDisplayName, List<String> projectKeys,
            List<SprintGroup> sprints, BacklogGroup backlog, String syncedAt
    ) {}
}
