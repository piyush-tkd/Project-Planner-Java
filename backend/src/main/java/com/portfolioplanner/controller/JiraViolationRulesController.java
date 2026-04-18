package com.portfolioplanner.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Violation-rules configuration for the Sprint Command Center.
 *
 * GET  /api/violation-rules                        → current rules config as JSON string
 * PUT  /api/violation-rules                        → save updated rules config
 * GET  /api/violation-rules/available-fields       → distinct custom fields + their type
 * GET  /api/violation-rules/field-values/{fieldId} → distinct values for a specific field
 * GET  /api/violation-rules/issue-types            → all distinct issue types
 */
@RestController
@RequestMapping("/api/violation-rules")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class JiraViolationRulesController {

    private final JdbcTemplate jdbc;

    // ── GET: current config ───────────────────────────────────────────────────

    @GetMapping(produces = "application/json")
    public ResponseEntity<String> getConfig() {
        List<String> rows = jdbc.queryForList(
            "SELECT rules_json FROM jira_violation_rule_config ORDER BY id LIMIT 1",
            String.class);
        return ResponseEntity.ok(rows.isEmpty() ? "[]" : rows.get(0));
    }

    // ── PUT: save config ──────────────────────────────────────────────────────

    @PutMapping(consumes = "application/json")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> saveConfig(@RequestBody String rulesJson) {
        int updated = jdbc.update(
            "UPDATE jira_violation_rule_config SET rules_json = ?, updated_at = NOW() " +
            "WHERE id = (SELECT id FROM jira_violation_rule_config ORDER BY id LIMIT 1)",
            rulesJson);
        if (updated == 0) {
            jdbc.update(
                "INSERT INTO jira_violation_rule_config (rules_json) VALUES (?)",
                rulesJson);
        }
        return ResponseEntity.ok().build();
    }

    // ── GET: available custom fields ──────────────────────────────────────────

    /**
     * Returns all distinct custom fields with their type.
     * fieldType is normalised to: string | number | date | option | user | unknown
     */
    @GetMapping("/available-fields")
    public ResponseEntity<List<Map<String, String>>> availableFields() {
        List<Map<String, String>> fields = jdbc.query(
            "SELECT field_id, " +
            "       COALESCE(NULLIF(MAX(field_name), ''), field_id) AS field_name, " +
            "       COALESCE(MAX(field_type), 'string') AS field_type " +
            "FROM jira_issue_custom_field " +
            "WHERE field_id IS NOT NULL " +
            "GROUP BY field_id " +
            "ORDER BY field_name",
            (rs, rowNum) -> {
                Map<String, String> m = new LinkedHashMap<>();
                m.put("fieldId",   rs.getString("field_id"));
                m.put("fieldName", rs.getString("field_name"));
                m.put("fieldType", normaliseFieldType(rs.getString("field_type")));
                return m;
            });
        return ResponseEntity.ok(fields);
    }

    /** Normalise Jira field_type values into a small set the frontend can switch on. */
    private static String normaliseFieldType(String raw) {
        if (raw == null) return "string";
        return switch (raw.toLowerCase()) {
            case "number", "float", "integer" -> "number";
            case "date", "datetime"            -> "date";
            case "option", "array", "options"  -> "option";
            case "user", "users"               -> "user";
            default                            -> "string";
        };
    }

    // ── GET: distinct values for a field ──────────────────────────────────────

    /**
     * Returns up to 100 distinct non-empty values for a specific custom field.
     * Used to populate the "must be one of" multiselect for option-type fields.
     */
    @GetMapping("/field-values/{fieldId}")
    public ResponseEntity<List<String>> fieldValues(@PathVariable String fieldId) {
        List<String> values = jdbc.queryForList(
            "SELECT DISTINCT field_value " +
            "FROM jira_issue_custom_field " +
            "WHERE field_id = ? AND field_value IS NOT NULL AND field_value != '' " +
            "ORDER BY field_value LIMIT 100",
            String.class, fieldId);
        return ResponseEntity.ok(values);
    }

    // ── GET: available issue types ────────────────────────────────────────────

    /**
     * Returns distinct issue types scoped to project keys from enabled PODs only.
     */
    @GetMapping("/issue-types")
    public ResponseEntity<List<String>> issueTypes() {
        List<String> types = jdbc.queryForList(
            "SELECT DISTINCT ji.issue_type " +
            "FROM jira_issue ji " +
            "WHERE ji.project_key IN (" +
            "  SELECT jpb.jira_project_key FROM jira_pod_board jpb " +
            "  JOIN jira_pod jp ON jpb.pod_id = jp.id WHERE jp.enabled = true" +
            ") AND ji.issue_type IS NOT NULL AND ji.issue_type != '' " +
            "ORDER BY ji.issue_type",
            String.class);
        return ResponseEntity.ok(types);
    }

    // ── GET: available issue statuses ─────────────────────────────────────────

    /**
     * Returns distinct status names scoped to project keys from enabled PODs only.
     * Used to populate the status-filter multiselects in the violation rule editor.
     */
    @GetMapping("/statuses")
    public ResponseEntity<List<String>> statuses() {
        List<String> statuses = jdbc.queryForList(
            "SELECT DISTINCT ji.status_name " +
            "FROM jira_issue ji " +
            "WHERE ji.project_key IN (" +
            "  SELECT jpb.jira_project_key FROM jira_pod_board jpb " +
            "  JOIN jira_pod jp ON jpb.pod_id = jp.id WHERE jp.enabled = true" +
            ") AND ji.status_name IS NOT NULL AND ji.status_name != '' " +
            "ORDER BY ji.status_name",
            String.class);
        return ResponseEntity.ok(statuses);
    }
}
