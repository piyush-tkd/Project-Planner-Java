package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.RiskItem;
import com.portfolioplanner.domain.repository.RiskItemRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/risks")
@RequiredArgsConstructor
public class RiskItemController {

    private final RiskItemRepository repo;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public record RiskResponse(
        Long   id,
        String title,
        String description,
        String itemType,
        String severity,
        String probability,
        String status,
        String owner,
        Long   projectId,
        String mitigationPlan,
        String dueDate,
        String createdAt
    ) {}

    public record RiskRequest(
        @NotBlank String title,
        String description,
        String itemType,
        String severity,
        String probability,
        String status,
        String owner,
        Long   projectId,
        String mitigationPlan,
        String dueDate   // ISO yyyy-MM-dd or null
    ) {}

    public record RiskSummary(
        long totalRisks,
        long totalIssues,
        long totalDecisions,
        long openItems,
        long criticalItems
    ) {}

    // ── Mappings ─────────────────────────────────────────────────────────────

    private RiskResponse toDto(RiskItem r) {
        return new RiskResponse(
            r.getId(),
            r.getTitle(),
            r.getDescription(),
            r.getItemType(),
            r.getSeverity(),
            r.getProbability(),
            r.getStatus(),
            r.getOwner(),
            r.getProjectId(),
            r.getMitigationPlan(),
            r.getDueDate() != null ? r.getDueDate().toString() : null,
            r.getCreatedAt() != null ? r.getCreatedAt().toString() : null
        );
    }

    private void applyRequest(RiskItem entity, RiskRequest req) {
        entity.setTitle(req.title());
        if (req.description()     != null) entity.setDescription(req.description());
        if (req.itemType()        != null) entity.setItemType(req.itemType().toUpperCase());
        if (req.severity()        != null) entity.setSeverity(req.severity().toUpperCase());
        if (req.probability()     != null) entity.setProbability(req.probability().toUpperCase());
        if (req.status()          != null) entity.setStatus(req.status().toUpperCase());
        if (req.owner()           != null) entity.setOwner(req.owner());
        if (req.projectId()       != null) entity.setProjectId(req.projectId());
        if (req.mitigationPlan()  != null) entity.setMitigationPlan(req.mitigationPlan());
        if (req.dueDate()         != null && !req.dueDate().isBlank())
            entity.setDueDate(LocalDate.parse(req.dueDate()));
    }

    // ── Endpoints ────────────────────────────────────────────────────────────

    @GetMapping
    public List<RiskResponse> getAll(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long   projectId) {
        if (projectId != null)
            return repo.findByProjectIdOrderByCreatedAtDesc(projectId).stream().map(this::toDto).toList();
        if (type != null && !type.isBlank())
            return repo.findByItemTypeOrderByCreatedAtDesc(type.toUpperCase()).stream().map(this::toDto).toList();
        if (status != null && !status.isBlank())
            return repo.findByStatusOrderByCreatedAtDesc(status.toUpperCase()).stream().map(this::toDto).toList();
        return repo.findAllByOrderByCreatedAtDesc().stream().map(this::toDto).toList();
    }

    @GetMapping("/summary")
    public RiskSummary getSummary() {
        List<RiskItem> all = repo.findAll();
        Map<String, Long> byType = all.stream()
            .collect(Collectors.groupingBy(RiskItem::getItemType, Collectors.counting()));
        long open = all.stream().filter(r -> "OPEN".equals(r.getStatus())).count();
        long critical = all.stream().filter(r -> "CRITICAL".equals(r.getSeverity())).count();
        return new RiskSummary(
            byType.getOrDefault("RISK",     0L),
            byType.getOrDefault("ISSUE",    0L),
            byType.getOrDefault("DECISION", 0L),
            open,
            critical
        );
    }

    @GetMapping("/{id}")
    public RiskResponse getById(@PathVariable Long id) {
        return repo.findById(id).map(this::toDto)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Risk item not found"));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<RiskResponse> create(@Valid @RequestBody RiskRequest req) {
        RiskItem entity = new RiskItem();
        entity.setItemType("RISK");
        entity.setSeverity("MEDIUM");
        entity.setStatus("OPEN");
        applyRequest(entity, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(repo.save(entity)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public RiskResponse update(@PathVariable Long id, @Valid @RequestBody RiskRequest req) {
        RiskItem entity = repo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Risk item not found"));
        applyRequest(entity, req);
        return toDto(repo.save(entity));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Risk item not found");
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
