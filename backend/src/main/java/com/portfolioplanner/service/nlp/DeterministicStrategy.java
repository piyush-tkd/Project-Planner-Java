package com.portfolioplanner.service.nlp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Deterministic strategy — runs FIRST in the chain.
 * Handles known query patterns using regex matching → direct tool execution → template response.
 *
 * Zero LLM involvement. 100% reproducible. Sub-50ms latency.
 * This is the primary query handler — covers 70-80% of all queries.
 *
 * Pre-computed routes extracted from LocalLlmStrategy + enhanced with additional patterns.
 */
@Component
public class DeterministicStrategy implements NlpStrategy {

    private static final Logger log = LoggerFactory.getLogger(DeterministicStrategy.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final NlpToolRegistry toolRegistry;
    private final NlpJiraToolExecutor jiraToolExecutor;
    private final NlpResponseBuilder responseBuilder;

    public DeterministicStrategy(NlpToolRegistry toolRegistry,
                                  NlpJiraToolExecutor jiraToolExecutor,
                                  NlpResponseBuilder responseBuilder) {
        this.toolRegistry = toolRegistry;
        this.jiraToolExecutor = jiraToolExecutor;
        this.responseBuilder = responseBuilder;
    }

    @Override
    public String name() {
        return "DETERMINISTIC";
    }

    @Override
    public boolean isAvailable() {
        return true; // Always available — no external dependencies
    }

    @Override
    public NlpResult classify(String query, NlpCatalogResponse catalog) {
        // Try regex-based route matching
        RouteMatch match = tryRegexRoute(query);
        if (match != null) {
            return executeRoute(match, catalog);
        }
        // No match — return low confidence so the next strategy in chain takes over
        return new NlpResult("UNKNOWN", 0.0, null, null, null, null, null, null, null);
    }

    // ══════════════════════════════════════════════════════════════════
    //  ROUTE EXECUTION
    // ══════════════════════════════════════════════════════════════════

    private NlpResult executeRoute(RouteMatch match, NlpCatalogResponse catalog) {
        try {
            log.info("DETERMINISTIC: route → tool={} params={}", match.toolName, match.params);

            // Execute the tool
            JsonNode toolParams = objectMapper.valueToTree(match.params);
            NlpToolRegistry.ToolResult toolResult;

            if (match.toolName.startsWith("get_jira_") || match.toolName.equals("search_jira_issues")) {
                toolResult = jiraToolExecutor.executeTool(match.toolName, toolParams);
            } else {
                toolResult = toolRegistry.executeTool(match.toolName, toolParams, catalog);
            }

            log.debug("DETERMINISTIC: tool result success={}, output length={}",
                    toolResult.success(),
                    toolResult.success() && toolResult.data() != null ? toolResult.data().length() : 0);

            // Build response deterministically — no LLM
            return responseBuilder.buildFromToolResult(match.toolName, match.params, toolResult);
        } catch (Exception e) {
            log.warn("DETERMINISTIC: tool execution failed for {}: {}", match.toolName, e.getMessage());
            return responseBuilder.buildErrorResult(match.toolName, match.params,
                    "Sorry, I encountered an error fetching that data. Please try again.");
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  REGEX ROUTE MATCHING
    // ══════════════════════════════════════════════════════════════════

    private RouteMatch tryRegexRoute(String query) {
        for (RoutePattern rp : ROUTES) {
            Matcher m = rp.pattern.matcher(query);
            if (m.matches()) {
                Map<String, String> params = new LinkedHashMap<>();
                if (rp.paramName != null) {
                    if (rp.fixedValue != null) {
                        params.put(rp.paramName, rp.fixedValue);
                    } else {
                        // Extract the first capturing group as the param value
                        String value = m.group(1);
                        if (value != null) {
                            value = value.trim();
                            // Normalize status values: "on-hold" → "ON_HOLD", "active" → "ACTIVE"
                            if ("status".equals(rp.paramName)) {
                                value = value.replaceAll("[\\-\\s]", "_").toUpperCase();
                            }
                            params.put(rp.paramName, value);
                        }
                    }
                }
                // Apply secondary params if present
                if (rp.secondParamName != null && rp.secondFixedValue != null) {
                    params.put(rp.secondParamName, rp.secondFixedValue);
                }
                return new RouteMatch(rp.toolName, params, rp.confidence);
            }
        }
        return null;
    }

    // ══════════════════════════════════════════════════════════════════
    //  ROUTE DEFINITIONS
    // ══════════════════════════════════════════════════════════════════

    private record RoutePattern(Pattern pattern, String toolName, String paramName,
                                 String fixedValue, String secondParamName, String secondFixedValue,
                                 double confidence) {
        RoutePattern(Pattern pattern, String toolName, String paramName) {
            this(pattern, toolName, paramName, null, null, null, 0.92);
        }
        RoutePattern(Pattern pattern, String toolName, String paramName, String fixedValue) {
            this(pattern, toolName, paramName, fixedValue, null, null, 0.92);
        }
    }

    private record RouteMatch(String toolName, Map<String, String> params, double confidence) {}

    private static final List<RoutePattern> ROUTES = List.of(
            // ══════════════════════════════════════════
            //  PROJECT QUERIES
            // ══════════════════════════════════════════

            // "Show me P0 projects" / "List P2 projects" / "Find all P1 projects"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find|display)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(P[0-3])\\s+projects?\\s*\\??$"),
                    "list_projects", "priority"),

            // "Show me active/on-hold/completed projects" (accepts both ON_HOLD and on-hold forms)
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find|display)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(ACTIVE|ON[_\\-\\s]HOLD|COMPLETED|NOT[_\\-\\s]STARTED|CANCELLED|IN[_\\-\\s]DISCOVERY|active|on[\\-\\s]hold|completed|not[\\-\\s]started|cancelled|in[\\-\\s]discovery)\\s+projects?\\s*\\??$"),
                    "list_projects", "status"),

            // "Show projects owned by John" / "John's projects"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?projects?\\s+(?:owned\\s+by|under|for|by)\\s+(.+?)\\s*\\??$"),
                    "list_projects", "owner"),
            new RoutePattern(
                    Pattern.compile("(?i)^(.+?)(?:'s|s')\\s+projects?\\s*\\??$"),
                    "list_projects", "owner"),

            // "Show projects in API Pod"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?projects?\\s+(?:in|from|under|for)\\s+(?:the\\s+)?(.+?)(?:\\s+pod)?\\s*\\??$"),
                    "list_projects", "pod"),

            // "Tell me about project X" / "Details for project X"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:tell\\s+me\\s+about|details?\\s+(?:for|of|about)|show\\s+me|info\\s+(?:on|about|for))\\s+(?:the\\s+)?project\\s+(.+?)\\s*\\??$"),
                    "get_project_profile", "name"),

            // "What are the estimates for X?"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?estimates?\\s+(?:for|of)\\s+(?:project\\s+)?(.+?)\\s*\\??$"),
                    "get_project_estimates", "name"),

            // "Show dependencies for X"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?dependencies\\s+(?:for|of)\\s+(?:project\\s+)?(.+?)\\s*\\??$"),
                    "get_project_dependencies", "name"),

            // ══════════════════════════════════════════
            //  RESOURCE QUERIES
            // ══════════════════════════════════════════

            // "Who is John?" / "Tell me about Jane"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:who\\s+is|tell\\s+me\\s+about|details?\\s+(?:for|of|about)|show\\s+me|info\\s+(?:on|about|for))\\s+(?:resource\\s+)?([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)\\s*\\??$"),
                    "get_resource_profile", "name"),

            // "Show me all developers" / "List QA engineers"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:developers?|devs?)(?:\\s+.*)?$"),
                    "list_resources", "role", "DEVELOPER"),
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:QA|testers?|quality\\s+assurance|quality\\s+engineers?)(?:\\s+.*)?$"),
                    "list_resources", "role", "QA"),
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:BSA|business\\s+(?:systems?\\s+)?analysts?)(?:\\s+.*)?$"),
                    "list_resources", "role", "BSA"),
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:tech\\s+leads?|TLs?|lead\\s+engineers?)(?:\\s+.*)?$"),
                    "list_resources", "role", "TECH_LEAD"),

            // "Show resources in API Pod" / "List team members in Platform Pod"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:resources?|members?|people|team\\s+members?|staff)\\s+(?:in|from|at)\\s+(?:the\\s+)?(.+?)(?:\\s+(?:pod|team))?\\s*\\??$"),
                    "list_resources", "pod"),

            // "Show resources in US/India"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:resources?|team\\s+members?|people|staff)\\s+(?:in|from)\\s+(US|India|INDIA|onshore|offshore)\\s*\\??$"),
                    "list_resources", "location"),

            // "What's John's availability?"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(.+?)(?:'s)?\\s+availability\\s*\\??$"),
                    "get_resource_availability", "name"),

            // ══════════════════════════════════════════
            //  POD QUERIES
            // ══════════════════════════════════════════

            // "Tell me about Pod X" / "Details for the API team"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:tell\\s+me\\s+about|details?\\s+(?:for|of|about)|show\\s+me|info\\s+(?:on|about|for))\\s+(?:the\\s+)?(?:pod|team)\\s+(.+?)\\s*\\??$"),
                    "get_pod_profile", "name"),

            // ══════════════════════════════════════════
            //  ANALYTICS QUERIES (no params)
            // ══════════════════════════════════════════

            // "Show team composition" / "What's the headcount?"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?(?:team\\s+composition|headcount|team\\s+breakdown|dev[\\s\\-]?to[\\s\\-]?qa\\s+ratio|role\\s+(?:mix|distribution|breakdown))\\s*\\??$"),
                    "get_team_composition", null),

            // "Show utilization" / "Resource utilization summary"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?(?:resource\\s+)?(?:utilization|utilisation)(?:\\s+summary)?\\s*\\??$"),
                    "get_utilization_summary", null),

            // "Show capacity" / "What's the available capacity?"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?(?:available\\s+)?capacity(?:\\s+summary)?\\s*\\??$"),
                    "get_capacity_summary", null),

            // "Portfolio summary" / "Project overview" / "Give me a portfolio overview"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|give|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?(?:a\\s+)?(?:portfolio\\s+(?:summary|overview|snapshot|health)|project\\s+(?:summary|overview))\\s*\\??$"),
                    "get_portfolio_summary", null),

            // ══════════════════════════════════════════
            //  SPRINT & RELEASE QUERIES
            // ══════════════════════════════════════════

            // "Current sprint" / "Active sprint"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?(?:current|active)\\s+sprint\\s*\\??$"),
                    "get_sprint_info", "name", "current"),

            // "Upcoming sprints"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|\\s+is|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?(?:next|upcoming)\\s+sprints?\\s*\\??$"),
                    "get_sprint_info", "name", "upcoming"),

            // "Sprint allocations"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|'re|\\s+is|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?(?:sprint\\s+allocations?|allocations?\\s+(?:for\\s+)?(?:this|current)\\s+sprint)\\s*\\??$"),
                    "get_sprint_allocations", "filter", "current"),

            // "Upcoming releases"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|'re|\\s+is|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?(?:upcoming|next)\\s+releases?\\s*\\??$"),
                    "get_release_info", "name", "upcoming"),

            // ══════════════════════════════════════════
            //  COST & RATE QUERIES
            // ══════════════════════════════════════════

            // "Show cost rates" / "What are the billing rates?"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|'re|\\s+is|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?(?:cost\\s+rates?|billing\\s+rates?|hourly\\s+rates?)\\s*\\??$"),
                    "get_cost_rates", null),

            // "Estimates for project X"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:estimates?|effort)\\s+(?:for|of)\\s+(?:project\\s+)?(.+?)\\s*\\??$"),
                    "get_project_estimates", "name"),

            // ══════════════════════════════════════════
            //  OVERRIDE & CONFIG QUERIES
            // ══════════════════════════════════════════

            // "Show overrides" / "Resource transfers"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|list)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:overrides?|resource\\s+transfers?|loaned\\s+(?:out|resources?)|cross[\\s\\-]?pod\\s+loans?)\\s*\\??$"),
                    "get_overrides", null),

            // "T-shirt sizes" / "Size configuration"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|'re|\\s+is|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?(?:t[\\s\\-]?shirt\\s+sizes?|size\\s+(?:config(?:uration)?|mapping))\\s*\\??$"),
                    "get_tshirt_sizes", null),

            // "Effort patterns"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|'re|\\s+is|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?(?:effort\\s+(?:patterns?|distribution)|work\\s+patterns?)\\s*\\??$"),
                    "get_effort_patterns", null),

            // "Role effort mix"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|'re|\\s+is|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?(?:role\\s+(?:effort\\s+)?mix|role\\s+split|dev[\\s\\-]?qa[\\s\\-]?bsa\\s+split)\\s*\\??$"),
                    "get_role_effort_mix", null),

            // ══════════════════════════════════════════
            //  JIRA QUERIES
            // ══════════════════════════════════════════

            // "Show Jira issue PROJ-123"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|find|lookup|look\\s+up)\\s+(?:me\\s+)?(?:jira\\s+)?(?:issue\\s+|ticket\\s+)?([A-Z][A-Z0-9]+-\\d+)\\s*\\??$"),
                    "get_jira_issue", "key"),

            // "Jira analytics" / "Jira summary"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?jira\\s+(?:analytics|summary|overview|metrics)\\s*\\??$"),
                    "get_jira_analytics_summary", null),

            // "Jira workload"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?jira\\s+workload\\s*\\??$"),
                    "get_jira_workload", null),

            // "Jira sprint health"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?jira\\s+sprint\\s+health\\s*\\??$"),
                    "get_jira_sprint_health", null),

            // "Jira bug summary"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?(?:jira\\s+)?bug\\s+(?:summary|report|metrics)\\s*\\??$"),
                    "get_jira_bug_summary", null),

            // ══════════════════════════════════════════
            //  GENERIC "SHOW ALL" PATTERNS
            // ══════════════════════════════════════════

            // "Show all projects" / "List projects"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find|display)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?projects?\\s*\\??$"),
                    "list_projects", null),

            // "Show all resources" / "List resources"
            new RoutePattern(
                    Pattern.compile("(?i)^(?:show|list|get|find|display)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:resources?|people|team\\s+members?)\\s*\\??$"),
                    "list_resources", null)
    );
}
