package com.portfolioplanner.service.nlp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.service.AiServiceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Local LLM strategy — delegates inference to portfolio-planner-ai (port 8081),
 * which in turn calls Ollama. Availability depends on portfolio-planner-ai
 * being running and Ollama being reachable from that service.
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
    private final NlpJiraToolExecutor jiraToolExecutor;
    private final NlpResponseBuilder responseBuilder;
    private final AliasResolver aliasResolver;
    private final AiServiceClient aiServiceClient;

    // These are set by NlpConfigService when config loads/changes
    private String model = "llama3:8b";
    private int timeoutMs = 10000;
    private volatile boolean lastHealthCheck = false;

    /** Minimum cosine similarity for a vector search result to be included in LLM context. */
    private static final double VECTOR_CONTEXT_SIMILARITY_THRESHOLD = 0.45;

    private volatile long lastHealthCheckTime = 0;
    private static final long HEALTH_CHECK_CACHE_MS = 30_000;

    public LocalLlmStrategy(NlpVectorSearchService vectorSearchService,
                             NlpToolRegistry toolRegistry,
                             NlpJiraToolExecutor jiraToolExecutor,
                             NlpResponseBuilder responseBuilder,
                             AliasResolver aliasResolver,
                             AiServiceClient aiServiceClient) {
        this.vectorSearchService = vectorSearchService;
        this.toolRegistry = toolRegistry;
        this.jiraToolExecutor = jiraToolExecutor;
        this.responseBuilder = responseBuilder;
        this.aliasResolver = aliasResolver;
        this.aiServiceClient = aiServiceClient;
    }

    @Override
    public String name() {
        return "LOCAL_LLM";
    }

    @Override
    public boolean isAvailable() {
        // Cache health check to avoid hitting the AI service on every query
        long now = System.currentTimeMillis();
        if (now - lastHealthCheckTime < HEALTH_CHECK_CACHE_MS) {
            return lastHealthCheck;
        }
        lastHealthCheck = aiServiceClient.isOllamaHealthy();
        lastHealthCheckTime = now;
        return lastHealthCheck;
    }

    public void configure(String modelUrl, String model, int timeoutMs) {
        // modelUrl is now managed by portfolio-planner-ai; retained here only
        // so NlpConfigService can still call configure() without changes.
        this.model = model;
        this.timeoutMs = timeoutMs;
    }

    @Override
    public NlpResult classify(String query, NlpCatalogResponse catalog) {
        try {
            // ── Step 1: Vector search for selective context (with similarity threshold) ──
            String vectorContext = "";
            List<NlpVectorSearchService.VectorSearchResult> searchResults = List.of();
            if (vectorSearchService != null) {
                var rawResults = vectorSearchService.search(query, 15);
                // Filter out low-relevance noise — only inject genuinely relevant context
                searchResults = rawResults.stream()
                        .filter(r -> r.similarity() >= VECTOR_CONTEXT_SIMILARITY_THRESHOLD)
                        .limit(10)
                        .toList();
                vectorContext = vectorSearchService.buildContextFromResults(searchResults);
                if (!vectorContext.isBlank()) {
                    log.debug("LOCAL_LLM: vector search found {} relevant entities (filtered from {} raw)",
                            searchResults.size(), rawResults.size());
                }
            }

            // ── Step 1.5: Pre-computed tool routing — skip ALL LLM calls for known patterns ──
            PreComputedRoute preRoute = tryPreComputedToolRoute(query, catalog);
            if (preRoute != null) {
                log.info("LOCAL_LLM: pre-computed route → tool={} params={} (skipping LLM entirely)",
                        preRoute.toolName, preRoute.params);
                JsonNode toolParams = objectMapper.valueToTree(preRoute.params);
                NlpToolRegistry.ToolResult toolResult = toolRegistry.executeTool(preRoute.toolName, toolParams, catalog);
                log.info("LOCAL_LLM: pre-computed tool result success={} output='{}'",
                        toolResult.success(), toolResult.success() ? toolResult.data().substring(0, Math.min(200, toolResult.data().length())) : "FAILED");
                if (toolResult.success()) {
                    // Build structured data from real tool output
                    Map<String, Object> realData = responseBuilder.parseToolOutput(preRoute.toolName, toolResult.data());
                    String drillDown = responseBuilder.inferDrillDown(preRoute.toolName);
                    // Use server-side template for message — NO LLM call needed
                    String message = responseBuilder.buildTemplateMessage(preRoute.toolName, preRoute.params, realData);
                    List<String> suggestions = responseBuilder.buildSuggestions(preRoute.toolName, preRoute.params);
                    String intent = "DATA_QUERY";
                    double confidence = 0.92;

                    log.info("LOCAL_LLM: pre-computed route completed (0 LLM calls) — message='{}'", message);
                    return new NlpResult(intent, confidence, message, null, null,
                            realData, drillDown, suggestions, null);
                }
                // If pre-computed route fails, fall through to normal LLM flow
                log.debug("LOCAL_LLM: pre-computed route failed, falling back to full LLM flow");
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

                // ── Step 4: Build response from tool result (no second LLM call) ──
                if (toolResult.success()) {
                    Map<String, Object> realData = responseBuilder.parseToolOutput(toolName, toolResult.data());
                    String drillDown = responseBuilder.inferDrillDown(toolName);
                    // Use server-side template for message — skip the slow LLM synthesis
                    Map<String, String> paramMap = new HashMap<>();
                    toolParams.fields().forEachRemaining(f -> paramMap.put(f.getKey(), f.getValue().asText()));
                    String msg = responseBuilder.buildTemplateMessage(toolName, paramMap, realData);
                    List<String> synthSuggestions = responseBuilder.buildSuggestions(toolName, paramMap);
                    String synthIntent = "DATA_QUERY";
                    double synthConf = 0.90;

                    log.info("LOCAL_LLM: tool call completed (1 LLM call total) — tool={} message='{}'", toolName, msg);
                    return new NlpResult(synthIntent, synthConf, msg, null, null,
                            realData, drillDown, synthSuggestions, null);
                } else {
                    // Tool failed — return a simple error message (no second LLM call)
                    log.warn("LOCAL_LLM: tool '{}' failed: {}", toolName, toolResult.error());
                    return new NlpResult("DATA_QUERY", 0.50,
                            "I couldn't find information for that query. " + toolResult.error(),
                            null, null, null, null,
                            List.of("Show portfolio summary", "List all projects", "List all resources"), null);
                }
            }

            // No tool call — parse the first response directly
            return parseJsonResponse(firstResponse, catalog);

        } catch (Exception e) {
            log.warn("LOCAL_LLM classification failed: {}", e.getMessage());
            return lowConfidenceResult();
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ── Pre-computed tool routing: skip first LLM call for known patterns ──
    // ═════════════════════════════════════════════════════════════════════════

    private record PreComputedRoute(String toolName, Map<String, String> params) {}

    // Patterns for direct tool routing (compiled once, thread-safe)
    private static final List<PreComputedRoutePattern> PRE_COMPUTED_ROUTES = List.of(
            // ── Resource queries ──
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:who is|tell me about|details? (?:for|of|about)|show me|info (?:on|about|for))\\s+(?:resource\\s+)?([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)\\s*\\??$"),
                    "get_resource_profile", "name"),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:developers?|devs?)(?:\\s+.*)?$"),
                    "list_resources", "role", "DEVELOPER"),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:QA|testers?|quality\\s+assurance)(?:\\s+.*)?$"),
                    "list_resources", "role", "QA"),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:BSA|business\\s+analysts?)(?:\\s+.*)?$"),
                    "list_resources", "role", "BSA"),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:tech\\s+leads?|TL|leads?)(?:\\s+.*)?$"),
                    "list_resources", "role", "TECH_LEAD"),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:resources?|members?|people|team\\s+members?|staff)\\s+(?:in|from|at)\\s+(?:the\\s+)?(.+?)(?:\\s+(?:pod|team))?\\s*\\??$"),
                    "list_resources", "pod"),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:resources?|team\\s+members?|people|staff)\\s+(?:in|from)\\s+(US|India|INDIA|onshore|offshore)\\s*\\??$"),
                    "list_resources", "location"),

            // ── Project queries ──
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:tell me about|details? (?:for|of|about)|show me|info (?:on|about|for))\\s+(?:the\\s+)?project\\s+(.+?)\\s*\\??$"),
                    "get_project_profile", "name"),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(P[0-3])\\s+projects?\\s*\\??$"),
                    "list_projects", "priority"),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(active|on.?hold|completed|not.?started|cancelled)\\s+projects?\\s*\\??$"),
                    "list_projects", "status"),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:projects?\\s+(?:owned\\s+by|under|for)|(?:what|which)\\s+projects?\\s+(?:does|is)\\s+(.+?)\\s+(?:own|manage|have|work))\\s+(.+?)\\s*\\??$"),
                    "list_projects", "owner"),

            // ── Pod queries ──
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:tell me about|details? (?:for|of|about)|show me|info (?:on|about|for))\\s+(?:the\\s+)?(?:pod|team)\\s+(.+?)\\s*\\??$"),
                    "get_pod_profile", "name"),

            // ── Analytics queries (no params) ──
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s| is))\\s+(?:me\\s+)?(?:the\\s+)?(?:team\\s+composition|headcount|team\\s+breakdown|dev.to.qa\\s+ratio|role\\s+(?:mix|distribution))\\s*\\??$"),
                    "get_team_composition", null),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s| is))\\s+(?:me\\s+)?(?:the\\s+)?(?:utilization|utilisation|resource\\s+utilization)(?:\\s+summary)?\\s*\\??$"),
                    "get_utilization_summary", null),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s| is))\\s+(?:me\\s+)?(?:the\\s+)?(?:capacity|capacity\\s+summary|available\\s+capacity)\\s*\\??$"),
                    "get_capacity_summary", null),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s| is))\\s+(?:me\\s+)?(?:the\\s+)?(?:portfolio\\s+(?:summary|overview|snapshot)|project\\s+(?:summary|overview))\\s*\\??$"),
                    "get_portfolio_summary", null),

            // ── Sprint & Release queries ──
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s| is))\\s+(?:me\\s+)?(?:the\\s+)?(?:current|active)\\s+sprint\\s*\\??$"),
                    "get_sprint_info", "name", "current"),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s| is))\\s+(?:me\\s+)?(?:the\\s+)?(?:next|upcoming)\\s+(?:sprints?|release)\\s*\\??$"),
                    "get_sprint_info", "name", "upcoming"),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s| is|'re| are))\\s+(?:me\\s+)?(?:the\\s+)?(?:sprint\\s+allocations?|allocations?\\s+(?:for\\s+)?(?:this|current)\\s+sprint)\\s*\\??$"),
                    "get_sprint_allocations", "filter", "current"),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|'re| is| are))\\s+(?:me\\s+)?(?:the\\s+)?(?:upcoming|next)\\s+releases?\\s*\\??$"),
                    "get_release_info", "name", "upcoming"),

            // ── Cost queries ──
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|'re| is| are))\\s+(?:me\\s+)?(?:the\\s+)?(?:cost\\s+rates?|billing\\s+rates?|hourly\\s+rates?)\\s*\\??$"),
                    "get_cost_rates", null),
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:estimates?|effort)\\s+(?:for|of)\\s+(?:project\\s+)?(.+?)\\s*\\??$"),
                    "get_project_estimates", "name"),

            // ── Override queries ──
            new PreComputedRoutePattern(
                    Pattern.compile("(?i)^(?:show|get|list)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:overrides?|resource\\s+transfers?|loaned\\s+(?:out|resources?))\\s*\\??$"),
                    "get_overrides", null)
    );

    private record PreComputedRoutePattern(Pattern pattern, String toolName, String paramName, String fixedValue) {
        PreComputedRoutePattern(Pattern pattern, String toolName, String paramName) {
            this(pattern, toolName, paramName, null);
        }
        PreComputedRoutePattern(Pattern pattern, String toolName, String paramName, String fixedValue) {
            this.pattern = pattern;
            this.toolName = toolName;
            this.paramName = paramName;
            this.fixedValue = fixedValue;
        }
    }

    // ── Broad "details about X" pattern for catalog-aware entity resolution ──
    private static final Pattern GENERIC_DETAILS_PATTERN = Pattern.compile(
            "(?i)^(?:give|show|get|tell)\\s+(?:me\\s+)?(?:details?|info(?:rmation)?)\\s+(?:about|on|for|of)\\s+(?:the\\s+)?(.+?)\\s*\\??$"
    );

    /**
     * Try to route a query directly to a tool without calling the LLM.
     * Returns null if no pre-computed route matches.
     * The catalog parameter enables smart entity resolution for ambiguous queries.
     */
    private PreComputedRoute tryPreComputedToolRoute(String query, NlpCatalogResponse catalog) {
        for (PreComputedRoutePattern route : PRE_COMPUTED_ROUTES) {
            java.util.regex.Matcher m = route.pattern.matcher(query.trim());
            if (m.find()) {
                Map<String, String> params = new HashMap<>();
                if (route.paramName != null) {
                    if (route.fixedValue != null) {
                        // Fixed value (e.g., "current" for sprint)
                        params.put(route.paramName, route.fixedValue);
                    } else if (m.groupCount() >= 1) {
                        // Extract from regex group
                        String value = m.group(1).trim();
                        // Normalize common location aliases
                        if ("location".equals(route.paramName)) {
                            value = normalizeLocation(value);
                        }
                        // Normalize status values
                        if ("status".equals(route.paramName)) {
                            value = normalizeStatus(value);
                        }
                        params.put(route.paramName, value);
                    }
                }
                return new PreComputedRoute(route.toolName, params);
            }
        }

        // ── Catalog-aware fallback: "give details about X" where X is ambiguous ──
        // Check if the query matches the generic "details about X" pattern,
        // then resolve X against the catalog to determine if it's a project, resource, or pod.
        if (catalog != null) {
            java.util.regex.Matcher dm = GENERIC_DETAILS_PATTERN.matcher(query.trim());
            if (dm.find()) {
                String entityName = dm.group(1).trim();
                log.debug("LOCAL_LLM: generic details pattern matched for '{}'", entityName);
                String lower = entityName.toLowerCase();

                // Check projects first (more specific names like "SG NIPT", "VA PGx")
                // catalog.projects() returns List<String> (plain name strings)
                if (catalog.projects() != null) {
                    for (var p : catalog.projects()) {
                        if (p.toLowerCase().contains(lower) || lower.contains(p.toLowerCase())) {
                            log.info("LOCAL_LLM: catalog match → project '{}'", p);
                            return new PreComputedRoute("get_project_profile", Map.of("name", entityName));
                        }
                    }
                }
                // Check pods — catalog.pods() returns List<String>
                if (catalog.pods() != null) {
                    for (var pod : catalog.pods()) {
                        if (pod.toLowerCase().contains(lower) || lower.contains(pod.toLowerCase())) {
                            log.info("LOCAL_LLM: catalog match → pod '{}'", pod);
                            return new PreComputedRoute("get_pod_profile", Map.of("name", entityName));
                        }
                    }
                }
                // Check resources — catalog.resources() returns List<String>
                if (catalog.resources() != null) {
                    for (var r : catalog.resources()) {
                        if (r.toLowerCase().contains(lower) || lower.contains(r.toLowerCase())) {
                            log.info("LOCAL_LLM: catalog match → resource '{}'", r);
                            return new PreComputedRoute("get_resource_profile", Map.of("name", entityName));
                        }
                    }
                }
            }
        }

        return null;
    }

    private String normalizeLocation(String loc) {
        // Delegate to centralized AliasResolver
        String resolved = aliasResolver.extractLocation(loc);
        if (resolved != null) return resolved;
        // Fallback for exact enum values
        return switch (loc.toUpperCase()) {
            case "US", "INDIA" -> loc.toUpperCase();
            default -> loc.toUpperCase();
        };
    }

    private String normalizeStatus(String status) {
        // Delegate to centralized AliasResolver
        String resolved = aliasResolver.extractStatus(status);
        if (resolved != null) return resolved;
        // Fallback for exact enum values
        String s = status.toUpperCase().replaceAll("[\\s-]", "_");
        return s;
    }

    /**
     * Delegate an Ollama inference call to portfolio-planner-ai.
     * Returns raw model text, or null on failure.
     */
    private String callOllama(String query, String systemPrompt) {
        // Delegate to portfolio-planner-ai — no direct Ollama calls from the main app.
        return aiServiceClient.chat("OLLAMA", model, null, systemPrompt, query, 1024, "json");
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
        StringBuilder sb = new StringBuilder(4096);

        sb.append("""
                You are an expert assistant for a Portfolio Planning tool.
                The user asked a question. You called a tool to fetch data. Now synthesize a RICH, ANALYTICAL answer.

                RETURN ONLY a valid JSON object with this structure:
                {
                  "intent": "DATA_QUERY",
                  "confidence": 0.85 to 0.95,
                  "message": "RICH analytical response — not just data, but INSIGHTS and RECOMMENDATIONS",
                  "route": null,
                  "formData": null,
                  "data": { ... structured data with _type and exact field names ... },
                  "drillDown": "frontend route for drill-down or null",
                  "suggestions": ["2-3 follow-up suggestions"]
                }

                CRITICAL RULES:
                1. The "message" MUST be genuinely insightful and analytical — NOT just "here is the data."
                   BAD: "Here are the cost rates." GOOD: "US developers cost $125/hr vs $50/hr in India — a 60% savings. With 8 India devs, you save roughly $4,800/month compared to equivalent US staffing."
                   BAD: "Found 5 QA engineers." GOOD: "You have 5 QA engineers (3 in India, 2 in the US), giving a Dev:QA ratio of 4:1. The Platform pod has no dedicated QA — consider assigning one."
                2. The "data" object MUST include _type and use the EXACT field names from the TYPE MARKERS below.
                3. Parse the TOOL RESULT carefully and map each value to the correct field name.
                4. If the tool returned multiple items, use LIST type with numbered items (#1, #2, ...) or the appropriate array format.
                5. If the tool failed, set confidence to 0.5 and explain the issue in the message.
                6. Always include 2-3 relevant follow-up suggestions.
                7. For capacity/utilization data: calculate gaps, flag over-allocated pods, recommend actions.
                8. For portfolio summary: prioritize issues, highlight risks, give top 3 recommendations.
                9. For cost data: calculate dollar amounts (hours × rates), show savings/comparisons.
                10. For what-if scenarios: quantify impact (e.g., "+320 hrs/month capacity" or "saves $8K/month").

                TOOL-TO-TYPE MAPPING:
                - get_resource_profile → RESOURCE_PROFILE (parse: Name, Role, Location, Pod→POD, Rate→Billing Rate, FTE)
                - get_project_profile → PROJECT_PROFILE (parse: Name, Priority, Owner, Status, Pods→Assigned PODs, Timeline, Duration)
                - get_pod_profile → POD_PROFILE (parse: Name, Members count, member names→Team, project names→Project List, BAU→Avg BAU, Active)
                - list_resources → LIST with listType=RESOURCES (each item as "#1": "Name — Role (Location) → Pod")
                - list_projects → LIST with listType=PROJECTS (each item as "#1": "Name [Priority] | Owner: X | Status: Y")
                - get_sprint_info → SPRINT_PROFILE (if single) or LIST (if multiple)
                - get_release_info → RELEASE_PROFILE (if single) or LIST with listType=RELEASES (if multiple)
                - get_cost_rates → COST_RATE (each rate as "Role (Location)": "$X/hr")
                - get_project_estimates → PROJECT_ESTIMATES (parse: Project, Dev/QA/BSA/TL Hours, Grand Total, POD Count)
                - get_sprint_allocations → SPRINT_ALLOCATIONS (parse into allocations array)
                - get_resource_availability → RESOURCE_AVAILABILITY (parse into entries array)
                - get_project_dependencies → PROJECT_DEPENDENCIES (parse into dependencies array)
                - get_project_actuals → PROJECT_ACTUALS (parse into entries array)
                - get_effort_patterns → EFFORT_PATTERN (parse into patterns array)
                - get_role_effort_mix → ROLE_EFFORT_MIX (parse into roles array)
                - get_jira_issue → JIRA_ISSUE_PROFILE (include all fields from result)
                - search_jira_issues → JIRA_ISSUE_LIST (parse into issues array with Title and Total)
                - get_project_jira_issues → JIRA_ISSUE_LIST
                - get_jira_issue_contributors → JIRA_ISSUE_CONTRIBUTORS (parse into Contributors array)
                - get_jira_analytics_summary → use key-value pairs with relevant _type
                - get_jira_workload → LIST with workload entries
                - get_jira_sprint_health → key-value summary
                - get_jira_bug_summary → key-value summary
                - get_capacity_summary → RESOURCE_ANALYTICS (parse capacity data by month, include totals)
                - get_utilization_summary → RESOURCE_ANALYTICS (parse utilization rates, highlight over/under)
                - get_team_composition → RESOURCE_ANALYTICS (parse headcount, ratios, distributions)
                - get_portfolio_summary → RISK_SUMMARY (parse into numbered items for key findings)
                - get_overrides → LIST with listType=OVERRIDES (parse resource transfers)
                - get_tshirt_sizes → LIST with listType=CONFIG (parse size configurations)

                """);

        // Include _type markers reference (compact version)
        sb.append(buildTypeMarkersCompact());

        sb.append("\nTOOL CALLED: ").append(toolName).append("\n");
        if (toolResult.success()) {
            sb.append("TOOL RESULT:\n").append(toolResult.data()).append("\n\n");
        } else {
            sb.append("TOOL ERROR: ").append(toolResult.error()).append("\n\n");
            sb.append("Since the tool failed, set confidence=0.5 and explain the issue in message.\n\n");
        }

        if (!vectorContext.isBlank()) {
            sb.append("ADDITIONAL CONTEXT:\n").append(vectorContext).append("\n");
        }

        sb.append("""

                IMPORTANT: The examples below show the expected JSON STRUCTURE only.
                The names, numbers, and values in the examples are fictional — your response must use ONLY the actual data from the TOOL RESULT above.
                Never copy example names like "Jane Doe" or "Alpha Pod" into your output.

                SYNTHESIS EXAMPLES:

                Tool: get_resource_profile, Result: "Resource: Jane Doe | Role: DEVELOPER | Location: US | Pod: Alpha Pod | Rate: $125/hr | FTE: 1.0"
                → {
                    "intent": "DATA_QUERY", "confidence": 0.9,
                    "message": "Jane Doe is a Developer in the Alpha Pod, based in the US with a billing rate of $125/hr at full-time capacity.",
                    "data": { "_type": "RESOURCE_PROFILE", "entityName": "Jane Doe", "Name": "Jane Doe", "Role": "DEVELOPER", "POD": "Alpha Pod", "Location": "US", "Billing Rate": "$125/hr", "FTE": "1.0" },
                    "drillDown": "/resources",
                    "suggestions": ["Show Alpha Pod details", "Show all developers", "Jane Doe's availability"]
                  }

                Tool: list_resources, Result: "Found 3 resources:\\n  - Amy | QA | US | Pod: Alpha Pod\\n  - Ben | QA | INDIA | Pod: Beta Pod\\n  - Cora | QA | INDIA | Pod: Alpha Pod"
                → {
                    "intent": "DATA_QUERY", "confidence": 0.9,
                    "message": "Found 3 QA engineers across your teams.",
                    "data": { "_type": "LIST", "listType": "RESOURCES", "filterValue": "QA", "Count": "3", "#1": "Amy — QA (US) → Alpha Pod", "#2": "Ben — QA (INDIA) → Beta Pod", "#3": "Cora — QA (INDIA) → Alpha Pod" },
                    "drillDown": "/resources",
                    "suggestions": ["Show QA in India", "Show Alpha Pod", "Resource analytics"]
                  }

                Tool: list_projects, Result: "Found 3 projects:\\n  - ProjectX [P0] | Owner: Tom | Status: ACTIVE | Pods: Alpha Pod\\n  - ProjectY [P0] | Owner: Lisa | Status: ACTIVE | Pods: Beta Pod\\n  - ProjectZ [P0] | Owner: Tom | Status: ACTIVE | Pods: Alpha Pod"
                → {
                    "intent": "DATA_QUERY", "confidence": 0.9,
                    "message": "Found 3 P0 projects, all currently active.",
                    "data": { "_type": "LIST", "listType": "PROJECTS", "Count": "3", "#1": "ProjectX [P0] — Active (Owner: Tom) → Alpha Pod", "#2": "ProjectY [P0] — Active (Owner: Lisa) → Beta Pod", "#3": "ProjectZ [P0] — Active (Owner: Tom) → Alpha Pod" },
                    "drillDown": "/projects",
                    "suggestions": ["Show project health report", "Show P0 project details", "Show all projects"]
                  }

                Tool: get_release_info, Result: "Releases (2):\\n  R9.0 | Release: 2099-01-15 | Freeze: 2099-01-08 | Type: MAJOR | Status: Upcoming\\n  R9.1 | Release: 2099-01-29 | Freeze: 2099-01-22 | Type: MINOR | Status: Upcoming"
                → {
                    "intent": "DATA_QUERY", "confidence": 0.9,
                    "message": "There are 2 releases scheduled: R9.0 (Major, Jan 15) and R9.1 (Minor, Jan 29).",
                    "data": { "_type": "LIST", "listType": "RELEASES", "Count": "2", "#1": "R9.0 — MAJOR | Release: 2099-01-15 | Code Freeze: 2099-01-08 | Upcoming", "#2": "R9.1 — MINOR | Release: 2099-01-29 | Code Freeze: 2099-01-22 | Upcoming" },
                    "drillDown": "/release-calendar",
                    "suggestions": ["Show release R9.0 details", "Show upcoming releases", "Release calendar"]
                  }

                Tool: get_utilization_summary, Result: "Utilization Summary:\\n  Beta Pod: Allocated=410 | Capacity=320 | Utilization=128%\\n  Gamma Pod: Allocated=180 | Capacity=280 | Utilization=64%\\n  OVERALL: 590/600 = 98%\\n  OVER-ALLOCATED: Beta Pod"
                → {
                    "intent": "DATA_QUERY", "confidence": 0.9,
                    "message": "Overall utilization is 98% — nearly maxed out. Beta Pod is critically over-allocated at 128% (410 hrs allocated vs 320 hrs available). Meanwhile, Gamma Pod has slack at only 64% utilization. Recommendation: Consider shifting ~90 hours of lower-priority work or defer P2/P3 projects to the next sprint.",
                    "data": { "_type": "RESOURCE_ANALYTICS", "Count": "2", "#1": "Beta Pod — 128% utilization (410/320 hrs) ⚠ OVER-ALLOCATED", "#2": "Gamma Pod — 64% utilization (180/280 hrs) — has 100 hrs spare capacity", "Overall": "98% utilization (590/600 hrs)" },
                    "drillDown": "/capacity-demand-report",
                    "suggestions": ["Show Beta Pod details", "Show capacity gap report", "Team composition"]
                  }

                Tool: get_portfolio_summary, Result: "Portfolio Summary:\\n  PROJECTS (15 total): ACTIVE=8 ON_HOLD=3 NOT_STARTED=2 COMPLETED=2\\n    By Priority: P0=3 P1=5 P2=4 P3=3\\n  RESOURCES (22 total): DEV=12 QA=4 BSA=3 TL=3\\n  PODS (4): Alpha Pod(6) Beta Pod(7) Gamma Pod(5) Delta Pod(4)\\n  CURRENT SPRINT: Sprint 99-01\\n  UPCOMING RELEASES: R9.0 (2099-01-15)\\n  BLOCKERS: 2 active dependencies"
                → {
                    "intent": "INSIGHT", "confidence": 0.9,
                    "message": "Portfolio snapshot: 15 projects (8 active, 3 on hold), 22 team members across 4 pods. Key concerns: 1) 2 active project dependencies that could block delivery. 2) 3 P0 projects competing for resources — ensure they have priority allocation. 3) Release R9.0 is coming soon — confirm code freeze readiness. Recommend focusing on: unblocking the 2 blocked dependencies, and ensuring P0 projects have sprint allocations locked in.",
                    "data": { "_type": "RISK_SUMMARY", "#1": "2 active project dependencies may block delivery — review and unblock", "#2": "3 P0 projects competing for limited resources — verify sprint allocations", "#3": "Release approaching — confirm code freeze readiness", "#4": "3 projects on hold — review if any should be reactivated or cancelled" },
                    "drillDown": "/dashboard",
                    "suggestions": ["Show blocked projects", "Sprint allocations", "Utilization summary"]
                  }

                Tool: get_team_composition, Result: "Team Composition (22 total):\\n  BY ROLE: DEVELOPER=12 QA=4 BSA=3 TECH_LEAD=3\\n  BY LOCATION: US=10 INDIA=12\\n  RATIOS: Dev:QA=12:4 (3.0:1) | US:India=10:12\\n  PER POD:\\n    Alpha Pod: DEVELOPER=3 QA=1 BSA=1 TECH_LEAD=1\\n    Beta Pod: DEVELOPER=4 QA=1 BSA=1 TECH_LEAD=1"
                → {
                    "intent": "DATA_QUERY", "confidence": 0.9,
                    "message": "Your team has 22 members: 12 developers, 4 QAs, 3 BSAs, and 3 tech leads. The Dev:QA ratio is 3:1, which is slightly high — industry standard is closer to 2.5:1. Geographic split is balanced: 10 US, 12 India (55% offshore). Beta Pod has the most members (7) while Delta Pod has the fewest (4). Consider whether Delta Pod needs reinforcement.",
                    "data": { "_type": "RESOURCE_ANALYTICS", "Count": "22", "Developers": "12", "QA": "4", "BSA": "3", "Tech Leads": "3", "US": "10", "India": "12", "Dev:QA Ratio": "3.0:1", "Offshore %": "55%" },
                    "drillDown": "/resources",
                    "suggestions": ["Show pod breakdown", "Utilization by pod", "Cost comparison US vs India"]
                  }

                """);

        sb.append("""
                REMINDER: Use ONLY data from the actual tool result above. The example names (Jane Doe, Amy, Ben, Alpha Pod, Beta Pod, R9.0, etc.) are fictional — never include them in your response.
                """);
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

            log.info("LOCAL_LLM: parsed → intent={} confidence={} message='{}' dataKeys={} drillDown={}",
                    intent, confidence,
                    message != null ? message.substring(0, Math.min(100, message.length())) : "NULL",
                    data != null ? data.keySet() : "NULL",
                    drillDown);
            return new NlpResult(intent, confidence, message, route, formData, data, drillDown, suggestions, null);

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
                            .filter(r -> filterRole == null || AliasResolver.matchesField(r.role(), filterRole))
                            .filter(r -> filterLoc == null || AliasResolver.matchesField(r.location(), filterLoc))
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
            case "JIRA_ISSUE_PROFILE" -> {
                // If LLM returned a JIRA_ISSUE_PROFILE with a Key, enrich from DB
                String issueKey = data.get("Key") != null ? data.get("Key").toString() :
                        (entityName != null ? entityName.toUpperCase() : null);
                if (issueKey != null && jiraToolExecutor != null) {
                    // The data may already be fully populated from tool execution;
                    // if it only has entityName/Key, try to enrich from executor
                    if (data.size() <= 3) { // only _type, Key, entityName
                        try {
                            Map<String, Object> structured = jiraToolExecutor.lookupIssueStructured(issueKey);
                            if (structured != null) return structured;
                        } catch (Exception e) {
                            log.debug("Could not enrich JIRA_ISSUE_PROFILE for {}: {}", issueKey, e.getMessage());
                        }
                    }
                }
                return data;
            }
            case "JIRA_ISSUE_LIST" -> {
                // The LLM returned a list of Jira issues from tool execution
                // Data should already be populated from tool result; just pass through
                // Ensure _type is set correctly
                if (!data.containsKey("_type")) data.put("_type", "JIRA_ISSUE_LIST");
                return data;
            }
            case "JIRA_ISSUE_CONTRIBUTORS" -> {
                // Contributors data from get_jira_issue_contributors tool
                // If only key provided, try to enrich from executor
                String contribKey = data.get("Key") != null ? data.get("Key").toString() :
                        (entityName != null ? entityName.toUpperCase() : null);
                if (contribKey != null && jiraToolExecutor != null && data.size() <= 3) {
                    try {
                        Map<String, Object> contributors = jiraToolExecutor.getIssueContributors(contribKey);
                        if (contributors != null && !contributors.isEmpty()) {
                            Map<String, Object> enriched = new LinkedHashMap<>();
                            enriched.put("_type", "JIRA_ISSUE_CONTRIBUTORS");
                            enriched.put("Key", contribKey);
                            enriched.put("Summary", jiraToolExecutor.summarizeContributors(contributors));
                            enriched.putAll(contributors);
                            return enriched;
                        }
                    } catch (Exception e) {
                        log.debug("Could not enrich JIRA_ISSUE_CONTRIBUTORS for {}: {}", contribKey, e.getMessage());
                    }
                }
                return data;
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
                    .filter(r -> AliasResolver.matchesField(r.role(), filterValue)
                            || AliasResolver.matchesField(r.location(), filterValue)
                            || AliasResolver.matchesField(r.podName(), filterValue))
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
     * Detailed _type markers with exact field names for frontend rendering.
     */
    private String buildTypeMarkersCompact() {
        return """
                _TYPE MARKERS — use data._type and include the EXACT fields shown:

                RESOURCE_PROFILE: { "_type": "RESOURCE_PROFILE", "entityName": "<name>", "Name": "<full name>", "Role": "<role>", "POD": "<pod name>", "Location": "<US|INDIA>", "Billing Rate": "<rate>", "FTE": "<fte>" }
                PROJECT_PROFILE: { "_type": "PROJECT_PROFILE", "entityName": "<name>", "Name": "<name>", "Priority": "<P0-P3>", "Owner": "<owner>", "Status": "<status>", "Assigned PODs": "<pods>", "Timeline": "<start - end>", "Duration": "<N months>" }
                POD_PROFILE: { "_type": "POD_PROFILE", "entityName": "<name>", "Name": "<name>", "Members": "<count>", "Projects": "<count>", "Avg BAU": "<pct>", "Active": "Yes|No", "Team": "<member1, member2>", "Project List": "<proj1, proj2>" }
                SPRINT_PROFILE: { "_type": "SPRINT_PROFILE", "entityName": "<name>", "Name": "<name>", "Type": "<type>", "Start Date": "<date>", "End Date": "<date>", "Lock-in Date": "<date>", "Status": "<status>" }
                RELEASE_PROFILE: { "_type": "RELEASE_PROFILE", "entityName": "<name>", "Name": "<name>", "Release Date": "<date>", "Code Freeze": "<date>", "Type": "<MAJOR|MINOR|PATCH|HOTFIX>", "Status": "<status>" }
                LIST: { "_type": "LIST", "listType": "PROJECTS|RESOURCES|PODS", "filterValue": "<filter>", "Count": "<N>", "#1": "<item summary>", "#2": "<item summary>", ... }
                COMPARISON: { "_type": "COMPARISON", "Entity A": "<details>", "Entity B": "<details>" }
                NAVIGATE_ACTION: { "_type": "NAVIGATE_ACTION", "Page": "<page name>", "Action": "Opening..." }
                COST_RATE: { "_type": "COST_RATE", "filterRole": "<role>", "filterLocation": "<loc>", "<Role (Location)>": "$<rate>/hr", ... }
                EXPORT: { "_type": "EXPORT", "exportType": "<entity type>" }
                CAPABILITIES: { "_type": "CAPABILITIES", "Navigate": "<examples>", "Create": "<examples>", "Lookup": "<examples>", "Compare": "<examples>", "Sprint/Release": "<examples>", "Analytics": "<examples>", "Jira": "<examples>", "Budget & Cost": "<examples>", "Export": "<examples>" }
                PROJECT_ESTIMATES: { "_type": "PROJECT_ESTIMATES", "entityName": "<name>", "Project": "<name>", "Dev Hours": "<N>", "QA Hours": "<N>", "BSA Hours": "<N>", "Tech Lead Hours": "<N>", "Grand Total Hours": "<N>", "POD Count": "<N>" }
                SPRINT_ALLOCATIONS: { "_type": "SPRINT_ALLOCATIONS", "Title": "<title>", "Count": "<N>", "allocations": [{ "Sprint": "<name>", "Project": "<name>", "POD": "<name>", "Dev": "<N>", "QA": "<N>", "BSA": "<N>", "TL": "<N>", "Total": "<N>" }] }
                RESOURCE_AVAILABILITY: { "_type": "RESOURCE_AVAILABILITY", "Title": "<title>", "Count": "<N>", "entries": [{ "Resource": "<name>", "Role": "<role>", "POD": "<pod>", "Month": "<label>", "Hours": "<N>" }] }
                PROJECT_DEPENDENCIES: { "_type": "PROJECT_DEPENDENCIES", "Title": "<title>", "Count": "<N>", "dependencies": [{ "Project": "<name>", "Blocked By": "<name>", "Project Status": "<status>", "Blocker Status": "<status>" }] }
                PROJECT_ACTUALS: { "_type": "PROJECT_ACTUALS", "Title": "<title>", "Count": "<N>", "entries": [{ "Project": "<name>", "Month": "<label>", "Actual Hours": "<N>" }] }
                EFFORT_PATTERN: { "_type": "EFFORT_PATTERN", "patterns": [{ "Name": "<name>", "Description": "<desc>" }] }
                ROLE_EFFORT_MIX: { "_type": "ROLE_EFFORT_MIX", "roles": [{ "Role": "<role>", "Mix %": "<pct>" }] }
                JIRA_ISSUE_PROFILE: { "_type": "JIRA_ISSUE_PROFILE", "Key": "<KEY-123>", "Summary": "<text>", "Status": "<status>", "Priority": "<priority>", "Type": "<type>", "Assignee": "<name>", "Reporter": "<name>", "Story Points": "<N>", "Created": "<date>", "Resolved": "<date or Open>" }
                JIRA_ISSUE_LIST: { "_type": "JIRA_ISSUE_LIST", "Title": "<description>", "Total": <N>, "issues": [{ "Key": "<KEY-123>", "Summary": "<text>", "Status": "<status>", "Priority": "<priority>", "Type": "<type>", "Assignee": "<name>" }] }
                JIRA_ISSUE_CONTRIBUTORS: { "_type": "JIRA_ISSUE_CONTRIBUTORS", "Key": "<KEY-123>", "Contributors": [{ "name": "<person>", "role": "assignee|reporter|commenter|worklog", "hours": "<N or null>" }] }
                RISK_SUMMARY: { "_type": "RISK_SUMMARY", "#1": "<risk item description>", "#2": "<risk item description>", ... }
                RESOURCE_ANALYTICS: { "_type": "RESOURCE_ANALYTICS", "Count": "<N>", "Matching Resources": "<names>", "Total FTE": "<N>", "Utilization": "<summary>", "Capacity": "<summary>" }

                IMPORTANT: Use the EXACT field names shown above. The frontend renders cards based on these field names.
                Always include entityName when referencing a specific entity.

                """;
    }

    private NlpResult lowConfidenceResult() {
        return new NlpResult("UNKNOWN", 0.0, null, null, null, null, null, null, null);
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
        StringBuilder sb = new StringBuilder(8192);

        // ── Role & output format ────────────────────────────────────────────
        sb.append("""
                You are an expert intent classifier, entity extractor, and intelligent assistant for a Portfolio Planning tool \
                (Baylor Genetics resource/project management system). You have access to powerful tools that let you \
                fetch live data about resources, projects, pods, sprints, releases, costs, Jira issues, and more.

                Given a user query, you have TWO options:

                OPTION A — CALL A TOOL (if you need specific data to answer):
                Return: { "tool": "tool_name", "params": { ... } }
                USE THIS when: the user asks about specific entities, wants data lookups, metrics, analytics,
                lists, comparisons, Jira tickets, sprint health, workload, budgets, or anything requiring live data.

                OPTION B — ANSWER DIRECTLY (for greetings, navigation, help, capabilities, or general knowledge):
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
                - For DATA_QUERY about specific entities — ALWAYS use a tool (Option A) to get fresh data.
                - confidence should be 0.85-0.95 when you're confident, 0.5-0.7 if unsure.
                - Always include 2-3 helpful follow-up suggestions.
                - The "message" should be a direct, conversational answer — not robotic.
                - PREFER TOOL CALLS over guessing. If a tool can answer the question, use it.

                """);

        // ── Tool definitions ────────────────────────────────────────────────
        sb.append(toolRegistry.buildToolPromptSection());

        // ── DETAILED TOOL USAGE GUIDANCE ────────────────────────────────────
        sb.append("""
                TOOL SELECTION GUIDE (when to call which tool):

                ═══ CATEGORY 1: RESOURCE/TEAM QUERIES ═══
                - "who is X", "tell me about X" (person) → get_resource_profile(name=X)
                - "show all developers", "list QA engineers" → list_resources(role=DEVELOPER or QA)
                - "who works in India", "onshore team" → list_resources(location=INDIA or US)
                - "members of pod X" → list_resources(pod=X)
                - "X's availability", "is X free next month" → get_resource_availability(name=X)
                - "who is over-allocated", "who can take more work" → get_utilization_summary()
                - "FTE for X", "X's billing rate" → get_resource_profile(name=X)
                - "team composition", "headcount breakdown", "dev-to-QA ratio" → get_team_composition()
                - "pod X team structure", "role mix in pod X" → get_team_composition(pod=X)
                - "India vs US split", "location distribution" → get_team_composition()
                - "temporary overrides", "who is loaned out", "resource transfers" → get_overrides()
                - "X's overrides", "is X being shared" → get_overrides(resource=X)
                - "how loaded is X", "X's workload" → get_resource_availability(name=X)

                ═══ CATEGORY 2: PROJECT QUERIES ═══
                - "tell me about project X" → get_project_profile(name=X)
                - "projects owned by X", "X's projects" → list_projects(owner=X)
                - "P0 projects", "critical projects" → list_projects(priority=P0)
                - "active projects", "on-hold projects" → list_projects(status=ACTIVE or ON_HOLD)
                - "projects in pod X" → list_projects(pod=X)
                - "estimates for X", "effort for X" → get_project_estimates(name=X)
                - "actual hours for X", "actuals vs planned" → get_project_actuals(name=X)
                - "X dependencies", "what blocks X" → get_project_dependencies(name=X)
                - "project sizing", "T-shirt sizes" → get_tshirt_sizes()
                - "portfolio overview", "project summary" → get_portfolio_summary()
                - "which projects need attention" → get_portfolio_summary()

                ═══ CATEGORY 3: SPRINT & RELEASE QUERIES ═══
                - "current sprint", "sprint details" → get_sprint_info(name=current)
                - "next sprint", "upcoming sprints" → get_sprint_info(name=upcoming)
                - "sprint allocations", "what's planned this sprint" → get_sprint_allocations(filter=current)
                - "allocations for pod X this sprint" → get_sprint_allocations(filter=X)
                - "next release", "upcoming releases" → get_release_info(name=upcoming)
                - "release X details" → get_release_info(name=X)
                - "releases in March", "releases this month" → get_release_info(month=March)
                - "sprint health", "how is the sprint going" → get_jira_sprint_health(sprint=current)

                ═══ CATEGORY 4: CAPACITY, DEMAND & UTILIZATION ═══
                - "total capacity", "developer capacity" → get_capacity_summary(role=DEVELOPER)
                - "QA capacity in Q2" → get_capacity_summary(role=QA)
                - "pod capacity", "Platform pod capacity" → get_capacity_summary(pod=Platform)
                - "India team capacity" → get_capacity_summary(location=INDIA)
                - "utilization rate", "are we over capacity" → get_utilization_summary()
                - "pod utilization", "which pod is most utilized" → get_utilization_summary()
                - "who is overallocated", "overloaded resources" → get_utilization_summary()
                - "capacity gap", "are we short-staffed" → get_utilization_summary()
                - "do we need to hire", "hiring needs" → get_utilization_summary() then analyze
                - "demand for next month" → get_sprint_allocations(filter=upcoming)
                - "capacity vs demand" → get_utilization_summary()
                When answering capacity/demand/utilization questions, provide ANALYTICAL insights:
                - Calculate the gap (demand minus supply) and what it means
                - Flag which roles or pods are constrained
                - Suggest actions (hire, reallocate, delay project)
                - Consider BAU overhead in your analysis

                ═══ CATEGORY 5: JIRA QUERIES ═══
                - "TAT-123", "BGENG-456", any ticket key → get_jira_issue(key=TAT-123)
                - "search for bugs in TAT" → search_jira_issues(project=TAT, type=Bug)
                - "open stories assigned to John" → search_jira_issues(type=Story, status=In Progress, assignee=John)
                - "find high priority issues" → search_jira_issues(priority=High)
                - "issues with label X" → search_jira_issues(label=X)
                - "search for login issues" → search_jira_issues(text=login)
                - "tickets for project SgNIPT" → get_project_jira_issues(project_name=SgNIPT)
                - "issues under Portal Redesign" → get_project_jira_issues(project_name=Portal Redesign)
                - "who worked on TAT-123" → get_jira_issue_contributors(key=TAT-123)
                - "hours logged on CEP-456" → get_jira_issue_contributors(key=CEP-456)
                - "Jira analytics", "issue metrics" → get_jira_analytics_summary()
                - "analytics for last 6 months" → get_jira_analytics_summary(months=6)
                - "team workload in Jira" → get_jira_workload()
                - "pod X workload" → get_jira_workload(pod=X)
                - "sprint health", "how's the sprint going" → get_jira_sprint_health(sprint=current)
                - "bug summary", "how many bugs" → get_jira_bug_summary()
                - "bugs in project TAT" → get_jira_bug_summary(project=TAT)

                ═══ CATEGORY 6: COST & BUDGET ═══
                - "billing rates", "rate card" → get_cost_rates()
                - "developer rate in India" → get_cost_rates(role=DEVELOPER, location=INDIA)
                - "project cost for X" → get_project_estimates(name=X) — multiply hours by rates
                - "monthly burn rate" → get_sprint_allocations(filter=current) — multiply by rates
                - "cost comparison India vs US" → get_cost_rates()
                - "T-shirt size cost", "what does XL cost" → get_tshirt_sizes() — combine with rates
                When answering cost questions, provide ANALYTICAL insights:
                - Calculate total costs by multiplying hours × rates
                - Compare India vs US costs (show savings percentage)
                - Project monthly/quarterly/annual burn rates
                - Note BAU overhead cost impact

                ═══ CATEGORY 7: REPORTS & ANALYTICS (often NAVIGATE) ═══
                For dashboard/report page requests → return NAVIGATE intent with correct route.
                For data questions phrased as "show me the report" → still use a TOOL if data is needed.
                - "show the dashboard" → NAVIGATE /dashboard
                - "capacity demand report" → NAVIGATE /capacity-demand-report
                - "DORA metrics" → NAVIGATE /dora-metrics (or HELP to explain what DORA is)
                - "give me an overview" → get_portfolio_summary()
                - "key metrics" → get_portfolio_summary()
                - "executive summary" → get_portfolio_summary()

                ═══ CATEGORY 8: NAVIGATION ═══
                Always answer with NAVIGATE intent. Match user phrases to page routes.
                Example: "open Jira analytics" → NAVIGATE /jira-analytics

                ═══ CATEGORY 9: PLANNING SCENARIOS & WHAT-IF ═══
                For scenario/what-if questions, provide ANALYTICAL guidance:
                - Explain the impact of the proposed change using available data
                - Call a relevant tool to get baseline data first
                - "what if we add 2 developers" → get_capacity_summary(role=DEVELOPER) then analyze impact
                - "what if we delay project X" → get_project_estimates(name=X) to understand effort
                - "what if we lose a QA" → get_utilization_summary(role=QA) to assess gap impact
                - For timeline simulations → NAVIGATE to /scenario-simulator or /timeline-simulator
                - Provide rough calculations in your message (e.g., "Adding 2 devs adds ~320 hrs/month")

                ═══ CATEGORY 10: INSIGHTS & RECOMMENDATIONS ═══
                For insight questions, use get_portfolio_summary() or get_utilization_summary()
                and provide DEEP ANALYTICAL responses:
                - "what should I focus on" → get_portfolio_summary() then prioritize issues
                - "biggest risks" → get_portfolio_summary() plus get_project_dependencies()
                - "hiring recommendations" → get_utilization_summary() then analyze gaps
                - "pod health" → get_utilization_summary(pod=X)
                Your message should contain specific recommendations with reasoning, not just raw data.

                ═══ CATEGORY 11: CONVERSATIONAL & HELP ═══
                Answer directly. No tool needed. See HELP TOPICS section below.

                ═══ CATEGORY 12: COMPLEX MULTI-ENTITY ═══
                Pick the MOST RELEVANT single tool call. Your synthesis step combines tool data
                with vector context to build comprehensive answers.
                - "how does project X compare to Y" → get_project_profile for one, use context for other
                - "is pod X over capacity" → get_utilization_summary(pod=X)
                - "which developer has the most tickets" → get_jira_workload()
                - "complete status for pod X" → get_pod_profile(name=X) — enriched with context
                - "summarize project X including Jira" → get_project_jira_issues(project_name=X)
                - "all P0 projects and their blockers" → get_project_dependencies()
                For ranked/sorted queries ("top 5 busiest", "rank pods"), call the best list tool
                and the synthesis step will sort/rank in the message.

                ═══ CATEGORY 13: FORM PRE-FILL ═══
                Detect creation intent and populate formData. See FORM FIELDS below.

                """);

        // ── Intents ─────────────────────────────────────────────────────────
        sb.append("""
                INTENTS (in priority order):
                1. GREETING — Hi, hello, hey, good morning, thanks, bye, appreciate it.
                   Reply with a friendly greeting + suggestions of what the user can ask.
                2. NAVIGATE — "go to pods", "open projects page", "take me to dashboard", "show me the Jira page"
                   → Set route to the matching page route. data._type = "NAVIGATE_ACTION"
                3. FORM_PREFILL — "create a project called X", "add a new developer named Y", "schedule a release"
                   → Set route = page + "?action=create", populate formData with field values.
                4. DATA_QUERY — User wants data about specific entities, lists, filters, comparisons, metrics.
                   → The data map MUST contain _type marker. PREFER calling a tool for accurate data.
                5. INSIGHT — "which pods are at risk?", "who is over-allocated?", "hiring needs",
                   "what should we focus on?", "capacity concerns"
                   → Analytical/advisory questions. data._type can be "RISK_SUMMARY" or "RESOURCE_ANALYTICS".
                   → Consider calling list_resources() or get_sprint_allocations() for data-backed insights.
                6. HELP — "what is a pod?", "how do sprints work?", "explain t-shirt sizing", "what is FTE",
                   "how does the demand dashboard work?", "what are DORA metrics?"
                   → Return helpful explanation in message. No tool call needed.
                7. EXPORT — "export projects to CSV", "download resource list", "export sprint data"
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
                  data: { "_type": "EFFORT_PATTERN", "entityName": "all" }
                - "ROLE_EFFORT_MIX" — Standard role effort percentages.
                  data: { "_type": "ROLE_EFFORT_MIX" }
                - "JIRA_ISSUE_PROFILE" — Single Jira issue lookup by key.
                  data: { "_type": "JIRA_ISSUE_PROFILE", "Key": "PROJ-123", "Summary": "...", ... }
                - "JIRA_ISSUE_LIST" — List of Jira issues (from search or project mapping).
                  data: { "_type": "JIRA_ISSUE_LIST", "Title": "...", "Total": N, "issues": [...] }
                - "JIRA_ISSUE_CONTRIBUTORS" — Who worked on a ticket with hours logged.
                  data: { "_type": "JIRA_ISSUE_CONTRIBUTORS", "Key": "...", "Contributors": [...] }

                """);

        // ── Jira intelligence section ───────────────────────────────────────
        sb.append("""
                JIRA INTEGRATION GUIDE:
                This system has full Jira integration. When users mention tickets, bugs, stories, sprints \
                (in Jira context), workload, velocity, or any development tracking concept, USE A JIRA TOOL.

                JIRA TICKET LOOKUP:
                When the user asks about a specific Jira ticket (e.g. "TAT-123", "tell me about PROJ-456",
                "what is the status of BGENG-789", "summarize TAT-100"), ALWAYS call get_jira_issue.
                Synthesize with data._type=JIRA_ISSUE_PROFILE.

                JIRA SEARCH:
                When users want to find issues by criteria — "show bugs in TAT", "open stories",
                "high priority tickets", "issues assigned to John" — call search_jira_issues.
                Synthesize with data._type=JIRA_ISSUE_LIST.

                JIRA PROJECT ISSUES:
                When user asks about tickets for a Portfolio Planner project — "tickets for SgNIPT",
                "Jira issues under Portal Redesign", "progress on X" — call get_project_jira_issues.
                This uses the project-to-Jira mapping (via epic name or label). Synthesize with JIRA_ISSUE_LIST.

                JIRA CONTRIBUTORS:
                "who worked on TAT-123", "hours logged on CEP-456", "contributors to BGENG-789"
                → call get_jira_issue_contributors. Synthesize with JIRA_ISSUE_CONTRIBUTORS.

                JIRA ANALYTICS:
                "Jira metrics", "issue trends", "velocity", "throughput", "cycle time", "created vs resolved"
                → call get_jira_analytics_summary. Present as DATA_QUERY with insightful message.

                JIRA WORKLOAD:
                "team workload", "who has the most tickets", "assignee breakdown", "workload distribution"
                → call get_jira_workload.

                JIRA SPRINT HEALTH:
                "sprint progress", "how's the sprint", "sprint burndown", "sprint completion"
                → call get_jira_sprint_health.

                JIRA BUGS:
                "bug count", "open bugs", "bug trend", "critical bugs", "bug resolution time"
                → call get_jira_bug_summary.

                """);

        // ── Capacity & Planning intelligence ────────────────────────────────
        sb.append("""
                CAPACITY & PLANNING GUIDE:
                The system tracks resource capacity, sprint allocations, and project demand.

                KEY TOOLS for Category 4 (Capacity/Demand/Utilization):
                - get_capacity_summary(role, pod, location) → aggregated capacity hours by month
                - get_utilization_summary(pod, role) → utilization rates: allocated vs available
                - get_resource_availability(name) → individual resource capacity by month
                - get_sprint_allocations(filter) → allocated hours per sprint/project/pod

                CAPACITY QUESTIONS:
                - "total capacity" → get_capacity_summary()
                - "developer capacity for Q2" → get_capacity_summary(role=DEVELOPER)
                - "pod capacity" → get_capacity_summary(pod=X)
                - "India team capacity" → get_capacity_summary(location=INDIA)
                - "capacity forecast next 6 months" → get_capacity_summary()
                - "is X available?" → get_resource_availability(name=X)

                DEMAND QUESTIONS:
                - "total demand" → get_sprint_allocations(filter=current)
                - "demand by project" → get_sprint_allocations()
                - "demand trend" → get_sprint_allocations() — analyze across sprints

                UTILIZATION & GAP ANALYSIS:
                - "utilization rate" → get_utilization_summary()
                - "who is overallocated" → get_utilization_summary()
                - "capacity gap" → get_utilization_summary() — compare allocated vs available
                - "are we short-staffed" → get_utilization_summary()
                - "bottleneck" → get_utilization_summary() — identify highest-utilized pod/role

                HIRING & FORECASTING:
                - "do we need to hire" → get_utilization_summary() — if >85% overall, recommend hiring
                - "how many developers to hire" → get_utilization_summary(role=DEVELOPER) — calculate gap
                - "bench strength" → get_utilization_summary() — find <50% utilized resources
                - "onshore vs offshore split" → get_team_composition()

                CONCURRENCY & RISK:
                - "concurrency risk" → get_overrides() + get_utilization_summary()
                - "resource conflicts" → get_utilization_summary() — flag >100% utilized
                - "scheduling conflicts" → get_sprint_allocations() — look for overloaded sprints

                ANALYTICAL GUIDANCE for capacity responses:
                When answering capacity/demand questions, your message MUST include:
                1. The raw numbers (total capacity, total demand)
                2. The gap or surplus (positive = surplus, negative = gap)
                3. Which role/pod is most constrained
                4. A recommendation (hire, reallocate, or defer work)
                Example: "The Platform pod has 320 hrs available but 410 hrs allocated — a 90-hour gap (128% utilization). Consider deferring lower-priority work or temporarily shifting resources from under-utilized pods."

                """);

        // ── Budget & Cost intelligence ──────────────────────────────────────
        sb.append("""
                BUDGET & COST GUIDE:
                Cost = Hours × Billing Rate. Use get_project_estimates for hours and get_cost_rates for rates.

                COST RATES: "rate card" → get_cost_rates()
                PROJECT COSTS: "cost of X" → get_project_estimates(name=X) — multiply hours × rates in synthesis
                MONTHLY BURN: "burn rate" → get_sprint_allocations(filter=current) — multiply totals × blended rate
                COMPARISON: "India vs US cost" → get_cost_rates() — calculate savings percentage
                CAPEX/OPEX: "CapEx" → HELP explaining concept, or get_jira_analytics_summary for story/bug split
                BAU COST: "BAU cost" → get_pod_profile for BAU% × capacity × rates
                SIZING: "T-shirt sizes" → get_tshirt_sizes() — XS/S/M/L/XL mapped to base hours

                In cost responses, always calculate dollar amounts (hours × rate), show comparisons, and give recommendations.

                """);

        // ── Scenario & What-If intelligence ──────────────────────────────────
        sb.append("""
                SCENARIO & WHAT-IF GUIDE (Category 9):
                For what-if questions, CALL A TOOL to get baseline data, then provide analytical reasoning.
                - "what if we add 2 developers" → get_capacity_summary(role=DEVELOPER) to get current capacity, \
                  then calculate: +2 devs × ~160 hrs/month = +320 hrs additional capacity
                - "what if we delay project X" → get_project_estimates(name=X) to understand effort released
                - "what if we lose a QA" → get_utilization_summary(role=QA) to assess impact on QA gap
                - "what if we reassign X to pod Y" → get_team_composition(pod=Y) to see current staffing
                - "what if rates increase by 15%" → get_cost_rates() then calculate new totals
                For timeline simulation or complex scenarios → NAVIGATE to /scenario-simulator or /timeline-simulator
                Always quantify the impact: "Adding 2 India developers saves ~$X/month while adding Y capacity hours."

                """);

        // ── Insights & Recommendations intelligence ──────────────────────────
        sb.append("""
                INSIGHTS & RECOMMENDATIONS GUIDE (Category 10):
                For insight questions, use get_portfolio_summary() or get_utilization_summary() as your baseline.
                Your response MUST be analytical, not just data. Include:
                1. Key finding (what is the most important issue)
                2. Supporting data (specific numbers)
                3. Recommendation (specific action to take)
                4. Priority (what to address first)

                Examples of analytical responses:
                - "what should I focus on" → get_portfolio_summary() → "3 P0 projects are blocked by dependencies. \
                  The Platform pod is at 120% utilization. Recommend: 1) Unblock Project X by completing its dependency, \
                  2) Shift 1 developer from Data pod (65% utilized) to Platform pod."
                - "are we staffed correctly" → get_team_composition() + get_utilization_summary() → \
                  "Dev:QA ratio is 5:1 which is high. QA utilization is 110% while dev is 75%. Recommend hiring 2 QAs."

                """);

        // ── Complex Multi-Entity intelligence ────────────────────────────────
        sb.append("""
                COMPLEX QUERY GUIDE (Category 12):
                For cross-domain questions requiring multiple data sources, pick the BEST single tool
                that gives you the most relevant data. Your synthesis step can combine that with
                vector context to answer comprehensively.

                STRATEGY:
                - Aggregate questions ("total hours across all projects") → get_portfolio_summary()
                - Comparison questions ("compare pod A vs B") → get_pod_profile for A, use context for B
                - Cross-entity ("John's projects and Jira tickets") → get_project_jira_issues or list_projects
                - Ranked/sorted ("top 5 busiest resources") → get_utilization_summary() — sort in synthesis
                - Conditional ("P0 projects that are blocked") → get_project_dependencies()
                - Predictive ("will we meet the deadline") → get_sprint_allocations + context → analytical estimate

                """);

        // ── Help topics ─────────────────────────────────────────────────────
        sb.append("""
                HELP TOPICS (answer directly without tools — provide DEEP explanations):
                - POD: A cross-functional team/squad of developers, QA, BSA, and tech leads working together. Each pod has its own capacity, BAU%, and project assignments. Pods own their deliverables end-to-end.
                - Sprint: A 2-week development cycle with start/end/lock-in dates. Lock-in date is when requirements freeze. Sprints can be regular or IP weeks. Sprint planning allocates hours per project per pod.
                - Release: A versioned deployment (MAJOR/MINOR/PATCH/HOTFIX) with code freeze date. Code freeze is when feature work stops. The gap between freeze and release is for testing/hardening.
                - T-shirt Sizing: Project estimation method using XS/S/M/L/XL mapped to base hour ranges. Combined with role effort mix to distribute across roles. Quick estimation before detailed planning.
                - FTE: Full-Time Equivalent — 1.0 = full time (~160 hrs/month), 0.5 = half time. Used to calculate available capacity hours for each resource.
                - BAU: Business As Usual — routine maintenance, support, and operational work. Measured as % of total capacity. A 20% BAU means only 80% of capacity is available for project work.
                - IP Week: Innovation/Planning week between sprints. Time for exploration, tech debt reduction, learning, and planning. Not allocated to project work.
                - Code Freeze: Period before release where no new features are merged. Only bug fixes and release hardening allowed. Duration varies by release type.
                - Complexity Multiplier: Factor (0.5-2.0) applied to project hour estimates based on pod capabilities. A multiplier of 1.2 means work takes 20% longer in that pod.
                - DORA Metrics: Four key DevOps performance indicators: Deployment Frequency (how often you ship), Lead Time for Changes (commit to production), Change Failure Rate (% of deploys causing issues), Mean Time to Recovery (time to fix production issues).
                - Story Points: Relative estimation unit in Jira measuring effort/complexity. Not hours — they represent relative difficulty. Fibonacci scale (1,2,3,5,8,13) is common.
                - Velocity: Average story points completed per sprint. Used for sprint planning and predicting delivery timelines. Tracks team throughput over time.
                - Owner Demand: Total hours demanded by a project owner across ALL their projects. Helps identify owners whose projects are consuming the most resources.
                - Contingency: Buffer percentage (typically 10-20%) added to project estimates to account for unknowns, risks, and scope creep. Higher contingency for riskier projects.
                - Effort Pattern: How project work is distributed across its timeline. Front-loaded = more work upfront, Back-loaded = more work toward delivery, Even = uniform distribution, Bell Curve = peaks in the middle.
                - Role Effort Mix: Standard percentage breakdown of project work across roles. Example: Dev 50%, QA 25%, BSA 15%, TL 10%. Used with T-shirt sizes for quick estimation.
                - Capacity: Total available working hours for a team/resource. Calculated as: FTE × Working Hours × (1 - BAU%). Tracked monthly for planning.
                - Demand: Total hours needed by active projects. Comes from project estimates + effort patterns spread across sprints. Compared to capacity for gap analysis.
                - Utilization: Ratio of allocated hours to available capacity. >100% = overallocated, <70% = underutilized. Target is typically 80-90%.
                - Capacity Gap: Demand minus Capacity. Positive gap = need more resources. Negative gap = surplus capacity. Tracked by role and pod.
                - CapEx vs OpEx: CapEx (Capital Expenditure) = new feature development (capitalizable). OpEx (Operating Expenditure) = maintenance, bugs, support. Important for financial reporting.
                - Concurrency Risk: Risk when the same resource or pod is allocated to multiple overlapping projects. Can cause context-switching and productivity loss.
                - Scenario Simulation: What-if analysis tool to model changes (add/remove resources, delay projects, change priorities) and see impact on capacity, timeline, and budget.

                """);

        // ── Synonym handling ────────────────────────────────────────────────
        sb.append("""
                SYNONYM HANDLING (important for matching user intent):
                - "under", "owned by", "belonging to", "managed by", "assigned to" → owner/assignment relationship
                - "team", "squad", "group", "pod" → POD entity
                - "dev", "developer", "engineer", "coder", "programmer", "SDE", "SWE" → DEVELOPER role
                - "qa", "tester", "quality", "testing", "SDET", "test engineer" → QA role
                - "bsa", "analyst", "business analyst", "requirements", "BA", "business systems" → BSA role
                - "lead", "tech lead", "senior", "principal", "architect", "TL" → TECH_LEAD role
                - "india", "offshore", "indian team", "IDC", "Hyderabad", "Bangalore", "Chennai" → INDIA location
                - "us", "onshore", "domestic", "stateside", "US team", "Houston", "Texas" → US location
                - "stuck", "blocked", "stalled", "delayed", "at risk", "paused", "on ice" → ON_HOLD or risk
                - "done", "finished", "completed", "closed", "shipped", "delivered", "wrapped up" → COMPLETED status
                - "new", "upcoming", "not started", "pending", "backlog", "queued", "in the pipeline" → NOT_STARTED status
                - "active", "in progress", "ongoing", "current", "live", "running", "in flight" → ACTIVE status
                - "cancelled", "killed", "scrapped", "dropped", "axed", "shelved" → CANCELLED status
                - "discovery", "planning", "scoping", "exploratory", "in discovery" → IN_DISCOVERY status
                - "ticket", "issue", "story", "bug", "epic", "task", "item", "card" → Jira issue
                - "sprint", "iteration", "cycle", "two-week", "cadence" → Sprint entity
                - "release", "deployment", "ship", "go-live", "launch", "rollout", "push", "cut" → Release entity
                - "hours", "effort", "estimate", "sizing", "how long", "how much work", "LOE" → Project estimates
                - "rate", "cost", "billing", "charge", "hourly", "per hour", "price" → Cost rates
                - "availability", "capacity", "bandwidth", "free time", "spare hours", "open slots" → Resource availability
                - "allocation", "assigned hours", "planned hours", "booked", "committed" → Sprint allocations
                - "headcount", "HC", "FTE", "full-time equivalent", "head count" → Team composition
                - "burndown", "velocity", "throughput", "completed points" → Sprint health / DORA
                - "bottleneck", "constraint", "limiting factor", "choke point" → Capacity demand / risk
                - "reassigned", "moved", "transferred", "loaned", "borrowed", "temp move" → Overrides
                - "budget", "spend", "burn", "run rate", "monthly cost", "total cost" → Budget queries
                - "capex", "capital", "capitalizable", "investment" → CapEx tracking
                - "opex", "operational", "maintenance", "run cost" → OpEx tracking
                - "forecast", "projection", "predict", "trajectory", "outlook" → Hiring / capacity forecast

                FOLLOW-UP & CONTEXT HANDLING:
                When previous conversation context is provided, use it to resolve:
                - Pronouns: "his", "her", "their", "its", "that project", "this pod" → resolve from prior Q&A
                - Implicit references: "and the QA team?", "what about India?", "same for Platform" → carry forward prior entity/filter
                - Drill-downs: "show me more", "details", "break it down" → use same tool with deeper params
                - Comparisons to prior results: "how does that compare to last month" → reuse prior tool + add time filter
                - Negations of prior: "no, I meant the other one", "not that, the API pod" → correct entity from context

                AMBIGUITY RESOLUTION:
                When a query is ambiguous, prefer this priority order:
                1. If a name matches a known RESOURCE, treat it as resource lookup (most common)
                2. If a name matches a known PROJECT, treat it as project lookup
                3. If a name matches a known POD, treat it as pod lookup
                4. If the query contains both an entity name AND a question ("what projects is X on"), resolve the cross-entity
                5. If truly ambiguous, use get_portfolio_summary as a safe fallback
                6. Never guess or hallucinate — use vector context to disambiguate when available

                ANALYTICAL DEPTH EXPECTATIONS:
                Users expect more than raw data — they want INSIGHTS. For every tool result:
                - Calculate ratios, percentages, and comparisons when data supports it
                - Flag anomalies (over-allocated, zero QA in a pod, stale projects)
                - Provide actionable recommendations (not vague advice)
                - Quantify impact when possible (dollar amounts, hour savings, % changes)
                - Reference industry benchmarks where relevant (Dev:QA 2.5:1, utilization 80-90%)

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

        // ── Comprehensive Examples ──────────────────────────────────────────
        sb.append("""
                EXAMPLES (these use placeholder names — match the PATTERN, not the specific names):

                === RESOURCE QUERIES ===
                Query: "who is Sarah?"
                → { "tool": "get_resource_profile", "params": { "name": "Sarah" } }

                Query: "show all QA engineers"
                → { "tool": "list_resources", "params": { "role": "QA" } }

                Query: "developers in India"
                → { "tool": "list_resources", "params": { "role": "DEVELOPER", "location": "INDIA" } }

                Query: "what's John's availability?"
                → { "tool": "get_resource_availability", "params": { "name": "John" } }

                Query: "members of API pod"
                → { "tool": "list_resources", "params": { "pod": "API" } }

                === PROJECT QUERIES ===
                Query: "give me all projects under BD"
                → { "tool": "list_projects", "params": { "owner": "BD" } }

                Query: "show active projects"
                → { "tool": "list_projects", "params": { "status": "ACTIVE" } }

                Query: "P0 projects"
                → { "tool": "list_projects", "params": { "priority": "P0" } }

                Query: "what are the estimates for SgNIPT?"
                → { "tool": "get_project_estimates", "params": { "name": "SgNIPT" } }

                Query: "actual hours for Portal Redesign"
                → { "tool": "get_project_actuals", "params": { "name": "Portal Redesign" } }

                Query: "is SgNIPT blocked by anything?"
                → { "tool": "get_project_dependencies", "params": { "name": "SgNIPT" } }

                === POD QUERIES ===
                Query: "tell me about API pod"
                → { "tool": "get_pod_profile", "params": { "name": "API" } }

                === SPRINT & RELEASE QUERIES ===
                Query: "current sprint details"
                → { "tool": "get_sprint_info", "params": { "name": "current" } }

                Query: "what's allocated for the current sprint?"
                → { "tool": "get_sprint_allocations", "params": { "filter": "current" } }

                Query: "next release"
                → { "tool": "get_release_info", "params": { "name": "upcoming" } }

                === COST QUERIES ===
                Query: "billing rate for developers in India"
                → { "tool": "get_cost_rates", "params": { "role": "DEVELOPER", "location": "INDIA" } }

                Query: "show all cost rates"
                → { "tool": "get_cost_rates", "params": {} }

                === JIRA QUERIES ===
                Query: "TAT-123"
                → { "tool": "get_jira_issue", "params": { "key": "TAT-123" } }

                Query: "tell me about BGENG-456"
                → { "tool": "get_jira_issue", "params": { "key": "BGENG-456" } }

                Query: "search for open bugs in TAT project"
                → { "tool": "search_jira_issues", "params": { "project": "TAT", "type": "Bug", "status": "To Do" } }

                Query: "stories assigned to John"
                → { "tool": "search_jira_issues", "params": { "type": "Story", "assignee": "John" } }

                Query: "high priority issues"
                → { "tool": "search_jira_issues", "params": { "priority": "High" } }

                Query: "tickets for SgNIPT project"
                → { "tool": "get_project_jira_issues", "params": { "project_name": "SgNIPT" } }

                Query: "who worked on TAT-123"
                → { "tool": "get_jira_issue_contributors", "params": { "key": "TAT-123" } }

                Query: "Jira analytics for the last 6 months"
                → { "tool": "get_jira_analytics_summary", "params": { "months": 6 } }

                Query: "team workload from Jira"
                → { "tool": "get_jira_workload", "params": {} }

                Query: "how's the current sprint going?"
                → { "tool": "get_jira_sprint_health", "params": { "sprint": "current" } }

                Query: "bug summary for last quarter"
                → { "tool": "get_jira_bug_summary", "params": { "months": 3 } }

                Query: "find issues about login"
                → { "tool": "search_jira_issues", "params": { "text": "login" } }

                === EFFORT & PLANNING ===
                Query: "what effort patterns are available?"
                → { "tool": "get_effort_patterns", "params": {} }

                Query: "standard role effort mix"
                → { "tool": "get_role_effort_mix", "params": {} }

                === NAVIGATION (answer directly — no tool) ===
                Query: "go to projects"
                → { "intent": "NAVIGATE", "confidence": 0.95, "message": "Opening Projects page.", "route": "/projects", "data": { "_type": "NAVIGATE_ACTION", "Page": "Projects", "Action": "Opening..." }, "suggestions": ["Show active projects", "Create a new project"] }

                Query: "open Jira dashboard"
                → { "intent": "NAVIGATE", "confidence": 0.95, "message": "Opening Jira Dashboard.", "route": "/jira-dashboard-builder", "data": { "_type": "NAVIGATE_ACTION", "Page": "Jira Dashboard", "Action": "Opening..." }, "suggestions": ["Show Jira analytics", "Sprint health"] }

                === FORM PREFILL (answer directly — no tool) ===
                Query: "create a P1 project called Mobile App owned by John"
                → { "intent": "FORM_PREFILL", "confidence": 0.9, "message": "I'll set up the project creation form for you.", "route": "/projects?action=create", "formData": { "name": "Mobile App", "priority": "P1", "owner": "John" }, "suggestions": ["Show all projects", "Show John's projects"] }

                Query: "add a new developer named Alex in India"
                → { "intent": "FORM_PREFILL", "confidence": 0.9, "message": "Setting up the resource creation form.", "route": "/resources?action=create", "formData": { "name": "Alex", "role": "DEVELOPER", "location": "INDIA" }, "suggestions": ["Show India team", "Show all developers"] }

                === GREETING (answer directly — no tool) ===
                Query: "hello"
                → { "intent": "GREETING", "confidence": 0.95, "message": "Hello! I'm your Portfolio Planning assistant. I can help with project data, resource info, Jira tickets, sprint details, cost rates, and more. What would you like to know?", "suggestions": ["Show active projects", "Current sprint status", "Team workload"] }

                === HELP (answer directly — no tool) ===
                Query: "what is a pod?"
                → { "intent": "HELP", "confidence": 0.9, "message": "A POD is a cross-functional team that typically includes developers, QA engineers, a BSA, and a tech lead. PODs are assigned to projects and have their own capacity and allocation planning.", "suggestions": ["Show all pods", "Pod capacity details"] }

                Query: "what are DORA metrics?"
                → { "intent": "HELP", "confidence": 0.9, "message": "DORA metrics are four key measures of software delivery performance: Deployment Frequency (how often you deploy), Lead Time for Changes (time from commit to production), Change Failure Rate (percentage of deployments causing failures), and Mean Time to Recovery (how quickly you recover from failures). They help assess your team's DevOps maturity.", "suggestions": ["Show Jira analytics", "Sprint health check"] }

                Query: "what can you do?"
                → { "intent": "DATA_QUERY", "confidence": 0.95, "message": "I can help you with a wide range of portfolio planning tasks!", "data": { "_type": "CAPABILITIES" }, "suggestions": ["Show active projects", "Current sprint status", "Team workload"] }

                === EXPORT (answer directly — no tool) ===
                Query: "export projects to CSV"
                → { "intent": "EXPORT", "confidence": 0.9, "message": "I'll prepare the project data export for you.", "data": { "_type": "EXPORT", "exportType": "projects" }, "suggestions": ["Show all projects", "Export resources"] }

                === COMPARISON ===
                Query: "compare API pod and Frontend pod"
                → { "tool": "get_pod_profile", "params": { "name": "API" } }

                === APP / CAPABILITIES (answer directly — no tool) ===
                Query: "tell me about this app"
                → { "intent": "HELP", "confidence": 0.95, "message": "This is the Portfolio Planner — a resource and project management tool for Baylor Genetics. Here's what I can help with:", "data": { "_type": "CAPABILITIES", "Navigate": "\"Go to projects page\", \"Open sprint calendar\"", "Create": "\"Create a new project called Alpha\", \"Add a developer\"", "Lookup": "\"Who is John?\", \"Tell me about SgNIPT\", \"API pod details\"", "Compare": "\"Compare API pod vs Platform pod\"", "Sprint/Release": "\"Current sprint\", \"Next release\", \"Upcoming releases\"", "Jira": "\"Show BGENG-123\", \"Open bugs in TAT\", \"Sprint health\"", "Analytics": "\"Team workload\", \"Resource analytics\", \"DORA metrics\"", "Budget & Cost": "\"Cost rates\", \"Project budget\", \"Billing rates\"", "Export": "\"Export projects CSV\", \"Download resource list\"" }, "suggestions": ["Show active projects", "Current sprint", "Team workload"] }

                === RESOURCE SEARCH (tool call) ===
                Query: "is there someone named Piyush"
                → { "tool": "list_resources", "params": { "name": "Piyush" } }

                Query: "do we have anyone called Sarah"
                → { "tool": "list_resources", "params": { "name": "Sarah" } }

                === RELEASE DATE QUERIES (tool call) ===
                Query: "give me releases in march 2026"
                → { "tool": "get_release_info", "params": { "month": "march 2026" } }

                Query: "what releases are coming up in April"
                → { "tool": "get_release_info", "params": { "month": "April" } }

                === WHAT IS X WORKING ON (tool call) ===
                Query: "what is Ojas working on"
                → { "tool": "list_projects", "params": { "owner": "Ojas" } }

                Query: "what projects does Sarah work on"
                → { "tool": "list_projects", "params": { "owner": "Sarah" } }

                === CAPACITY / HELP (answer directly — no tool) ===
                Query: "how is capacity calculated"
                → { "intent": "HELP", "confidence": 0.9, "message": "Capacity in Portfolio Planner is calculated based on each resource's FTE (Full-Time Equivalent), their BAU (Business As Usual) percentage, and any temporary overrides. The formula is: Available Hours = FTE × Sprint Working Hours × (1 - BAU%). These available hours are then allocated across projects via the Sprint Planner. The Capacity Gap Report shows the difference between demand (allocated project hours) and supply (available capacity).", "suggestions": ["Show capacity gap report", "Resource availability", "Sprint allocations"] }

                === CAPACITY & UTILIZATION (tool call) ===
                Query: "what is the total developer capacity for next month"
                → { "tool": "get_capacity_summary", "params": { "role": "DEVELOPER" } }

                Query: "utilization rate"
                → { "tool": "get_utilization_summary", "params": {} }

                Query: "is the Platform pod over capacity"
                → { "tool": "get_utilization_summary", "params": { "pod": "Platform" } }

                Query: "who is overallocated"
                → { "tool": "get_utilization_summary", "params": {} }

                Query: "do we need to hire"
                → { "tool": "get_utilization_summary", "params": {} }

                === TEAM COMPOSITION (tool call) ===
                Query: "what is our team composition"
                → { "tool": "get_team_composition", "params": {} }

                Query: "dev to QA ratio in the Mobile pod"
                → { "tool": "get_team_composition", "params": { "pod": "Mobile" } }

                Query: "how many people by role"
                → { "tool": "get_team_composition", "params": {} }

                === PORTFOLIO / INSIGHTS (tool call) ===
                Query: "give me an overview of the portfolio"
                → { "tool": "get_portfolio_summary", "params": {} }

                Query: "what needs my attention"
                → { "tool": "get_portfolio_summary", "params": {} }

                Query: "executive summary"
                → { "tool": "get_portfolio_summary", "params": {} }

                Query: "what should I focus on"
                → { "tool": "get_portfolio_summary", "params": {} }

                === OVERRIDES & RESOURCE TRANSFERS ===
                Query: "show me all active overrides"
                → { "tool": "get_overrides", "params": {} }

                Query: "who is temporarily reassigned"
                → { "tool": "get_overrides", "params": {} }

                Query: "is John being loaned to another pod"
                → { "tool": "get_overrides", "params": { "resource": "John" } }

                === T-SHIRT SIZING ===
                Query: "what are the T-shirt sizes"
                → { "tool": "get_tshirt_sizes", "params": {} }

                Query: "what does an XL project cost"
                → { "tool": "get_tshirt_sizes", "params": {} }

                === SCENARIO / WHAT-IF ===
                Query: "what if we add 2 developers"
                → { "tool": "get_capacity_summary", "params": { "role": "DEVELOPER" } }

                Query: "what happens if we delay Project Alpha"
                → { "tool": "get_project_estimates", "params": { "name": "Project Alpha" } }

                Query: "what if we lose a QA"
                → { "tool": "get_utilization_summary", "params": { "role": "QA" } }

                """);

        sb.append("Return ONLY the JSON object. No text before or after it.");

        return sb.toString();
    }
}
