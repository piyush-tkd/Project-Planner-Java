package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.JiraSprintIssue;
import com.portfolioplanner.domain.model.JiraSyncedIssue;
import com.portfolioplanner.domain.model.JiraSyncedSprint;
import com.portfolioplanner.domain.model.SprintRetroSummary;
import com.portfolioplanner.domain.repository.JiraSprintIssueRepository;
import com.portfolioplanner.domain.repository.JiraSyncedIssueRepository;
import com.portfolioplanner.domain.repository.JiraSyncedSprintRepository;
import com.portfolioplanner.domain.repository.SprintRetroRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Business logic for sprint retrospective summaries.
 *
 * <p>The controller {@code SprintRetroController} delegates everything here — it is
 * responsible only for routing, @PreAuthorize checks, and HTTP status selection.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SprintRetroService {

    private final SprintRetroRepository retroRepo;
    private final JiraSyncedSprintRepository sprintRepo;
    private final JiraSprintIssueRepository sprintIssueRepo;
    private final JiraSyncedIssueRepository issueRepo;

    // ── Public DTOs (consumed by the controller — public so it can reference them) ─

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

    // ── Query methods ─────────────────────────────────────────────────────────

    /**
     * Returns closed/active sprints with their retro status, newest first.
     *
     * @param projectKey optional project filter
     * @param limit      max results (capped to 1–500)
     */
    @Transactional(readOnly = true)
    public List<SprintSummaryItem> listSprints(String projectKey, int limit) {
        int effectiveLimit = Math.min(Math.max(limit, 1), 500);

        List<JiraSyncedSprint> sprints = projectKey != null && !projectKey.isBlank()
            ? sprintRepo.findByProjectKeyOrderByStartDateDesc(projectKey)
            : sprintRepo.findAll();

        // Lightweight set of sprint IDs that already have a retro — avoid loading full entities
        Set<Long> retroIds = retroRepo.findAll().stream()
            .map(SprintRetroSummary::getSprintJiraId)
            .collect(Collectors.toSet());

        return sprints.stream()
            .filter(s -> "closed".equalsIgnoreCase(s.getState()) || "active".equalsIgnoreCase(s.getState()))
            .sorted(Comparator.comparing(
                (JiraSyncedSprint s) -> {
                    // Active sprints sort to the top; closed sprints sort by end date descending
                    if ("active".equalsIgnoreCase(s.getState())) return LocalDateTime.MAX;
                    return s.getEndDate() != null ? s.getEndDate() : LocalDateTime.MIN;
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

    /** All retro summaries, optionally filtered by project key, newest sprint first. */
    @Transactional(readOnly = true)
    public List<RetroResponse> getSummaries(String projectKey) {
        List<SprintRetroSummary> list = projectKey != null && !projectKey.isBlank()
            ? retroRepo.findByProjectKeyOrderByGeneratedAtDesc(projectKey)
            : retroRepo.findAllByOrderByGeneratedAtDesc();
        return list.stream().map(this::toDto).toList();
    }

    /** Fetch a single retro by sprint ID, throwing 404 if absent. */
    @Transactional(readOnly = true)
    public RetroResponse getBySprintId(Long sprintJiraId) {
        return retroRepo.findBySprintJiraId(sprintJiraId)
            .map(this::toDto)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No retro for this sprint"));
    }

    // ── Mutation methods ──────────────────────────────────────────────────────

    /** Delete a retro summary by its DB id. */
    @Transactional
    public void deleteRetro(Long id) {
        if (!retroRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Retro not found");
        }
        retroRepo.deleteById(id);
    }

    /**
     * Generate (or regenerate) a retro summary for a sprint.
     *
     * <p>Resolves issue data via the sprint-issue join table; for older sprints
     * that pre-date join-table backfill, falls back to the issue's primary
     * {@code sprintId} column and then backfills the join table as a side-effect
     * so future calls are faster.
     */
    @Transactional
    public RetroResponse generate(Long sprintJiraId) {
        JiraSyncedSprint sprint = sprintRepo.findBySprintJiraId(sprintJiraId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sprint not found"));

        // Resolve issues via join table, with legacy fallback + backfill
        List<JiraSyncedIssue> issues = resolveIssues(sprintJiraId);

        int total     = issues.size();
        int completed = (int) issues.stream()
            .filter(i -> "done".equalsIgnoreCase(i.getStatusCategory()))
            .count();

        double spDone = issues.stream()
            .filter(i -> "done".equalsIgnoreCase(i.getStatusCategory()) && i.getStoryPoints() != null)
            .mapToDouble(JiraSyncedIssue::getStoryPoints)
            .sum();

        BigDecimal velocityDelta = computeVelocityDelta(sprint, sprintJiraId, spDone);

        double avgCycle = computeAvgCycleDays(issues);
        double completionPct = total > 0 ? (completed * 100.0 / total) : 0;

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
        log.debug("SprintRetroService: generated retro for sprint {} ({})", sprintJiraId, sprint.getName());
        return toDto(retro);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Resolves the issue list for a sprint.
     * Primary path: via {@code jira_sprint_issue} join table.
     * Fallback: query by {@code sprintId} field for older synced data, and backfill the join table.
     */
    private List<JiraSyncedIssue> resolveIssues(Long sprintJiraId) {
        List<JiraSprintIssue> sprintLinks = sprintIssueRepo.findBySprintJiraId(sprintJiraId);
        List<String> issueKeys = sprintLinks.stream()
            .map(JiraSprintIssue::getIssueKey)
            .toList();

        if (!issueKeys.isEmpty()) {
            return issueRepo.findByIssueKeyIn(issueKeys);
        }

        // Legacy fallback — sprint predates join-table preservation
        List<JiraSyncedIssue> issues = issueRepo.findBySprintId(sprintJiraId);
        if (!issues.isEmpty()) {
            Set<String> existing = sprintIssueRepo.findBySprintJiraId(sprintJiraId).stream()
                .map(JiraSprintIssue::getIssueKey)
                .collect(Collectors.toSet());
            for (JiraSyncedIssue i : issues) {
                if (!existing.contains(i.getIssueKey())) {
                    sprintIssueRepo.save(new JiraSprintIssue(sprintJiraId, i.getIssueKey()));
                }
            }
            log.debug("SprintRetroService: backfilled {} sprint-issue links for sprint {}",
                    issues.size(), sprintJiraId);
        }
        return issues;
    }

    /**
     * Computes the velocity delta (%) relative to the most recently completed preceding sprint.
     * Ordering is based on actual sprint end dates, not retro-generation timestamps.
     */
    private BigDecimal computeVelocityDelta(JiraSyncedSprint sprint, Long sprintJiraId, double spDone) {
        if (sprint.getProjectKey() == null) return null;

        LocalDateTime thisSprintEnded = sprint.getCompleteDate() != null
            ? sprint.getCompleteDate()
            : sprint.getEndDate() != null ? sprint.getEndDate() : LocalDateTime.now();

        List<SprintRetroSummary> prevRetros = retroRepo.findPreviousForVelocity(
            sprint.getProjectKey(), sprintJiraId, thisSprintEnded);
        if (prevRetros.isEmpty()) return null;

        SprintRetroSummary prev = prevRetros.get(0);
        if (prev.getStoryPointsDone() == null || prev.getStoryPointsDone().doubleValue() <= 0) return null;

        double delta = ((spDone - prev.getStoryPointsDone().doubleValue())
            / prev.getStoryPointsDone().doubleValue()) * 100;
        return BigDecimal.valueOf(delta).setScale(1, RoundingMode.HALF_UP);
    }

    /** Average calendar days from issue creation to resolution, for done issues only. */
    private double computeAvgCycleDays(List<JiraSyncedIssue> issues) {
        return issues.stream()
            .filter(i -> "done".equalsIgnoreCase(i.getStatusCategory())
                && i.getResolutionDate() != null && i.getCreatedAt() != null)
            .mapToLong(i -> java.time.temporal.ChronoUnit.DAYS.between(
                i.getCreatedAt().toLocalDate(),
                i.getResolutionDate().toLocalDate()))
            .average()
            .orElse(0);
    }

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
                sb.append("Velocity improved by ").append(String.format("%.1f", v))
                  .append("% vs the prior sprint — strong trend. ");
            else if (v <= -10)
                sb.append("Velocity declined by ").append(String.format("%.1f", Math.abs(v)))
                  .append("% vs the prior sprint — worth discussing in retro. ");
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
            items.add("Completion rate below 70% (" + completed + "/" + total
                + " done) — investigate carry-over causes");
        if (velocityDelta != null && velocityDelta.doubleValue() <= -10)
            items.add(String.format("Velocity dropped %.1f%% — check for blockers or scope creep",
                Math.abs(velocityDelta.doubleValue())));
        if (avgCycle > 5)
            items.add(String.format("Avg cycle time %.1f days — consider breaking down large tickets", avgCycle));
        return items.isEmpty() ? "" : String.join("|", items);
    }
}
