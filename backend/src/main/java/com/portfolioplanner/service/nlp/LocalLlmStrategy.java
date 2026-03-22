package com.portfolioplanner.service.nlp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Local LLM strategy using Ollama-compatible API (http://localhost:11434/api/generate).
 * Availability depends on Ollama running locally.
 *
 * Enhanced with:
 * - Semantic vector search for selective context injection (instead of full catalog dump)
 * - Tool calling framework: LLM can request specific data via structured JSON tool calls
 * - Two-turn flow: query → tool call → tool result → final synthesis
 *
 * This strategy acts as a powerful safety net for queries the rule-based engine misses.
 * It uses vector similarity to inject only the most relevant entities into the context,
 * keeping the prompt small and focused.
 */
@Component
public class LocalLlmStrategy implements NlpStrategy {

    private static final Logger log = LoggerFactory.getLogger(LocalLlmStrategy.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final NlpVectorSearchService vectorSearchService;
    private final NlpToolRegistry toolRegistry;

    // These are set by NlpConfigService when config loads/changes
    private String modelUrl = "http://localhost:11434";
    private String model = "llama3:8b";
    private int timeoutMs = 10000;
    private volatile boolean lastHealthCheck = false;

    public LocalLlmStrategy(NlpVectorSearchService vectorSearchService,
                             NlpToolRegistry toolRegistry) {
        this.vectorSearchService = vectorSearchService;
        this.toolRegistry = toolRegistry;
    }

    @Override
    public String name() {
        return "LOCAL_LLM";
    }

    @Override
    public boolean isAvailable() {
        try {
            RestTemplate rt = new RestTemplate();
            ResponseEntity<String> resp = rt.getForEntity(modelUrl + "/api/tags", String.class);
            lastHealthCheck = resp.getStatusCode().is2xxSuccessful();
            return lastHealthCheck;
        } catch (Exception e) {
            lastHealthCheck = false;
            return false;
        }
    }

    public void configure(String modelUrl, String model, int timeoutMs) {
        this.modelUrl = modelUrl;
        this.model = model;
        this.timeoutMs = timeoutMs;
    }

    @Override
    public NlpResult classify(String query, NlpCatalogResponse catalog) {
        try {
            // ── Step 1: Vector search for selective context ──
            String vectorContext = "";
            if (vectorSearchService != null) {
                var searchResults = vectorSearchService.search(query, 10);
                vectorContext = vectorSearchService.buildContextFromResults(searchResults);
                if (!vectorContext.isBlank()) {
                    log.debug("LOCAL_LLM: vector search found {} relevant entities", searchResults.size());
                }
            }

            // ── Step 2: First LLM call (with vector context + tool definitions) ──
            String systemPrompt = buildSystemPrompt(catalog, vectorContext);
            String firstResponse = callOllama(query, systemPrompt);
            if (firstResponse == null) return lowConfidenceResult();

            // ── Step 3: Check if LLM wants to call a tool ──
            JsonNode firstJson = parseRawJson(firstResponse);
            if (firstJson != null && toolRegistry.isToolCall(firstJson)) {
                String toolName = firstJson.path("tool").asText();
                JsonNode toolParams = firstJson.path("params");
                log.info("LOCAL_LLM: tool call detected — {} with params {}", toolName, toolParams);

                // Execute the tool
                NlpToolRegistry.ToolResult toolResult = toolRegistry.executeTool(toolName, toolParams, catalog);
                log.debug("LOCAL_LLM: tool result success={}", toolResult.success());

                // ── Step 4: Second LLM call with tool result ──
                String synthesisPrompt = buildSynthesisPrompt(query, toolName, toolResult, vectorContext);
                String secondResponse = callOllama(query, synthesisPrompt);
                if (secondResponse != null) {
                    return parseJsonResponse(secondResponse, catalog);
                }
            }

            // No tool call — parse the first response directly
            return parseJsonResponse(firstResponse, catalog);

        } catch (Exception e) {
            log.warn("LOCAL_LLM classification failed: {}", e.getMessage());
            return lowConfidenceResult();
        }
    }

    /**
     * Make a single call to Ollama /api/generate and return the response text.
     */
    private String callOllama(String query, String systemPrompt) {
        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                    "model", model,
                    "prompt", query,
                    "system", systemPrompt,
                    "stream", false,
                    "format", "json",
                    "options", Map.of(
                            "temperature", 0.1,
                            "num_predict", 1024
                    )
            ));

            RestTemplate rt = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(payload, headers);

            ResponseEntity<String> resp = rt.postForEntity(
                    modelUrl + "/api/generate", entity, String.class);

            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                log.warn("LOCAL_LLM returned non-200: {}", resp.getStatusCode());
                return null;
            }

            JsonNode root = objectMapper.readTree(resp.getBody());
            return root.path("response").asText("");
        } catch (Exception e) {
            log.warn("LOCAL_LLM Ollama call failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Parse raw JSON from the LLM response, handling markdown code blocks.
     */
    private JsonNode parseRawJson(String json) {
        try {
            json = json.trim();
            if (json.startsWith("```")) {
                json = json.replaceAll("^```(?:json)?\\s*", "").replaceAll("```\\s*$", "").trim();
            }
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Build a synthesis prompt for the second LLM call after tool execution.
     */
    private String buildSynthesisPrompt(String originalQuery, String toolName,
                                         NlpToolRegistry.ToolResult toolResult,
                                         String vectorContext) {
        StringBuilder sb = new StringBuilder(2048);

        sb.append("""
                You are an expert intent classifier for a Portfolio Planning tool.
                The user asked a question. You called a tool to fetch data. Now synthesize the answer.

                Given the user's original query and the tool result below, return ONLY a valid JSON object:
                {
                  "intent": "one of: GREETING, NAVIGATE, FORM_PREFILL, DATA_QUERY, INSIGHT, HELP, EXPORT",
                  "confidence": 0.0 to 1.0,
                  "message": "human-readable conversational answer using the tool data",
                  "route": "frontend page route or null",
                  "formData": null,
                  "data": { structured data with _type marker },
                  "drillDown": "route for drill-down or null",
                  "suggestions": ["2-3 follow-up suggestions"]
                }

                """);

        // Include _type markers reference (compact version)
        sb.append(buildTypeMarkersCompact());

        sb.append("\nTOOL CALLED: ").append(toolName).append("\n");
        if (toolResult.success()) {
            sb.append("TOOL RESULT:\n").append(toolResult.data()).append("\n\n");
        } else {
            sb.append("TOOL ERROR: ").append(toolResult.error()).append("\n\n");
            sb.append("Since the tool failed, try to answer from the context below or inform the user.\n\n");
        }

        if (!vectorContext.isBlank()) {
            sb.append(vectorContext).append("\n");
        }

        sb.append("Return ONLY the JSON object. No text before or after it.");
        return sb.toString();
    }

    // ────────────────────────────────────────────────────────────────────────
    // JSON response parsing with entity enrichment
    // ────────────────────────────────────────────────────────────────────────

    private NlpResult parseJsonResponse(String json, NlpCatalogResponse catalog) {
        try {
            // The LLM may wrap JSON in markdown code blocks — strip them
            json = json.trim();
            if (json.startsWith("```")) {
                json = json.replaceAll("^```(?:json)?\\s*", "").replaceAll("```\\s*$", "").trim();
            }

            JsonNode node = objectMapper.readTree(json);
            String intent = node.path("intent").asText("UNKNOWN");
            double confidence = node.path("confidence").asDouble(0.5);
            String message = node.path("message").asText("");
            String route = node.has("route") && !node.path("route").isNull()
                    ? node.path("route").asText() : null;

            Map<String, Object> formData = null;
            if (node.has("formData") && node.path("formData").isObject()) {
                formData = objectMapper.convertValue(node.path("formData"),
                        objectMapper.getTypeFactory().constructMapType(
                                LinkedHashMap.class, String.class, Object.class));
            }

            Map<String, Object> data = null;
            if (node.has("data") && node.path("data").isObject()) {
                data = objectMapper.convertValue(node.path("data"),
                        objectMapper.getTypeFactory().constructMapType(
                                LinkedHashMap.class, String.class, Object.class));
            }

            String drillDown = node.has("drillDown") && !node.path("drillDown").isNull()
                    ? node.path("drillDown").asText() : null;

            List<String> suggestions = new ArrayList<>();
            if (node.has("suggestions") && node.path("suggestions").isArray()) {
                node.path("suggestions").forEach(s -> suggestions.add(s.asText()));
            }

            // ── Post-process: enrich data with catalog lookups when LLM identifies an entity ──
            if (data != null && catalog != null) {
                data = enrichDataFromCatalog(data, catalog);
                // If enrichment set a specific drillDown, use it instead of LLM's generic one
                if (data.containsKey("_drillDown")) {
                    drillDown = data.remove("_drillDown").toString();
                }
            }

            return new NlpResult(intent, confidence, message, route, formData, data, drillDown, suggestions);

        } catch (Exception e) {
            log.warn("Failed to parse LOCAL_LLM JSON response: {}", e.getMessage());
            return lowConfidenceResult();
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Post-process: enrich LLM-produced data with real catalog values
    // ────────────────────────────────────────────────────────────────────────

    /**
     * The LLM identifies the entity and _type, but may not have all the details.
     * We look up the entity in the catalog and fill in rich card data.
     */
    private Map<String, Object> enrichDataFromCatalog(Map<String, Object> data,
                                                       NlpCatalogResponse catalog) {
        String type = data.get("_type") != null ? data.get("_type").toString() : null;

        String entityName = data.get("entityName") != null
                ? data.get("entityName").toString() : null;

        // If _type is missing but entityName is present, try to infer the type
        if (type == null && entityName != null) {
            type = inferTypeFromEntityName(entityName, catalog);
            if (type != null) {
                data.put("_type", type);
                log.debug("Inferred _type={} for entityName={}", type, entityName);
            } else {
                return data;
            }
        }
        if (type == null) return data;

        switch (type) {
            case "RESOURCE_PROFILE" -> {
                if (entityName != null && catalog.resourceDetails() != null) {
                    var res = catalog.resourceDetails().stream()
                            .filter(r -> r.name().toLowerCase().contains(entityName.toLowerCase()))
                            .findFirst().orElse(null);
                    if (res != null) {
                        Map<String, Object> enriched = new LinkedHashMap<>();
                        enriched.put("_type", "RESOURCE_PROFILE");
                        enriched.put("_entityId", res.id());
                        enriched.put("_drillDown", "/resources?highlight=" + res.id());
                        enriched.put("Name", res.name());
                        enriched.put("Role", res.role());
                        enriched.put("Location", res.location());
                        enriched.put("POD", res.podName() != null ? res.podName() : "Unassigned");
                        enriched.put("Billing Rate", res.billingRate());
                        enriched.put("FTE", res.fte());
                        return enriched;
                    }
                }
            }
            case "PROJECT_PROFILE" -> {
                if (entityName != null && catalog.projectDetails() != null) {
                    var proj = catalog.projectDetails().stream()
                            .filter(p -> p.name().toLowerCase().contains(entityName.toLowerCase()))
                            .findFirst().orElse(null);
                    if (proj != null) {
                        Map<String, Object> enriched = new LinkedHashMap<>();
                        enriched.put("_type", "PROJECT_PROFILE");
                        enriched.put("_entityId", proj.id());
                        enriched.put("_drillDown", "/projects/" + proj.id());
                        enriched.put("Name", proj.name());
                        enriched.put("Priority", proj.priority());
                        enriched.put("Owner", proj.owner());
                        enriched.put("Status", formatStatus(proj.status()));
                        enriched.put("Timeline", proj.timeline());
                        enriched.put("Duration", proj.durationMonths() + " months");
                        enriched.put("Assigned Pods", proj.assignedPods());
                        if (proj.client() != null) enriched.put("Client", proj.client());
                        return enriched;
                    }
                }
            }
            case "POD_PROFILE" -> {
                if (entityName != null && catalog.podDetails() != null) {
                    var pod = catalog.podDetails().stream()
                            .filter(p -> p.name().toLowerCase().contains(entityName.toLowerCase()))
                            .findFirst().orElse(null);
                    if (pod != null) {
                        Map<String, Object> enriched = new LinkedHashMap<>();
                        enriched.put("_type", "POD_PROFILE");
                        enriched.put("_entityId", pod.id());
                        enriched.put("_drillDown", "/pods/" + pod.id());
                        enriched.put("Name", pod.name());
                        enriched.put("Members", String.valueOf(pod.memberCount()));
                        enriched.put("Projects", String.valueOf(pod.projectCount()));
                        enriched.put("Avg BAU %", pod.avgBauPct());
                        enriched.put("Active", pod.active() ? "Yes" : "No");
                        if (!pod.members().isEmpty()) {
                            enriched.put("Team", String.join(", ", pod.members()));
                        }
                        if (!pod.projectNames().isEmpty()) {
                            enriched.put("Project List", String.join(", ", pod.projectNames()));
                        }
                        return enriched;
                    }
                }
            }
            case "SPRINT_PROFILE" -> {
                if (entityName != null && catalog.sprintDetails() != null) {
                    var sprint = catalog.sprintDetails().stream()
                            .filter(s -> s.name().toLowerCase().contains(entityName.toLowerCase()))
                            .findFirst().orElse(null);
                    if (sprint != null) {
                        Map<String, Object> enriched = new LinkedHashMap<>();
                        enriched.put("_type", "SPRINT_PROFILE");
                        enriched.put("Name", sprint.name());
                        enriched.put("Type", sprint.type());
                        enriched.put("Start", sprint.startDate());
                        enriched.put("End", sprint.endDate());
                        enriched.put("Lock-in", sprint.lockInDate());
                        enriched.put("Status", sprint.status());
                        return enriched;
                    }
                }
            }
            case "RELEASE_PROFILE" -> {
                if (entityName != null && catalog.releaseDetails() != null) {
                    var rel = catalog.releaseDetails().stream()
                            .filter(r -> r.name().toLowerCase().contains(entityName.toLowerCase()))
                            .findFirst().orElse(null);
                    if (rel != null) {
                        Map<String, Object> enriched = new LinkedHashMap<>();
                        enriched.put("_type", "RELEASE_PROFILE");
                        enriched.put("Name", rel.name());
                        enriched.put("Release Date", rel.releaseDate());
                        enriched.put("Code Freeze", rel.codeFreezeDate());
                        enriched.put("Type", rel.type());
                        enriched.put("Status", rel.status());
                        if (rel.notes() != null) enriched.put("Notes", rel.notes());
                        return enriched;
                    }
                }
            }
            case "LIST" -> {
                // LLM might return a list type with entityName as the filter value
                // Enrich with real project/resource lists
                return enrichListFromCatalog(data, catalog);
            }
            case "COST_RATE" -> {
                if (catalog.costRates() != null && !catalog.costRates().isEmpty()) {
                    Map<String, Object> enriched = new LinkedHashMap<>();
                    enriched.put("_type", "COST_RATE");
                    // Include the rates the LLM might have referenced
                    String filterRole = data.get("filterRole") != null
                            ? data.get("filterRole").toString().toUpperCase() : null;
                    String filterLoc = data.get("filterLocation") != null
                            ? data.get("filterLocation").toString().toUpperCase() : null;
                    var rates = catalog.costRates().stream()
                            .filter(r -> filterRole == null || r.role().equalsIgnoreCase(filterRole))
                            .filter(r -> filterLoc == null || r.location().equalsIgnoreCase(filterLoc))
                            .toList();
                    for (var rate : rates) {
                        enriched.put(rate.role() + " (" + rate.location() + ")",
                                "$" + rate.hourlyRate() + "/hr");
                    }
                    if (enriched.size() == 1) {
                        // Only _type, add all rates
                        for (var rate : catalog.costRates()) {
                            enriched.put(rate.role() + " (" + rate.location() + ")",
                                    "$" + rate.hourlyRate() + "/hr");
                        }
                    }
                    return enriched;
                }
            }
            case "CAPABILITIES" -> {
                Map<String, Object> enriched = new LinkedHashMap<>(data);
                return enriched;
            }
            case "PROJECT_ESTIMATES" -> {
                if (entityName != null && catalog.projectEstimates() != null) {
                    var est = catalog.projectEstimates().stream()
                            .filter(e -> e.projectName().toLowerCase().contains(entityName.toLowerCase()))
                            .findFirst().orElse(null);
                    if (est != null) {
                        Map<String, Object> enriched = new LinkedHashMap<>();
                        enriched.put("_type", "PROJECT_ESTIMATES");
                        enriched.put("Project", est.projectName());
                        enriched.put("Dev Hours", est.totalDevHours());
                        enriched.put("QA Hours", est.totalQaHours());
                        enriched.put("BSA Hours", est.totalBsaHours());
                        enriched.put("Tech Lead Hours", est.totalTechLeadHours());
                        enriched.put("Grand Total Hours", est.grandTotalHours());
                        enriched.put("POD Count", String.valueOf(est.podCount()));
                        List<Map<String, String>> podBreakdown = new ArrayList<>();
                        for (var pod : est.podEstimates()) {
                            Map<String, String> podMap = new LinkedHashMap<>();
                            podMap.put("POD", pod.podName());
                            podMap.put("Dev", pod.devHours());
                            podMap.put("QA", pod.qaHours());
                            podMap.put("BSA", pod.bsaHours());
                            podMap.put("TL", pod.techLeadHours());
                            podMap.put("Total", pod.totalHours());
                            podMap.put("Contingency", pod.contingencyPct());
                            podMap.put("Pattern", pod.effortPattern());
                            podMap.put("Release", pod.targetRelease());
                            podBreakdown.add(podMap);
                        }
                        enriched.put("podBreakdown", podBreakdown);
                        return enriched;
                    }
                }
            }
            case "SPRINT_ALLOCATIONS" -> {
                if (catalog.sprintAllocations() != null) {
                    List<NlpCatalogResponse.SprintAllocationInfo> filtered;
                    if (entityName != null && !"current".equalsIgnoreCase(entityName)) {
                        filtered = catalog.sprintAllocations().stream()
                                .filter(a -> a.sprintName().toLowerCase().contains(entityName.toLowerCase())
                                        || a.projectName().toLowerCase().contains(entityName.toLowerCase())
                                        || a.podName().toLowerCase().contains(entityName.toLowerCase()))
                                .toList();
                    } else {
                        filtered = catalog.sprintAllocations().stream()
                                .filter(a -> "Active".equals(a.sprintStatus())).toList();
                    }
                    if (!filtered.isEmpty()) {
                        Map<String, Object> enriched = new LinkedHashMap<>();
                        enriched.put("_type", "SPRINT_ALLOCATIONS");
                        enriched.put("Title", "Sprint Allocations");
                        enriched.put("Count", String.valueOf(filtered.size()));
                        List<Map<String, String>> items = new ArrayList<>();
                        for (var a : filtered) {
                            Map<String, String> item = new LinkedHashMap<>();
                            item.put("Sprint", a.sprintName());
                            item.put("Project", a.projectName());
                            item.put("POD", a.podName());
                            item.put("Dev", a.devHours());
                            item.put("QA", a.qaHours());
                            item.put("BSA", a.bsaHours());
                            item.put("TL", a.techLeadHours());
                            item.put("Total", a.totalHours());
                            items.add(item);
                        }
                        enriched.put("allocations", items);
                        return enriched;
                    }
                }
            }
            case "RESOURCE_AVAILABILITY" -> {
                if (entityName != null && catalog.resourceAvailabilities() != null) {
                    var filtered = catalog.resourceAvailabilities().stream()
                            .filter(a -> a.resourceName().toLowerCase().contains(entityName.toLowerCase()))
                            .toList();
                    if (!filtered.isEmpty()) {
                        Map<String, Object> enriched = new LinkedHashMap<>();
                        enriched.put("_type", "RESOURCE_AVAILABILITY");
                        enriched.put("Title", entityName + "'s Availability");
                        enriched.put("Count", String.valueOf(filtered.size()));
                        List<Map<String, String>> items = new ArrayList<>();
                        for (var a : filtered) {
                            Map<String, String> item = new LinkedHashMap<>();
                            item.put("Resource", a.resourceName());
                            item.put("Role", a.role());
                            item.put("Month", a.monthLabel());
                            item.put("Hours", a.availableHours());
                            items.add(item);
                        }
                        enriched.put("entries", items);
                        return enriched;
                    }
                }
            }
            case "PROJECT_DEPENDENCIES" -> {
                if (catalog.projectDependencies() != null) {
                    List<NlpCatalogResponse.ProjectDependencyInfo> filtered;
                    if (entityName != null) {
                        filtered = catalog.projectDependencies().stream()
                                .filter(d -> d.projectName().toLowerCase().contains(entityName.toLowerCase())
                                        || d.blockedByName().toLowerCase().contains(entityName.toLowerCase()))
                                .toList();
                    } else {
                        filtered = catalog.projectDependencies();
                    }
                    if (!filtered.isEmpty()) {
                        Map<String, Object> enriched = new LinkedHashMap<>();
                        enriched.put("_type", "PROJECT_DEPENDENCIES");
                        enriched.put("Title", "Project Dependencies");
                        enriched.put("Count", String.valueOf(filtered.size()));
                        List<Map<String, String>> items = new ArrayList<>();
                        for (var d : filtered) {
                            Map<String, String> item = new LinkedHashMap<>();
                            item.put("Project", d.projectName());
                            item.put("Blocked By", d.blockedByName());
                            item.put("Status", formatStatus(d.projectStatus()));
                            item.put("Blocker Status", formatStatus(d.blockedByStatus()));
                            items.add(item);
                        }
                        enriched.put("dependencies", items);
                        return enriched;
                    }
                }
            }
            case "PROJECT_ACTUALS" -> {
                if (entityName != null && catalog.projectActuals() != null) {
                    var filtered = catalog.projectActuals().stream()
                            .filter(a -> a.projectName().toLowerCase().contains(entityName.toLowerCase()))
                            .toList();
                    if (!filtered.isEmpty()) {
                        Map<String, Object> enriched = new LinkedHashMap<>();
                        enriched.put("_type", "PROJECT_ACTUALS");
                        enriched.put("Title", "Actual Hours for " + entityName);
                        enriched.put("Count", String.valueOf(filtered.size()));
                        List<Map<String, String>> items = new ArrayList<>();
                        for (var a : filtered) {
                            Map<String, String> item = new LinkedHashMap<>();
                            item.put("Project", a.projectName());
                            item.put("Month", a.monthLabel());
                            item.put("Actual Hours", a.actualHours());
                            items.add(item);
                        }
                        enriched.put("entries", items);
                        return enriched;
                    }
                }
            }
            case "EFFORT_PATTERN" -> {
                if (catalog.effortPatterns() != null && !catalog.effortPatterns().isEmpty()) {
                    Map<String, Object> enriched = new LinkedHashMap<>();
                    enriched.put("_type", "EFFORT_PATTERN_LIST");
                    enriched.put("Title", "Available Effort Patterns");
                    enriched.put("Count", String.valueOf(catalog.effortPatterns().size()));
                    List<Map<String, String>> items = new ArrayList<>();
                    for (var ep : catalog.effortPatterns()) {
                        Map<String, String> item = new LinkedHashMap<>();
                        item.put("Name", ep.name());
                        item.put("Description", ep.description());
                        items.add(item);
                    }
                    enriched.put("patterns", items);
                    return enriched;
                }
            }
            case "ROLE_EFFORT_MIX" -> {
                if (catalog.roleEffortMixes() != null && !catalog.roleEffortMixes().isEmpty()) {
                    Map<String, Object> enriched = new LinkedHashMap<>();
                    enriched.put("_type", "ROLE_EFFORT_MIX");
                    enriched.put("Title", "Standard Role Effort Mix");
                    List<Map<String, String>> items = new ArrayList<>();
                    for (var mix : catalog.roleEffortMixes()) {
                        Map<String, String> item = new LinkedHashMap<>();
                        item.put("Role", mix.role());
                        item.put("Mix %", mix.mixPct());
                        items.add(item);
                    }
                    enriched.put("roles", items);
                    return enriched;
                }
            }
        }
        return data;
    }

    /**
     * Enrich LIST-type responses by looking up actual entities from the catalog.
     */
    private Map<String, Object> enrichListFromCatalog(Map<String, Object> data,
                                                       NlpCatalogResponse catalog) {
        String listType = data.get("listType") != null ? data.get("listType").toString() : null;
        String filterValue = data.get("filterValue") != null ? data.get("filterValue").toString() : null;

        if ("PROJECTS".equals(listType) && filterValue != null && catalog.projectDetails() != null) {
            // Filter projects by owner name
            List<NlpCatalogResponse.ProjectInfo> matches = catalog.projectDetails().stream()
                    .filter(p -> p.owner().toLowerCase().contains(filterValue.toLowerCase()))
                    .toList();

            // Also try pod name
            if (matches.isEmpty() && catalog.podDetails() != null) {
                var pod = catalog.podDetails().stream()
                        .filter(p -> p.name().toLowerCase().contains(filterValue.toLowerCase()))
                        .findFirst().orElse(null);
                if (pod != null && !pod.projectNames().isEmpty()) {
                    matches = catalog.projectDetails().stream()
                            .filter(p -> pod.projectNames().stream()
                                    .anyMatch(pn -> pn.equalsIgnoreCase(p.name())))
                            .toList();
                    if (!matches.isEmpty()) {
                        Map<String, Object> enriched = new LinkedHashMap<>();
                        enriched.put("_type", "LIST");
                        enriched.put("listType", "PROJECTS");
                        enriched.put("Pod", pod.name());
                        enriched.put("Count", String.valueOf(matches.size()));
                        for (int j = 0; j < matches.size(); j++) {
                            var p = matches.get(j);
                            enriched.put("#" + (j + 1), p.name() + " [" + p.priority() + "] — "
                                    + formatStatus(p.status()) + " (Owner: " + p.owner() + ")");
                        }
                        return enriched;
                    }
                }
            }

            if (!matches.isEmpty()) {
                Map<String, Object> enriched = new LinkedHashMap<>();
                enriched.put("_type", "LIST");
                enriched.put("listType", "PROJECTS");
                enriched.put("Owner", matches.get(0).owner());
                enriched.put("Count", String.valueOf(matches.size()));
                for (int j = 0; j < matches.size(); j++) {
                    var p = matches.get(j);
                    enriched.put("#" + (j + 1), p.name() + " [" + p.priority() + "] — "
                            + formatStatus(p.status()));
                }
                return enriched;
            }
        }

        if ("RESOURCES".equals(listType) && filterValue != null && catalog.resourceDetails() != null) {
            List<NlpCatalogResponse.ResourceInfo> matches = catalog.resourceDetails().stream()
                    .filter(r -> r.role() != null && r.role().toLowerCase().contains(filterValue.toLowerCase())
                            || r.location() != null && r.location().toLowerCase().contains(filterValue.toLowerCase())
                            || r.podName() != null && r.podName().toLowerCase().contains(filterValue.toLowerCase()))
                    .toList();
            if (!matches.isEmpty()) {
                Map<String, Object> enriched = new LinkedHashMap<>();
                enriched.put("_type", "LIST");
                enriched.put("listType", "RESOURCES");
                enriched.put("Filter", filterValue);
                enriched.put("Count", String.valueOf(matches.size()));
                for (int j = 0; j < matches.size(); j++) {
                    var r = matches.get(j);
                    enriched.put("#" + (j + 1), r.name() + " — " + r.role()
                            + " (" + r.location() + ") → " + (r.podName() != null ? r.podName() : "Unassigned"));
                }
                return enriched;
            }
        }

        return data;
    }

    private String formatStatus(String status) {
        if (status == null) return "";
        return switch (status.toUpperCase()) {
            case "NOT_STARTED" -> "Not Started";
            case "IN_DISCOVERY" -> "In Discovery";
            case "ACTIVE" -> "Active";
            case "ON_HOLD" -> "On Hold";
            case "COMPLETED" -> "Completed";
            case "CANCELLED" -> "Cancelled";
            default -> status;
        };
    }

    /**
     * Compact version of _type markers for the synthesis prompt.
     */
    private String buildTypeMarkersCompact() {
        return """
                _TYPE MARKERS (put in data._type):
                RESOURCE_PROFILE, PROJECT_PROFILE, POD_PROFILE, SPRINT_PROFILE, RELEASE_PROFILE,
                LIST (with listType: PROJECTS|RESOURCES|PODS), COMPARISON, NAVIGATE_ACTION,
                RISK_SUMMARY, RESOURCE_ANALYTICS, COST_RATE, EXPORT, CAPABILITIES,
                PROJECT_ESTIMATES, SPRINT_ALLOCATIONS, RESOURCE_AVAILABILITY,
                PROJECT_DEPENDENCIES, PROJECT_ACTUALS, EFFORT_PATTERN, ROLE_EFFORT_MIX
                Include entityName in data when referencing a specific entity.

                """;
    }

    private NlpResult lowConfidenceResult() {
        return new NlpResult("UNKNOWN", 0.0, null, null, null, null, null, null);
    }

    /**
     * When the LLM omits _type but includes entityName, try to infer what type
     * of entity it is by matching against known names in the catalog.
     */
    private String inferTypeFromEntityName(String entityName, NlpCatalogResponse catalog) {
        String lower = entityName.toLowerCase().trim();
        if (catalog.projectDetails() != null) {
            for (var p : catalog.projectDetails()) {
                if (p.name().equalsIgnoreCase(lower) || p.name().toLowerCase().contains(lower) || lower.contains(p.name().toLowerCase())) {
                    return "PROJECT_PROFILE";
                }
            }
        }
        if (catalog.resourceDetails() != null) {
            for (var r : catalog.resourceDetails()) {
                if (r.name().equalsIgnoreCase(lower) || r.name().toLowerCase().contains(lower) || lower.contains(r.name().toLowerCase())) {
                    return "RESOURCE_PROFILE";
                }
            }
        }
        if (catalog.podDetails() != null) {
            for (var p : catalog.podDetails()) {
                if (p.name().equalsIgnoreCase(lower) || p.name().toLowerCase().contains(lower) || lower.contains(p.name().toLowerCase())) {
                    return "POD_PROFILE";
                }
            }
        }
        if (catalog.sprintDetails() != null) {
            for (var s : catalog.sprintDetails()) {
                if (s.name().equalsIgnoreCase(lower) || s.name().toLowerCase().contains(lower) || lower.contains(s.name().toLowerCase())) {
                    return "SPRINT_PROFILE";
                }
            }
        }
        if (catalog.releaseDetails() != null) {
            for (var r : catalog.releaseDetails()) {
                if (r.name().equalsIgnoreCase(lower) || r.name().toLowerCase().contains(lower) || lower.contains(r.name().toLowerCase())) {
                    return "RELEASE_PROFILE";
                }
            }
        }
        return null;
    }

    // ────────────────────────────────────────────────────────────────────────
    // System prompt — the brain of the LLM strategy
    // ────────────────────────────────────────────────────────────────────────

    private String buildSystemPrompt(NlpCatalogResponse catalog, String vectorContext) {
        StringBuilder sb = new StringBuilder(4096);

        // ── Role & output format ────────────────────────────────────────────
        sb.append("""
                You are an expert intent classifier and entity extractor for a Portfolio Planning tool \
                (Baylor Genetics resource/project management system).

                Given a user query, you have TWO options:

                OPTION A — CALL A TOOL (if you need specific data to answer):
                Return: { "tool": "tool_name", "params": { ... } }

                OPTION B — ANSWER DIRECTLY (for greetings, navigation, help, capabilities, or if context is sufficient):
                Return: {
                  "intent": "one of the intents below",
                  "confidence": 0.0 to 1.0,
                  "message": "human-readable answer to the user's question",
                  "route": "frontend page route or null",
                  "formData": { field: value pairs for form pre-fill, or null },
                  "data": { structured response data with _type marker, or null },
                  "drillDown": "route for drill-down link, or null",
                  "suggestions": ["2-3 follow-up query suggestions"]
                }

                CRITICAL RULES:
                - Return ONLY a JSON object, no explanation, no markdown.
                - For GREETING, NAVIGATE, HELP, CAPABILITIES — always answer directly (Option B).
                - For DATA_QUERY about specific entities — use a tool (Option A) to get fresh data.
                - confidence should be 0.85-0.95 when you're confident, 0.5-0.7 if unsure.
                - Always include 2-3 helpful follow-up suggestions when answering directly.
                - The "message" should be a direct, conversational answer.

                """);

        // ── Tool definitions ────────────────────────────────────────────────
        sb.append(toolRegistry.buildToolPromptSection());

        // ── Intents ─────────────────────────────────────────────────────────
        sb.append("""
                INTENTS (in priority order):
                1. GREETING — Hi, hello, hey, good morning. Reply with a friendly greeting + suggestions.
                2. NAVIGATE — "go to pods", "open projects page", "take me to dashboard"
                   → Set route to the matching page route. data._type = "NAVIGATE_ACTION"
                3. FORM_PREFILL — "create a project called X", "add a new developer named Y"
                   → Set route = page + "?action=create", populate formData with field values.
                4. DATA_QUERY — User wants data about specific entities, lists, filters, comparisons.
                   → The data map MUST contain _type marker. See _TYPE MARKERS section.
                5. INSIGHT — "which pods are at risk?", "who is over-allocated?", "hiring needs"
                   → Analytical questions. data._type can be "RISK_SUMMARY" or "RESOURCE_ANALYTICS".
                6. HELP — "what is a pod?", "how do sprints work?", "explain t-shirt sizing"
                   → Return helpful explanation in message. No data needed.
                7. EXPORT — "export projects to CSV", "download resource list"
                   → data._type = "EXPORT", data.exportType = entity type.

                """);

        // ── _type markers for the data map ──────────────────────────────────
        sb.append("""
                _TYPE MARKERS (put in data._type to control frontend card rendering):
                - "RESOURCE_PROFILE" — Single resource lookup. Include entityName for enrichment.
                  data: { "_type": "RESOURCE_PROFILE", "entityName": "John" }
                - "PROJECT_PROFILE" — Single project lookup.
                  data: { "_type": "PROJECT_PROFILE", "entityName": "Portal Redesign" }
                - "POD_PROFILE" — Single pod lookup.
                  data: { "_type": "POD_PROFILE", "entityName": "API" }
                - "SPRINT_PROFILE" — Single sprint lookup.
                  data: { "_type": "SPRINT_PROFILE", "entityName": "Sprint 12" }
                - "RELEASE_PROFILE" — Single release lookup.
                  data: { "_type": "RELEASE_PROFILE", "entityName": "R2.5" }
                - "LIST" — Filtered list of entities.
                  data: { "_type": "LIST", "listType": "PROJECTS|RESOURCES|PODS", "filterValue": "search term" }
                - "COMPARISON" — Compare two entities.
                  data: { "_type": "COMPARISON", "Entity A": "...", "Entity B": "..." }
                - "NAVIGATE_ACTION" — Navigation card with page info.
                  data: { "_type": "NAVIGATE_ACTION", "Page": "Projects", "Action": "Opening..." }
                - "RISK_SUMMARY" — Risk/health analysis.
                  data: { "_type": "RISK_SUMMARY", "riskItems": [...] }
                - "RESOURCE_ANALYTICS" — Resource analytics by role/location.
                  data: { "_type": "RESOURCE_ANALYTICS", "filterRole": "DEVELOPER", "filterLocation": "US" }
                - "COST_RATE" — Cost/billing rate lookup.
                  data: { "_type": "COST_RATE", "filterRole": "DEVELOPER", "filterLocation": "US" }
                - "EXPORT" — Export request.
                  data: { "_type": "EXPORT", "exportType": "projects" }
                - "CAPABILITIES" — What can I do / what are your capabilities.
                  data: { "_type": "CAPABILITIES" }
                - "PROJECT_ESTIMATES" — Project hour estimates/effort breakdown.
                  data: { "_type": "PROJECT_ESTIMATES", "entityName": "SgNIPT" }
                - "SPRINT_ALLOCATIONS" — Sprint-level hour allocations.
                  data: { "_type": "SPRINT_ALLOCATIONS", "entityName": "Sprint 25-01" }
                - "RESOURCE_AVAILABILITY" — Resource monthly availability/capacity.
                  data: { "_type": "RESOURCE_AVAILABILITY", "entityName": "John" }
                - "PROJECT_DEPENDENCIES" — Project blocker/dependency info.
                  data: { "_type": "PROJECT_DEPENDENCIES", "entityName": "SgNIPT" }
                - "PROJECT_ACTUALS" — Actual hours logged against a project.
                  data: { "_type": "PROJECT_ACTUALS", "entityName": "SgNIPT" }
                - "EFFORT_PATTERN" — Effort distribution pattern info.
                  data: { "_type": "EFFORT_PATTERN", "entityName": "Front-loaded" }
                - "ROLE_EFFORT_MIX" — Standard role effort percentages.
                  data: { "_type": "ROLE_EFFORT_MIX" }

                """);

        // ── Synonym handling ────────────────────────────────────────────────
        sb.append("""
                SYNONYM HANDLING (important for matching user intent):
                - "under", "owned by", "belonging to", "managed by", "assigned to" → owner/assignment relationship
                - "team", "squad", "group", "pod" → POD entity
                - "dev", "developer", "engineer", "coder" → DEVELOPER role
                - "qa", "tester", "quality" → QA role
                - "bsa", "analyst", "business analyst" → BSA role
                - "lead", "tech lead", "senior", "principal" → TECH_LEAD role
                - "india", "offshore", "indian team" → INDIA location
                - "us", "onshore", "domestic", "stateside" → US location
                - "stuck", "blocked", "stalled", "delayed" → ON_HOLD or risk
                - "done", "finished", "completed", "closed" → COMPLETED status
                - "new", "upcoming", "not started", "pending" → NOT_STARTED status

                """);

        // ── Form fields for FORM_PREFILL ────────────────────────────────────
        sb.append("""
                FORM FIELDS (for FORM_PREFILL intent):
                Project → route: /projects?action=create
                  fields: { name, priority (P0-P3), owner, startDate (YYYY-MM-DD), targetDate, durationMonths, status, client, notes }
                Resource → route: /resources?action=create
                  fields: { name, role (DEVELOPER|QA|BSA|TECH_LEAD), location (US|INDIA), active (boolean), capacityFte (0.0-1.0) }
                Pod → route: /pods?action=create
                  fields: { name, complexityMultiplier (default 1.0) }
                Override → route: /overrides?action=create
                  fields: { resourceName, toPodName, startMonth (1-12), endMonth (1-12), allocationPct (0-100) }
                Sprint → route: /sprint-calendar?action=create
                  fields: { name, startDate, endDate }
                Release → route: /release-calendar?action=create
                  fields: { name, releaseDate, codeFreezeDate, type (MAJOR|MINOR|PATCH|HOTFIX) }

                """);

        // ── Semantic context from vector search (replaces full catalog dump) ─
        if (vectorContext != null && !vectorContext.isBlank()) {
            sb.append(vectorContext).append("\n");
        }

        // ── Compact entity name lists (for entity name matching) ────────────
        if (catalog != null) {
            sb.append("KNOWN ENTITY NAMES (use tools above to get full details):\n\n");

            if (catalog.resources() != null && !catalog.resources().isEmpty()) {
                sb.append("Resources: ").append(String.join(", ", catalog.resources())).append("\n");
            }
            if (catalog.projects() != null && !catalog.projects().isEmpty()) {
                sb.append("Projects: ").append(String.join(", ", catalog.projects())).append("\n");
            }
            if (catalog.pods() != null && !catalog.pods().isEmpty()) {
                sb.append("Pods: ").append(String.join(", ", catalog.pods())).append("\n");
            }
            if (catalog.sprints() != null && !catalog.sprints().isEmpty()) {
                sb.append("Sprints: ").append(String.join(", ", catalog.sprints())).append("\n");
            }
            if (catalog.releases() != null && !catalog.releases().isEmpty()) {
                sb.append("Releases: ").append(String.join(", ", catalog.releases())).append("\n");
            }
            sb.append("\n");

            // Page routes (compact — needed for NAVIGATE intent)
            if (catalog.pages() != null && !catalog.pages().isEmpty()) {
                sb.append("PAGE ROUTES (for NAVIGATE intent):\n");
                for (var page : catalog.pages()) {
                    sb.append("  ").append(page.route()).append(" = ").append(page.title());
                    if (page.aliases() != null && !page.aliases().isEmpty()) {
                        sb.append(" (aliases: ").append(String.join(", ", page.aliases())).append(")");
                    }
                    sb.append("\n");
                }
                sb.append("\n");
            }

            // Enums (always needed for field values)
            sb.append("ENUMS:\n");
            sb.append("  Priorities: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)\n");
            sb.append("  Roles: DEVELOPER, QA, BSA, TECH_LEAD\n");
            sb.append("  Locations: US, INDIA\n");
            sb.append("  Statuses: NOT_STARTED, IN_DISCOVERY, ACTIVE, ON_HOLD, COMPLETED, CANCELLED\n");
            sb.append("  Release Types: MAJOR, MINOR, PATCH, HOTFIX\n\n");
        }

        // ── Examples ────────────────────────────────────────────────────────
        sb.append("""
                EXAMPLES:
                Query: "give me all projects under BD"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here are the projects under BD.", "data": { "_type": "LIST", "listType": "PROJECTS", "filterValue": "BD" }, "suggestions": ["Show BD's pod details", "Show active projects"] }

                Query: "who is Sarah?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here's Sarah's profile.", "data": { "_type": "RESOURCE_PROFILE", "entityName": "Sarah" }, "suggestions": ["Show Sarah's pod", "Show all developers"] }

                Query: "compare API pod and Frontend pod"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Comparing API and Frontend pods.", "data": { "_type": "COMPARISON", "Entity A": "API", "Entity B": "Frontend" }, "suggestions": ["Show API pod details", "Show Frontend pod details"] }

                Query: "go to projects"
                → { "intent": "NAVIGATE", "confidence": 0.95, "message": "Opening Projects page.", "route": "/projects", "data": { "_type": "NAVIGATE_ACTION", "Page": "Projects" }, "suggestions": ["Show active projects", "Create a new project"] }

                Query: "create a P1 project called Mobile App owned by John"
                → { "intent": "FORM_PREFILL", "confidence": 0.9, "message": "I'll set up the project creation form for you.", "route": "/projects?action=create", "formData": { "name": "Mobile App", "priority": "P1", "owner": "John" }, "suggestions": ["Show all projects", "Show John's projects"] }

                Query: "what's the billing rate for developers in India?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here's the billing rate.", "data": { "_type": "COST_RATE", "filterRole": "DEVELOPER", "filterLocation": "INDIA" }, "suggestions": ["Show all cost rates", "Show India team"] }

                Query: "show me all QA engineers"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here are all QA engineers.", "data": { "_type": "LIST", "listType": "RESOURCES", "filterValue": "QA" }, "suggestions": ["Show QA in India", "Show resource analytics"] }

                Query: "what are the estimates for SgNIPT project?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here are the hour estimates for SgNIPT.", "data": { "_type": "PROJECT_ESTIMATES", "entityName": "SgNIPT" }, "suggestions": ["Show SgNIPT details", "Show pods in SgNIPT"] }

                Query: "what pods are involved in SgNIPT?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here are the PODs assigned to SgNIPT.", "data": { "_type": "PROJECT_ESTIMATES", "entityName": "SgNIPT" }, "suggestions": ["Show SgNIPT estimates", "Show pod details"] }

                Query: "what's allocated for the current sprint?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here are the current sprint allocations.", "data": { "_type": "SPRINT_ALLOCATIONS", "entityName": "current" }, "suggestions": ["Show sprint calendar", "Show pod workload"] }

                Query: "what's John's availability?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here's John's monthly availability.", "data": { "_type": "RESOURCE_AVAILABILITY", "entityName": "John" }, "suggestions": ["Show all availability", "Show John's profile"] }

                Query: "is SgNIPT blocked by anything?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Checking dependencies for SgNIPT.", "data": { "_type": "PROJECT_DEPENDENCIES", "entityName": "SgNIPT" }, "suggestions": ["Show all dependencies", "Show SgNIPT details"] }

                Query: "actual hours for SgNIPT"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here are the actual hours logged.", "data": { "_type": "PROJECT_ACTUALS", "entityName": "SgNIPT" }, "suggestions": ["Show planned vs actual", "Show budget report"] }

                Query: "what effort patterns are available?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here are the available effort patterns.", "data": { "_type": "EFFORT_PATTERN", "entityName": "all" }, "suggestions": ["Explain front-loaded", "Show projects page"] }

                Query: "what's the standard effort mix?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here's the standard role effort mix.", "data": { "_type": "ROLE_EFFORT_MIX" }, "suggestions": ["Show cost rates", "Show resources"] }

                """);

        sb.append("Return ONLY the JSON object. No text before or after it.");

        return sb.toString();
    }
}
