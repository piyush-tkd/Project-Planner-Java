package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraResourceMappingService;
import com.portfolioplanner.service.jira.JiraResourceMappingService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/jira/resource-mappings")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class JiraResourceMappingController {

    private final JiraResourceMappingService mappingService;

    /** Get all current mappings with issue/hours stats */
    @GetMapping
    public ResponseEntity<List<ResourceMappingResponse>> getAll() {
        return ResponseEntity.ok(mappingService.getAllMappings());
    }

    /** Get mapping statistics */
    @GetMapping("/stats")
    public ResponseEntity<MappingStats> getStats() {
        return ResponseEntity.ok(mappingService.getStats());
    }

    /** Scan Jira for all unique display names */
    @GetMapping("/scan")
    public ResponseEntity<List<JiraNameInfo>> scan() {
        return ResponseEntity.ok(mappingService.scanJiraNames());
    }

    /** Run auto-match: scan + fuzzy match + persist suggestions */
    @PostMapping("/auto-match")
    public ResponseEntity<List<ResourceMappingResponse>> autoMatch() {
        return ResponseEntity.ok(mappingService.scanAndAutoMatch());
    }

    /** Save or update a single mapping */
    @PutMapping("/{jiraDisplayName}")
    public ResponseEntity<Map<String, Object>> saveMapping(
            @PathVariable String jiraDisplayName,
            @RequestBody Map<String, Object> body) {
        Long resourceId = body.get("resourceId") != null ? ((Number) body.get("resourceId")).longValue() : null;
        String mappingType = (String) body.getOrDefault("mappingType", "MANUAL");
        var saved = mappingService.saveMapping(jiraDisplayName, resourceId, mappingType);
        return ResponseEntity.ok(Map.of("id", saved.getId(), "status", "saved"));
    }

    /** Delete a mapping */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMapping(@PathVariable Long id) {
        mappingService.deleteMapping(id);
        return ResponseEntity.noContent().build();
    }

    /** Clear mapping for a resource (unmap it) */
    @DeleteMapping("/by-resource/{resourceId}")
    public ResponseEntity<Map<String, Object>> clearResourceMapping(@PathVariable Long resourceId) {
        int cleared = mappingService.clearResourceMapping(resourceId);
        return ResponseEntity.ok(Map.of("cleared", cleared));
    }

    /** Get resources from Resource tab that have no Jira user mapped */
    @GetMapping("/unmapped-resources")
    public ResponseEntity<List<UnmappedResource>> getUnmappedResources() {
        return ResponseEntity.ok(mappingService.getUnmappedResources());
    }

    /** Bulk accept all auto-matched mappings above a confidence threshold */
    @PostMapping("/bulk-accept")
    public ResponseEntity<Map<String, Object>> bulkAccept(@RequestBody Map<String, Double> body) {
        double minConfidence = body.getOrDefault("minConfidence", 0.85);
        int accepted = mappingService.bulkAccept(minConfidence);
        return ResponseEntity.ok(Map.of("accepted", accepted));
    }

    /** Backfill Jira avatar URLs for all confirmed mappings that don't have one yet */
    @PostMapping("/sync-avatars")
    public ResponseEntity<Map<String, Object>> syncAvatars() {
        int synced = mappingService.syncAllAvatars();
        return ResponseEntity.ok(Map.of("synced", synced));
    }
}
