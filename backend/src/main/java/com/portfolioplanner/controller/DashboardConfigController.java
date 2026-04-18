package com.portfolioplanner.controller;

import com.portfolioplanner.dto.DashboardConfigDto;
import com.portfolioplanner.service.DashboardConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
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

    private final DashboardConfigService service;

    /**
     * List all dashboards owned by the current user, ordered by most recently updated.
     */
    @GetMapping
    public ResponseEntity<List<DashboardConfigDto>> listUserDashboards(Authentication auth) {
        String username = auth.getName();
        List<DashboardConfigDto> dashboards = service.listUserDashboards(username);
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
        DashboardConfigDto saved = service.createDashboard(dto, username);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * Update an existing dashboard (owner only).
     */
    // TODO Phase 6: add ownership check — only dashboard owner or ADMIN may update
    @PutMapping("/{id}")
    public ResponseEntity<?> updateDashboard(
            @PathVariable Long id,
            @RequestBody DashboardConfigDto dto,
            Authentication auth) {
        String username = auth.getName();
        try {
            DashboardConfigDto updated = service.updateDashboard(id, dto, username);
            return ResponseEntity.ok(updated);
        } catch (ResponseStatusException e) {
            if (e.getStatusCode() == HttpStatus.FORBIDDEN) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getReason());
            }
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Delete a dashboard (owner only).
     */
    // TODO Phase 6: add ownership check — only dashboard owner or ADMIN may delete
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDashboard(
            @PathVariable Long id,
            Authentication auth) {
        String username = auth.getName();
        try {
            service.deleteDashboard(id, username);
            return ResponseEntity.ok().build();
        } catch (ResponseStatusException e) {
            if (e.getStatusCode() == HttpStatus.FORBIDDEN) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getReason());
            }
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * List all public templates (is_template=true).
     */
    @GetMapping("/templates")
    public ResponseEntity<List<DashboardConfigDto>> listTemplates() {
        List<DashboardConfigDto> templates = service.listTemplates();
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
        try {
            DashboardConfigDto copy = service.duplicateDashboard(id, username);
            return ResponseEntity.status(HttpStatus.CREATED).body(copy);
        } catch (ResponseStatusException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
