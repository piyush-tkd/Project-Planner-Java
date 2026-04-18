package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.CustomFieldDefinition;
import com.portfolioplanner.domain.model.CustomFieldValue;
import com.portfolioplanner.domain.repository.CustomFieldDefinitionRepository;
import com.portfolioplanner.domain.repository.CustomFieldValueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomFieldService {

    private final CustomFieldDefinitionRepository defRepo;
    private final CustomFieldValueRepository      valRepo;

    // ── Definitions ───────────────────────────────────────────────────────────

    public List<Map<String, Object>> getActiveDefinitions() {
        return defRepo.findByActiveTrueOrderBySortOrderAsc().stream().map(this::defToMap).toList();
    }

    public List<Map<String, Object>> getAllDefinitions() {
        return defRepo.findAllByOrderBySortOrderAsc().stream().map(this::defToMap).toList();
    }

    @Transactional
    public Map<String, Object> createDefinition(String fieldName, String fieldLabel,
                                                  String fieldType, String optionsJson,
                                                  Boolean required, Integer sortOrder) {
        if (defRepo.existsByFieldName(fieldName))
            throw new IllegalArgumentException("Field name '" + fieldName + "' already exists");

        CustomFieldDefinition def = CustomFieldDefinition.builder()
                .fieldName(fieldName)
                .fieldLabel(fieldLabel != null ? fieldLabel : fieldName)
                .fieldType(fieldType != null ? fieldType : "text")
                .optionsJson(optionsJson)
                .required(required != null ? required : false)
                .sortOrder(sortOrder != null ? sortOrder : 0)
                .active(true)
                .build();
        return defToMap(defRepo.save(def));
    }

    @Transactional
    public Optional<Map<String, Object>> updateDefinition(Long id, String fieldLabel,
                                                           String optionsJson, Boolean required,
                                                           Integer sortOrder, Boolean active) {
        return defRepo.findById(id).map(def -> {
            if (fieldLabel  != null) def.setFieldLabel(fieldLabel);
            if (optionsJson != null) def.setOptionsJson(optionsJson);
            if (required    != null) def.setRequired(required);
            if (sortOrder   != null) def.setSortOrder(sortOrder);
            if (active      != null) def.setActive(active);
            return defToMap(defRepo.save(def));
        });
    }

    @Transactional
    public void deleteDefinition(Long id) {
        defRepo.findById(id).ifPresent(def -> {
            def.setActive(false);
            defRepo.save(def);
        });
    }

    // ── Values ────────────────────────────────────────────────────────────────

    public Map<String, Object> getValues(Long projectId) {
        List<CustomFieldDefinition> defs = defRepo.findByActiveTrueOrderBySortOrderAsc();
        List<CustomFieldValue> vals = valRepo.findByProjectId(projectId);

        Map<Long, String> valByDefId = vals.stream()
                .collect(Collectors.toMap(CustomFieldValue::getFieldDefId, CustomFieldValue::getValueText,
                        (a, b) -> a));

        Map<String, Object> result = new LinkedHashMap<>();
        for (CustomFieldDefinition def : defs) {
            result.put(def.getFieldName(), valByDefId.getOrDefault(def.getId(), null));
        }
        return result;
    }

    @Transactional
    public Map<String, Object> upsertValues(Long projectId, Map<String, String> fieldValues) {
        List<CustomFieldDefinition> defs = defRepo.findAllByOrderBySortOrderAsc();
        Map<String, Long> nameToId = defs.stream()
                .collect(Collectors.toMap(CustomFieldDefinition::getFieldName, CustomFieldDefinition::getId,
                        (a, b) -> a));

        List<CustomFieldValue> existing = valRepo.findByProjectId(projectId);
        Map<Long, CustomFieldValue> existingByDefId = existing.stream()
                .collect(Collectors.toMap(CustomFieldValue::getFieldDefId, v -> v, (a, b) -> a));

        for (Map.Entry<String, String> entry : fieldValues.entrySet()) {
            Long defId = nameToId.get(entry.getKey());
            if (defId == null) continue;

            CustomFieldValue val = existingByDefId.computeIfAbsent(defId,
                    id -> CustomFieldValue.builder().fieldDefId(id).projectId(projectId).build());
            val.setValueText(entry.getValue());
            valRepo.save(val);
        }

        return getValues(projectId);
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
        return m;
    }
}
