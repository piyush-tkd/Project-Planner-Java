package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraCredentialsService;
import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.service.jira.JiraActualsService;
import com.portfolioplanner.service.jira.JiraActualsService.*;
import com.portfolioplanner.service.jira.JiraClient;
import com.portfolioplanner.service.JiraMappingService;
import com.portfolioplanner.service.JiraMappingService.SaveMappingRequest;
import com.portfolioplanner.service.JiraMappingService.MappingResponse;
import com.portfolioplanner.service.JiraPodConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/jira")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class JiraController {

    private final JiraActualsService actualsService;
    private final JiraClient jiraClient;
    private final JiraCredentialsService creds;
    private final com.portfolioplanner.service.jira.JiraSyncScheduler jiraSyncScheduler;
    private final JiraMappingService mappingService;
    private final JiraPodConfigService podConfigService;

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
    @PreAuthorize("hasRole('ADMIN')")
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

    @GetMapping("/mappings")
    public ResponseEntity<List<MappingResponse>> getMappings() {
        return ResponseEntity.ok(mappingService.getMappings());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/mappings")
    public ResponseEntity<MappingResponse> saveMapping(@RequestBody SaveMappingRequest req) {
        return ResponseEntity.ok(mappingService.saveMapping(req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/mappings/bulk")
    public ResponseEntity<List<MappingResponse>> saveMappingsBulk(
            @RequestBody List<SaveMappingRequest> requests) {
        return ResponseEntity.ok(mappingService.saveMappingsBulk(requests));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/mappings/{id}")
    public ResponseEntity<Void> deleteMapping(@PathVariable Long id) {
        mappingService.deleteMapping(id);
        return ResponseEntity.noContent().build();
    }

    /** Fetch actuals from Jira and compare against PP estimates */
    @GetMapping("/actuals")
    public ResponseEntity<List<ActualsRow>> getActuals() {
        return ResponseEntity.ok(actualsService.getActuals());
    }

    /**
     * Lightweight project list — just key + name, no epics or labels.
     * Returns only POD-board-mapped projects — used in filter dropdowns on data pages.
     */
    @GetMapping("/projects/simple")
    public ResponseEntity<List<SimpleProject>> getProjectsSimple() {
        return ResponseEntity.ok(actualsService.getSimpleProjects());
    }

    /**
     * Returns all Jira projects visible to the configured account.
     * Used in settings pages where the full project list is needed
     * (board-picker, project linking).
     */
    @GetMapping("/projects/all-simple")
    public ResponseEntity<List<SimpleProject>> getAllProjectsSimple() {
        return ResponseEntity.ok(actualsService.getAllSimpleProjects());
    }

    /**
     * Executes a Jira JQL search and returns results shaped for the
     * "Import Initiatives" modal.  The caller supplies the full JQL so
     * they can target any issue type (Initiative, Epic, custom).
     *
     * Query param: jql — default finds issues of type "Initiative".
     *
     * Response shape per item:
     *   { key, name, status, startDate, dueDate, assignee, issueType }
     */
    @SuppressWarnings("unchecked")
    @GetMapping("/initiatives")
    public ResponseEntity<List<Map<String, Object>>> getInitiatives(
            @RequestParam(defaultValue = "issuetype = \"Initiative\" ORDER BY created DESC") String jql) {
        if (!creds.isConfigured()) {
            return ResponseEntity.ok(List.of());
        }
        List<Map<String, Object>> raw;
        try {
            raw = jiraClient.searchByJql(jql);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(List.of(
                Map.of("error", e.getMessage() != null ? e.getMessage() : "JQL search failed")
            ));
        }
        List<Map<String, Object>> result = raw.stream().map(issue -> {
            Map<String, Object> out = new java.util.LinkedHashMap<>();
            out.put("key", issue.getOrDefault("key", ""));
            Object fieldsRaw = issue.get("fields");
            if (fieldsRaw instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> f = (Map<String, Object>) fieldsRaw;
                out.put("name", f.getOrDefault("summary", ""));
                // Status — return both name and category so the frontend can map it
                Object statusObj = f.get("status");
                if (statusObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> s = (Map<String, Object>) statusObj;
                    out.put("status", s.getOrDefault("name", ""));
                    Object cat = s.get("statusCategory");
                    if (cat instanceof Map<?,?> catMap) {
                        Object keyVal = catMap.get("key");
                        out.put("statusCategory", keyVal instanceof String ? keyVal : "");
                    }
                } else {
                    out.put("status", "");
                }
                // Priority — name only (Highest / High / Medium / Low / Lowest)
                Object priorityObj = f.get("priority");
                if (priorityObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> p = (Map<String, Object>) priorityObj;
                    out.put("priority", p.getOrDefault("name", "Medium"));
                } else {
                    out.put("priority", "Medium");
                }
                // Start date (Jira Cloud: customfield_10015)
                out.put("startDate", f.getOrDefault("customfield_10015", null));
                // Due date
                out.put("dueDate", f.getOrDefault("duedate", null));
                // Assignee
                Object assigneeObj = f.get("assignee");
                if (assigneeObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> a = (Map<String, Object>) assigneeObj;
                    out.put("assignee", a.getOrDefault("displayName", ""));
                } else {
                    out.put("assignee", "");
                }
                // Issue type name (so UI can show it)
                Object itObj = f.get("issuetype");
                if (itObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> it = (Map<String, Object>) itObj;
                    out.put("issueType", it.getOrDefault("name", ""));
                } else {
                    out.put("issueType", "");
                }
            } else {
                out.put("name", "");
                out.put("status", "");
                out.put("priority", "Medium");
                out.put("startDate", null);
                out.put("dueDate", null);
                out.put("assignee", "");
                out.put("issueType", "");
            }
            return out;
        }).collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /**
     * Manually trigger a sync of all JIRA_SYNCED projects against live Jira data.
     * Updates name, startDate, and targetDate from Jira. User-managed fields
     * (priority, notes, budget, owner) are never overwritten.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/sync/projects")
    public ResponseEntity<Map<String, Object>> syncProjects() {
        com.portfolioplanner.service.jira.JiraSyncScheduler.SyncResult result =
                jiraSyncScheduler.syncJiraProjects();
        return ResponseEntity.ok(Map.of(
                "updated", result.updated(),
                "errors",  result.errors(),
                "skipped", result.skipped()
        ));
    }

    /**
     * Bust all Jira API caches so the next calls re-fetch live data.
     * Returns 200 OK with a count of caches cleared.
     */
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/debug/pods/sp")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> debugPodsSprintReports() {
        if (!creds.isConfigured()) return ResponseEntity.ok(Map.of("error", "Jira not configured"));

        // Evict caches — same as Refresh button
        jiraClient.evictAllCaches();

        List<JiraPod> pods = podConfigService.getEnabledPods();
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
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasRole('ADMIN')")
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
}
