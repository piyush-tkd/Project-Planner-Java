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
 * Cloud LLM strategy using Anthropic Claude API (or OpenAI-compatible).
 * Availability depends on API key being configured.
 *
 * Shares the same rich system prompt as LocalLlmStrategy but benefits from
 * more powerful cloud models for complex queries.
 */
@Component
public class CloudLlmStrategy implements NlpStrategy {

    private static final Logger log = LoggerFactory.getLogger(CloudLlmStrategy.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private String provider = "ANTHROPIC";
    private String model = "claude-haiku-4-5-20251001";
    private String apiKey = "";
    private int maxTimeoutMs = 5000;

    @Override
    public String name() {
        return "CLOUD_LLM";
    }

    @Override
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    public void configure(String provider, String model, String apiKey, int maxTimeoutMs) {
        this.provider = provider != null ? provider : "ANTHROPIC";
        this.model = model != null ? model : "claude-haiku-4-5-20251001";
        this.apiKey = apiKey != null ? apiKey : "";
        this.maxTimeoutMs = maxTimeoutMs;
    }

    @Override
    public NlpResult classify(String query, NlpCatalogResponse catalog) {
        try {
            if ("ANTHROPIC".equalsIgnoreCase(provider)) {
                return classifyWithAnthropic(query, catalog);
            } else if ("OPENAI".equalsIgnoreCase(provider)) {
                return classifyWithOpenAI(query, catalog);
            }
            log.warn("Unknown cloud provider: {}", provider);
            return lowConfidenceResult();
        } catch (Exception e) {
            log.warn("CLOUD_LLM classification failed: {}", e.getMessage());
            return lowConfidenceResult();
        }
    }

    private NlpResult classifyWithAnthropic(String query, NlpCatalogResponse catalog) throws Exception {
        String systemPrompt = buildSystemPrompt(catalog);

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "max_tokens", 1024,
                "system", systemPrompt,
                "messages", List.of(
                        Map.of("role", "user", "content", query)
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");

        RestTemplate rt = new RestTemplate();
        HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);

        ResponseEntity<String> resp = rt.postForEntity(
                "https://api.anthropic.com/v1/messages", entity, String.class);

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            log.warn("Anthropic API returned: {}", resp.getStatusCode());
            return lowConfidenceResult();
        }

        JsonNode root = objectMapper.readTree(resp.getBody());
        String responseText = root.path("content").get(0).path("text").asText("");
        return parseJsonResponse(responseText, catalog);
    }

    private NlpResult classifyWithOpenAI(String query, NlpCatalogResponse catalog) throws Exception {
        String systemPrompt = buildSystemPrompt(catalog);

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "max_tokens", 1024,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", query)
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        RestTemplate rt = new RestTemplate();
        HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);

        ResponseEntity<String> resp = rt.postForEntity(
                "https://api.openai.com/v1/chat/completions", entity, String.class);

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            return lowConfidenceResult();
        }

        JsonNode root = objectMapper.readTree(resp.getBody());
        String responseText = root.path("choices").get(0).path("message").path("content").asText("");
        return parseJsonResponse(responseText, catalog);
    }

    // ────────────────────────────────────────────────────────────────────────
    // JSON response parsing with entity enrichment
    // ────────────────────────────────────────────────────────────────────────

    private NlpResult parseJsonResponse(String json, NlpCatalogResponse catalog) {
        try {
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

            // Post-process: enrich data with catalog lookups
            if (data != null && catalog != null) {
                data = enrichDataFromCatalog(data, catalog);
                // If enrichment set a specific drillDown, use it instead of LLM's generic one
                if (data.containsKey("_drillDown")) {
                    drillDown = data.remove("_drillDown").toString();
                }
            }

            return new NlpResult(intent, confidence, message, route, formData, data, drillDown, suggestions, null);
        } catch (Exception e) {
            log.warn("Failed to parse CLOUD_LLM JSON: {}", e.getMessage());
            return lowConfidenceResult();
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Entity enrichment (identical logic to LocalLlmStrategy)
    // ────────────────────────────────────────────────────────────────────────

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
                    String entityLower = entityName.toLowerCase().trim();
                    var res = catalog.resourceDetails().stream()
                            .filter(r -> {
                                String rLower = r.name().toLowerCase().trim();
                                return rLower.contains(entityLower) || entityLower.contains(rLower)
                                        || rLower.equals(entityLower);
                            })
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
                    String entityLower = entityName.toLowerCase().trim();
                    var proj = catalog.projectDetails().stream()
                            .filter(p -> {
                                String pLower = p.name().toLowerCase().trim();
                                return pLower.contains(entityLower) || entityLower.contains(pLower)
                                        || pLower.equals(entityLower);
                            })
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
                        if (!pod.members().isEmpty())
                            enriched.put("Team", String.join(", ", pod.members()));
                        if (!pod.projectNames().isEmpty())
                            enriched.put("Project List", String.join(", ", pod.projectNames()));
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
                return enrichListFromCatalog(data, catalog);
            }
            case "COST_RATE" -> {
                if (catalog.costRates() != null && !catalog.costRates().isEmpty()) {
                    Map<String, Object> enriched = new LinkedHashMap<>();
                    enriched.put("_type", "COST_RATE");
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
                        for (var rate : catalog.costRates()) {
                            enriched.put(rate.role() + " (" + rate.location() + ")",
                                    "$" + rate.hourlyRate() + "/hr");
                        }
                    }
                    return enriched;
                }
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
                            podBreakdown.add(podMap);
                        }
                        enriched.put("podBreakdown", podBreakdown);
                        return enriched;
                    }
                }
            }
            case "SPRINT_ALLOCATIONS", "RESOURCE_AVAILABILITY", "PROJECT_DEPENDENCIES",
                 "PROJECT_ACTUALS", "EFFORT_PATTERN", "ROLE_EFFORT_MIX" -> {
                // These types are enriched the same way as in LocalLlmStrategy
                // but for cloud, we return data as-is since the cloud model
                // produces richer responses. The rule-based engine handles
                // the full enrichment for these types.
                return data;
            }
        }
        return data;
    }

    /**
     * When the LLM omits _type but includes entityName, try to infer what type
     * of entity it is by matching against known names in the catalog.
     */
    private String inferTypeFromEntityName(String entityName, NlpCatalogResponse catalog) {
        String lower = entityName.toLowerCase().trim();
        // Try project match
        if (catalog.projectDetails() != null) {
            for (var p : catalog.projectDetails()) {
                if (p.name().equalsIgnoreCase(lower) || p.name().toLowerCase().contains(lower) || lower.contains(p.name().toLowerCase())) {
                    return "PROJECT_PROFILE";
                }
            }
        }
        // Try resource match
        if (catalog.resourceDetails() != null) {
            for (var r : catalog.resourceDetails()) {
                if (r.name().equalsIgnoreCase(lower) || r.name().toLowerCase().contains(lower) || lower.contains(r.name().toLowerCase())) {
                    return "RESOURCE_PROFILE";
                }
            }
        }
        // Try pod match
        if (catalog.podDetails() != null) {
            for (var p : catalog.podDetails()) {
                if (p.name().equalsIgnoreCase(lower) || p.name().toLowerCase().contains(lower) || lower.contains(p.name().toLowerCase())) {
                    return "POD_PROFILE";
                }
            }
        }
        // Try sprint match
        if (catalog.sprintDetails() != null) {
            for (var s : catalog.sprintDetails()) {
                if (s.name().equalsIgnoreCase(lower) || s.name().toLowerCase().contains(lower) || lower.contains(s.name().toLowerCase())) {
                    return "SPRINT_PROFILE";
                }
            }
        }
        // Try release match
        if (catalog.releaseDetails() != null) {
            for (var r : catalog.releaseDetails()) {
                if (r.name().equalsIgnoreCase(lower) || r.name().toLowerCase().contains(lower) || lower.contains(r.name().toLowerCase())) {
                    return "RELEASE_PROFILE";
                }
            }
        }
        return null;
    }

    private Map<String, Object> enrichListFromCatalog(Map<String, Object> data,
                                                       NlpCatalogResponse catalog) {
        String listType = data.get("listType") != null ? data.get("listType").toString() : null;
        String filterValue = data.get("filterValue") != null ? data.get("filterValue").toString() : null;

        if ("PROJECTS".equals(listType) && filterValue != null && catalog.projectDetails() != null) {
            // Try owner match
            List<NlpCatalogResponse.ProjectInfo> matches = catalog.projectDetails().stream()
                    .filter(p -> p.owner().toLowerCase().contains(filterValue.toLowerCase()))
                    .toList();

            // Try pod name fallback
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
                    .filter(r -> (r.role() != null && r.role().toLowerCase().contains(filterValue.toLowerCase()))
                            || (r.location() != null && r.location().toLowerCase().contains(filterValue.toLowerCase()))
                            || (r.podName() != null && r.podName().toLowerCase().contains(filterValue.toLowerCase())))
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

    private NlpResult lowConfidenceResult() {
        return new NlpResult("UNKNOWN", 0.0, null, null, null, null, null, null, null);
    }

    // ────────────────────────────────────────────────────────────────────────
    // System prompt — shared brain across all LLM strategies
    // ────────────────────────────────────────────────────────────────────────

    private String buildSystemPrompt(NlpCatalogResponse catalog) {
        StringBuilder sb = new StringBuilder(4096);

        sb.append("""
                You are an expert intent classifier and entity extractor for a Portfolio Planning tool \
                (Baylor Genetics resource/project management system).

                Given a user query, return ONLY a valid JSON object with these fields:
                {
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
                - Return ONLY the JSON object, no explanation, no markdown fences.
                - confidence should be 0.85-0.95 when you're confident, 0.5-0.7 if unsure.
                - Always include 2-3 helpful follow-up suggestions.
                - The "message" should be a direct, conversational answer.

                """);

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
                - "JIRA_ISSUE_PROFILE" — Single Jira issue lookup by key (e.g. PROJ-123).
                  data: { "_type": "JIRA_ISSUE_PROFILE", "Key": "PROJ-123", "Summary": "...", ... }
                  Use when user asks about a specific Jira ticket by its key.

                JIRA TICKET LOOKUP:
                When the user asks about a specific Jira ticket (e.g. "TAT-123", "tell me about PROJ-456",
                "what is the status of BGENG-789", "summarize TAT-100"), use the get_jira_issue tool
                with the ticket key. After getting the result, synthesize a helpful summary with
                intent=DATA_QUERY and data._type=JIRA_ISSUE_PROFILE.

                """);

        sb.append("""
                SYNONYM HANDLING (important for matching user intent):
                - "under", "owned by", "belonging to", "managed by", "assigned to" → owner/assignment relationship
                - "team", "squad", "group", "pod" → POD entity (BUT "India team" / "US team" → location-based resource list, NOT a pod)
                - "dev", "developer", "engineer", "coder" → DEVELOPER role
                - "qa", "tester", "quality" → QA role
                - "bsa", "analyst", "business analyst" → BSA role
                - "lead", "tech lead", "senior", "principal" → TECH_LEAD role
                - "india", "offshore", "indian team" → INDIA location
                - "us", "onshore", "domestic", "stateside" → US location
                - "stuck", "blocked", "stalled", "delayed" → ON_HOLD or risk
                - "done", "finished", "completed", "closed" → COMPLETED status
                - "new", "upcoming", "not started", "pending" → NOT_STARTED status

                LOCATION-BASED TEAM QUERIES:
                - "India team" / "US team" / "offshore team" → LIST of resources filtered by location
                  data: { "_type": "LIST", "listType": "RESOURCES", "filterValue": "INDIA" }
                - DO NOT treat "India team" as a POD lookup — there is no POD named "India".
                - Instead return a LIST of all resources in that location.

                OUT-OF-SCOPE HANDLING (CRITICAL):
                This system manages: Projects, Resources, PODs, Sprints, Releases, Overrides,
                Budget/Cost Rates, T-shirt Sizes, Effort Patterns, and Planning data.
                This system does NOT have: Jira tickets, support tickets, bugs, user stories,
                Git commits, CI/CD, email, Slack messages, or external integrations.
                If the user asks about something NOT in this system (like "Jira stories",
                "support tickets", "bugs", "pull requests", "emails"):
                → intent: "HELP", confidence: 0.85
                → message: Explain what IS available and suggest related queries
                → data: { "_type": "CAPABILITIES" }
                → suggestions: 2-3 relevant queries the system CAN answer
                DO NOT guess or return unrelated data.

                """);

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

        // ── Entity catalog ──────────────────────────────────────────────────
        if (catalog != null) {
            sb.append("KNOWN ENTITIES IN THIS SYSTEM:\n\n");

            if (catalog.resourceDetails() != null && !catalog.resourceDetails().isEmpty()) {
                sb.append("RESOURCES:\n");
                for (var r : catalog.resourceDetails()) {
                    sb.append("  - ").append(r.name()).append(" | Role: ").append(r.role())
                            .append(" | Location: ").append(r.location())
                            .append(" | Pod: ").append(r.podName() != null ? r.podName() : "None")
                            .append(" | Rate: ").append(r.billingRate())
                            .append(" | FTE: ").append(r.fte())
                            .append("\n");
                }
                sb.append("\n");
            } else if (catalog.resources() != null) {
                sb.append("Resources: ").append(String.join(", ", catalog.resources())).append("\n\n");
            }

            if (catalog.projectDetails() != null && !catalog.projectDetails().isEmpty()) {
                sb.append("PROJECTS:\n");
                for (var p : catalog.projectDetails()) {
                    sb.append("  - ").append(p.name()).append(" | Priority: ").append(p.priority())
                            .append(" | Owner: ").append(p.owner())
                            .append(" | Status: ").append(p.status())
                            .append(" | Pods: ").append(p.assignedPods() != null ? p.assignedPods() : "None")
                            .append("\n");
                }
                sb.append("\n");
            } else if (catalog.projects() != null) {
                sb.append("Projects: ").append(String.join(", ", catalog.projects())).append("\n\n");
            }

            if (catalog.podDetails() != null && !catalog.podDetails().isEmpty()) {
                sb.append("PODS:\n");
                for (var p : catalog.podDetails()) {
                    sb.append("  - ").append(p.name())
                            .append(" | Members: ").append(p.memberCount())
                            .append(" (").append(String.join(", ", p.members())).append(")")
                            .append(" | Projects: ").append(String.join(", ", p.projectNames()))
                            .append(" | BAU: ").append(p.avgBauPct())
                            .append("\n");
                }
                sb.append("\n");
            }

            if (catalog.sprintDetails() != null && !catalog.sprintDetails().isEmpty()) {
                sb.append("SPRINTS:\n");
                for (var s : catalog.sprintDetails()) {
                    sb.append("  - ").append(s.name()).append(" | ").append(s.startDate())
                            .append(" to ").append(s.endDate())
                            .append(" | Status: ").append(s.status()).append("\n");
                }
                sb.append("\n");
            }

            if (catalog.releaseDetails() != null && !catalog.releaseDetails().isEmpty()) {
                sb.append("RELEASES:\n");
                for (var r : catalog.releaseDetails()) {
                    sb.append("  - ").append(r.name()).append(" | Release: ").append(r.releaseDate())
                            .append(" | Type: ").append(r.type()).append("\n");
                }
                sb.append("\n");
            }

            if (catalog.costRates() != null && !catalog.costRates().isEmpty()) {
                sb.append("COST RATES:\n");
                for (var cr : catalog.costRates()) {
                    sb.append("  - ").append(cr.role()).append(" (").append(cr.location())
                            .append("): $").append(cr.hourlyRate()).append("/hr\n");
                }
                sb.append("\n");
            }

            if (catalog.tshirtSizes() != null && !catalog.tshirtSizes().isEmpty()) {
                sb.append("T-SHIRT SIZES:\n");
                for (var ts : catalog.tshirtSizes()) {
                    sb.append("  - ").append(ts.name()).append(": ").append(ts.baseHours())
                            .append(" base hours\n");
                }
                sb.append("\n");
            }

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

            sb.append("ENUMS:\n");
            sb.append("  Priorities: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)\n");
            sb.append("  Roles: DEVELOPER, QA, BSA, TECH_LEAD\n");
            sb.append("  Locations: US, INDIA\n");
            sb.append("  Statuses: NOT_STARTED, IN_DISCOVERY, ACTIVE, ON_HOLD, COMPLETED, CANCELLED\n");
            sb.append("  Release Types: MAJOR, MINOR, PATCH, HOTFIX\n\n");
        }

        sb.append("""
                IMPORTANT MATCHING RULES:
                - When the user mentions a name, ALWAYS match it against the KNOWN ENTITIES above.
                - Use partial matching: "sg" → "SgNIPT", "port" → "Portal Redesign", etc.
                - Be case-insensitive: "sgnIPT", "SGNPT", "sgnpt" all match "SgNIPT".
                - For people: first name alone is enough: "piyush" → full name from RESOURCES.
                - For ambiguous queries, prefer the entity type that best fits the question context.
                - ALWAYS include _type in the data object — the frontend needs it for rendering.
                - entityName MUST exactly match a name from KNOWN ENTITIES (not the user's typo).
                - The "message" field should be RICH and conversational — summarize the data you're returning.
                  For profiles, mention key details: "Sarah is a Developer in the US, assigned to the API pod."
                  For lists, state the count: "Found 3 active projects owned by BD."
                  For insights, explain: "The API pod is at 95% capacity — they may need extra resources."

                PERMUTATION HANDLING:
                - "tell me about X" / "what is X" / "who is X" / "details for X" / "lookup X" → same intent
                - "X's projects" / "projects under X" / "projects owned by X" / "what does X own" → LIST with owner filter
                - "people in X" / "X members" / "who works in X" / "X team" → POD_PROFILE or LIST with pod filter
                - "how much does X cost" / "rate for X" / "billing for X" → COST_RATE with filters
                - "when is X" / "X dates" / "X timeline" → SPRINT_PROFILE or RELEASE_PROFILE

                EXAMPLES:
                Query: "give me all projects under BD"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here are the projects under BD.", "data": { "_type": "LIST", "listType": "PROJECTS", "filterValue": "BD" }, "suggestions": ["Show BD's pod details", "Show active projects"] }

                Query: "who is Sarah?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Sarah is a Developer based in the US, currently assigned to the API pod with a billing rate of $85/hr.", "data": { "_type": "RESOURCE_PROFILE", "entityName": "Sarah" }, "suggestions": ["Show Sarah's pod", "Show all developers"] }

                Query: "compare API pod and Frontend pod"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Comparing API and Frontend pods.", "data": { "_type": "COMPARISON", "Entity A": "API", "Entity B": "Frontend" }, "suggestions": ["Show API pod details", "Show Frontend pod details"] }

                Query: "create a P1 project called Mobile App owned by John"
                → { "intent": "FORM_PREFILL", "confidence": 0.9, "message": "Setting up project creation form for Mobile App (P1, owned by John).", "route": "/projects?action=create", "formData": { "name": "Mobile App", "priority": "P1", "owner": "John" }, "suggestions": ["Show all projects", "Show John's projects"] }

                Query: "what's the billing rate for developers in India?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here's the billing rate for Developers in India.", "data": { "_type": "COST_RATE", "filterRole": "DEVELOPER", "filterLocation": "INDIA" }, "suggestions": ["Show all cost rates", "Show India team"] }

                Query: "what are the estimates for SgNIPT?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here are the hour estimates for SgNIPT project.", "data": { "_type": "PROJECT_ESTIMATES", "entityName": "SgNIPT" }, "suggestions": ["Show SgNIPT details", "Show pods in SgNIPT"] }

                Query: "how many people are in the API pod?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "The API pod has 5 members: John, Sarah, Mike, Lisa, and Raj.", "data": { "_type": "POD_PROFILE", "entityName": "API" }, "suggestions": ["Show API pod projects", "Compare pods"] }

                Query: "what's allocated for the current sprint?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here are the allocations for the current sprint.", "data": { "_type": "SPRINT_ALLOCATIONS", "entityName": "current" }, "suggestions": ["Show sprint calendar", "Show pod workload"] }

                Query: "is SgNIPT blocked?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Checking dependency status for SgNIPT.", "data": { "_type": "PROJECT_DEPENDENCIES", "entityName": "SgNIPT" }, "suggestions": ["Show all dependencies", "Show SgNIPT details"] }

                Query: "show me all developers"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here are all developers in the system.", "data": { "_type": "LIST", "listType": "RESOURCES", "filterValue": "DEVELOPER" }, "suggestions": ["Show QA resources", "Show India team"] }

                Query: "which projects are active?"
                → { "intent": "DATA_QUERY", "confidence": 0.9, "message": "Here are the currently active projects.", "data": { "_type": "LIST", "listType": "PROJECTS", "filterValue": "ACTIVE" }, "suggestions": ["Show on-hold projects", "Show project timeline"] }

                """);

        // ── Dynamic examples from actual catalog data ──────────────────────
        // Generate examples using real entity names so the LLM sees the exact
        // names it should be matching against.
        if (catalog != null) {
            sb.append("DYNAMIC EXAMPLES (using real entities from this system):\n\n");

            // Resource example
            if (catalog.resourceDetails() != null && !catalog.resourceDetails().isEmpty()) {
                var sampleRes = catalog.resourceDetails().get(0);
                sb.append("Query: \"tell me about ").append(sampleRes.name().split(" ")[0]).append("\"\n");
                sb.append("→ { \"intent\": \"DATA_QUERY\", \"confidence\": 0.9, \"message\": \"")
                  .append(sampleRes.name()).append(" is a ").append(sampleRes.role())
                  .append(" based in ").append(sampleRes.location()).append(".\", ")
                  .append("\"data\": { \"_type\": \"RESOURCE_PROFILE\", \"entityName\": \"")
                  .append(sampleRes.name().split(" ")[0]).append("\" }, ")
                  .append("\"suggestions\": [\"Show ").append(sampleRes.name().split(" ")[0]).append("'s pod\", \"Show all ").append(sampleRes.role().toLowerCase()).append("s\"] }\n\n");
            }

            // Project example
            if (catalog.projectDetails() != null && !catalog.projectDetails().isEmpty()) {
                var sampleProj = catalog.projectDetails().get(0);
                sb.append("Query: \"what is the status of ").append(sampleProj.name()).append("?\"\n");
                sb.append("→ { \"intent\": \"DATA_QUERY\", \"confidence\": 0.9, \"message\": \"")
                  .append(sampleProj.name()).append(" is ").append(sampleProj.status())
                  .append(", priority ").append(sampleProj.priority())
                  .append(", owned by ").append(sampleProj.owner()).append(".\", ")
                  .append("\"data\": { \"_type\": \"PROJECT_PROFILE\", \"entityName\": \"")
                  .append(sampleProj.name()).append("\" }, ")
                  .append("\"suggestions\": [\"Show ").append(sampleProj.name()).append(" estimates\", \"Show active projects\"] }\n\n");
            }

            // Location team example
            sb.append("Query: \"India team details\"\n");
            sb.append("→ { \"intent\": \"DATA_QUERY\", \"confidence\": 0.9, \"message\": \"Here are all resources in India.\", ")
              .append("\"data\": { \"_type\": \"LIST\", \"listType\": \"RESOURCES\", \"filterValue\": \"INDIA\" }, ")
              .append("\"suggestions\": [\"Show India billing rates\", \"Show all resources\"] }\n\n");

            // Out-of-scope example
            sb.append("Query: \"are there any support tickets on highest priority?\"\n");
            sb.append("→ { \"intent\": \"HELP\", \"confidence\": 0.85, \"message\": \"This system doesn't track support tickets or Jira stories. ")
              .append("I can help with projects, resources, PODs, sprints, and releases. Would you like to see high-priority projects instead?\", ")
              .append("\"data\": { \"_type\": \"CAPABILITIES\" }, ")
              .append("\"suggestions\": [\"Show P0 projects\", \"Show active projects\", \"What can you do?\"] }\n\n");
        }

        sb.append("Return ONLY the JSON object. No text before or after it.");
        return sb.toString();
    }

    // ── Free-form content generation ──────────────────────────────────────────

    /**
     * Generates free-form text content (not classification).
     * Used by AiContentController for status emails, retro summaries, etc.
     *
     * @param systemPrompt  Instructions describing what to generate
     * @param userMessage   The user's input / context
     * @return Generated text, or null if unavailable/failed
     */
    public String generateContent(String systemPrompt, String userMessage) {
        if (!isAvailable()) return null;
        try {
            if ("ANTHROPIC".equalsIgnoreCase(provider)) {
                return generateWithAnthropic(systemPrompt, userMessage);
            } else if ("OPENAI".equalsIgnoreCase(provider)) {
                return generateWithOpenAI(systemPrompt, userMessage);
            }
        } catch (Exception e) {
            log.warn("generateContent failed: {}", e.getMessage());
        }
        return null;
    }

    private String generateWithAnthropic(String systemPrompt, String userMessage) throws Exception {
        Map<String, Object> requestBody = Map.of(
            "model", model,
            "max_tokens", 2048,
            "system", systemPrompt,
            "messages", List.of(Map.of("role", "user", "content", userMessage))
        );
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");

        RestTemplate rt = new RestTemplate();
        HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);
        ResponseEntity<String> resp = rt.postForEntity("https://api.anthropic.com/v1/messages", entity, String.class);

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) return null;
        JsonNode root = objectMapper.readTree(resp.getBody());
        return root.path("content").get(0).path("text").asText(null);
    }

    private String generateWithOpenAI(String systemPrompt, String userMessage) throws Exception {
        Map<String, Object> requestBody = Map.of(
            "model", model,
            "max_tokens", 2048,
            "messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userMessage)
            )
        );
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        RestTemplate rt = new RestTemplate();
        HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);
        ResponseEntity<String> resp = rt.postForEntity("https://api.openai.com/v1/chat/completions", entity, String.class);

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) return null;
        JsonNode root = objectMapper.readTree(resp.getBody());
        return root.path("choices").get(0).path("message").path("content").asText(null);
    }
}
