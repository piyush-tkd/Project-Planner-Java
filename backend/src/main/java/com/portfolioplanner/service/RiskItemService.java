package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.RiskItem;
import com.portfolioplanner.domain.repository.RiskItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RiskItemService {

    private final RiskItemRepository repo;

    // ── Queries ───────────────────────────────────────────────────────────────

    public Page<RiskItem> list(String type, String status, Long projectId, Pageable pageable) {
        if (projectId != null) return repo.findByProjectId(projectId, pageable);
        if (type != null && !type.isBlank()) return repo.findByItemType(type.toUpperCase(), pageable);
        if (status != null && !status.isBlank()) return repo.findByStatus(status.toUpperCase(), pageable);
        return repo.findAll(pageable);
    }

    public List<RiskItem> listAll(String type, String status, Long projectId) {
        if (projectId != null) return repo.findByProjectIdOrderByCreatedAtDesc(projectId);
        if (type != null && !type.isBlank()) return repo.findByItemTypeOrderByCreatedAtDesc(type.toUpperCase());
        if (status != null && !status.isBlank()) return repo.findByStatusOrderByCreatedAtDesc(status.toUpperCase());
        return repo.findAllByOrderByCreatedAtDesc();
    }

    public SummaryResult getSummary() {
        List<RiskItem> all = repo.findAll();
        Map<String, Long> byType = all.stream()
            .collect(Collectors.groupingBy(RiskItem::getItemType, Collectors.counting()));
        long open = all.stream().filter(r -> "OPEN".equals(r.getStatus())).count();
        long critical = all.stream().filter(r -> "CRITICAL".equals(r.getSeverity())).count();
        return new SummaryResult(
            byType.getOrDefault("RISK",     0L),
            byType.getOrDefault("ISSUE",    0L),
            byType.getOrDefault("DECISION", 0L),
            open, critical);
    }

    public RiskItem findById(Long id) {
        return repo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Risk item not found"));
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    @Transactional
    public RiskItem create(RiskRequest req) {
        RiskItem entity = new RiskItem();
        entity.setItemType("RISK");
        entity.setSeverity("MEDIUM");
        entity.setStatus("OPEN");
        applyRequest(entity, req);
        return repo.save(entity);
    }

    @Transactional
    public RiskItem update(Long id, RiskRequest req) {
        RiskItem entity = findById(id);
        applyRequest(entity, req);
        return repo.save(entity);
    }

    @Transactional
    public void delete(Long id) {
        if (!repo.existsById(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Risk item not found");
        repo.deleteById(id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void applyRequest(RiskItem entity, RiskRequest req) {
        entity.setTitle(req.title());
        if (req.description()    != null) entity.setDescription(req.description());
        if (req.itemType()       != null) entity.setItemType(req.itemType().toUpperCase());
        if (req.severity()       != null) entity.setSeverity(req.severity().toUpperCase());
        if (req.probability()    != null) entity.setProbability(req.probability().toUpperCase());
        if (req.status()         != null) entity.setStatus(req.status().toUpperCase());
        if (req.owner()          != null) entity.setOwner(req.owner());
        if (req.projectId()      != null) entity.setProjectId(req.projectId());
        if (req.mitigationPlan() != null) entity.setMitigationPlan(req.mitigationPlan());
        if (req.dueDate()        != null && !req.dueDate().isBlank())
            entity.setDueDate(LocalDate.parse(req.dueDate()));
    }

    // ── Value types shared with controller ────────────────────────────────────

    public record RiskRequest(
        String title,
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

    public record SummaryResult(
        long totalRisks,
        long totalIssues,
        long totalDecisions,
        long openItems,
        long criticalItems
    ) {}
}
