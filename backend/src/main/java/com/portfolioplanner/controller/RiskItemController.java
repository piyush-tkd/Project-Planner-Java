package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.RiskItem;
import com.portfolioplanner.service.RiskItemService;
import com.portfolioplanner.service.RiskItemService.RiskRequest;
import com.portfolioplanner.service.RiskItemService.SummaryResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/risks")
@RequiredArgsConstructor
public class RiskItemController {

    private final RiskItemService riskItemService;

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

    public record RiskApiRequest(
        @NotBlank String title,
        String description,
        String itemType,
        String severity,
        String probability,
        String status,
        String owner,
        Long   projectId,
        String mitigationPlan,
        String dueDate
    ) {}

    public record RiskSummary(
        long totalRisks,
        long totalIssues,
        long totalDecisions,
        long openItems,
        long criticalItems
    ) {}

    // ── Mapping ───────────────────────────────────────────────────────────────

    private RiskResponse toDto(RiskItem r) {
        return new RiskResponse(
            r.getId(), r.getTitle(), r.getDescription(), r.getItemType(),
            r.getSeverity(), r.getProbability(), r.getStatus(), r.getOwner(),
            r.getProjectId(), r.getMitigationPlan(),
            r.getDueDate()   != null ? r.getDueDate().toString()   : null,
            r.getCreatedAt() != null ? r.getCreatedAt().toString() : null
        );
    }

    private RiskRequest toServiceRequest(RiskApiRequest req) {
        return new RiskRequest(req.title(), req.description(), req.itemType(),
            req.severity(), req.probability(), req.status(), req.owner(),
            req.projectId(), req.mitigationPlan(), req.dueDate());
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    @GetMapping
    public Page<RiskResponse> getAll(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long   projectId,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size) {
        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return riskItemService.list(type, status, projectId, pageable).map(this::toDto);
    }

    @GetMapping("/all")
    public List<RiskResponse> getAllUnpaginated(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long   projectId) {
        return riskItemService.listAll(type, status, projectId).stream().map(this::toDto).toList();
    }

    @GetMapping("/summary")
    public RiskSummary getSummary() {
        SummaryResult s = riskItemService.getSummary();
        return new RiskSummary(s.totalRisks(), s.totalIssues(), s.totalDecisions(),
            s.openItems(), s.criticalItems());
    }

    @GetMapping("/{id}")
    public RiskResponse getById(@PathVariable Long id) {
        return toDto(riskItemService.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<RiskResponse> create(@Valid @RequestBody RiskApiRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(toDto(riskItemService.create(toServiceRequest(req))));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public RiskResponse update(@PathVariable Long id, @Valid @RequestBody RiskApiRequest req) {
        return toDto(riskItemService.update(id, toServiceRequest(req)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        riskItemService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
