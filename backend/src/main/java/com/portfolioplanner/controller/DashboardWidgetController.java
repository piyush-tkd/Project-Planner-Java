package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.DashboardWidget;
import com.portfolioplanner.domain.repository.DashboardWidgetRepository;
import com.portfolioplanner.dto.DashboardWidgetDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;
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

    private final DashboardWidgetRepository repo;

    // ── GET current user's widgets ────────────────────────────────────────────

    @GetMapping
    public List<DashboardWidgetDto> list(Authentication auth) {
        String username = resolveUser(auth);
        return repo.findByUsernameOrderByGridRowAscGridColAsc(username)
                .stream().map(DashboardWidgetDto::from).collect(Collectors.toList());
    }

    // ── POST bulk-save (replace) ──────────────────────────────────────────────

    @PostMapping("/bulk")
    public List<DashboardWidgetDto> bulkSave(
            @RequestBody DashboardWidgetDto.BulkSaveRequest req,
            Authentication auth) {

        String username = resolveUser(auth);

        // Delete existing layout for the user
        repo.deleteByUsername(username);

        // Persist new layout
        List<DashboardWidget> saved = req.getWidgets().stream().map(r -> {
            DashboardWidget w = new DashboardWidget();
            w.setUsername(username);
            w.setWidgetType(r.getWidgetType());
            w.setTitle(r.getTitle());
            w.setGridCol(r.getGridCol());
            w.setGridRow(r.getGridRow());
            w.setColSpan(r.getColSpan());
            w.setRowSpan(r.getRowSpan());
            w.setConfig(r.getConfig());
            return repo.save(w);
        }).collect(Collectors.toList());

        return saved.stream().map(DashboardWidgetDto::from).collect(Collectors.toList());
    }

    // ── DELETE single widget ──────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, Authentication auth) {
        String username = resolveUser(auth);
        repo.findById(id).ifPresent(w -> {
            if (w.getUsername().equals(username)) repo.delete(w);
        });
    }

    private String resolveUser(Authentication auth) {
        return auth != null ? auth.getName() : "anonymous";
    }
}
