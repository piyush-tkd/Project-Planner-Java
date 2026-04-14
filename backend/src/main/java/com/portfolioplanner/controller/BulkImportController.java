package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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

    private final ProjectRepository  projectRepo;
    private final ResourceRepository resourceRepo;

    // ── Project bulk import ───────────────────────────────────────────────────

    @Data
    public static class ProjectRow {
        private String name;
        private String status;
        private String priority;
        private String owner;
        private String startDate;
        private String targetDate;
        private String importStatus;  // set by server: "OK" | "ERROR"
        private String errorMessage;
    }

    @PostMapping("/projects")
    public List<ProjectRow> importProjects(@RequestBody List<ProjectRow> rows) {
        for (ProjectRow row : rows) {
            try {
                if (row.getName() == null || row.getName().isBlank()) {
                    row.setImportStatus("ERROR");
                    row.setErrorMessage("Name is required");
                    continue;
                }
                Project p = new Project();
                p.setName(row.getName().trim());
                p.setStatus(normaliseStatus(row.getStatus()));
                p.setPriority(normalisePriority(row.getPriority()));
                p.setOwner(row.getOwner());
                if (row.getStartDate() != null && !row.getStartDate().isBlank()) {
                    p.setStartDate(LocalDate.parse(row.getStartDate().trim()));
                }
                if (row.getTargetDate() != null && !row.getTargetDate().isBlank()) {
                    p.setTargetDate(LocalDate.parse(row.getTargetDate().trim()));
                }
                projectRepo.save(p);
                row.setImportStatus("OK");
            } catch (Exception e) {
                row.setImportStatus("ERROR");
                row.setErrorMessage(e.getMessage());
            }
        }
        return rows;
    }

    // ── Resource bulk import ──────────────────────────────────────────────────

    @Data
    public static class ResourceRow {
        private String name;
        private String email;
        private String role;
        private String location;
        private String fte;          // informational only — no fte column on Resource entity
        private String importStatus;
        private String errorMessage;
    }

    @PostMapping("/resources")
    public List<ResourceRow> importResources(@RequestBody List<ResourceRow> rows) {
        for (ResourceRow row : rows) {
            try {
                if (row.getName() == null || row.getName().isBlank()) {
                    row.setImportStatus("ERROR");
                    row.setErrorMessage("Name is required");
                    continue;
                }
                Resource r = new Resource();
                r.setName(row.getName().trim());
                r.setEmail(row.getEmail());
                r.setRole(normaliseRole(row.getRole()));
                r.setLocation(normaliseLocation(row.getLocation()));
                // fte is accepted in the CSV but the Resource entity has no fte column;
                // we silently ignore it rather than error the row.
                resourceRepo.save(r);
                row.setImportStatus("OK");
            } catch (Exception e) {
                row.setImportStatus("ERROR");
                row.setErrorMessage(e.getMessage());
            }
        }
        return rows;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String normaliseStatus(String raw) {
        if (raw == null) return "NOT_STARTED";
        return switch (raw.trim().toUpperCase().replace(" ", "_").replace("-", "_")) {
            case "ACTIVE", "IN_PROGRESS", "IN_FLIGHT" -> "ACTIVE";
            case "NOT_STARTED", "NEW"                 -> "NOT_STARTED";
            case "ON_HOLD", "PAUSED"                  -> "ON_HOLD";
            case "COMPLETED", "DONE"                  -> "COMPLETED";
            case "CANCELLED", "CANCELED"              -> "CANCELLED";
            default                                   -> "NOT_STARTED";
        };
    }

    private Priority normalisePriority(String raw) {
        if (raw == null) return Priority.MEDIUM;
        return switch (raw.trim().toUpperCase()) {
            case "P0", "CRITICAL", "HIGHEST" -> Priority.HIGHEST;
            case "P1", "HIGH"                -> Priority.HIGH;
            case "P3", "LOW"                 -> Priority.LOW;
            case "LOWEST"                    -> Priority.LOWEST;
            case "BLOCKER"                   -> Priority.BLOCKER;
            case "MINOR"                     -> Priority.MINOR;
            default                          -> Priority.MEDIUM;
        };
    }

    private Role normaliseRole(String raw) {
        if (raw == null) return Role.DEVELOPER;
        return switch (raw.trim().toUpperCase().replace(" ", "_").replace("-", "_")) {
            case "QA", "TESTER", "QA_ENGINEER"       -> Role.QA;
            case "BSA", "ANALYST", "BUSINESS_ANALYST" -> Role.BSA;
            case "TECH_LEAD", "LEAD", "TL"            -> Role.TECH_LEAD;
            default                                   -> Role.DEVELOPER;
        };
    }

    private Location normaliseLocation(String raw) {
        if (raw == null) return Location.US;
        return switch (raw.trim().toUpperCase()) {
            case "INDIA", "IN", "IND" -> Location.INDIA;
            default                   -> Location.US;
        };
    }
}
