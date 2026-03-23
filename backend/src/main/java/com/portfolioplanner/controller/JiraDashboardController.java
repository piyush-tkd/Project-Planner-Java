package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.JiraDashboard;
import com.portfolioplanner.domain.repository.JiraDashboardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * CRUD for custom Jira analytics dashboards.
 * Each dashboard stores its widget layout as a JSON blob.
 */
@RestController
@RequestMapping("/api/jira/dashboards")
@RequiredArgsConstructor
@Slf4j
public class JiraDashboardController {

    private final JiraDashboardRepository repo;

    /** List all dashboards visible to the current user (own + system defaults). */
    @GetMapping
    public List<JiraDashboard> list(@AuthenticationPrincipal UserDetails principal) {
        String username = principal != null ? principal.getUsername() : "anonymous";
        return repo.findByUsernameOrIsDefaultTrueOrderByUpdatedAtDesc(username);
    }

    /** Get a single dashboard by ID. */
    @GetMapping("/{id}")
    public ResponseEntity<JiraDashboard> get(@PathVariable Long id) {
        return repo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Create a new dashboard. */
    @PostMapping
    public JiraDashboard create(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails principal) {
        String username = principal != null ? principal.getUsername() : "anonymous";
        JiraDashboard dash = JiraDashboard.builder()
                .name(body.getOrDefault("name", "Untitled Dashboard"))
                .description(body.get("description"))
                .username(username)
                .isDefault(false)
                .widgetsJson(body.getOrDefault("widgetsJson", "[]"))
                .filtersJson(body.getOrDefault("filtersJson", "{}"))
                .build();
        return repo.save(dash);
    }

    /** Update dashboard widgets and/or metadata. */
    @PutMapping("/{id}")
    public ResponseEntity<JiraDashboard> update(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return repo.findById(id).map(dash -> {
            if (body.containsKey("name")) dash.setName(body.get("name"));
            if (body.containsKey("description")) dash.setDescription(body.get("description"));
            if (body.containsKey("widgetsJson")) dash.setWidgetsJson(body.get("widgetsJson"));
            if (body.containsKey("filtersJson")) dash.setFiltersJson(body.get("filtersJson"));
            return ResponseEntity.ok(repo.save(dash));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Delete a dashboard (cannot delete system defaults). */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return repo.findById(id).map(dash -> {
            if (dash.isDefault()) {
                return ResponseEntity.badRequest().<Void>build();
            }
            repo.delete(dash);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Clone a dashboard as a new custom one for the current user. */
    @PostMapping("/{id}/clone")
    public ResponseEntity<JiraDashboard> clone(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails principal) {
        String username = principal != null ? principal.getUsername() : "anonymous";
        return repo.findById(id).map(source -> {
            JiraDashboard copy = JiraDashboard.builder()
                    .name(source.getName() + " (Copy)")
                    .description(source.getDescription())
                    .username(username)
                    .isDefault(false)
                    .widgetsJson(source.getWidgetsJson())
                    .filtersJson(source.getFiltersJson())
                    .build();
            return ResponseEntity.ok(repo.save(copy));
        }).orElse(ResponseEntity.notFound().build());
    }
}
