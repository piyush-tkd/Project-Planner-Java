package com.portfolioplanner.service.nlp;

import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Routing catalog: maps known query patterns to pre-computed routing decisions.
 * Each entry specifies exactly which tool to call with what params, what shape
 * the response will be, and what template to use for the message.
 *
 * This is the foundation for Phase 1.6 — every catalog prompt becomes a
 * guaranteed-correct route. Scaling to 5000+ prompts = 5000+ pre-mapped routes.
 */
@Component
public class NlpRoutingCatalog {

    public record RoutingDecision(
            String toolName,
            Map<String, String> params,
            String shape,           // LIST, DETAIL, SUMMARY, COMPARISON, ERROR
            String intent,          // DATA_QUERY, NAVIGATE, FORM_PREFILL, etc.
            String drillDown,       // e.g., "/projects"
            double confidence
    ) {}

    private final List<CatalogEntry> entries = new ArrayList<>();

    public NlpRoutingCatalog() {
        buildCatalog();
    }

    /**
     * Find the best matching routing decision for a query.
     * Returns null if no catalog entry matches.
     */
    public RoutingDecision findRoute(String query) {
        String q = query.trim().toLowerCase();
        for (CatalogEntry entry : entries) {
            if (entry.pattern.matcher(q).matches()) {
                // Apply param extraction if needed
                var m = entry.pattern.matcher(q);
                if (m.matches()) {
                    Map<String, String> params = new LinkedHashMap<>(entry.baseParams);
                    if (entry.captureParam != null && m.groupCount() >= 1 && m.group(1) != null) {
                        params.put(entry.captureParam, m.group(1).trim());
                    }
                    return new RoutingDecision(
                            entry.toolName, params, entry.shape,
                            entry.intent, entry.drillDown, entry.confidence
                    );
                }
            }
        }
        return null;
    }

    private record CatalogEntry(
            Pattern pattern,
            String toolName,
            Map<String, String> baseParams,
            String captureParam,    // Name of param to extract from group(1)
            String shape,
            String intent,
            String drillDown,
            double confidence
    ) {}

    private void buildCatalog() {
        // ── PROJECT LIST QUERIES ──
        addEntry("(?:show|list|get|find|display)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(p[0-3])\\s+projects?",
                "list_projects", Map.of(), "priority", "LIST", "DATA_QUERY", "/projects", 0.95);
        addEntry("(?:show|list|get|find|display)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:active)\\s+projects?",
                "list_projects", Map.of("status", "ACTIVE"), null, "LIST", "DATA_QUERY", "/projects", 0.95);
        addEntry("(?:show|list|get|find|display)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:on[\\-\\s_]?hold)\\s+projects?",
                "list_projects", Map.of("status", "ON_HOLD"), null, "LIST", "DATA_QUERY", "/projects", 0.95);
        addEntry("(?:show|list|get|find|display)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:completed)\\s+projects?",
                "list_projects", Map.of("status", "COMPLETED"), null, "LIST", "DATA_QUERY", "/projects", 0.95);
        addEntry("(?:show|list|get|find|display)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?projects?",
                "list_projects", Map.of(), null, "LIST", "DATA_QUERY", "/projects", 0.92);
        addEntry("(?:show|list|get|find)\\s+(?:me\\s+)?projects?\\s+(?:owned\\s+by|by|for)\\s+(.+?)\\s*\\??",
                "list_projects", Map.of(), "owner", "LIST", "DATA_QUERY", "/projects", 0.92);

        // ── RESOURCE LIST QUERIES ──
        addEntry("(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:developers?|devs?)",
                "list_resources", Map.of("role", "DEVELOPER"), null, "LIST", "DATA_QUERY", "/resources", 0.95);
        addEntry("(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:qa|testers?|quality\\s+engineers?)",
                "list_resources", Map.of("role", "QA"), null, "LIST", "DATA_QUERY", "/resources", 0.95);
        addEntry("(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:bsa|business\\s+analysts?)",
                "list_resources", Map.of("role", "BSA"), null, "LIST", "DATA_QUERY", "/resources", 0.95);
        addEntry("(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:tech\\s+leads?|tls?)",
                "list_resources", Map.of("role", "TECH_LEAD"), null, "LIST", "DATA_QUERY", "/resources", 0.95);
        addEntry("(?:show|list|get|find)\\s+(?:me\\s+)?(?:all\\s+)?(?:the\\s+)?(?:resources?|people|team\\s+members?)",
                "list_resources", Map.of(), null, "LIST", "DATA_QUERY", "/resources", 0.92);

        // ── PROFILE QUERIES ──
        addEntry("(?:tell\\s+me\\s+about|details?\\s+(?:for|of|about)|info\\s+(?:on|about|for))\\s+(?:the\\s+)?project\\s+(.+?)\\s*\\??",
                "get_project_profile", Map.of(), "name", "DETAIL", "DATA_QUERY", "/projects", 0.92);
        addEntry("(?:tell\\s+me\\s+about|details?\\s+(?:for|of|about)|info\\s+(?:on|about|for))\\s+(?:the\\s+)?(?:pod|team)\\s+(.+?)\\s*\\??",
                "get_pod_profile", Map.of(), "name", "DETAIL", "DATA_QUERY", "/pods", 0.92);

        // ── SUMMARY/ANALYTICS QUERIES ──
        addEntry("(?:show|get|give|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?(?:a\\s+)?(?:portfolio\\s+(?:summary|overview|snapshot|health)|project\\s+(?:summary|overview))",
                "get_portfolio_summary", Map.of(), null, "SUMMARY", "DATA_QUERY", "/reports/portfolio-health", 0.95);
        addEntry("(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?(?:team\\s+composition|headcount|team\\s+breakdown)",
                "get_team_composition", Map.of(), null, "SUMMARY", "DATA_QUERY", "/resources", 0.95);
        addEntry("(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?(?:resource\\s+)?(?:utilization|utilisation)(?:\\s+summary)?",
                "get_utilization_summary", Map.of(), null, "SUMMARY", "DATA_QUERY", "/heatmap", 0.95);
        addEntry("(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?(?:available\\s+)?capacity(?:\\s+summary)?",
                "get_capacity_summary", Map.of(), null, "SUMMARY", "DATA_QUERY", "/heatmap", 0.95);
        addEntry("(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?cost\\s+rates?|billing\\s+rates?",
                "get_cost_rates", Map.of(), null, "SUMMARY", "DATA_QUERY", "/cost-rates", 0.92);

        // ── SPRINT/RELEASE QUERIES ──
        addEntry("(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(?:the\\s+)?(?:current|active)\\s+sprint",
                "get_sprint_info", Map.of("name", "current"), null, "DETAIL", "DATA_QUERY", "/sprint-calendar", 0.95);
        addEntry("(?:show|get|what(?:'s|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?(?:upcoming|next)\\s+sprints?",
                "get_sprint_info", Map.of("name", "upcoming"), null, "LIST", "DATA_QUERY", "/sprint-calendar", 0.92);
        addEntry("(?:show|get|what(?:'s|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?(?:upcoming|next)\\s+releases?",
                "get_release_info", Map.of("name", "upcoming"), null, "LIST", "DATA_QUERY", "/release-calendar", 0.92);
        addEntry("(?:show|get|what(?:'s|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?sprint\\s+allocations?",
                "get_sprint_allocations", Map.of("filter", "current"), null, "SUMMARY", "DATA_QUERY", "/sprint-calendar", 0.92);

        // ── EFFORT/PATTERN QUERIES ──
        addEntry("(?:show|get|what(?:'s|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?effort\\s+(?:patterns?|distribution)",
                "get_effort_patterns", Map.of(), null, "SUMMARY", "DATA_QUERY", null, 0.92);
        addEntry("(?:show|get|what(?:'s|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?role\\s+(?:effort\\s+)?mix",
                "get_role_effort_mix", Map.of(), null, "SUMMARY", "DATA_QUERY", null, 0.92);

        // ── DEPENDENCY QUERIES ──
        addEntry("(?:show|get|what(?:'s|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?dependencies\\s+(?:for|of)\\s+(?:project\\s+)?(.+?)\\s*\\??",
                "get_project_dependencies", Map.of(), "name", "LIST", "DATA_QUERY", "/cross-pod-dependencies", 0.92);

        // ── AVAILABILITY QUERIES ──
        addEntry("(?:show|get|what(?:'s|\\s+is))\\s+(?:me\\s+)?(.+?)(?:'s)?\\s+availability",
                "get_resource_availability", Map.of(), "name", "DETAIL", "DATA_QUERY", "/heatmap", 0.90);

        // ── ESTIMATE QUERIES ──
        addEntry("(?:show|get|what(?:'s|\\s+are))\\s+(?:me\\s+)?(?:the\\s+)?estimates?\\s+(?:for|of)\\s+(?:project\\s+)?(.+?)\\s*\\??",
                "get_project_estimates", Map.of(), "name", "SUMMARY", "DATA_QUERY", null, 0.92);
    }

    // ── Autocomplete suggestions ──────────────────────────────────────────────

    /**
     * A curated list of human-readable example phrases, one per distinct query type.
     * Used by the smart autocomplete endpoint to return matching suggestions as the
     * user types. Ordered by most-commonly-used first.
     */
    private static final List<String> EXAMPLE_PHRASES = List.of(
            // Projects
            "Show me P0 projects",
            "Show me P1 projects",
            "Show me P2 projects",
            "List all active projects",
            "Show me on-hold projects",
            "Show completed projects",
            "List all projects",
            "Show projects owned by [name]",

            // Resources
            "Show me all developers",
            "List all QA engineers",
            "Show me business analysts",
            "Show me tech leads",
            "List all resources",
            "Show me the team members",

            // Profiles
            "Tell me about project [name]",
            "Tell me about pod [name]",
            "Who is [name]",
            "Details for [name]",

            // Analytics
            "Show me the portfolio summary",
            "Portfolio overview",
            "Show team composition",
            "What is the headcount?",
            "Show resource utilization",
            "Show capacity summary",
            "What is the available capacity?",
            "Show cost rates",
            "Show billing rates",

            // Sprints & Releases
            "Show me the current sprint",
            "What is the active sprint?",
            "Show upcoming sprints",
            "Show upcoming releases",
            "Show sprint allocations",

            // Effort
            "Show effort patterns",
            "Show role effort mix",

            // Dependencies & Estimates
            "Show dependencies for project [name]",
            "Show estimates for project [name]",
            "What is [name]'s availability?",

            // Comparison
            "Compare pod [A] and pod [B]",
            "Compare project [A] and project [B]"
    );

    /**
     * Return up to {@code limit} example phrases that match (contain) the partial query.
     * Matching is case-insensitive. Used by the autocomplete endpoint.
     */
    public List<String> getSuggestions(String partialQuery, int limit) {
        if (partialQuery == null || partialQuery.isBlank()) return List.of();
        String lower = partialQuery.trim().toLowerCase();

        return EXAMPLE_PHRASES.stream()
                .filter(phrase -> {
                    // Prefix match first, then substring match
                    String phraseLower = phrase.toLowerCase();
                    return phraseLower.startsWith(lower) || phraseLower.contains(lower);
                })
                .sorted((a, b) -> {
                    // Prefer prefix matches over substring matches
                    boolean aPrefix = a.toLowerCase().startsWith(lower);
                    boolean bPrefix = b.toLowerCase().startsWith(lower);
                    if (aPrefix && !bPrefix) return -1;
                    if (!aPrefix && bPrefix) return 1;
                    return a.compareTo(b);
                })
                .limit(limit)
                .collect(java.util.stream.Collectors.toList());
    }

    private void addEntry(String regex, String toolName, Map<String, String> baseParams,
                           String captureParam, String shape, String intent,
                           String drillDown, double confidence) {
        entries.add(new CatalogEntry(
                Pattern.compile("(?i)^" + regex + "\\s*\\??$"),
                toolName, baseParams, captureParam, shape, intent, drillDown, confidence
        ));
    }
}
