package com.portfolioplanner.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Quality metrics configuration — controls what counts as an escaped bug,
 * invalid bug, which phases represent escapes, etc.
 *
 * GET  /api/jira/quality-config        → all config as key-value map
 * PUT  /api/jira/quality-config/{key}  → update a single config value
 * GET  /api/jira/quality-config/schema → key list with descriptions for UI rendering
 */
@RestController
@RequestMapping("/api/jira/quality-config")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class JiraQualityConfigController {

    private final JdbcTemplate jdbc;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAll() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT config_key, config_value, description, updated_at FROM jira_quality_config ORDER BY config_key");
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String key = (String) row.get("config_key");
            result.put(key, Map.of(
                "value",       row.get("config_value"),
                "description", row.getOrDefault("description", ""),
                "updated_at",  row.getOrDefault("updated_at", "")
            ));
        }
        return ResponseEntity.ok(result);
    }

    @PutMapping("/{key}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Map<String, String>> update(
            @PathVariable String key,
            @RequestBody Map<String, String> body) {
        String value = body.get("value");
        if (value == null) return ResponseEntity.badRequest().body(Map.of("error", "value required"));

        int updated = jdbc.update(
            "UPDATE jira_quality_config SET config_value = ?, updated_at = NOW() WHERE config_key = ?",
            value.trim(), key);

        if (updated == 0) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("key", key, "value", value.trim()));
    }

    @GetMapping("/schema")
    public ResponseEntity<List<Map<String, String>>> schema() {
        return ResponseEntity.ok(List.of(
            Map.of("key", "escape_phases",       "label", "Escape Phases",
                   "hint", "Phase Defect Found values that represent escaped bugs (comma-separated)"),
            Map.of("key", "in_sprint_phases",    "label", "In-Sprint Phases",
                   "hint", "Phase values caught during normal sprint QA — not escapes (comma-separated)"),
            Map.of("key", "invalid_bug_statuses","label", "Invalid Bug Statuses",
                   "hint", "Statuses meaning the ticket is NOT a real bug — excluded from all metrics (comma-separated)"),
            Map.of("key", "bug_issue_types",     "label", "Bug Issue Types",
                   "hint", "Issue types counted as defects/bugs in quality calculations (comma-separated)"),
            Map.of("key", "phase_defect_field",  "label", "Phase Defect Field ID",
                   "hint", "Jira custom field ID for 'Phase Defect Found' (do not change unless field changed)")
        ));
    }

    /**
     * Returns available options for each config field — populated from actual DB data.
     * Phase options come from jira_issue_custom_field; statuses/types from jira_issue.
     */
    @GetMapping("/options")
    public ResponseEntity<Map<String, List<String>>> options() {
        Map<String, List<String>> result = new LinkedHashMap<>();

        // Phase Defect Found values actually in use
        result.put("phase_options", jdbc.queryForList(
            "SELECT DISTINCT field_value FROM jira_issue_custom_field " +
            "WHERE field_id = 'customfield_13493' AND field_value IS NOT NULL AND field_value != '' " +
            "ORDER BY field_value", String.class));

        // If no data synced yet, show sensible defaults
        if (result.get("phase_options").isEmpty()) {
            result.put("phase_options", List.of("Development", "Integration", "Production", "QA", "Regression", "Sprint", "UAT"));
        }

        // All distinct bug/defect statuses in DB
        result.put("status_options", jdbc.queryForList(
            "SELECT DISTINCT status_name FROM jira_issue " +
            "WHERE status_name IS NOT NULL ORDER BY status_name", String.class));

        // All distinct issue types
        result.put("issue_type_options", jdbc.queryForList(
            "SELECT DISTINCT issue_type FROM jira_issue " +
            "WHERE issue_type IS NOT NULL ORDER BY issue_type", String.class));

        return ResponseEntity.ok(result);
    }

    /** Helper used by JiraQualityController to load config values */
    public String getValue(String key, String defaultValue) {
        try {
            return jdbc.queryForObject(
                "SELECT config_value FROM jira_quality_config WHERE config_key = ?",
                String.class, key);
        } catch (Exception e) {
            return defaultValue;
        }
    }

    public Set<String> getSet(String key, String defaultCsv) {
        String csv = getValue(key, defaultCsv);
        Set<String> result = new LinkedHashSet<>();
        for (String s : csv.split(",")) {
            String trimmed = s.trim();
            if (!trimmed.isEmpty()) result.add(trimmed.toUpperCase());
        }
        return result;
    }
}
