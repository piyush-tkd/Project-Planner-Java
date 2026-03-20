package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraCredentialsService;
import com.portfolioplanner.domain.model.JiraProjectMapping;
import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.repository.JiraProjectMappingRepository;
import com.portfolioplanner.domain.repository.JiraPodRepository;
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
    private final JiraPodRepository podRepo;
    private final ProjectRepository projectRepo;
    private final JiraCredentialsService creds;

    /** Check whether Jira credentials are configured */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of(
                "configured", creds.isConfigured(),
                "baseUrl", creds.isConfigured() ? creds.getBaseUrl() : ""
        ));
    }

    /**
     * Live connectivity test — calls /rest/api/3/myself and returns the raw
     * Jira user object so you can confirm auth works, or returns an error message.
     */
    @GetMapping("/test")
    public ResponseEntity<Map<String, Object>> testConnection() {
        if (!creds.isConfigured()) {
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
        if (!creds.isConfigured()) {
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
                List<Map<String, Object>> issues = jiraClient.getSprintIssues(boardId, sprintId, spField);
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

    /**
     * SP audit — returns every issue in the active sprint with its key, type,
     * subtask flag, status, SP value, and assignee.
     * Use this to find exactly where inflated SP totals are coming from.
     * Example: GET /api/jira/debug/board/15/sp-audit
     */
    @GetMapping("/debug/board/{boardId}/sp-audit")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> spAudit(@PathVariable long boardId) {
        if (!creds.isConfigured()) return ResponseEntity.ok(Map.of("error", "Jira not configured"));
        try {
            Map<String, Object> boardConfig = jiraClient.getBoardConfiguration(boardId);
            String spField = null;
            Object est = boardConfig.get("estimation");
            if (est instanceof Map) {
                Object fieldObj = ((Map<?,?>) est).get("field");
                if (fieldObj instanceof Map) spField = (String) ((Map<?,?>) fieldObj).get("fieldId");
            }
            if (spField == null) spField = "customfield_10016";

            List<Map<String, Object>> activeSprints = jiraClient.getActiveSprints(boardId);
            if (activeSprints.isEmpty()) return ResponseEntity.ok(Map.of("error", "No active sprint"));
            long sprintId = ((Number) activeSprints.get(0).get("id")).longValue();

            // Evict cache so we get fresh data
            jiraClient.evictAllCaches();
            List<Map<String, Object>> issues = jiraClient.getSprintIssues(boardId, sprintId, spField);

            double totalSP = 0, subtaskSP = 0;
            Map<String, Double> spByType = new java.util.LinkedHashMap<>();
            List<Map<String, Object>> allIssues = new java.util.ArrayList<>();

            for (Map<String, Object> issue : issues) {
                Object fields = issue.get("fields");
                if (!(fields instanceof Map)) continue;
                Map<String, Object> f = (Map<String, Object>) fields;

                Map<String, Object> it = f.get("issuetype") instanceof Map ? (Map<String,Object>)f.get("issuetype") : null;
                String type = it != null ? String.valueOf(it.getOrDefault("name","?")) : "?";
                boolean isSubtask = it != null && Boolean.TRUE.equals(it.get("subtask"));

                Object spVal = f.get(spField);
                double sp = spVal instanceof Number ? ((Number)spVal).doubleValue() : 0;

                Map<String, Object> statusObj = f.get("status") instanceof Map ? (Map<String,Object>)f.get("status") : null;
                String status = statusObj != null ? String.valueOf(statusObj.getOrDefault("name","?")) : "?";

                Map<String, Object> assigneeObj = f.get("assignee") instanceof Map ? (Map<String,Object>)f.get("assignee") : null;
                String assignee = assigneeObj != null ? String.valueOf(assigneeObj.getOrDefault("displayName","Unassigned")) : "Unassigned";

                totalSP += sp;
                if (isSubtask) subtaskSP += sp;
                spByType.merge(type, sp, Double::sum);

                Map<String, Object> row = new java.util.LinkedHashMap<>();
                row.put("key", issue.get("key"));
                row.put("type", type);
                row.put("subtask", isSubtask);
                row.put("sp", sp);
                row.put("status", status);
                row.put("assignee", assignee);
                allIssues.add(row);
            }

            // Sort: issues with SP first
            allIssues.sort((a, b) -> Double.compare((double)b.get("sp"), (double)a.get("sp")));

            return ResponseEntity.ok(Map.of(
                    "boardId", boardId, "sprintId", sprintId, "spField", spField,
                    "totalIssues", issues.size(), "totalSP", totalSP, "subtaskSP", subtaskSP,
                    "spByType", spByType, "issues", allIssues
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }

    /**
     * SP path trace — runs the EXACT same Map-navigation logic as buildPodMetrics
     * and shows the intermediate values, so we can pinpoint where SP extraction fails.
     * Does NOT evict caches or touch other state.
     *
     * Example: GET /api/jira/debug/board/15/sp-trace
     */
    @GetMapping("/debug/board/{boardId}/sp-trace")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> spTrace(@PathVariable long boardId) {
        if (!creds.isConfigured()) return ResponseEntity.ok(Map.of("error", "Jira not configured"));
        Map<String, Object> trace = new java.util.LinkedHashMap<>();
        try {
            // Step 1 — active sprint
            List<Map<String, Object>> activeSprints = jiraClient.getActiveSprints(boardId);
            if (activeSprints.isEmpty()) return ResponseEntity.ok(Map.of("error", "No active sprint"));
            long sprintId = ((Number) activeSprints.get(0).get("id")).longValue();
            trace.put("sprintId", sprintId);

            // Step 2 — call getSprintReport (same call as buildPodMetrics)
            Map<String, Object> sr;
            try {
                sr = jiraClient.getSprintReport(boardId, sprintId);
                trace.put("step2_getSprintReport", "SUCCESS");
                trace.put("step2_reportIsEmpty", sr.isEmpty());
                trace.put("step2_reportKeys", sr.keySet());
            } catch (Exception e) {
                trace.put("step2_getSprintReport", "FAILED: " + e.getMessage());
                return ResponseEntity.ok(trace);
            }

            // Step 3 — navigate contents (exact same asMap logic as buildPodMetrics)
            Object contentsRaw = sr.get("contents");
            trace.put("step3_contentsRawType", contentsRaw == null ? "NULL" : contentsRaw.getClass().getName());
            Map<String, Object> srContents = contentsRaw instanceof Map ? (Map<String, Object>) contentsRaw : null;
            trace.put("step3_srContentsNull", srContents == null);
            if (srContents == null) return ResponseEntity.ok(trace);
            trace.put("step3_contentsKeys", srContents.keySet());

            // Step 4 — extract the three sum objects
            Object allSumRaw  = srContents.get("allIssuesEstimateSum");
            Object doneSumRaw = srContents.get("completedIssuesEstimateSum");
            Object puntSumRaw = srContents.get("puntedIssuesEstimateSum");
            trace.put("step4_allSumType",  allSumRaw  == null ? "NULL" : allSumRaw.getClass().getName());
            trace.put("step4_doneSumType", doneSumRaw == null ? "NULL" : doneSumRaw.getClass().getName());
            trace.put("step4_puntSumType", puntSumRaw == null ? "NULL" : puntSumRaw.getClass().getName());

            Map<String, Object> allSum  = allSumRaw  instanceof Map ? (Map<String, Object>) allSumRaw  : null;
            Map<String, Object> doneSum = doneSumRaw instanceof Map ? (Map<String, Object>) doneSumRaw : null;
            Map<String, Object> puntSum = puntSumRaw instanceof Map ? (Map<String, Object>) puntSumRaw : null;

            // Step 5 — extract .value fields
            Object allVal  = allSum  != null ? allSum.get("value")  : null;
            Object doneVal = doneSum != null ? doneSum.get("value") : null;
            Object puntVal = puntSum != null ? puntSum.get("value") : null;
            trace.put("step5_allValueType",  allVal  == null ? "NULL" : allVal.getClass().getName());
            trace.put("step5_doneValueType", doneVal == null ? "NULL" : doneVal.getClass().getName());
            trace.put("step5_puntValueType", puntVal == null ? "NULL" : puntVal.getClass().getName());
            trace.put("step5_allValue",  allVal);
            trace.put("step5_doneValue", doneVal);
            trace.put("step5_puntValue", puntVal);

            // Step 6 — apply instanceof Number check (exact same as buildPodMetrics)
            double allSP    = allVal  instanceof Number ? ((Number) allVal).doubleValue()  : -1;
            double doneSPv  = doneVal instanceof Number ? ((Number) doneVal).doubleValue() : -1;
            double puntSP   = puntVal instanceof Number ? ((Number) puntVal).doubleValue() : 0;
            trace.put("step6_allSP",   allSP);
            trace.put("step6_doneSPv", doneSPv);
            trace.put("step6_puntSP",  puntSP);
            trace.put("step6_conditionPassed", allSP >= 0 && doneSPv >= 0);

            // Step 7 — final result
            if (allSP >= 0 && doneSPv >= 0) {
                trace.put("RESULT_totalSP", allSP - puntSP);
                trace.put("RESULT_doneSP",  doneSPv);
            } else {
                trace.put("RESULT", "FALLBACK (condition failed) — raw SP would be used");
            }

        } catch (Exception e) {
            trace.put("error", e.getMessage());
        }
        return ResponseEntity.ok(trace);
    }

    /**
     * Sprint report debug — calls the Greenhopper sprint report API directly and
     * returns the raw response plus the extracted SP values our code uses.
     *
     * Example: GET /api/jira/debug/board/15/sprint-report
     */
    @GetMapping("/debug/board/{boardId}/sprint-report")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> debugSprintReport(@PathVariable long boardId) {
        if (!creds.isConfigured()) return ResponseEntity.ok(Map.of("error", "Jira not configured"));
        try {
            // Evict cache so we definitely hit the API live
            jiraClient.evictAllCaches();

            List<Map<String, Object>> activeSprints = jiraClient.getActiveSprints(boardId);
            if (activeSprints.isEmpty()) return ResponseEntity.ok(Map.of("error", "No active sprint for board " + boardId));

            Map<String, Object> sprint = activeSprints.get(0);
            long sprintId = ((Number) sprint.get("id")).longValue();
            String sprintName = sprint.get("name") instanceof String ? (String) sprint.get("name") : "?";

            // Fetch the sprint report
            Map<String, Object> report = jiraClient.getSprintReport(boardId, sprintId);

            // Extract the SP values our code reads
            Map<String, Object> extracted = new java.util.LinkedHashMap<>();
            Object contents = report.get("contents");
            if (contents instanceof Map) {
                Map<String, Object> c = (Map<String, Object>) contents;
                extracted.put("allIssuesEstimateSum",       extractValue(c, "allIssuesEstimateSum"));
                extracted.put("completedIssuesEstimateSum", extractValue(c, "completedIssuesEstimateSum"));
                extracted.put("puntedIssuesEstimateSum",    extractValue(c, "puntedIssuesEstimateSum"));
                extracted.put("issuesNotCompletedEstimateSum", extractValue(c, "issuesNotCompletedEstimateSum"));

                double allSP       = numberValue(c, "allIssuesEstimateSum");
                double completedSP = numberValue(c, "completedIssuesEstimateSum");
                double puntedSP    = numberValue(c, "puntedIssuesEstimateSum");
                extracted.put("=> totalSP (all - punted)", allSP - puntedSP);
                extracted.put("=> doneSP  (completed)",    completedSP);
            } else {
                extracted.put("warning", "No 'contents' key in sprint report — report may be empty");
            }

            return ResponseEntity.ok(Map.of(
                    "boardId",    boardId,
                    "sprintId",   sprintId,
                    "sprintName", sprintName,
                    "extracted",  extracted,
                    "rawReport",  report
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }

    @SuppressWarnings("unchecked")
    private static Object extractValue(Map<String, Object> contents, String key) {
        Object wrapper = contents.get(key);
        if (wrapper instanceof Map) return ((Map<?,?>) wrapper).get("value");
        return null;
    }

    @SuppressWarnings("unchecked")
    private static double numberValue(Map<String, Object> contents, String key) {
        Object wrapper = contents.get(key);
        if (wrapper instanceof Map) {
            Object v = ((Map<?,?>) wrapper).get("value");
            if (v instanceof Number) return ((Number) v).doubleValue();
        }
        return 0;
    }

    /**
     * Pods SP debug — for EVERY configured POD, walks the same board→sprint→sprintReport
     * path that buildPodMetrics uses and reports exactly what happens.
     *
     * Evicts all caches first (same as Refresh button) so results are realistic.
     * Call this immediately after seeing wrong SP on the dashboard.
     *
     * Example: GET /api/jira/debug/pods/sp
     */
    @GetMapping("/debug/pods/sp")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> debugPodsSprintReports() {
        if (!creds.isConfigured()) return ResponseEntity.ok(Map.of("error", "Jira not configured"));

        // Evict caches — same as Refresh button
        jiraClient.evictAllCaches();

        List<JiraPod> pods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        List<Map<String, Object>> results = new java.util.ArrayList<>();

        for (JiraPod pod : pods) {
            Map<String, Object> podResult = new java.util.LinkedHashMap<>();
            podResult.put("pod", pod.getPodDisplayName());
            List<Map<String, Object>> boardResults = new java.util.ArrayList<>();

            for (JiraPodBoard boardEntry : pod.getBoards()) {
                Map<String, Object> br = new java.util.LinkedHashMap<>();
                String projectKey = boardEntry.getJiraProjectKey();
                br.put("projectKey", projectKey);
                try {
                    // 1. Get board
                    List<Map<String, Object>> boards = jiraClient.getBoards(projectKey);
                    if (boards.isEmpty()) { br.put("error", "No boards found"); boardResults.add(br); continue; }
                    Map<String, Object> board = boards.stream()
                            .filter(b -> "scrum".equalsIgnoreCase(b.get("type") instanceof String ? (String)b.get("type") : ""))
                            .findFirst().orElse(boards.get(0));
                    long boardId = ((Number) board.get("id")).longValue();
                    br.put("boardId", boardId);
                    br.put("boardName", board.get("name"));

                    // 2. Active sprint
                    List<Map<String, Object>> sprints = jiraClient.getActiveSprints(boardId);
                    if (sprints.isEmpty()) { br.put("activeSprint", "NONE"); boardResults.add(br); continue; }
                    long sprintId = ((Number) sprints.get(0).get("id")).longValue();
                    br.put("sprintId", sprintId);
                    br.put("sprintName", sprints.get(0).get("name"));

                    // 3. Sprint report
                    try {
                        Map<String, Object> sr = jiraClient.getSprintReport(boardId, sprintId);
                        br.put("sprintReportStatus", "SUCCESS");
                        br.put("sprintReportEmpty", sr.isEmpty());
                        Object contents = sr.get("contents");
                        if (contents instanceof Map) {
                            Map<String, Object> c = (Map<String, Object>) contents;
                            br.put("allIssuesEstimateSum",       extractValue(c, "allIssuesEstimateSum"));
                            br.put("completedIssuesEstimateSum", extractValue(c, "completedIssuesEstimateSum"));
                            br.put("puntedIssuesEstimateSum",    extractValue(c, "puntedIssuesEstimateSum"));
                            double all  = numberValue(c, "allIssuesEstimateSum");
                            double done = numberValue(c, "completedIssuesEstimateSum");
                            double punt = numberValue(c, "puntedIssuesEstimateSum");
                            br.put("=> totalSP", all - punt);
                            br.put("=> doneSP",  done);
                        } else {
                            br.put("contentsKey", "MISSING — sprint report may be empty or wrong format");
                        }
                    } catch (Exception srEx) {
                        br.put("sprintReportStatus", "FAILED: " + srEx.getMessage());
                    }

                } catch (Exception e) {
                    br.put("error", e.getMessage());
                }
                boardResults.add(br);
            }
            podResult.put("boards", boardResults);
            results.add(podResult);
        }

        return ResponseEntity.ok(Map.of(
                "note", "Caches were evicted before this call — same as Refresh button",
                "pods", results
        ));
    }

    // ── Credentials endpoints ─────────────────────────────────────────

    /**
     * Returns the currently active Jira credentials (token masked for security).
     * The caller can use this to pre-fill the settings form.
     */
    @GetMapping("/credentials")
    public ResponseEntity<Map<String, Object>> getCredentials() {
        var db = creds.dbCredentials();
        String baseUrl  = db.map(c -> c.getBaseUrl()  != null ? c.getBaseUrl()  : "").orElse("");
        String email    = db.map(c -> c.getEmail()    != null ? c.getEmail()    : "").orElse("");
        boolean hasToken = db.map(c -> c.getApiToken() != null && !c.getApiToken().isBlank()).orElse(false);
        // Return a masked token placeholder so the UI shows "saved" state
        String tokenMask = hasToken ? "••••••••••••••••" : "";
        return ResponseEntity.ok(Map.of(
                "baseUrl",   baseUrl,
                "email",     email,
                "apiToken",  tokenMask,
                "hasToken",  hasToken,
                "configured", creds.isConfigured(),
                "source", db.isPresent() && db.get().isConfigured() ? "database" : "config-file"
        ));
    }

    /**
     * Saves Jira credentials entered via the UI.
     * Pass an empty {@code apiToken} to keep the existing token unchanged.
     */
    @PostMapping("/credentials")
    public ResponseEntity<Map<String, Object>> saveCredentials(
            @RequestBody CredentialsSaveRequest req) {
        // If client sends the mask placeholder, preserve the existing token
        String token = req.apiToken();
        if (token != null && token.startsWith("••")) {
            token = creds.dbCredentials()
                    .map(c -> c.getApiToken() != null ? c.getApiToken() : "")
                    .orElse("");
        }
        creds.save(req.baseUrl(), req.email(), token);
        // Evict all Jira caches since the endpoint may have changed
        jiraClient.evictAllCaches();
        return ResponseEntity.ok(Map.of(
                "saved", true,
                "configured", creds.isConfigured()
        ));
    }

    // ── DTOs ──────────────────────────────────────────────────────────

    public record CredentialsSaveRequest(
            String baseUrl,
            String email,
            String apiToken) {}

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
