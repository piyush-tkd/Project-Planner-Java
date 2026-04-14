package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.DashboardConfig;
import com.portfolioplanner.domain.repository.DashboardConfigRepository;
import com.portfolioplanner.dto.DashboardConfigDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * REST API for managing named dashboard configurations.
 *
 * <p>Endpoints:
 * <ul>
 *   <li>{@code GET  /api/dashboards} — list current user's dashboards</li>
 *   <li>{@code POST /api/dashboards} — create a new dashboard</li>
 *   <li>{@code PUT  /api/dashboards/{id}} — update a dashboard (owner only)</li>
 *   <li>{@code DELETE /api/dashboards/{id}} — delete a dashboard (owner only)</li>
 *   <li>{@code GET  /api/dashboards/templates} — list all templates</li>
 *   <li>{@code POST /api/dashboards/{id}/duplicate} — clone a dashboard</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/dashboards")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class DashboardConfigController {

    private final DashboardConfigRepository repo;

    /**
     * List all dashboards owned by the current user, ordered by most recently updated.
     */
    @GetMapping
    public ResponseEntity<List<DashboardConfigDto>> listUserDashboards(Authentication auth) {
        String username = auth.getName();
        List<DashboardConfigDto> dashboards = repo.findByOwnerUsernameOrderByUpdatedAtDesc(username)
                .stream()
                .map(DashboardConfigDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dashboards);
    }

    /**
     * Create a new dashboard for the current user.
     */
    @PostMapping
    public ResponseEntity<DashboardConfigDto> createDashboard(
            @RequestBody DashboardConfigDto dto,
            Authentication auth) {
        String username = auth.getName();

        DashboardConfig config = new DashboardConfig();
        config.setName(dto.getName());
        config.setDescription(dto.getDescription());
        config.setOwnerUsername(username);
        config.setDefault(dto.isDefault());
        config.setTemplate(dto.isTemplate());
        config.setTemplateName(dto.getTemplateName());
        config.setConfig(dto.getConfig() != null ? dto.getConfig() : "{}");
        config.setThumbnailUrl(dto.getThumbnailUrl());

        DashboardConfig saved = repo.save(config);
        return ResponseEntity.status(HttpStatus.CREATED).body(DashboardConfigDto.from(saved));
    }

    /**
     * Update an existing dashboard (owner only).
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateDashboard(
            @PathVariable Long id,
            @RequestBody DashboardConfigDto dto,
            Authentication auth) {
        String username = auth.getName();

        return repo.findById(id)
                .map(config -> {
                    // Verify owner
                    if (!config.getOwnerUsername().equals(username)) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body("Only the owner can update this dashboard");
                    }

                    config.setName(dto.getName());
                    config.setDescription(dto.getDescription());
                    config.setDefault(dto.isDefault());
                    config.setTemplate(dto.isTemplate());
                    config.setTemplateName(dto.getTemplateName());
                    config.setConfig(dto.getConfig() != null ? dto.getConfig() : "{}");
                    config.setThumbnailUrl(dto.getThumbnailUrl());

                    DashboardConfig updated = repo.save(config);
                    return ResponseEntity.ok(DashboardConfigDto.from(updated));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Delete a dashboard (owner only).
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDashboard(
            @PathVariable Long id,
            Authentication auth) {
        String username = auth.getName();

        return repo.findById(id)
                .map(config -> {
                    // Verify owner
                    if (!config.getOwnerUsername().equals(username)) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body("Only the owner can delete this dashboard");
                    }

                    repo.deleteById(id);
                    return ResponseEntity.ok().build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * List all public templates (is_template=true).
     */
    @GetMapping("/templates")
    public ResponseEntity<List<DashboardConfigDto>> listTemplates() {
        List<DashboardConfigDto> templates = repo.findByIsTemplateTrue()
                .stream()
                .map(DashboardConfigDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(templates);
    }

    /**
     * Clone a dashboard, appending "(Copy)" to the name.
     */
    @PostMapping("/{id}/duplicate")
    public ResponseEntity<?> duplicateDashboard(
            @PathVariable Long id,
            Authentication auth) {
        String username = auth.getName();

        return repo.findById(id)
                .map(original -> {
                    DashboardConfig copy = new DashboardConfig();
                    copy.setName(original.getName() + " (Copy)");
                    copy.setDescription(original.getDescription());
                    copy.setOwnerUsername(username);
                    copy.setDefault(false);
                    copy.setTemplate(false);
                    copy.setTemplateName(original.getTemplateName());
                    copy.setConfig(original.getConfig());
                    copy.setThumbnailUrl(original.getThumbnailUrl());

                    DashboardConfig saved = repo.save(copy);
                    return ResponseEntity.status(HttpStatus.CREATED)
                            .body(DashboardConfigDto.from(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
