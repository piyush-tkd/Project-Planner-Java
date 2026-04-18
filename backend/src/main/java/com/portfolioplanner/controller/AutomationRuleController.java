package com.portfolioplanner.controller;

import com.portfolioplanner.dto.AutomationRuleDto;
import com.portfolioplanner.service.AutomationRuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

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
@PreAuthorize("isAuthenticated()")
public class AutomationRuleController {

    private final AutomationRuleService service;

    // ── List ─────────────────────────────────────────────────────────────────

    @GetMapping
    public List<AutomationRuleDto> list() {
        return service.listAll();
    }

    // ── Create ────────────────────────────────────────────────────────────────

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AutomationRuleDto create(@RequestBody AutomationRuleDto dto,
                                    Authentication auth) {
        return service.create(dto, auth);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public AutomationRuleDto update(@PathVariable Long id,
                                     @RequestBody AutomationRuleDto dto) {
        return service.update(id, dto);
    }

    // ── Toggle enabled ─────────────────────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/toggle")
    public AutomationRuleDto toggle(@PathVariable Long id) {
        return service.toggle(id);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    // ── Manual fire (test) ────────────────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/fire")
    public ResponseEntity<Map<String, Object>> manualFire(@PathVariable Long id) {
        return ResponseEntity.ok(service.manualFire(id));
    }
}
