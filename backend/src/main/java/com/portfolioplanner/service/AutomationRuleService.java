package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.AutomationRule;
import com.portfolioplanner.domain.repository.AutomationRuleRepository;
import com.portfolioplanner.dto.AutomationRuleDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AutomationRuleService {

    private final AutomationRuleRepository repo;

    public List<AutomationRuleDto> listAll() {
        return repo.findAllByOrderByCreatedAtDesc().stream().map(this::toDto).toList();
    }

    @Transactional
    public AutomationRuleDto create(AutomationRuleDto dto, Authentication auth) {
        AutomationRule rule = new AutomationRule();
        applyDto(rule, dto);
        rule.setCreatedBy(auth != null ? auth.getName() : "system");
        rule.setCreatedAt(LocalDateTime.now());
        rule.setUpdatedAt(LocalDateTime.now());
        return toDto(repo.save(rule));
    }

    @Transactional
    public AutomationRuleDto update(Long id, AutomationRuleDto dto) {
        AutomationRule rule = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rule not found"));
        applyDto(rule, dto);
        return toDto(repo.save(rule));
    }

    @Transactional
    public AutomationRuleDto toggle(Long id) {
        AutomationRule rule = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rule not found"));
        rule.setEnabled(!rule.isEnabled());
        return toDto(repo.save(rule));
    }

    @Transactional
    public void delete(Long id) {
        if (!repo.existsById(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Rule not found");
        repo.deleteById(id);
    }

    @Transactional
    public Map<String, Object> manualFire(Long id) {
        AutomationRule rule = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rule not found"));
        rule.setLastFiredAt(LocalDateTime.now());
        rule.setFireCount(rule.getFireCount() + 1);
        repo.save(rule);
        return Map.of("fired", true, "ruleId", id, "firedAt", rule.getLastFiredAt().toString());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void applyDto(AutomationRule rule, AutomationRuleDto dto) {
        if (dto.getName()             != null) rule.setName(dto.getName());
        if (dto.getDescription()      != null) rule.setDescription(dto.getDescription());
        rule.setEnabled(dto.isEnabled());
        if (dto.getTriggerEvent()     != null) rule.setTriggerEvent(dto.getTriggerEvent());
        if (dto.getTriggerValue()     != null) rule.setTriggerValue(dto.getTriggerValue());
        if (dto.getConditionField()   != null) rule.setConditionField(dto.getConditionField());
        if (dto.getConditionOperator()!= null) rule.setConditionOperator(dto.getConditionOperator());
        if (dto.getConditionValue()   != null) rule.setConditionValue(dto.getConditionValue());
        if (dto.getActionType()       != null) rule.setActionType(dto.getActionType());
        if (dto.getActionPayload()    != null) rule.setActionPayload(dto.getActionPayload());
    }

    private AutomationRuleDto toDto(AutomationRule r) {
        AutomationRuleDto d = new AutomationRuleDto();
        d.setId(r.getId());
        d.setName(r.getName());
        d.setDescription(r.getDescription());
        d.setEnabled(r.isEnabled());
        d.setCreatedBy(r.getCreatedBy());
        d.setCreatedAt(r.getCreatedAt());
        d.setUpdatedAt(r.getUpdatedAt());
        d.setTriggerEvent(r.getTriggerEvent());
        d.setTriggerValue(r.getTriggerValue());
        d.setConditionField(r.getConditionField());
        d.setConditionOperator(r.getConditionOperator());
        d.setConditionValue(r.getConditionValue());
        d.setActionType(r.getActionType());
        d.setActionPayload(r.getActionPayload());
        d.setLastFiredAt(r.getLastFiredAt());
        d.setFireCount(r.getFireCount());
        return d;
    }
}
