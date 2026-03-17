package com.portfolioplanner.controller;

import com.portfolioplanner.config.JiraProperties;
import com.portfolioplanner.domain.model.JiraProjectMapping;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.repository.JiraProjectMappingRepository;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.service.jira.JiraActualsService;
import com.portfolioplanner.service.jira.JiraActualsService.*;
import com.portfolioplanner.service.jira.JiraClient;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/jira")
@RequiredArgsConstructor
public class JiraController {

    private final JiraActualsService actualsService;
    private final JiraClient jiraClient;
    private final JiraProjectMappingRepository mappingRepo;
    private final ProjectRepository projectRepo;
    private final JiraProperties props;

    /** Check whether Jira credentials are configured */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of(
                "configured", props.isConfigured(),
                "baseUrl", props.isConfigured() ? props.getBaseUrl() : ""
        ));
    }

    /**
     * Live connectivity test — calls /rest/api/3/myself and returns the raw
     * Jira user object so you can confirm auth works, or returns an error message.
     */
    @GetMapping("/test")
    public ResponseEntity<Map<String, Object>> testConnection() {
        if (!props.isConfigured()) {
            return ResponseEntity.ok(Map.of("ok", false, "error", "Jira credentials not configured"));
        }
        try {
            String body = actualsService.testConnection();
            return ResponseEntity.ok(Map.of("ok", true, "response", body));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("ok", false, "error", e.getMessage()));
        }
    }

    /** List all Jira projects with their epics and labels (for mapper UI) */
    @GetMapping("/projects")
    public ResponseEntity<List<JiraProjectInfo>> getJiraProjects() {
        return ResponseEntity.ok(actualsService.getJiraProjects());
    }

    /** Suggest automatic mappings based on epic/label name matching */
    @GetMapping("/suggestions")
    public ResponseEntity<List<MappingSuggestion>> getSuggestions() {
        return ResponseEntity.ok(actualsService.suggestMappings());
    }

    /** List all saved mappings */
    @GetMapping("/mappings")
    @Transactional(readOnly = true)
    public ResponseEntity<List<MappingResponse>> getMappings() {
        List<JiraProjectMapping> mappings = mappingRepo.findByActiveTrueOrderByJiraProjectKey();
        List<MappingResponse> result = mappings.stream()
                .map(m -> new MappingResponse(
                        m.getId(),
                        m.getProject().getId(),
                        m.getProject().getName(),
                        m.getJiraProjectKey(),
                        m.getMatchType(),
                        m.getMatchValue(),
                        m.getActive()))
                .toList();
        return ResponseEntity.ok(result);
    }

    /** Save or update a mapping */
    @PostMapping("/mappings")
    @Transactional
    public ResponseEntity<MappingResponse> saveMapping(@RequestBody SaveMappingRequest req) {
        Project project = projectRepo.findById(req.ppProjectId())
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + req.ppProjectId()));

        JiraProjectMapping mapping = mappingRepo
                .findByProjectIdAndJiraProjectKey(req.ppProjectId(), req.jiraProjectKey())
                .orElseGet(JiraProjectMapping::new);

        mapping.setProject(project);
        mapping.setJiraProjectKey(req.jiraProjectKey());
        mapping.setMatchType(req.matchType());
        mapping.setMatchValue(req.matchValue());
        mapping.setActive(true);
        mapping = mappingRepo.save(mapping);

        return ResponseEntity.ok(new MappingResponse(
                mapping.getId(),
                project.getId(),
                project.getName(),
                mapping.getJiraProjectKey(),
                mapping.getMatchType(),
                mapping.getMatchValue(),
                mapping.getActive()));
    }

    /** Bulk-save multiple mappings at once */
    @PostMapping("/mappings/bulk")
    @Transactional
    public ResponseEntity<List<MappingResponse>> saveMappingsBulk(
            @RequestBody List<SaveMappingRequest> requests) {
        List<MappingResponse> saved = requests.stream()
                .map(req -> saveMapping(req).getBody())
                .toList();
        return ResponseEntity.ok(saved);
    }

    /** Delete a mapping */
    @DeleteMapping("/mappings/{id}")
    @Transactional
    public ResponseEntity<Void> deleteMapping(@PathVariable Long id) {
        mappingRepo.findById(id).ifPresent(m -> {
            m.setActive(false);
            mappingRepo.save(m);
        });
        return ResponseEntity.noContent().build();
    }

    /** Fetch actuals from Jira and compare against PP estimates */
    @GetMapping("/actuals")
    public ResponseEntity<List<ActualsRow>> getActuals() {
        return ResponseEntity.ok(actualsService.getActuals());
    }

    /**
     * Lightweight project list — just key + name, no epics or labels.
     * Used by the Settings board-picker to avoid loading all epic/label data.
     */
    @GetMapping("/projects/simple")
    public ResponseEntity<List<SimpleProject>> getProjectsSimple() {
        return ResponseEntity.ok(actualsService.getSimpleProjects());
    }

    /**
     * Bust all Jira API caches so the next calls re-fetch live data.
     * Returns 200 OK with a count of caches cleared.
     */
    @PostMapping("/cache/clear")
    public ResponseEntity<Map<String, Object>> clearCache() {
        jiraClient.evictAllCaches();
        return ResponseEntity.ok(Map.of("cleared", true, "message", "All Jira caches cleared"));
    }

    /**
     * Debug endpoint — given a board ID, returns:
     *  - boardConfig: the raw board configuration (including estimation.field.fieldId)
     *  - spField: the field Jira says this board uses for story points
     *  - sampleIssues: first 5 sprint issues with their numeric customfield_ values
     *
     * Call this to diagnose why SP numbers look wrong.
     * Example: GET /api/jira/debug/board/123
     */
    @GetMapping("/debug/board/{boardId}")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> debugBoard(@PathVariable long boardId) {
        if (!props.isConfigured()) {
            return ResponseEntity.ok(Map.of("error", "Jira not configured"));
        }
        try {
            // 1. Board configuration
            Map<String, Object> boardConfig = jiraClient.getBoardConfiguration(boardId);
            String spField = null;
            Object est = boardConfig.get("estimation");
            if (est instanceof Map) {
                Object fieldObj = ((Map<?,?>) est).get("field");
                if (fieldObj instanceof Map) spField = (String) ((Map<?,?>) fieldObj).get("fieldId");
            }

            // 2. Active sprint issues — dump numeric customfields
            List<Map<String, Object>> activeSprints = jiraClient.getActiveSprints(boardId);
            List<Map<String, Object>> sampleIssues  = List.of();
            if (!activeSprints.isEmpty()) {
                long sprintId = ((Number) activeSprints.get(0).get("id")).longValue();
                List<Map<String, Object>> issues = jiraClient.getSprintIssues(sprintId, spField);
                sampleIssues = issues.stream().limit(10).map(issue -> {
                    Map<String, Object> out = new java.util.LinkedHashMap<>();
                    out.put("key", issue.get("key"));
                    Object fields = issue.get("fields");
                    if (fields instanceof Map) {
                        Map<String, Object> f = (Map<String, Object>) fields;
                        // Status
                        Object statusObj = f.get("status");
                        if (statusObj instanceof Map) out.put("status", ((Map<?,?>) statusObj).get("name"));
                        // All numeric customfields (SP candidates)
                        Map<String, Object> numericCustomFields = new java.util.LinkedHashMap<>();
                        for (Map.Entry<String,Object> e : f.entrySet()) {
                            if (e.getKey().startsWith("customfield_") && e.getValue() instanceof Number) {
                                numericCustomFields.put(e.getKey(), e.getValue());
                            }
                        }
                        out.put("numericCustomFields", numericCustomFields);
                        // Also show null customfields (fields that were requested but came back null)
                        List<String> nullSpFields = List.of(
                                "customfield_10004","customfield_10016","customfield_10024",
                                "customfield_10025","customfield_10028");
                        Map<String, Object> spFieldValues = new java.util.LinkedHashMap<>();
                        for (String cf : nullSpFields) {
                            spFieldValues.put(cf, f.getOrDefault(cf, "<not returned>"));
                        }
                        out.put("spFieldValues", spFieldValues);
                    }
                    return out;
                }).collect(java.util.stream.Collectors.toList());
            }

            return ResponseEntity.ok(Map.of(
                    "boardId",      boardId,
                    "spField",      spField != null ? spField : "not found in board config",
                    "boardConfig",  boardConfig,
                    "sampleIssues", sampleIssues
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }

    // ── DTOs ──────────────────────────────────────────────────────────

    public record SaveMappingRequest(
            Long ppProjectId,
            String jiraProjectKey,
            String matchType,   // EPIC_NAME | LABEL | EPIC_KEY | PROJECT_NAME
            String matchValue) {}

    public record MappingResponse(
            Long id,
            Long ppProjectId,
            String ppProjectName,
            String jiraProjectKey,
            String matchType,
            String matchValue,
            Boolean active) {}
    // SimpleProject DTO is defined in JiraActualsService and imported via wildcard above
}
