package com.portfolioplanner.controller;

import com.portfolioplanner.service.SprintBacklogService;
import com.portfolioplanner.service.SprintBacklogService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Sprint Backlog — returns per-POD sprint + backlog data from local DB cache.
 *
 * GET /api/backlog/pods          → list of all enabled pods (for tab rendering)
 * GET /api/backlog/sprint-names  → lightweight list of sprint names + states across all enabled pods
 * GET /api/backlog/{podId}       → sprints + issues for a specific pod
 */
@RestController
@RequestMapping("/api/backlog")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class SprintBacklogController {

    private final SprintBacklogService sprintBacklogService;
    private final JdbcTemplate jdbc;

    @GetMapping("/pods")
    public ResponseEntity<List<PodSummary>> getPods() {
        return ResponseEntity.ok(sprintBacklogService.listPods());
    }

    /**
     * Lightweight sprint list — name + state only, no issues.
     * Scoped to enabled PODs. Closed sprints limited to last 90 days.
     * Ordered: active first, then closed by end_date desc.
     */
    @GetMapping("/sprint-names")
    public ResponseEntity<List<Map<String, String>>> sprintNames() {
        List<Map<String, String>> rows = jdbc.query(
            "SELECT name, state FROM (" +
            "  SELECT js.name, js.state, MAX(js.end_date) AS max_end " +
            "  FROM jira_sprint js " +
            "  JOIN jira_pod_board jpb ON js.project_key = jpb.jira_project_key " +
            "  JOIN jira_pod jp ON jpb.pod_id = jp.id " +
            "  WHERE jp.enabled = true " +
            "    AND js.state IN ('active', 'closed') " +
            "    AND (js.state = 'active' OR js.end_date > NOW() - INTERVAL '90 days') " +
            "  GROUP BY js.name, js.state" +
            ") sub " +
            "ORDER BY CASE state WHEN 'active' THEN 0 ELSE 1 END, max_end DESC NULLS LAST",
            (rs, rowNum) -> {
                Map<String, String> m = new LinkedHashMap<>();
                m.put("name",  rs.getString("name"));
                m.put("state", rs.getString("state"));
                return m;
            });
        return ResponseEntity.ok(rows);
    }

    /**
     * @param view  active (default) | future | closed | all
     */
    @GetMapping("/{podId}")
    public ResponseEntity<BacklogResult> getBacklog(
            @PathVariable Long podId,
            @RequestParam(defaultValue = "future") String view) {
        return ResponseEntity.ok(sprintBacklogService.getBacklog(podId, view));
    }
}
