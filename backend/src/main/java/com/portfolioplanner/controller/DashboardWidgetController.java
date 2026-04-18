package com.portfolioplanner.controller;

import com.portfolioplanner.dto.DashboardWidgetDto;
import com.portfolioplanner.service.DashboardWidgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * REST API for per-user custom dashboard layouts.
 *
 * GET  /api/dashboard-widgets          → load current user's widgets
 * POST /api/dashboard-widgets/bulk     → replace all widgets for current user
 */
@RestController
@RequestMapping("/api/dashboard-widgets")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class DashboardWidgetController {

    private final DashboardWidgetService service;

    // ── GET current user's widgets ────────────────────────────────────────────

    @GetMapping
    public List<DashboardWidgetDto> list(Authentication auth) {
        String username = resolveUser(auth);
        return service.listUserWidgets(username);
    }

    // ── POST bulk-save (replace) ──────────────────────────────────────────────

    @PostMapping("/bulk")
    public List<DashboardWidgetDto> bulkSave(
            @RequestBody DashboardWidgetDto.BulkSaveRequest req,
            Authentication auth) {
        String username = resolveUser(auth);
        return service.bulkSave(username, req.getWidgets());
    }

    // ── DELETE single widget ──────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, Authentication auth) {
        String username = resolveUser(auth);
        service.deleteWidget(id, username);
    }

    private String resolveUser(Authentication auth) {
        return auth != null ? auth.getName() : "anonymous";
    }
}
