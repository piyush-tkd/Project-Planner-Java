package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraBufferService;
import com.portfolioplanner.service.jira.JiraBufferService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/jira/buffer")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class JiraBufferController {

    private final JiraBufferService bufferService;

    /** All Jira display names (for the resource-form dropdown) */
    @GetMapping("/jira-users")
    public ResponseEntity<List<JiraUserInfo>> getJiraUsers() {
        return ResponseEntity.ok(bufferService.scanJiraUsers());
    }

    /** Buffer users: logged hours in configured PODs but not mapped to a resource */
    @GetMapping
    public ResponseEntity<List<BufferEntry>> getBufferUsers() {
        return ResponseEntity.ok(bufferService.getBufferUsers());
    }

    /** Stats for the buffer page header */
    @GetMapping("/stats")
    public ResponseEntity<BufferStats> getStats() {
        return ResponseEntity.ok(bufferService.getBufferStats());
    }

    /** Auto-match suggestions for unmapped resources */
    @GetMapping("/auto-match-suggestions")
    public ResponseEntity<List<AutoMatchSuggestion>> getAutoMatchSuggestions() {
        return ResponseEntity.ok(bufferService.autoMatchSuggestions());
    }

    /** Apply auto-match: set jiraDisplayName on resources above confidence threshold */
    @PostMapping("/auto-match")
    public ResponseEntity<Map<String, Object>> applyAutoMatch(@RequestBody(required = false) Map<String, Double> body) {
        double minConfidence = (body != null && body.containsKey("minConfidence"))
            ? body.get("minConfidence") : 0.85;
        int count = bufferService.applyAutoMatch(minConfidence);
        return ResponseEntity.ok(Map.of("matched", count));
    }
}
