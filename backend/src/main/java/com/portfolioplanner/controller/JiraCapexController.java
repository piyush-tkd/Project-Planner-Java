package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraCapexService;
import com.portfolioplanner.service.jira.JiraCapexService.*;
import com.portfolioplanner.service.jira.JiraCredentialsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API for CapEx / OpEx (IDS vs NON-IDS) monthly reporting.
 *
 * <pre>
 *   GET  /api/jira/capex                – monthly breakdown (requires ?month=YYYY-MM)
 *   GET  /api/jira/capex/fields         – list Jira custom fields (for field picker)
 *   GET  /api/jira/capex/settings       – current capex field config from DB
 *   POST /api/jira/capex/settings       – save capex field ID to DB
 * </pre>
 */
@RestController
@RequestMapping("/api/jira/capex")
@RequiredArgsConstructor
public class JiraCapexController {

    private final JiraCapexService       capexService;
    private final JiraCredentialsService creds;

    /**
     * Returns a monthly CapEx/OpEx breakdown.
     *
     * @param month   "YYYY-MM" (required) — e.g. "2025-01"
     * @param fieldId optional override for the custom field ID; falls back to DB setting
     */
    @GetMapping
    public ResponseEntity<CapexMonthReport> getMonthlyReport(
            @RequestParam String month,
            @RequestParam(required = false) String fieldId) {
        return ResponseEntity.ok(capexService.getMonthlyReport(month, fieldId));
    }

    /**
     * Returns all Jira fields — used by the UI to let the user pick the
     * IDS/NON-IDS custom field without having to know the field ID upfront.
     * Only returns custom fields (those whose key starts with "customfield_").
     */
    @GetMapping("/fields")
    public ResponseEntity<List<Map<String, Object>>> getCustomFields() {
        List<Map<String, Object>> all = capexService.getCustomFields();
        // Filter to custom fields only and shape the response for the UI
        List<Map<String, Object>> custom = all.stream()
                .filter(f -> {
                    Object id = f.get("id");
                    return id instanceof String && ((String) id).startsWith("customfield_");
                })
                .map(f -> Map.of(
                        "id",   f.getOrDefault("id",   ""),
                        "name", f.getOrDefault("name", ""),
                        "type", extractFieldType(f)
                ))
                .sorted((a, b) -> String.valueOf(a.get("name")).compareTo(String.valueOf(b.get("name"))))
                .toList();
        return ResponseEntity.ok(custom);
    }

    /** Returns the currently configured CapEx field ID. */
    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> getSettings() {
        String fieldId = creds.getCapexFieldId();
        return ResponseEntity.ok(Map.of(
                "capexFieldId", fieldId != null ? fieldId : ""
        ));
    }

    /** Saves the CapEx field ID to the DB. */
    @PostMapping("/settings")
    public ResponseEntity<Map<String, Object>> saveSettings(
            @RequestBody Map<String, String> body) {
        String fieldId = body.get("capexFieldId");
        creds.saveCapexFieldId(fieldId);
        return ResponseEntity.ok(Map.of(
                "capexFieldId", fieldId != null ? fieldId : "",
                "saved", true
        ));
    }

    @SuppressWarnings("unchecked")
    private static String extractFieldType(Map<String, Object> field) {
        Object schema = field.get("schema");
        if (schema instanceof Map) {
            Object type = ((Map<?,?>) schema).get("type");
            if (type instanceof String) return (String) type;
        }
        return "unknown";
    }
}
