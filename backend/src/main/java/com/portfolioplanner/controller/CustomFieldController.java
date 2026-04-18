package com.portfolioplanner.controller;

import com.portfolioplanner.service.CustomFieldService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/custom-fields")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class CustomFieldController {

    private final CustomFieldService service;

    // ── Definitions ───────────────────────────────────────────────────────────

    /** All active definitions (for rendering on project pages). */
    @GetMapping("/definitions")
    public ResponseEntity<List<Map<String, Object>>> activeDefinitions() {
        return ResponseEntity.ok(service.getActiveDefinitions());
    }

    /** All definitions including inactive (admin view). */
    @GetMapping("/definitions/all")
    public ResponseEntity<List<Map<String, Object>>> allDefinitions() {
        return ResponseEntity.ok(service.getAllDefinitions());
    }

    /** Create a new field definition (admin). */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/definitions")
    public ResponseEntity<?> createDefinition(@RequestBody DefRequest req) {
        try {
            var result = service.createDefinition(req.fieldName(), req.fieldLabel(), req.fieldType(),
                                                   req.optionsJson(), req.required(), req.sortOrder());
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Update a field definition (admin). */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/definitions/{id}")
    public ResponseEntity<?> updateDefinition(@PathVariable Long id, @RequestBody DefRequest req) {
        return service.updateDefinition(id, req.fieldLabel(), req.optionsJson(),
                                        req.required(), req.sortOrder(), req.active())
                      .map(ResponseEntity::ok)
                      .orElse(ResponseEntity.notFound().build());
    }

    /** Soft-delete (deactivate) a field definition. */
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/definitions/{id}")
    public ResponseEntity<Void> deleteDefinition(@PathVariable Long id) {
        service.deleteDefinition(id);
        return ResponseEntity.noContent().build();
    }

    // ── Values ────────────────────────────────────────────────────────────────

    /** Get all custom field values for a project (as fieldName → value map). */
    @GetMapping("/values/{projectId}")
    public ResponseEntity<Map<String, Object>> getValues(@PathVariable Long projectId) {
        return ResponseEntity.ok(service.getValues(projectId));
    }

    /** Upsert custom field values for a project.
     *  Body: map of fieldName → value string */
    @PutMapping("/values/{projectId}")
    public ResponseEntity<Map<String, Object>> upsertValues(
            @PathVariable Long projectId,
            @RequestBody Map<String, String> fieldValues
    ) {
        return ResponseEntity.ok(service.upsertValues(projectId, fieldValues));
    }

    record DefRequest(
            String fieldName, String fieldLabel, String fieldType,
            String optionsJson, Boolean required, Integer sortOrder, Boolean active
    ) {}
}
