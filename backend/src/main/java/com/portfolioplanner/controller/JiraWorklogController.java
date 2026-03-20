package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraWorklogService;
import com.portfolioplanner.service.jira.JiraWorklogService.WorklogMonthReport;
import com.portfolioplanner.service.jira.JiraWorklogService.UserHistoryReport;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Exposes monthly worklog reports — who worked on what and for how long.
 *
 * <p>GET /api/jira/worklog?month=2025-03
 * <br>GET /api/jira/worklog?month=2025-03&projectKey=ABC
 */
@RestController
@RequestMapping("/api/jira/worklog")
@RequiredArgsConstructor
public class JiraWorklogController {

    private final JiraWorklogService worklogService;

    /**
     * Returns a worklog report for the given month.
     *
     * @param month      required, format "YYYY-MM"
     * @param projectKey optional Jira project key to restrict to one project
     */
    @GetMapping
    public WorklogMonthReport getWorklogReport(
            @RequestParam String month,
            @RequestParam(required = false) String projectKey) {
        return worklogService.getMonthlyReport(month, projectKey);
    }

    /**
     * Returns month-by-month worklog history for a specific author.
     *
     * @param author exact display name (URL-encoded)
     * @param months number of months to look back (default 6, max 24)
     */
    @GetMapping("/user-history")
    public UserHistoryReport getUserHistory(
            @RequestParam String author,
            @RequestParam(defaultValue = "6") int months) {
        return worklogService.getUserHistory(author, months);
    }
}
