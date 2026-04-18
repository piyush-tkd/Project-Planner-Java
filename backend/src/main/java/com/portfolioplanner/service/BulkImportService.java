package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.dto.request.ProjectRequest;
import com.portfolioplanner.dto.request.ResourceRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BulkImportService {

    private final ProjectService  projectService;
    private final ResourceService resourceService;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public record ProjectRow(
            // Input columns
            String  name,
            String  priority,     // CRITICAL | HIGH | MEDIUM | LOW
            String  owner,
            String  status,
            String  startDate,    // ISO yyyy-MM-dd
            String  targetDate,   // ISO yyyy-MM-dd
            String  notes,
            String  client,
            String  estimatedBudget,
            // Import status (output)
            String  importStatus,    // SUCCESS | SKIPPED | ERROR
            String  errorMessage
    ) {
        public ProjectRow withStatus(String s, String msg) {
            return new ProjectRow(name, priority, owner, status, startDate, targetDate,
                    notes, client, estimatedBudget, s, msg);
        }
    }

    public record ResourceRow(
            String  name,
            String  email,
            String  role,       // enum name
            String  location,   // enum name
            Boolean active,
            String  jiraDisplayName,
            // Import status (output)
            String  importStatus,
            String  errorMessage
    ) {
        public ResourceRow withStatus(String s, String msg) {
            return new ResourceRow(name, email, role, location, active, jiraDisplayName, s, msg);
        }
    }

    // ── Project import ────────────────────────────────────────────────────────

    @Transactional
    public List<ProjectRow> importProjects(List<ProjectRow> rows) {
        return rows.stream().map(row -> {
            try {
                if (row.name() == null || row.name().isBlank())
                    return row.withStatus("SKIPPED", "name is required");

                Priority pri = parsePriority(row.priority());
                LocalDate start  = parseDate(row.startDate());
                LocalDate target = parseDate(row.targetDate());
                BigDecimal budget = parseBigDecimal(row.estimatedBudget());

                ProjectRequest req = new ProjectRequest(
                        row.name().trim(), pri, row.owner(),
                        null, null, null, null,
                        row.notes(), row.status(),
                        null, target, start, null,
                        row.client(), budget, null, null, null);

                projectService.create(req);
                return row.withStatus("SUCCESS", null);
            } catch (Exception e) {
                return row.withStatus("ERROR", e.getMessage());
            }
        }).toList();
    }

    // ── Resource import ───────────────────────────────────────────────────────

    @Transactional
    public List<ResourceRow> importResources(List<ResourceRow> rows) {
        return rows.stream().map(row -> {
            try {
                if (row.name() == null || row.name().isBlank())
                    return row.withStatus("SKIPPED", "name is required");

                Role     role     = Role.valueOf(row.role().toUpperCase());
                Location location = Location.valueOf(row.location().toUpperCase());

                ResourceRequest req = new ResourceRequest(
                        row.name().trim(), row.email(), role, location,
                        row.active() != null ? row.active() : true,
                        true, row.jiraDisplayName(), null);

                resourceService.create(req);
                return row.withStatus("SUCCESS", null);
            } catch (IllegalArgumentException e) {
                return row.withStatus("ERROR", "Invalid role or location: " + e.getMessage());
            } catch (Exception e) {
                return row.withStatus("ERROR", e.getMessage());
            }
        }).toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Priority parsePriority(String s) {
        if (s == null) return Priority.MEDIUM;
        try { return Priority.valueOf(s.toUpperCase()); } catch (Exception e) { return Priority.MEDIUM; }
    }

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try { return LocalDate.parse(s); } catch (Exception e) { return null; }
    }

    private BigDecimal parseBigDecimal(String s) {
        if (s == null || s.isBlank()) return null;
        try { return new BigDecimal(s.replaceAll("[^\\d.]", "")); } catch (Exception e) { return null; }
    }
}
