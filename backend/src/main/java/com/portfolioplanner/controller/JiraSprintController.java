package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraReleaseService.ReleaseMetrics;
import com.portfolioplanner.service.jira.JiraSprintIssueService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * REST API for fetching Jira issues that fall within a calendar sprint's date window.
 *
 * <pre>
 *   GET /api/jira/sprint-issues?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * </pre>
 *
 * The endpoint finds every Jira sprint (across all enabled POD boards) whose date range
 * overlaps with {@code [startDate, endDate]}, then returns the issues grouped by POD —
 * regardless of how the Jira sprint is named.
 */
@RestController
@RequestMapping("/api/jira/sprint-issues")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class JiraSprintController {

    private final JiraSprintIssueService sprintIssueService;

    /**
     * Returns Jira sprint issues grouped by POD for the given calendar-sprint date window.
     *
     * @param startDate calendar sprint start date (YYYY-MM-DD)
     * @param endDate   calendar sprint end date   (YYYY-MM-DD)
     */
    @GetMapping
    public ResponseEntity<List<ReleaseMetrics>> getSprintIssues(
            @RequestParam String startDate,
            @RequestParam String endDate) {
        LocalDate start = LocalDate.parse(startDate);
        LocalDate end   = LocalDate.parse(endDate);
        return ResponseEntity.ok(sprintIssueService.getIssuesForDateRange(start, end));
    }
}
