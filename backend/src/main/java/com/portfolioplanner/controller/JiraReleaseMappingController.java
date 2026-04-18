package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraReleaseMappingService;
import com.portfolioplanner.service.jira.JiraReleaseMappingService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/jira/release-mappings")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class JiraReleaseMappingController {

    private final JiraReleaseMappingService mappingService;

    /** Get all release calendar entries with their linked Jira fix versions */
    @GetMapping
    public ResponseEntity<List<ReleaseMappingResponse>> getAll() {
        return ResponseEntity.ok(mappingService.getAllMappings());
    }

    /** Scan all fix versions from synced Jira data */
    @GetMapping("/fix-versions")
    public ResponseEntity<List<JiraFixVersionInfo>> scanFixVersions() {
        return ResponseEntity.ok(mappingService.scanFixVersions());
    }

    /** Run auto-match: finds name/date matches between releases and fix versions */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/auto-match")
    public ResponseEntity<List<ReleaseMappingResponse>> autoMatch() {
        return ResponseEntity.ok(mappingService.autoMatch());
    }

    /** Link a single Jira fix version to a release calendar entry */
    @PostMapping
    public ResponseEntity<Map<String, String>> saveMapping(@RequestBody ReleaseMappingSaveRequest request) {
        mappingService.saveMapping(request);
        return ResponseEntity.ok(Map.of("status", "saved"));
    }

    /** Bulk-save: replace all links for a single release calendar entry */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{releaseCalendarId}")
    public ResponseEntity<Map<String, String>> saveBulk(
            @PathVariable Long releaseCalendarId,
            @RequestBody List<ReleaseMappingSaveRequest> requests) {
        mappingService.saveBulk(releaseCalendarId, requests);
        return ResponseEntity.ok(Map.of("status", "saved"));
    }

    /** Delete a single mapping link */
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMapping(@PathVariable Long id) {
        mappingService.deleteMapping(id);
        return ResponseEntity.noContent().build();
    }
}
