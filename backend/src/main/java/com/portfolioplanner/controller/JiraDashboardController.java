package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.JiraDashboard;
import com.portfolioplanner.service.JiraDashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * CRUD for custom Jira analytics dashboards.
 * Each dashboard stores its widget layout as a JSON blob.
 */
@RestController
@RequestMapping("/api/jira/dashboards")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class JiraDashboardController {

    private final JiraDashboardService service;

    /** List all dashboards visible to the current user (own + system defaults). */
    @GetMapping
    public List<JiraDashboard> list(@AuthenticationPrincipal UserDetails principal) {
        String username = principal != null ? principal.getUsername() : "anonymous";
        return service.listForUser(username);
    }

    /** Get a single dashboard by ID. */
    @GetMapping("/{id}")
    public ResponseEntity<JiraDashboard> get(@PathVariable Long id) {
        return service.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Create a new dashboard. */
    @PostMapping
    public JiraDashboard create(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails principal) {
        String username = principal != null ? principal.getUsername() : "anonymous";
        return service.create(username, body);
    }

    /** Update dashboard widgets and/or metadata. */
    @PutMapping("/{id}")
    public ResponseEntity<JiraDashboard> update(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return service.update(id, body)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Delete a dashboard (cannot delete system defaults). */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        var result = service.delete(id);
        if (result.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok().build();
    }

    /** Clone a dashboard as a new custom one for the current user. */
    @PostMapping("/{id}/clone")
    public ResponseEntity<JiraDashboard> clone(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails principal) {
        String username = principal != null ? principal.getUsername() : "anonymous";
        return service.clone(id, username)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
