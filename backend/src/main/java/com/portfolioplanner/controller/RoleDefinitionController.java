package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.RoleDefinition;
import com.portfolioplanner.domain.repository.RoleDefinitionRepository;
import com.portfolioplanner.exception.ResourceNotFoundException;
import com.portfolioplanner.exception.ValidationException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * CRUD for role definitions.
 *
 * GET    /api/roles          — list all roles (system + custom), ordered: system first then alpha
 * POST   /api/roles          — create a new custom role
 * PUT    /api/roles/{name}   — update display_name, description, color (name and is_system are immutable)
 * DELETE /api/roles/{name}   — delete a non-system role; returns 409 if is_system=true
 */
@RestController
@RequestMapping("/api/roles")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class RoleDefinitionController {

    private final RoleDefinitionRepository repo;

    // ── GET /api/roles ──────────────────────────────────────────────────────────
    @GetMapping
    public List<RoleDto> list() {
        return repo.findAllByOrderBySystemDescNameAsc()
                   .stream()
                   .map(RoleDto::from)
                   .toList();
    }

    // ── POST /api/roles ─────────────────────────────────────────────────────────
    @PostMapping
    public ResponseEntity<RoleDto> create(@RequestBody CreateRoleRequest req) {
        String normalised = req.name().toUpperCase().replaceAll("[^A-Z0-9_]", "_");
        if (repo.existsByName(normalised)) {
            throw new ValidationException("Role already exists: " + normalised);
        }
        RoleDefinition r = new RoleDefinition();
        r.setName(normalised);
        r.setDisplayName(req.displayName());
        r.setDescription(req.description());
        r.setSystem(false);
        r.setColor(req.color() != null ? req.color() : "blue");
        r.setCreatedAt(LocalDateTime.now());
        return ResponseEntity.status(HttpStatus.CREATED).body(RoleDto.from(repo.save(r)));
    }

    // ── PUT /api/roles/{name} ───────────────────────────────────────────────────
    @PutMapping("/{name}")
    public RoleDto update(@PathVariable String name, @RequestBody UpdateRoleRequest req) {
        RoleDefinition r = repo.findByName(name.toUpperCase())
                               .orElseThrow(() -> new ResourceNotFoundException("Role not found: " + name));
        if (req.displayName() != null) r.setDisplayName(req.displayName());
        if (req.description()  != null) r.setDescription(req.description());
        if (req.color()        != null) r.setColor(req.color());
        return RoleDto.from(repo.save(r));
    }

    // ── DELETE /api/roles/{name} ────────────────────────────────────────────────
    @DeleteMapping("/{name}")
    public ResponseEntity<Void> delete(@PathVariable String name) {
        RoleDefinition r = repo.findByName(name.toUpperCase())
                               .orElseThrow(() -> new ResourceNotFoundException("Role not found: " + name));
        if (r.isSystem()) {
            throw new ValidationException("System roles cannot be deleted: " + name);
        }
        repo.delete(r);
        return ResponseEntity.noContent().build();
    }

    // ── DTOs ────────────────────────────────────────────────────────────────────

    public record RoleDto(
            Long     id,
            String   name,
            String   displayName,
            String   description,
            boolean  system,
            String   color,
            String   createdAt) {

        static RoleDto from(RoleDefinition r) {
            return new RoleDto(
                r.getId(),
                r.getName(),
                r.getDisplayName(),
                r.getDescription(),
                r.isSystem(),
                r.getColor(),
                r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);
        }
    }

    public record CreateRoleRequest(
            String name,
            String displayName,
            String description,
            String color) {}

    public record UpdateRoleRequest(
            String displayName,
            String description,
            String color) {}
}
