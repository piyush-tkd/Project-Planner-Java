package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraReleaseService;
import com.portfolioplanner.service.jira.JiraReleaseService.ReleaseConfigRequest;
import com.portfolioplanner.service.jira.JiraReleaseService.ReleaseConfigResponse;
import com.portfolioplanner.service.jira.JiraReleaseService.ReleaseMetrics;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API for the Releases tracking feature.
 *
 * <pre>
 *   GET  /api/jira/releases                    – aggregated release metrics for all PODs
 *   GET  /api/jira/releases/config             – tracked release versions per POD (for settings)
 *   POST /api/jira/releases/config             – save tracked release versions for PODs
 *   GET  /api/jira/releases/fixversions/{podId} – available fix versions from Jira for a POD
 * </pre>
 */
@RestController
@RequestMapping("/api/jira/releases")
@RequiredArgsConstructor
public class JiraReleaseController {

    private final JiraReleaseService releaseService;

    // ── Metrics ────────────────────────────────────────────────────────

    /**
     * Returns aggregated release metrics for all PODs that have at least one tracked version.
     * Each entry represents one (pod, version) combination.
     */
    @GetMapping
    public ResponseEntity<List<ReleaseMetrics>> getReleaseMetrics() {
        return ResponseEntity.ok(releaseService.getAllReleaseMetrics());
    }

    // ── Config ────────────────────────────────────────────────────────

    /** Returns the current release-version config for every POD (enabled and disabled). */
    @GetMapping("/config")
    public ResponseEntity<List<ReleaseConfigResponse>> getConfig() {
        return ResponseEntity.ok(releaseService.getConfig());
    }

    /**
     * Saves tracked release versions for the supplied PODs.
     * Only the PODs present in the request list are updated; others are untouched.
     */
    @PostMapping("/config")
    public ResponseEntity<List<ReleaseConfigResponse>> saveConfig(
            @RequestBody List<ReleaseConfigRequest> requests) {
        releaseService.saveConfig(requests);
        return ResponseEntity.ok(releaseService.getConfig());
    }

    // ── Ad-hoc search ─────────────────────────────────────────────────

    /**
     * Ad-hoc lookup: returns release metrics for a given fix-version name,
     * broken down one entry per enabled POD that has issues tagged with that version.
     *
     * Usage: GET /api/jira/releases/search?version=v2.5.0
     */
    @GetMapping("/search")
    public ResponseEntity<List<ReleaseMetrics>> searchRelease(@RequestParam String version) {
        return ResponseEntity.ok(releaseService.searchRelease(version));
    }

    // ── Debug ─────────────────────────────────────────────────────────

    /**
     * Diagnostic endpoint — clears the release-issues cache, then runs both the
     * scoped (project-restricted) and unscoped JQL variants for every tracked release
     * on a POD, returning counts and sample issues.
     *
     * Usage: GET /api/jira/releases/debug/{podId}
     */
    @GetMapping("/debug/{podId}")
    public ResponseEntity<Map<String, Object>> debugRelease(@PathVariable Long podId) {
        return ResponseEntity.ok(releaseService.debugRelease(podId));
    }

    // ── Fix-version picker ────────────────────────────────────────────

    /**
     * Returns all fix versions across every enabled POD's project boards,
     * de-duplicated and annotated with which PODs carry each version.
     * Used to populate the global version search multi-select on the Release Notes page.
     */
    @GetMapping("/fixversions")
    public ResponseEntity<List<Map<String, Object>>> getAllFixVersions() {
        return ResponseEntity.ok(releaseService.getAllFixVersions());
    }

    /**
     * Returns all fix versions available in Jira for the given POD's project boards.
     * Used to populate the release-version picker in Release Settings.
     */
    @GetMapping("/fixversions/{podId}")
    public ResponseEntity<List<Map<String, Object>>> getFixVersions(@PathVariable Long podId) {
        return ResponseEntity.ok(releaseService.getFixVersionsForPod(podId));
    }
}
