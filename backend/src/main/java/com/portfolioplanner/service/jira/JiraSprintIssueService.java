package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.domain.model.JiraSyncedIssue;
import com.portfolioplanner.domain.model.JiraSyncedSprint;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import com.portfolioplanner.domain.repository.JiraSyncedIssueRepository;
import com.portfolioplanner.domain.repository.JiraSyncedSprintRepository;
import com.portfolioplanner.domain.repository.JiraSprintIssueRepository;
import com.portfolioplanner.service.jira.JiraReleaseService.ReleaseMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Fetches Jira sprint issues that overlap a given calendar sprint's date window.
 * Uses DB-backed repositories instead of live Jira API calls.
 *
 * <p>Strategy:
 * <ol>
 *   <li>For each enabled POD, iterate over its project boards.</li>
 *   <li>For each project key, query {@link JiraSyncedSprintRepository#findWithDatesForProjectKeys(java.util.List)}
 *       to get synced sprints with valid dates, ordered by startDate DESC.</li>
 *   <li>Find any synced sprint whose {@code startDate}–{@code endDate} window overlaps
 *       the requested calendar window (standard interval-overlap test).</li>
 *   <li>Fetch issues for every matching sprint via {@link JiraSyncedIssueRepository#findBySprintId(Long)},
 *       returning {@link JiraSyncedIssue} entities directly.</li>
 *   <li>Return one {@link ReleaseMetrics} per POD (issues from all matching sprints
 *       within that POD are merged). The {@code versionName} field carries the Jira
 *       sprint name; {@code notes} carries its actual date range.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraSprintIssueService {

    private final JiraPodRepository                podRepo;
    private final JiraSyncedSprintRepository      sprintRepo;
    private final JiraSyncedIssueRepository       issueRepo;
    private final JiraSprintIssueRepository       sprintIssueRepo;
    private final JiraCredentialsService         creds;
    private final JiraReleaseService             releaseService;

    /**
     * Returns one {@link ReleaseMetrics} per POD that has at least one Jira sprint
     * overlapping {@code [startDate, endDate]}.
     *
     * @param startDate calendar sprint start (YYYY-MM-DD)
     * @param endDate   calendar sprint end   (YYYY-MM-DD)
     */
    @Transactional(readOnly = true)
    public List<ReleaseMetrics> getIssuesForDateRange(LocalDate startDate, LocalDate endDate) {
        if (!creds.isConfigured()) {
            return List.of(ReleaseMetrics.error(null, "Sprint Issues", "Jira not configured", "Jira not configured"));
        }

        List<JiraPod> pods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        if (pods.isEmpty()) {
            return List.of(ReleaseMetrics.error(null, "Sprint Issues", "No PODs", "No Jira PODs configured"));
        }

        List<ReleaseMetrics> results = new ArrayList<>();

        for (JiraPod pod : pods) {
            try {
                ReleaseMetrics podResult = fetchPodSprintIssues(pod, startDate, endDate);
                if (podResult != null) {
                    results.add(podResult);
                }
            } catch (Exception e) {
                log.warn("Failed to load sprint issues for pod=[{}]: {}", pod.getPodDisplayName(), e.getMessage());
                results.add(ReleaseMetrics.error(
                        pod.getId(), pod.getPodDisplayName(),
                        startDate + " → " + endDate, e.getMessage()));
            }
        }
        return results;
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * For one POD: find all synced sprints by project key, find overlapping sprints, collect issues.
     * Returns {@code null} if no overlapping sprint found (so we skip this POD silently).
     */
    private ReleaseMetrics fetchPodSprintIssues(JiraPod pod, LocalDate calStart, LocalDate calEnd) {
        List<JiraSyncedIssue> allDbIssues = new ArrayList<>();
        String matchedSprintName  = null;
        String matchedSprintDates = null;

        // Collect all project keys from this POD's boards
        List<String> projectKeys = new ArrayList<>();
        for (JiraPodBoard board : pod.getBoards()) {
            if (board.getJiraProjectKey() != null && !board.getJiraProjectKey().isEmpty()) {
                projectKeys.add(board.getJiraProjectKey());
            }
        }

        if (projectKeys.isEmpty()) {
            log.warn("POD [{}] has no project keys configured", pod.getPodDisplayName());
            return null;
        }

        // Query synced sprints with non-null dates, ordered by startDate DESC
        List<JiraSyncedSprint> syncedSprints = sprintRepo.findWithDatesForProjectKeys(projectKeys);

        for (JiraSyncedSprint sprint : syncedSprints) {
            LocalDate jiraStart = sprint.getStartDate() != null ? sprint.getStartDate().toLocalDate() : null;
            LocalDate jiraEnd   = sprint.getEndDate() != null ? sprint.getEndDate().toLocalDate() : null;

            if (jiraStart == null || jiraEnd == null) {
                continue;
            }

            // Standard overlap: [jiraStart, jiraEnd] ∩ [calStart, calEnd] ≠ ∅
            if (overlaps(jiraStart, jiraEnd, calStart, calEnd)) {
                String sprintName = sprint.getName() != null ? sprint.getName() : "Sprint";

                log.info("POD [{}] synced sprint [{}] ({} → {}) overlaps calendar ({} → {})",
                        pod.getPodDisplayName(), sprintName,
                        jiraStart, jiraEnd, calStart, calEnd);

                try {
                    // Fetch issues for this sprint from DB
                    List<JiraSyncedIssue> issues = issueRepo.findBySprintId(sprint.getSprintJiraId());
                    allDbIssues.addAll(issues);

                    if (matchedSprintName == null) {
                        matchedSprintName  = sprintName;
                        matchedSprintDates = jiraStart + " → " + jiraEnd;
                    }
                } catch (Exception e) {
                    log.warn("Could not fetch issues for sprint={}: {}",
                            sprint.getSprintJiraId(), e.getMessage());
                }
            }
        }

        if (allDbIssues.isEmpty() && matchedSprintName == null) {
            return null;  // no overlap found for this POD → skip
        }

        // Deduplicate by issue key (same issue can appear in multiple boards)
        List<JiraSyncedIssue> deduplicated = deduplicateIssuesByKey(allDbIssues);

        String label = matchedSprintName != null ? matchedSprintName : (calStart + " → " + calEnd);
        String notes = matchedSprintDates;

        return releaseService.computeMetrics(pod.getId(), pod.getPodDisplayName(), label, notes, deduplicated);
    }

    /** Removes duplicate issues (same Jira key) — keeps first occurrence. */
    private List<JiraSyncedIssue> deduplicateIssuesByKey(List<JiraSyncedIssue> issues) {
        Set<String> seen = new java.util.LinkedHashSet<>();
        List<JiraSyncedIssue> out = new ArrayList<>();
        for (JiraSyncedIssue issue : issues) {
            String key = issue.getIssueKey();
            if (key != null && seen.add(key)) {
                out.add(issue);
            }
        }
        return out;
    }

    private boolean overlaps(LocalDate s1, LocalDate e1, LocalDate s2, LocalDate e2) {
        return !s1.isAfter(e2) && !s2.isAfter(e1);
    }
}
