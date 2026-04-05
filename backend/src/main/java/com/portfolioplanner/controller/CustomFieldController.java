package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.CustomFieldDefinition;
import com.portfolioplanner.domain.model.CustomFieldValue;
import com.portfolioplanner.domain.repository.CustomFieldDefinitionRepository;
import com.portfolioplanner.domain.repository.CustomFieldValueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/custom-fields")
@RequiredArgsConstructor
public class CustomFieldController {

    private final CustomFieldDefinitionRepository defRepo;
    private final CustomFieldValueRepository      valRepo;

    // ── Definitions ───────────────────────────────────────────────────────────

    /** All active definitions (for rendering on project pages). */
    @GetMapping("/definitions")
    public ResponseEntity<List<Map<String, Object>>> activeDefinitions() {
        return ResponseEntity.ok(
                defRepo.findByActiveTrueOrderBySortOrderAsc()
                       .stream().map(this::defToMap).collect(Collectors.toList())
        );
    }

    /** All definitions including inactive (admin view). */
    @GetMapping("/definitions/all")
    public ResponseEntity<List<Map<String, Object>>> allDefinitions() {
        return ResponseEntity.ok(
                defRepo.findAllByOrderBySortOrderAsc()
                       .stream().map(this::defToMap).collect(Collectors.toList())
        );
    }

    /** Create a new field definition (admin). */
    @PostMapping("/definitions")
    public ResponseEntity<?> createDefinition(@RequestBody DefRequest req) {
        if (defRepo.existsByFieldName(req.fieldName())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Field name already exists"));
        }
        CustomFieldDefinition def = CustomFieldDefinition.builder()
                .fieldName(req.fieldName())
                .fieldLabel(req.fieldLabel())
                .fieldType(req.fieldType())
                .optionsJson(req.optionsJson())
                .required(req.required() != null ? req.required() : false)
                .sortOrder(req.sortOrder() != null ? req.sortOrder() : 0)
                .active(true)
                .build();
        return ResponseEntity.ok(defToMap(defRepo.save(def)));
    }

    /** Update a field definition (admin). */
    @PutMapping("/definitions/{id}")
    public ResponseEntity<?> updateDefinition(@PathVariable Long id, @RequestBody DefRequest req) {
        return defRepo.findById(id).map(def -> {
            if (req.fieldLabel()  != null) def.setFieldLabel(req.fieldLabel());
            if (req.optionsJson() != null) def.setOptionsJson(req.optionsJson());
            if (req.required()    != null) def.setRequired(req.required());
            if (req.sortOrder()   != null) def.setSortOrder(req.sortOrder());
            if (req.active()      != null) def.setActive(req.active());
            return ResponseEntity.ok(defToMap(defRepo.save(def)));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Soft-delete (deactivate) a field definition. */
    @DeleteMapping("/definitions/{id}")
    public ResponseEntity<Void> deleteDefinition(@PathVariable Long id) {
        defRepo.findById(id).ifPresent(def -> { def.setActive(false); defRepo.save(def); });
        return ResponseEntity.noContent().build();
    }

    // ── Values ────────────────────────────────────────────────────────────────

    /** Get all custom field values for a project (as fieldName → value map). */
    @GetMapping("/values/{projectId}")
    public ResponseEntity<Map<String, Object>> getValues(@PathVariable Long projectId) {
        List<CustomFieldValue> values = valRepo.findByProjectId(projectId);
        // Build fieldDefId → value map, then enrich with fieldName
        Map<Long, String> idToValue = values.stream()
                .collect(Collectors.toMap(CustomFieldValue::getFieldDefId, v -> v.getValueText() != null ? v.getValueText() : ""));
        // Get definitions to resolve names
        List<CustomFieldDefinition> defs = defRepo.findByActiveTrueOrderBySortOrderAsc();
        Map<String, Object> result = new LinkedHashMap<>();
        for (CustomFieldDefinition def : defs) {
            result.put(def.getFieldName(), idToValue.getOrDefault(def.getId(), ""));
        }
        return ResponseEntity.ok(result);
    }

    /** Upsert custom field values for a project.
     *  Body: map of fieldName → value string */
    @PutMapping("/values/{projectId}")
    public ResponseEntity<Map<String, Object>> upsertValues(
            @PathVariable Long projectId,
            @RequestBody Map<String, String> fieldValues
    ) {
        // Build fieldName → definition lookup
        List<CustomFieldDefinition> defs = defRepo.findByActiveTrueOrderBySortOrderAsc();
        Map<String, CustomFieldDefinition> nameToDefMap = defs.stream()
                .collect(Collectors.toMap(CustomFieldDefinition::getFieldName, d -> d));

        for (Map.Entry<String, String> entry : fieldValues.entrySet()) {
            CustomFieldDefinition def = nameToDefMap.get(entry.getKey());
            if (def == null) continue; // ignore unknown field names
            CustomFieldValue val = valRepo.findByFieldDefIdAndProjectId(def.getId(), projectId)
                    .orElseGet(() -> CustomFieldValue.builder()
                            .fieldDefId(def.getId())
                            .projectId(projectId)
                            .build());
            val.setValueText(entry.getValue());
            valRepo.save(val);
        }

        return getValues(projectId); // return updated values
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private Map<String, Object> defToMap(CustomFieldDefinition d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",          d.getId());
        m.put("fieldName",   d.getFieldName());
        m.put("fieldLabel",  d.getFieldLabel());
        m.put("fieldType",   d.getFieldType());
        m.put("optionsJson", d.getOptionsJson());
        m.put("required",    d.getRequired());
        m.put("sortOrder",   d.getSortOrder());
        m.put("active",      d.getActive());
        m.put("createdAt",   d.getCreatedAt() != null ? d.getCreatedAt().toString() : null);
        return m;
    }

    record DefRequest(
            String fieldName, String fieldLabel, String fieldType,
            String optionsJson, Boolean required, Integer sortOrder, Boolean active
    ) {}
}
