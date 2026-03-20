package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import com.portfolioplanner.service.jira.JiraReleaseService.ReleaseMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Fetches Jira sprint issues that overlap a given calendar sprint's date window.
 *
 * <p>Strategy:
 * <ol>
 *   <li>For each enabled POD, iterate over its project boards.</li>
 *   <li>For each board, get ALL sprints (active + closed + future) via
 *       {@link JiraClient#getAllSprints(long)}.</li>
 *   <li>Find any Jira sprint whose {@code startDate}–{@code endDate} window overlaps
 *       the requested calendar window (standard interval-overlap test).</li>
 *   <li>Fetch issues for every matching sprint via the board-scoped endpoint so the
 *       board filter is respected, identical to how the Jira sprint board shows them.</li>
 *   <li>Return one {@link ReleaseMetrics} per POD (issues from all matching sprints
 *       within that POD are merged). The {@code versionName} field carries the Jira
 *       sprint name; {@code notes} carries its actual date range.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraSprintIssueService {

    private final JiraClient              jiraClient;
    private final JiraPodRepository       podRepo;
    private final JiraCredentialsService  creds;
    private final JiraReleaseService      releaseService;   // for computeMetrics + detectSpFieldId

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

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
     * For one POD: find all Jira boards, find overlapping sprints, collect issues.
     * Returns {@code null} if no overlapping sprint found (so we skip this POD silently).
     */
    @SuppressWarnings("unchecked")
    private ReleaseMetrics fetchPodSprintIssues(JiraPod pod, LocalDate calStart, LocalDate calEnd) {
        String spFieldId = releaseService.detectSpFieldId(pod);

        List<Map<String, Object>> allRawIssues = new ArrayList<>();
        String matchedSprintName  = null;
        String matchedSprintDates = null;

        for (JiraPodBoard board : pod.getBoards()) {
            String projectKey = board.getJiraProjectKey();

            // Collect board IDs to search: prefer the explicit override, fall back to API lookup
            List<Long> boardIds = new ArrayList<>();
            if (board.getSprintBoardId() != null && board.getSprintBoardId() > 0) {
                // Direct board ID configured — skip the project-key lookup entirely.
                // This is required when the Scrum board is associated with a different
                // Jira project than the ticket project key (multi-project board setups).
                log.debug("POD [{}] project={}: using explicit sprintBoardId={}",
                        pod.getPodDisplayName(), projectKey, board.getSprintBoardId());
                boardIds.add(board.getSprintBoardId());
            } else {
                List<Map<String, Object>> jiraBoards = jiraClient.getBoards(projectKey);
                if (jiraBoards.isEmpty()) {
                    log.warn("POD [{}] project={}: no Jira boards found via API. " +
                             "If your Scrum board belongs to a different project, set the " +
                             "Sprint Board ID in Settings → Jira Settings → POD Boards.",
                            pod.getPodDisplayName(), projectKey);
                    continue;
                }
                for (Map<String, Object> jiraBoard : jiraBoards) {
                    long bid = toLong(jiraBoard.get("id"));
                    if (bid > 0) boardIds.add(bid);
                }
            }

            for (long boardId : boardIds) {
                List<Map<String, Object>> sprints = jiraClient.getAllSprints(boardId);
                for (Map<String, Object> sprint : sprints) {
                    LocalDate jiraStart = parseSprintDate(sprint.get("startDate"));
                    LocalDate jiraEnd   = parseSprintDate(sprint.get("endDate"));
                    if (jiraStart == null || jiraEnd == null) continue;

                    // Standard overlap: [jiraStart, jiraEnd] ∩ [calStart, calEnd] ≠ ∅
                    if (overlaps(jiraStart, jiraEnd, calStart, calEnd)) {
                        long sprintId = toLong(sprint.get("id"));
                        if (sprintId <= 0) continue;

                        String sprintName = sprint.get("name") instanceof String
                                ? (String) sprint.get("name") : "Sprint";

                        log.info("POD [{}] board {} sprint [{}] ({} → {}) overlaps calendar ({} → {})",
                                pod.getPodDisplayName(), boardId, sprintName,
                                jiraStart, jiraEnd, calStart, calEnd);

                        try {
                            List<Map<String, Object>> issues =
                                    jiraClient.getSprintIssues(boardId, sprintId, spFieldId);
                            allRawIssues.addAll(issues);
                            if (matchedSprintName == null) {
                                matchedSprintName  = sprintName;
                                matchedSprintDates = jiraStart + " → " + jiraEnd;
                            }
                        } catch (Exception e) {
                            log.warn("Could not fetch issues for board={} sprint={}: {}",
                                    boardId, sprintId, e.getMessage());
                        }
                    }
                }
            }
        }

        if (allRawIssues.isEmpty() && matchedSprintName == null) {
            return null;  // no overlap found for this POD → skip
        }

        // Deduplicate by issue key (same issue can appear in multiple boards)
        List<Map<String, Object>> deduplicated = deduplicateByKey(allRawIssues);

        String label = matchedSprintName != null ? matchedSprintName : (calStart + " → " + calEnd);
        String notes = matchedSprintDates;

        return releaseService.computeMetrics(pod.getId(), pod.getPodDisplayName(), label, notes, deduplicated);
    }

    /** Removes duplicate issues (same Jira key) — keeps first occurrence. */
    private List<Map<String, Object>> deduplicateByKey(List<Map<String, Object>> issues) {
        java.util.Set<String> seen = new java.util.LinkedHashSet<>();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> issue : issues) {
            String key = issue.get("key") instanceof String ? (String) issue.get("key") : null;
            if (key != null && seen.add(key)) out.add(issue);
        }
        return out;
    }

    /** Parses a Jira sprint date string (ISO-8601 with optional time/zone) to LocalDate. */
    private LocalDate parseSprintDate(Object raw) {
        if (!(raw instanceof String s)) return null;
        try {
            // Jira returns "2026-03-11T09:00:00.000Z" or just "2026-03-11"
            return LocalDate.parse(s.length() >= 10 ? s.substring(0, 10) : s, ISO_DATE);
        } catch (Exception e) {
            return null;
        }
    }

    private boolean overlaps(LocalDate s1, LocalDate e1, LocalDate s2, LocalDate e2) {
        return !s1.isAfter(e2) && !s2.isAfter(e1);
    }

    private long toLong(Object o) {
        if (o instanceof Number n) return n.longValue();
        return -1L;
    }
}
