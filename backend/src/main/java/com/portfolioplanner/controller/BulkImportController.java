package com.portfolioplanner.controller;

import com.portfolioplanner.service.BulkImportService;
import com.portfolioplanner.service.BulkImportService.ProjectRow;
import com.portfolioplanner.service.BulkImportService.ResourceRow;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API for bulk import of projects and resources.
 *
 * POST /api/bulk-import/projects    → validate + persist project rows
 * POST /api/bulk-import/resources   → validate + persist resource rows
 *
 * The payload is a list of rows parsed by the frontend from CSV/Excel.
 * Validation errors are returned inline (importStatus + errorMessage per row).
 */
@RestController
@RequestMapping("/api/bulk-import")
@PreAuthorize("hasRole('ADMIN')") // S2.3
@RequiredArgsConstructor
public class BulkImportController {

    private final BulkImportService service;

    // ── Project bulk import ───────────────────────────────────────────────────

    @PostMapping("/projects")
    public List<ProjectRow> importProjects(@RequestBody List<ProjectRow> rows) {
        return service.importProjects(rows);
    }

    // ── Resource bulk import ──────────────────────────────────────────────────

    @PostMapping("/resources")
    public List<ResourceRow> importResources(@RequestBody List<ResourceRow> rows) {
        return service.importResources(rows);
    }
}
