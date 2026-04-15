package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.JiraSprintIssue;
import com.portfolioplanner.domain.model.JiraSyncedIssue;
import com.portfolioplanner.domain.model.JiraSyncedSprint;
import com.portfolioplanner.domain.model.SprintRetroSummary;
import com.portfolioplanner.domain.repository.JiraSprintIssueRepository;
import com.portfolioplanner.domain.repository.JiraSyncedIssueRepository;
import com.portfolioplanner.domain.repository.JiraSyncedSprintRepository;
import com.portfolioplanner.domain.repository.SprintRetroRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/retro")
@RequiredArgsConstructor
public class SprintRetroController {

    private final SprintRetroRepository retroRepo;
    private final JiraSyncedSprintRepository sprintRepo;
    private final JiraSprintIssueRepository sprintIssueRepo;
    private final JiraSyncedIssueRepository issueRepo;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public record RetroResponse(
        Long   id,
        Long   sprintJiraId,
        String sprintName,
        String projectKey,
        int    completedIssues,
        int    totalIssues,
        double completionPct,
        Double storyPointsDone,
        Double velocityDeltaPct,
        Double avgCycleTimeDays,
        String summaryText,
        List<String> highlights,
        List<String> concerns,
        String generatedAt
    ) {}

    public record SprintSummaryItem(
        Long   sprintJiraId,
        String sprintName,
        String projectKey,
        String state,
        String startDate,
        String endDate,
        boolean hasRetro,
        Long   boardId
    ) {}

    // ── Endpoints ────────────────────────────────────────────────────────────

    /**
     * List closed sprints with retro status, ordered most-recent first.
     *
     * @param projectKey optional filter — only sprints for this project
     * @param limit      max results to return (default 150, max 500)
     */
    @GetMapping("/sprints")
    public List<SprintSummaryItem> listSprints(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "150") int limit) {

        // Cap at 500 to prevent accidental full table scans via the API
        int effectiveLimit = Math.min(Math.max(limit, 1), 500);

        List<JiraSyncedSprint> sprints = projectKey != null && !projectKey.isBlank()
            ? sprintRepo.findByProjectKeyOrderByStartDateDesc(projectKey)
            : sprintRepo.findAll();

        // Only retro IDs — lightweight fetch for exists-check
        Set<Long> retroIds = retroRepo.findAll().stream()
            .map(SprintRetroSummary::getSprintJiraId)
            .collect(Collectors.toSet());

        return sprints.stream()
            .filter(s -> "closed".equalsIgnoreCase(s.getState()) || "active".equalsIgnoreCase(s.getState()))
            .sorted(Comparator.comparing(
                (JiraSyncedSprint s) -> {
                    // Active sprints first, then closed most-recent first
                    if ("active".equalsIgnoreCase(s.getState())) return java.time.LocalDateTime.MAX;
                    return s.getEndDate() != null ? s.getEndDate() : java.time.LocalDateTime.MIN;
                },
                Comparator.reverseOrder()))
            .limit(effectiveLimit)
            .map(s -> new SprintSummaryItem(
                s.getSprintJiraId(),
                s.getName(),
                s.getProjectKey(),
                s.getState(),
                s.getStartDate() != null ? s.getStartDate().toLocalDate().toString() : null,
                s.getEndDate()   != null ? s.getEndDate().toLocalDate().toString()   : null,
                retroIds.contains(s.getSprintJiraId()),
                s.getBoardId()
            ))
            .collect(Collectors.toList());
    }

    /** Get all generated retro summaries (most recent first) */
    @GetMapping("/summaries")
    public List<RetroResponse> getSummaries(
            @RequestParam(required = false) String projectKey) {
        List<SprintRetroSummary> list = projectKey != null && !projectKey.isBlank()
            ? retroRepo.findByProjectKeyOrderByGeneratedAtDesc(projectKey)
            : retroRepo.findAllByOrderByGeneratedAtDesc();
        return list.stream().map(this::toDto).toList();
    }

    /** Get a specific retro by sprint ID */
    @GetMapping("/summaries/{sprintJiraId}")
    public RetroResponse getBySprintId(@PathVariable Long sprintJiraId) {
        return retroRepo.findBySprintJiraId(sprintJiraId)
            .map(this::toDto)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No retro for this sprint"));
    }

    /** Delete a retro summary by its DB id */
    @DeleteMapping("/summaries/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> deleteRetro(@PathVariable Long id) {
        if (!retroRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Retro not found");
        }
        retroRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /** Generate (or regenerate) a retro summary for a closed sprint */
    @PostMapping("/generate/{sprintJiraId}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<RetroResponse> generate(@PathVariable Long sprintJiraId) {
        JiraSyncedSprint sprint = sprintRepo.findBySprintJiraId(sprintJiraId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sprint not found"));

        // Fetch all issue keys for this sprint
        List<JiraSprintIssue> sprintLinks = sprintIssueRepo.findBySprintJiraId(sprintJiraId);
        List<String> issueKeys = sprintLinks.stream()
            .map(JiraSprintIssue::getIssueKey).toList();

        // Fetch synced issue details.
        // For older closed sprints synced before historical link preservation was introduced,
        // jira_sprint_issue may have no rows for this sprint. Fall back to querying issues
        // by their primary sprintId field — this covers any issue whose "current" sprint at
        // last sync was this one (i.e. it was never moved to a later sprint).
        List<JiraSyncedIssue> issues;
        if (!issueKeys.isEmpty()) {
            issues = issueRepo.findByIssueKeyIn(issueKeys);
        } else {
            issues = issueRepo.findBySprintId(sprintJiraId);
            // Also backfill the join table so future lookups and re-generates are faster
            if (!issues.isEmpty()) {
                Set<String> existing = sprintIssueRepo.findBySprintJiraId(sprintJiraId).stream()
                    .map(JiraSprintIssue::getIssueKey).collect(java.util.stream.Collectors.toSet());
                for (JiraSyncedIssue i : issues) {
                    if (!existing.contains(i.getIssueKey())) {
                        sprintIssueRepo.save(new JiraSprintIssue(sprintJiraId, i.getIssueKey()));
                    }
                }
            }
        }

        int total     = issues.size();
        int completed = (int) issues.stream()
            .filter(i -> "done".equalsIgnoreCase(i.getStatusCategory()))
            .count();

        double spDone = issues.stream()
            .filter(i -> "done".equalsIgnoreCase(i.getStatusCategory()) && i.getStoryPoints() != null)
            .mapToDouble(JiraSyncedIssue::getStoryPoints).sum();

        // Velocity delta: compare with the most recently completed sprint that ended BEFORE
        // this one (using actual sprint end dates, not retro generation timestamps).
        // This ensures correct ordering even when retros are generated out of chronological order.
        BigDecimal velocityDelta = null;
        if (sprint.getProjectKey() != null) {
            // Use sprint's completeDate if available; fall back to endDate; default to far-future
            // so that sprints without a recorded end date still exclude themselves correctly.
            LocalDateTime thisSprintEnded = sprint.getCompleteDate() != null
                ? sprint.getCompleteDate()
                : sprint.getEndDate() != null ? sprint.getEndDate() : LocalDateTime.now();

            List<SprintRetroSummary> prevRetros = retroRepo.findPreviousForVelocity(
                sprint.getProjectKey(), sprintJiraId, thisSprintEnded);
            if (!prevRetros.isEmpty()) {
                SprintRetroSummary prev = prevRetros.get(0);
                if (prev.getStoryPointsDone() != null && prev.getStoryPointsDone().doubleValue() > 0) {
                    double delta = ((spDone - prev.getStoryPointsDone().doubleValue())
                        / prev.getStoryPointsDone().doubleValue()) * 100;
                    velocityDelta = BigDecimal.valueOf(delta).setScale(1, RoundingMode.HALF_UP);
                }
            }
        }

        // Avg cycle time (days from creation to resolution for done issues)
        double avgCycle = issues.stream()
            .filter(i -> "done".equalsIgnoreCase(i.getStatusCategory())
                && i.getResolutionDate() != null && i.getCreatedAt() != null)
            .mapToLong(i ->
                java.time.temporal.ChronoUnit.DAYS.between(
                    i.getCreatedAt().toLocalDate(),
                    i.getResolutionDate().toLocalDate()))
            .average()
            .orElse(0);

        double completionPct = total > 0 ? (completed * 100.0 / total) : 0;

        // Generate narrative summary
        String summaryText = buildSummary(sprint, total, completed, completionPct, spDone, velocityDelta);
        String highlights  = buildHighlights(completed, total, spDone, velocityDelta);
        String concerns    = buildConcerns(completed, total, velocityDelta, avgCycle);

        // Upsert
        SprintRetroSummary retro = retroRepo.findBySprintJiraId(sprintJiraId)
            .orElse(new SprintRetroSummary());
        retro.setSprintJiraId(sprintJiraId);
        retro.setSprintName(sprint.getName());
        retro.setProjectKey(sprint.getProjectKey());
        retro.setBoardId(sprint.getBoardId());
        // Store actual sprint end date for chronological velocity ordering
        retro.setSprintEndDate(sprint.getCompleteDate() != null
            ? sprint.getCompleteDate() : sprint.getEndDate());
        retro.setCompletedIssues(completed);
        retro.setTotalIssues(total);
        retro.setStoryPointsDone(BigDecimal.valueOf(spDone).setScale(1, RoundingMode.HALF_UP));
        retro.setVelocityDeltaPct(velocityDelta);
        retro.setAvgCycleTimeDays(BigDecimal.valueOf(avgCycle).setScale(1, RoundingMode.HALF_UP));
        retro.setSummaryText(summaryText);
        retro.setHighlights(highlights);
        retro.setConcerns(concerns);
        retro.setGeneratedAt(LocalDateTime.now());

        retro = retroRepo.save(retro);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(retro));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private RetroResponse toDto(SprintRetroSummary r) {
        double completionPct = r.getTotalIssues() > 0
            ? (r.getCompletedIssues() * 100.0 / r.getTotalIssues()) : 0;
        return new RetroResponse(
            r.getId(),
            r.getSprintJiraId(),
            r.getSprintName(),
            r.getProjectKey(),
            r.getCompletedIssues(),
            r.getTotalIssues(),
            Math.round(completionPct * 10.0) / 10.0,
            r.getStoryPointsDone() != null ? r.getStoryPointsDone().doubleValue() : null,
            r.getVelocityDeltaPct() != null ? r.getVelocityDeltaPct().doubleValue() : null,
            r.getAvgCycleTimeDays() != null ? r.getAvgCycleTimeDays().doubleValue() : null,
            r.getSummaryText(),
            r.getHighlights() != null ? Arrays.asList(r.getHighlights().split("\\|")) : List.of(),
            r.getConcerns()   != null ? Arrays.asList(r.getConcerns().split("\\|"))   : List.of(),
            r.getGeneratedAt() != null ? r.getGeneratedAt().toString() : null
        );
    }

    private String buildSummary(JiraSyncedSprint sprint, int total, int completed,
                                 double completionPct, double spDone, BigDecimal velocityDelta) {
        StringBuilder sb = new StringBuilder();
        sb.append(sprint.getName()).append(" concluded ");
        if (sprint.getEndDate() != null)
            sb.append("on ").append(sprint.getEndDate().toLocalDate()).append(" ");
        sb.append("with ").append(completed).append(" of ").append(total)
          .append(" issues completed (").append(String.format("%.0f", completionPct)).append("%). ");

        if (spDone > 0)
            sb.append("The team delivered ").append(String.format("%.0f", spDone)).append(" story points. ");

        if (velocityDelta != null) {
            double v = velocityDelta.doubleValue();
            if (v >= 5)
                sb.append("Velocity improved by ").append(String.format("%.1f", v)).append("% vs the prior sprint — strong trend. ");
            else if (v <= -10)
                sb.append("Velocity declined by ").append(String.format("%.1f", Math.abs(v))).append("% vs the prior sprint — worth discussing in retro. ");
            else
                sb.append("Velocity was broadly consistent with the prior sprint. ");
        }

        if (sprint.getGoal() != null && !sprint.getGoal().isBlank())
            sb.append("Sprint goal: \"").append(sprint.getGoal()).append("\"");

        return sb.toString();
    }

    private String buildHighlights(int completed, int total, double spDone, BigDecimal velocityDelta) {
        List<String> items = new java.util.ArrayList<>();
        if (total > 0 && completed * 100.0 / total >= 80)
            items.add("High completion rate: " + completed + "/" + total + " issues done");
        if (spDone > 0)
            items.add(String.format("%.0f story points delivered", spDone));
        if (velocityDelta != null && velocityDelta.doubleValue() >= 5)
            items.add(String.format("Velocity up %.1f%% vs prior sprint", velocityDelta.doubleValue()));
        if (items.isEmpty()) items.add("Sprint completed");
        return String.join("|", items);
    }

    private String buildConcerns(int completed, int total, BigDecimal velocityDelta, double avgCycle) {
        List<String> items = new java.util.ArrayList<>();
        if (total > 0 && completed * 100.0 / total < 70)
            items.add("Completion rate below 70% (" + completed + "/" + total + " done) — investigate carry-over causes");
        if (velocityDelta != null && velocityDelta.doubleValue() <= -10)
            items.add(String.format("Velocity dropped %.1f%% — check for blockers or scope creep", Math.abs(velocityDelta.doubleValue())));
        if (avgCycle > 5)
            items.add(String.format("Avg cycle time %.1f days — consider breaking down large tickets", avgCycle));
        return items.isEmpty() ? "" : String.join("|", items);
    }
}
