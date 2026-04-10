package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Sprint Backlog — returns per-POD sprint + backlog data from local DB cache.
 *
 * GET /api/backlog/pods          → list of all enabled pods (for tab rendering)
 * GET /api/backlog/{podId}       → sprints + issues for a specific pod
 */
@RestController
@RequestMapping("/api/backlog")
@RequiredArgsConstructor
public class SprintBacklogController {

    private final JiraPodRepository             podRepo;
    private final JiraSyncedSprintRepository    sprintRepo;
    private final JiraSyncedIssueRepository     issueRepo;
    private final JiraSprintIssueRepository     sprintIssueRepo;
    private final JiraIssueFixVersionRepository fixVersionRepo;

    // ── DTOs ──────────────────────────────────────────────────────────────────

    public record PodSummary(Long id, String displayName, List<String> projectKeys) {}

    public record IssueRow(
        String key,
        String summary,
        String issueType,
        String statusName,
        String statusCategory,
        String priorityName,
        String assignee,
        String assigneeAvatarUrl,   // Jira 48x48 avatar URL (may be null)
        Double storyPoints,
        String epicName,
        String epicKey,
        String fixVersionName,      // first fix version (may be null)
        Boolean subtask,
        String parentKey,
        List<IssueRow> subtasks   // nested subtask rows; empty for subtasks themselves
    ) {}

    public record SprintGroup(
        Long   sprintJiraId,
        Long   boardId,
        String name,
        String state,
        String startDate,
        String endDate,
        String goal,
        int    todoCount,
        int    inProgressCount,
        int    doneCount,
        int    totalCount,
        List<IssueRow> issues
    ) {}

    public record BacklogGroup(
        int    totalCount,
        List<IssueRow> issues
    ) {}

    public record BacklogResponse(
        Long         podId,
        String       podDisplayName,
        List<String> projectKeys,
        List<SprintGroup> sprints,
        BacklogGroup backlog,
        String       syncedAt
    ) {}

    // ── Endpoints ─────────────────────────────────────────────────────────────

    /** List all enabled PODs — used to render tabs in the frontend */
    @GetMapping("/pods")
    public ResponseEntity<List<PodSummary>> getPods() {
        List<JiraPod> pods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        List<PodSummary> result = pods.stream().map(p -> new PodSummary(
            p.getId(),
            p.getPodDisplayName(),
            p.getBoards().stream().map(JiraPodBoard::getJiraProjectKey).collect(Collectors.toList())
        )).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /** Full backlog for one POD: active & future sprints with issues + backlog bucket */
    @GetMapping("/{podId}")
    public ResponseEntity<BacklogResponse> getBacklog(@PathVariable Long podId) {
        JiraPod pod = podRepo.findById(podId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "POD not found"));

        List<String> keys = pod.getBoards().stream()
            .map(JiraPodBoard::getJiraProjectKey)
            .collect(Collectors.toList());

        if (keys.isEmpty()) {
            return ResponseEntity.ok(new BacklogResponse(
                podId, pod.getPodDisplayName(), keys, List.of(),
                new BacklogGroup(0, List.of()), null));
        }

        // ── Active and future sprints ──────────────────────────────────────────
        List<JiraSyncedSprint> activeSprints = sprintRepo.findByProjectKeyInAndState(keys, "active");
        List<JiraSyncedSprint> futureSprints = sprintRepo.findByProjectKeyInAndState(keys, "future");

        // Safety guard: if a sprint is still marked "active" but its end date is more than
        // 30 days in the past, its state is almost certainly stale in our DB (the Jira board
        // that owns it may not be returned by getBoards for this project key, so the state
        // never gets updated to "closed").  Hide these from the sprint backlog view so users
        // don't see old, completed sprints with historical issues mixed into the active view.
        LocalDateTime staleCutoff = LocalDateTime.now().minusDays(30);
        activeSprints = activeSprints.stream()
            .filter(s -> s.getEndDate() == null || s.getEndDate().isAfter(staleCutoff))
            .collect(Collectors.toList());

        // Combine: active first, then future ordered by start date
        futureSprints.sort(Comparator.comparing(
            s -> s.getStartDate() != null ? s.getStartDate() : LocalDateTime.MAX));
        List<JiraSyncedSprint> allSprints = new ArrayList<>(activeSprints);
        allSprints.addAll(futureSprints);

        // Collect sprint IDs
        List<Long> sprintIds = allSprints.stream()
            .map(JiraSyncedSprint::getSprintJiraId)
            .collect(Collectors.toList());

        // ── Load ALL issues for this pod ────────────────────────────────────────
        List<JiraSyncedIssue> allIssues = issueRepo.findByProjectKeyIn(keys);

        // Index issues by key for fast lookup
        Map<String, JiraSyncedIssue> issueByKey = allIssues.stream()
            .collect(Collectors.toMap(JiraSyncedIssue::getIssueKey, i -> i, (a, b) -> a));

        // Bulk load fix versions — keep first version per issue key
        List<String> allIssueKeys = allIssues.stream().map(JiraSyncedIssue::getIssueKey).collect(Collectors.toList());
        Map<String, String> fvByKey = allIssueKeys.isEmpty() ? Map.of() :
            fixVersionRepo.findByIssueKeyIn(allIssueKeys).stream()
                .collect(Collectors.toMap(
                    JiraIssueFixVersion::getIssueKey,
                    JiraIssueFixVersion::getVersionName,
                    (a, b) -> a   // keep first if multiple fix versions
                ));

        // ── Build sprint groups from sprint_issue join table ───────────────────
        List<SprintGroup> sprintGroups = new ArrayList<>();
        Set<String> assignedToSprintKeys = new HashSet<>();

        for (JiraSyncedSprint sprint : allSprints) {
            List<JiraSprintIssue> links = sprintIssueRepo.findBySprintJiraId(sprint.getSprintJiraId());
            List<String> linkedKeys = links.stream()
                .map(JiraSprintIssue::getIssueKey)
                .collect(Collectors.toList());

            // Fallback: if join table is empty, use sprintId on issue
            if (linkedKeys.isEmpty()) {
                linkedKeys = allIssues.stream()
                    .filter(i -> sprint.getSprintJiraId().equals(i.getSprintId()))
                    .map(JiraSyncedIssue::getIssueKey)
                    .collect(Collectors.toList());
            }

            assignedToSprintKeys.addAll(linkedKeys);

            // Build subtask map: parentKey → list of subtask rows (for this sprint)
            Map<String, List<IssueRow>> sprintSubtasksByParent = linkedKeys.stream()
                .map(issueByKey::get)
                .filter(Objects::nonNull)
                .filter(i -> Boolean.TRUE.equals(i.getSubtask()) && i.getParentKey() != null)
                .collect(Collectors.groupingBy(
                    JiraSyncedIssue::getParentKey,
                    Collectors.mapping(i -> toRow(i, fvByKey), Collectors.toList())
                ));

            // Build parent rows with subtasks attached
            List<IssueRow> rows = linkedKeys.stream()
                .map(issueByKey::get)
                .filter(Objects::nonNull)
                .filter(i -> !Boolean.TRUE.equals(i.getSubtask()))
                .map(i -> toRowWithSubtasks(i, sprintSubtasksByParent, fvByKey))
                .collect(Collectors.toList());

            // Sprint header counts use parent issues only (matches Jira behaviour)
            int todo   = (int) rows.stream().filter(r -> "to do".equalsIgnoreCase(r.statusCategory()) || r.statusCategory() == null).count();
            int inProg = (int) rows.stream().filter(r -> "indeterminate".equalsIgnoreCase(r.statusCategory())).count();
            int done   = (int) rows.stream().filter(r -> "done".equalsIgnoreCase(r.statusCategory())).count();

            sprintGroups.add(new SprintGroup(
                sprint.getSprintJiraId(),
                sprint.getBoardId(),
                sprint.getName(),
                sprint.getState(),
                sprint.getStartDate() != null ? sprint.getStartDate().toLocalDate().toString() : null,
                sprint.getEndDate()   != null ? sprint.getEndDate().toLocalDate().toString()   : null,
                sprint.getGoal(),
                todo, inProg, done, rows.size(),
                rows
            ));
        }

        // ── Backlog: issues not assigned to any active/future sprint, not done ──
        // Build subtask map for backlog issues
        Map<String, List<IssueRow>> backlogSubtasksByParent = allIssues.stream()
            .filter(i -> Boolean.TRUE.equals(i.getSubtask()) && i.getParentKey() != null)
            .filter(i -> !assignedToSprintKeys.contains(i.getIssueKey()))
            .filter(i -> !"done".equalsIgnoreCase(i.getStatusCategory()))
            .collect(Collectors.groupingBy(
                JiraSyncedIssue::getParentKey,
                Collectors.mapping(i -> toRow(i, fvByKey), Collectors.toList())
            ));

        List<IssueRow> backlogRows = allIssues.stream()
            .filter(i -> !Boolean.TRUE.equals(i.getSubtask()))
            .filter(i -> !assignedToSprintKeys.contains(i.getIssueKey()))
            .filter(i -> !"done".equalsIgnoreCase(i.getStatusCategory()))
            .map(i -> toRowWithSubtasks(i, backlogSubtasksByParent, fvByKey))
            .collect(Collectors.toList());

        // Sort backlog: highest priority first (P1 > P2 > ...), then by key
        backlogRows.sort(Comparator
            .comparingInt((IssueRow r) -> priorityOrder(r.priorityName()))
            .thenComparing(IssueRow::key));

        String syncedAt = allIssues.stream()
            .map(JiraSyncedIssue::getSyncedAt)
            .filter(Objects::nonNull)
            .max(Comparator.naturalOrder())
            .map(Object::toString)
            .orElse(null);

        return ResponseEntity.ok(new BacklogResponse(
            podId,
            pod.getPodDisplayName(),
            keys,
            sprintGroups,
            new BacklogGroup(backlogRows.size(), backlogRows),
            syncedAt
        ));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Basic row — no subtasks attached (used for subtask entries themselves). */
    private IssueRow toRow(JiraSyncedIssue i, Map<String, String> fvByKey) {
        return new IssueRow(
            i.getIssueKey(),
            i.getSummary(),
            i.getIssueType(),
            i.getStatusName(),
            i.getStatusCategory(),
            i.getPriorityName(),
            i.getAssigneeDisplayName(),
            i.getAssigneeAvatarUrl(),
            i.getStoryPoints(),
            i.getEpicName(),
            i.getEpicKey(),
            fvByKey.get(i.getIssueKey()),
            i.getSubtask(),
            i.getParentKey(),
            List.of()
        );
    }

    /** Row with subtasks nested — used for parent (non-subtask) issues. */
    private IssueRow toRowWithSubtasks(JiraSyncedIssue i, Map<String, List<IssueRow>> subtasksByParent,
                                        Map<String, String> fvByKey) {
        return new IssueRow(
            i.getIssueKey(),
            i.getSummary(),
            i.getIssueType(),
            i.getStatusName(),
            i.getStatusCategory(),
            i.getPriorityName(),
            i.getAssigneeDisplayName(),
            i.getAssigneeAvatarUrl(),
            i.getStoryPoints(),
            i.getEpicName(),
            i.getEpicKey(),
            fvByKey.get(i.getIssueKey()),
            i.getSubtask(),
            i.getParentKey(),
            subtasksByParent.getOrDefault(i.getIssueKey(), List.of())
        );
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
}
