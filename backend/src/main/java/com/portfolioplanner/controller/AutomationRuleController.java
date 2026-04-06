package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AutomationRule;
import com.portfolioplanner.domain.repository.AutomationRuleRepository;
import com.portfolioplanner.dto.AutomationRuleDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * CRUD for user-defined automation rules.
 *
 *  GET    /api/automation-rules          → list all
 *  POST   /api/automation-rules          → create
 *  PUT    /api/automation-rules/{id}     → update
 *  PATCH  /api/automation-rules/{id}/toggle → flip enabled flag
 *  DELETE /api/automation-rules/{id}     → delete
 *  POST   /api/automation-rules/{id}/fire  → manual test-fire (admin only)
 */
@RestController
@RequestMapping("/api/automation-rules")
@RequiredArgsConstructor
public class AutomationRuleController {

    private final AutomationRuleRepository repo;

    // ── List ─────────────────────────────────────────────────────────────────

    @GetMapping
    public List<AutomationRuleDto> list() {
        return repo.findAllByOrderByCreatedAtDesc()
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    // ── Create ────────────────────────────────────────────────────────────────

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AutomationRuleDto create(@RequestBody AutomationRuleDto dto,
                                    Authentication auth) {
        AutomationRule rule = new AutomationRule();
        applyDto(rule, dto);
        rule.setCreatedBy(auth != null ? auth.getName() : "system");
        rule.setCreatedAt(LocalDateTime.now());
        rule.setUpdatedAt(LocalDateTime.now());
        return toDto(repo.save(rule));
    }

    // ── Update ────────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public AutomationRuleDto update(@PathVariable Long id,
                                     @RequestBody AutomationRuleDto dto) {
        AutomationRule rule = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        applyDto(rule, dto);
        return toDto(repo.save(rule));
    }

    // ── Toggle enabled ─────────────────────────────────────────────────────────

    @PatchMapping("/{id}/toggle")
    public AutomationRuleDto toggle(@PathVariable Long id) {
        AutomationRule rule = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        rule.setEnabled(!rule.isEnabled());
        rule.setUpdatedAt(LocalDateTime.now());
        return toDto(repo.save(rule));
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        if (!repo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        repo.deleteById(id);
    }

    // ── Manual fire (test) ────────────────────────────────────────────────────

    @PostMapping("/{id}/fire")
    public ResponseEntity<Map<String, Object>> manualFire(@PathVariable Long id) {
        AutomationRule rule = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        // Record the test-fire
        rule.setLastFiredAt(LocalDateTime.now());
        rule.setFireCount(rule.getFireCount() + 1);
        repo.save(rule);

        // In production this would invoke the actual action executor.
        // For now we log and return the rule payload so the UI can confirm.
        return ResponseEntity.ok(Map.of(
                "status",      "fired",
                "ruleId",      rule.getId(),
                "actionType",  rule.getActionType(),
                "actionPayload", rule.getActionPayload() != null ? rule.getActionPayload() : Map.of(),
                "firedAt",     LocalDateTime.now().toString()
        ));
    }

    // ── Mapping helpers ───────────────────────────────────────────────────────

    private void applyDto(AutomationRule rule, AutomationRuleDto dto) {
        rule.setName(dto.getName());
        rule.setDescription(dto.getDescription());
        rule.setEnabled(dto.isEnabled());
        rule.setTriggerEvent(dto.getTriggerEvent());
        rule.setTriggerValue(dto.getTriggerValue());
        rule.setConditionField(dto.getConditionField());
        rule.setConditionOperator(dto.getConditionOperator());
        rule.setConditionValue(dto.getConditionValue());
        rule.setActionType(dto.getActionType());
        rule.setActionPayload(dto.getActionPayload());
        rule.setUpdatedAt(LocalDateTime.now());
    }

    private AutomationRuleDto toDto(AutomationRule r) {
        return new AutomationRuleDto(
                r.getId(),
                r.getName(),
                r.getDescription(),
                r.isEnabled(),
                r.getCreatedBy(),
                r.getCreatedAt(),
                r.getUpdatedAt(),
                r.getTriggerEvent(),
                r.getTriggerValue(),
                r.getConditionField(),
                r.getConditionOperator(),
                r.getConditionValue(),
                r.getActionType(),
                r.getActionPayload(),
                r.getLastFiredAt(),
                r.getFireCount()
        );
    }
}
