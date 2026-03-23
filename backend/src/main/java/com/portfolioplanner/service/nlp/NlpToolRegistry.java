package com.portfolioplanner.service.nlp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.function.BiFunction;
import java.util.stream.Collectors;
import java.util.ArrayList;

/**
 * Registry of "tools" that the local LLM can call via structured JSON.
 *
 * The LLM returns: { "tool": "tool_name", "params": { ... } }
 * We execute the tool against the catalog and return the result string
 * for the LLM to synthesize into a final answer.
 *
 * This avoids dumping the entire catalog into the system prompt.
 * Instead, the LLM gets entity names from vector search context,
 * then calls tools to fetch detailed data.
 */
@Component
public class NlpToolRegistry {

    private static final Logger log = LoggerFactory.getLogger(NlpToolRegistry.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final NlpJiraToolExecutor jiraToolExecutor;

    public NlpToolRegistry(NlpJiraToolExecutor jiraToolExecutor) {
        this.jiraToolExecutor = jiraToolExecutor;
    }

    public record ToolDefinition(
            String name,
            String description,
            String parameterSchema // JSON schema for params
    ) {}

    public record ToolResult(
            boolean success,
            String data,
            String error
    ) {
        public static ToolResult ok(String data) { return new ToolResult(true, data, null); }
        public static ToolResult fail(String error) { return new ToolResult(false, null, error); }
    }

    /**
     * Get all tool definitions (for including in the LLM prompt).
     */
    public List<ToolDefinition> getToolDefinitions() {
        List<ToolDefinition> tools = new ArrayList<>(List.of(
                new ToolDefinition("get_resource_profile",
                        "Get detailed profile of a resource/team member by name. Returns: name, role, location, pod assignment, billing rate, FTE. Use for: 'who is X', 'tell me about X (person)', 'X's role', 'X's rate'.",
                        """
                        { "name": "string (resource name or partial name)" }
                        """),
                new ToolDefinition("get_project_profile",
                        "Get detailed profile of a project by name. Returns: name, priority, owner, status, assigned pods, timeline, duration, client. Use for: 'tell me about project X', 'project X details', 'who owns X', 'X status'.",
                        """
                        { "name": "string (project name or partial name)" }
                        """),
                new ToolDefinition("get_pod_profile",
                        "Get detailed profile of a POD/team including members and projects. Returns: name, member count, member list, project names, avg BAU%, active status. Use for: 'tell me about pod X', 'X team details', 'who is in pod X', 'X pod projects'.",
                        """
                        { "name": "string (pod name or partial name)" }
                        """),
                new ToolDefinition("list_resources",
                        "List and filter resources by name, role, location, or pod. Returns: matching resources with name, role, location, pod. Use for: 'show all developers', 'is there someone named X', 'QA engineers in India', 'who works in pod X', 'onshore team', 'find resource X', 'do we have anyone called X'.",
                        """
                        { "name": "string? (resource name or partial name to search)", "role": "string? (DEVELOPER|QA|BSA|TECH_LEAD)", "location": "string? (US|INDIA)", "pod": "string? (pod name)" }
                        """),
                new ToolDefinition("list_projects",
                        "List and filter projects by owner, status, priority, or pod. Returns: matching projects with name, priority, owner, status, pods. Use for: 'projects under X', 'active projects', 'P0 projects', 'pod X projects', 'what is X working on', 'X's projects', 'projects owned by X', 'what projects does X have'.",
                        """
                        { "owner": "string?", "status": "string? (NOT_STARTED|IN_DISCOVERY|ACTIVE|ON_HOLD|COMPLETED|CANCELLED)", "priority": "string? (P0|P1|P2|P3)", "pod": "string?" }
                        """),
                new ToolDefinition("get_project_estimates",
                        "Get hour estimates and pod breakdown for a project. Returns: total dev/QA/BSA/TL hours, grand total, pod-level breakdown. Use for: 'estimates for X', 'effort for X', 'how many hours for X', 'pods working on X'.",
                        """
                        { "name": "string (project name)" }
                        """),
                new ToolDefinition("get_sprint_allocations",
                        "Get sprint-level hour allocations. Can filter by sprint name, project, pod, or 'current' for active sprint. Returns: allocation breakdown by project/pod/resource. Use for: 'current sprint allocations', 'what's planned this sprint', 'pod X sprint hours', 'capacity utilization'.",
                        """
                        { "filter": "string? (sprint name, project name, pod name, or 'current' for active sprint)" }
                        """),
                new ToolDefinition("get_resource_availability",
                        "Get monthly availability/capacity for a resource. Returns: monthly FTE availability, allocated hours, free capacity. Use for: 'is X available', 'X's availability', 'X capacity next month', 'when is X free'.",
                        """
                        { "name": "string (resource name)" }
                        """),
                new ToolDefinition("get_project_dependencies",
                        "Get dependency and blocker information for projects. Returns: blocked-by and blocking relationships. Use for: 'what blocks X', 'X dependencies', 'is X blocked', 'project blockers'.",
                        """
                        { "name": "string? (project name, or omit for all dependencies)" }
                        """),
                new ToolDefinition("get_cost_rates",
                        "Get billing/cost rates filtered by role and/or location. Returns: hourly rates per role-location combination. Use for: 'developer rate', 'India rates', 'cost comparison', 'rate card', 'billing rates'.",
                        """
                        { "role": "string? (DEVELOPER|QA|BSA|TECH_LEAD)", "location": "string? (US|INDIA)" }
                        """),
                new ToolDefinition("get_sprint_info",
                        "Get sprint calendar details. Use name='current' for active sprint, 'upcoming' for future sprints. Returns: name, type, start/end dates, lock-in date, status. Use for: 'current sprint', 'when does sprint end', 'sprint calendar'.",
                        """
                        { "name": "string? (sprint name or 'current' or 'upcoming')" }
                        """),
                new ToolDefinition("get_release_info",
                        "Get release calendar details filtered by name, month, or status. Returns: name, release date, code freeze date, type, status. Use for: 'next release', 'upcoming releases', 'release X details', 'releases in March 2026', 'releases in March', 'when is the next release'.",
                        """
                        { "name": "string? (release name or 'upcoming')", "month": "string? (month name like 'March' or 'march 2026' for date filtering)" }
                        """),
                new ToolDefinition("get_project_actuals",
                        "Get actual hours logged against a project. Returns: hours logged by role, variance from planned. Use for: 'actual hours for X', 'how much time spent on X', 'planned vs actual', 'budget burn'.",
                        """
                        { "name": "string (project name)" }
                        """),
                new ToolDefinition("get_effort_patterns",
                        "Get available effort distribution patterns (e.g. front-loaded, even, back-loaded). Returns: pattern names and descriptions. Use for: 'effort patterns', 'distribution patterns', 'how is work distributed'.",
                        """
                        {}
                        """),
                new ToolDefinition("get_role_effort_mix",
                        "Get standard role effort mix percentages. Returns: standard % split across Dev/QA/BSA/TL. Use for: 'role effort mix', 'standard breakdown', 'how much QA vs dev'.",
                        """
                        {}
                        """),
                new ToolDefinition("get_capacity_summary",
                        "Get aggregated capacity summary by role, pod, or location. Returns: total available hours, resource count, breakdown by group. Use for: 'total capacity', 'developer capacity next month', 'pod capacity', 'how much QA capacity in Q2', 'India team capacity', 'capacity forecast', 'how many hours available'.",
                        """
                        { "role": "string? (DEVELOPER|QA|BSA|TECH_LEAD)", "pod": "string? (pod name)", "location": "string? (US|INDIA)" }
                        """),
                new ToolDefinition("get_utilization_summary",
                        "Calculate utilization rates by comparing allocated hours to available capacity. Returns: utilization % per resource/pod, over/under-allocated resources. Use for: 'utilization rate', 'who is overallocated', 'underutilized resources', 'utilization heatmap', 'is X over capacity', 'which pod has highest utilization', 'who can take more work', 'who is at full capacity'.",
                        """
                        { "pod": "string? (pod name)", "role": "string? (DEVELOPER|QA|BSA|TECH_LEAD)" }
                        """),
                new ToolDefinition("get_team_composition",
                        "Get team composition breakdown by role, location, pod with ratios and headcounts. Returns: headcount by role, location split, dev-to-QA ratio, pod staffing summary. Use for: 'team composition', 'headcount breakdown', 'dev to QA ratio', 'role mix per pod', 'how many people by role', 'India vs US split', 'location distribution', 'team structure'.",
                        """
                        { "pod": "string? (pod name for pod-specific breakdown)" }
                        """),
                new ToolDefinition("get_portfolio_summary",
                        "Get high-level portfolio health summary across projects, resources, sprints, releases. Returns: total counts, status distributions, key metrics, risk indicators. Use for: 'portfolio overview', 'executive summary', 'what needs attention', 'portfolio health', 'give me the big picture', 'current state of things', 'key metrics', 'what should I focus on', 'what do I need to know'.",
                        """
                        {}
                        """),
                new ToolDefinition("get_overrides",
                        "Get temporary resource allocation overrides (cross-pod loans). Returns: resource name, from/to pod, duration, allocation %. Use for: 'temporary overrides', 'resource transfers', 'who is loaned out', 'cross-pod assignments', 'shared resources', 'active overrides', 'resource movements'.",
                        """
                        { "resource": "string? (resource name)", "pod": "string? (pod name)" }
                        """),
                new ToolDefinition("get_tshirt_sizes",
                        "Get T-shirt size configuration (XS/S/M/L/XL → base hours mapping). Returns: size names and base hour values. Use for: 'T-shirt sizes', 'project sizing', 'what is an XL project', 'sizing configuration', 'how are projects sized'.",
                        """
                        {}
                        """)
        ));
        // Add Jira tools if available
        if (jiraToolExecutor != null) {
            tools.addAll(jiraToolExecutor.getToolDefinitions());
        }
        return tools;
    }

    /**
     * Build the tool definitions section for the LLM system prompt.
     */
    public String buildToolPromptSection() {
        StringBuilder sb = new StringBuilder();
        sb.append("AVAILABLE TOOLS (you may call ONE tool per turn to fetch data):\n\n");

        for (ToolDefinition tool : getToolDefinitions()) {
            sb.append("  tool: \"").append(tool.name()).append("\"\n");
            sb.append("  description: ").append(tool.description()).append("\n");
            sb.append("  params: ").append(tool.parameterSchema().trim()).append("\n\n");
        }

        sb.append("""
                TO CALL A TOOL, return ONLY this JSON:
                { "tool": "tool_name", "params": { ... } }

                TOOL CALLING RULES:
                - CALL a tool when the user asks about specific entities, metrics, or data.
                - CALL a tool when you need live/accurate data to answer (don't guess from context alone).
                - DO NOT call a tool for: greetings, navigation, help/explanations, capabilities, form creation.
                - For entity lookups (resource, project, pod, sprint, release) → call the matching profile tool.
                - For list/filter queries → call the matching list tool.
                - For Jira questions → call the matching Jira tool.
                - For comparisons → call a profile tool for one entity; use context for the other.
                - Only omit optional params if user didn't specify them (don't send empty strings).
                - You will receive the tool result and then produce your final synthesized answer.

                """);
        return sb.toString();
    }

    /**
     * Normalize common LLM tool-name hallucinations to the canonical name.
     * The LLM sometimes invents tool names that are close but don't match exactly.
     */
    private static final Map<String, String> TOOL_NAME_ALIASES = Map.ofEntries(
            Map.entry("get_project_info",         "get_project_profile"),
            Map.entry("get_project_details",      "get_project_profile"),
            Map.entry("project_info",             "get_project_profile"),
            Map.entry("project_profile",          "get_project_profile"),
            Map.entry("get_resource_info",        "get_resource_profile"),
            Map.entry("get_resource_details",     "get_resource_profile"),
            Map.entry("resource_info",            "get_resource_profile"),
            Map.entry("resource_profile",         "get_resource_profile"),
            Map.entry("get_pod_info",             "get_pod_profile"),
            Map.entry("get_pod_details",          "get_pod_profile"),
            Map.entry("pod_info",                 "get_pod_profile"),
            Map.entry("pod_profile",              "get_pod_profile"),
            Map.entry("get_sprint_details",       "get_sprint_info"),
            Map.entry("sprint_info",              "get_sprint_info"),
            Map.entry("get_release_details",      "get_release_info"),
            Map.entry("release_info",             "get_release_info"),
            Map.entry("list_all_resources",       "list_resources"),
            Map.entry("list_all_projects",        "list_projects"),
            Map.entry("get_team_info",            "get_team_composition"),
            Map.entry("get_utilization",          "get_utilization_summary"),
            Map.entry("get_capacity",             "get_capacity_summary"),
            Map.entry("portfolio_summary",        "get_portfolio_summary")
    );

    /**
     * Smart tool name normalization:
     *   1. Exact match against alias map
     *   2. Canonical form: lowercase, trim, collapse whitespace, normalize separators (- → _)
     *   3. Strip common prefixes/suffixes the LLM sometimes adds
     */
    private String normalizeToolName(String toolName) {
        if (toolName == null) return null;

        // Step 1: exact match
        String normalized = TOOL_NAME_ALIASES.get(toolName);
        if (normalized != null) {
            log.info("Normalized tool name '{}' → '{}' (exact alias)", toolName, normalized);
            return normalized;
        }

        // Step 2: canonical form — lowercase, trim, collapse whitespace, normalize - to _
        String canonical = toolName.trim().toLowerCase()
                .replaceAll("[\\s-]+", "_")          // whitespace or hyphens → underscore
                .replaceAll("_+", "_")               // collapse multiple underscores
                .replaceAll("^_|_$", "");             // strip leading/trailing _

        if (!canonical.equals(toolName)) {
            // Try alias lookup with canonical form
            normalized = TOOL_NAME_ALIASES.get(canonical);
            if (normalized != null) {
                log.info("Normalized tool name '{}' → '{}' (canonical alias)", toolName, normalized);
                return normalized;
            }
        }

        // Step 3: check if canonical form is itself a valid tool (case-insensitive match)
        // The executeTool switch uses exact names, so check against known tools
        if (KNOWN_TOOLS.contains(canonical)) {
            if (!canonical.equals(toolName)) {
                log.info("Normalized tool name '{}' → '{}' (case/separator fix)", toolName, canonical);
            }
            return canonical;
        }

        // Step 4: fuzzy — strip "tool_", "call_", "fn_", "function_" prefix the LLM sometimes adds
        String stripped = canonical.replaceFirst("^(?:tool_|call_|fn_|function_)", "");
        if (!stripped.equals(canonical)) {
            normalized = TOOL_NAME_ALIASES.get(stripped);
            if (normalized != null) {
                log.info("Normalized tool name '{}' → '{}' (prefix-stripped alias)", toolName, normalized);
                return normalized;
            }
            if (KNOWN_TOOLS.contains(stripped)) {
                log.info("Normalized tool name '{}' → '{}' (prefix-stripped)", toolName, stripped);
                return stripped;
            }
        }

        log.debug("Tool name '{}' used as-is (no normalization matched)", toolName);
        return toolName;
    }

    /** All canonical tool names used in the executeTool switch. */
    private static final Set<String> KNOWN_TOOLS = Set.of(
            "get_resource_profile", "get_project_profile", "get_pod_profile",
            "list_resources", "list_projects",
            "get_sprint_info", "get_release_info",
            "get_team_composition", "get_utilization_summary",
            "get_capacity_summary", "get_portfolio_summary",
            "get_resource_allocation", "get_availability",
            "search_by_skill", "get_budget_summary"
    );

    /**
     * Execute a tool call against the catalog and return the result.
     */
    public ToolResult executeTool(String toolName, JsonNode params, NlpCatalogResponse catalog) {
        toolName = normalizeToolName(toolName);

        // Delegate to Jira tool executor if it handles this tool
        if (jiraToolExecutor != null && jiraToolExecutor.handles(toolName)) {
            return jiraToolExecutor.executeTool(toolName, params);
        }

        if (catalog == null) return ToolResult.fail("No catalog available");

        try {
            return switch (toolName) {
                case "get_resource_profile" -> getResourceProfile(params, catalog);
                case "get_project_profile" -> getProjectProfile(params, catalog);
                case "get_pod_profile" -> getPodProfile(params, catalog);
                case "list_resources" -> listResources(params, catalog);
                case "list_projects" -> listProjects(params, catalog);
                case "get_project_estimates" -> getProjectEstimates(params, catalog);
                case "get_sprint_allocations" -> getSprintAllocations(params, catalog);
                case "get_resource_availability" -> getResourceAvailability(params, catalog);
                case "get_project_dependencies" -> getProjectDependencies(params, catalog);
                case "get_cost_rates" -> getCostRates(params, catalog);
                case "get_sprint_info" -> getSprintInfo(params, catalog);
                case "get_release_info" -> getReleaseInfo(params, catalog);
                case "get_project_actuals" -> getProjectActuals(params, catalog);
                case "get_effort_patterns" -> getEffortPatterns(catalog);
                case "get_role_effort_mix" -> getRoleEffortMix(catalog);
                case "get_capacity_summary" -> getCapacitySummary(params, catalog);
                case "get_utilization_summary" -> getUtilizationSummary(params, catalog);
                case "get_team_composition" -> getTeamComposition(params, catalog);
                case "get_portfolio_summary" -> getPortfolioSummary(catalog);
                case "get_overrides" -> getOverrides(params, catalog);
                case "get_tshirt_sizes" -> getTshirtSizes(catalog);
                default -> ToolResult.fail("Unknown tool: " + toolName);
            };
        } catch (Exception e) {
            log.warn("Tool execution failed for '{}': {}", toolName, e.getMessage());
            return ToolResult.fail("Tool execution error: " + e.getMessage());
        }
    }

    /**
     * Check if a JSON response from the LLM is a tool call.
     */
    public boolean isToolCall(JsonNode response) {
        return response != null && response.has("tool") && !response.path("tool").asText().isEmpty()
                && !response.has("intent"); // Make sure it's not a normal response that happens to mention "tool"
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Tool implementations
    // ═══════════════════════════════════════════════════════════════════════════

    private ToolResult getResourceProfile(JsonNode params, NlpCatalogResponse catalog) {
        String name = params.path("name").asText("");
        if (name.isBlank()) return ToolResult.fail("Missing 'name' parameter");

        if (catalog.resourceDetails() == null) return ToolResult.fail("No resource data available");

        var match = catalog.resourceDetails().stream()
                .filter(r -> r.name().toLowerCase().contains(name.toLowerCase()))
                .findFirst().orElse(null);

        if (match == null) return ToolResult.fail("Resource not found: " + name);

        return ToolResult.ok(String.format(
                "Resource: %s | Role: %s | Location: %s | Pod: %s | Rate: %s | FTE: %s",
                match.name(), match.role(), match.location(),
                match.podName() != null ? match.podName() : "Unassigned",
                match.billingRate(), match.fte()));
    }

    private ToolResult getProjectProfile(JsonNode params, NlpCatalogResponse catalog) {
        String name = params.path("name").asText("");
        if (name.isBlank()) return ToolResult.fail("Missing 'name' parameter");

        if (catalog.projectDetails() == null) return ToolResult.fail("No project data available");

        var match = catalog.projectDetails().stream()
                .filter(p -> p.name().toLowerCase().contains(name.toLowerCase()))
                .findFirst().orElse(null);

        if (match == null) return ToolResult.fail("Project not found: " + name);

        return ToolResult.ok(String.format(
                "Project: %s | Priority: %s | Owner: %s | Status: %s | Pods: %s | Timeline: %s | Duration: %s | Client: %s",
                match.name(), match.priority(), match.owner(), match.status(),
                match.assignedPods(), match.timeline(), match.durationMonths(),
                match.client() != null ? match.client() : "N/A"));
    }

    private ToolResult getPodProfile(JsonNode params, NlpCatalogResponse catalog) {
        String name = params.path("name").asText("");
        if (name.isBlank()) return ToolResult.fail("Missing 'name' parameter");

        if (catalog.podDetails() == null) return ToolResult.fail("No pod data available");

        var match = catalog.podDetails().stream()
                .filter(p -> p.name().toLowerCase().contains(name.toLowerCase()))
                .findFirst().orElse(null);

        if (match == null) return ToolResult.fail("Pod not found: " + name);

        return ToolResult.ok(String.format(
                "Pod: %s | Members: %d (%s) | Projects: %s | Avg BAU: %s | Active: %s",
                match.name(), match.memberCount(),
                String.join(", ", match.members()),
                String.join(", ", match.projectNames()),
                match.avgBauPct(), match.active() ? "Yes" : "No"));
    }

    private ToolResult listResources(JsonNode params, NlpCatalogResponse catalog) {
        if (catalog.resourceDetails() == null) return ToolResult.fail("No resource data available");

        String name = params.path("name").asText(null);
        String role = params.path("role").asText(null);
        String location = params.path("location").asText(null);
        String pod = params.path("pod").asText(null);

        var filtered = catalog.resourceDetails().stream()
                .filter(r -> name == null || r.name().toLowerCase().contains(name.toLowerCase()))
                .filter(r -> role == null || smartMatchField(r.role(), role))
                .filter(r -> location == null || smartMatchField(r.location(), location))
                .filter(r -> pod == null || (r.podName() != null && r.podName().toLowerCase().contains(pod.toLowerCase())))
                .toList();

        if (filtered.isEmpty()) return ToolResult.ok("No resources match the given filters.");

        StringBuilder sb = new StringBuilder("Found " + filtered.size() + " resources:\n");
        for (var r : filtered) {
            sb.append(String.format("  - %s | %s | %s | Pod: %s\n",
                    r.name(), r.role(), r.location(),
                    r.podName() != null ? r.podName() : "Unassigned"));
        }
        return ToolResult.ok(sb.toString());
    }

    private ToolResult listProjects(JsonNode params, NlpCatalogResponse catalog) {
        if (catalog.projectDetails() == null) return ToolResult.fail("No project data available");

        String owner = params.path("owner").asText(null);
        String status = params.path("status").asText(null);
        String priority = params.path("priority").asText(null);
        String pod = params.path("pod").asText(null);

        var filtered = catalog.projectDetails().stream()
                .filter(p -> owner == null || p.owner().toLowerCase().contains(owner.toLowerCase()))
                .filter(p -> status == null || smartMatchField(p.status(), status))
                .filter(p -> priority == null || smartMatchField(p.priority(), priority))
                .filter(p -> pod == null || (p.assignedPods() != null && p.assignedPods().toLowerCase().contains(pod.toLowerCase())))
                // When filtering by priority/owner/pod (not status), exclude COMPLETED and CANCELLED
                // These terminal-state projects shouldn't appear in "show P0 projects" or "John's projects"
                .filter(p -> status != null
                        || (!"COMPLETED".equalsIgnoreCase(p.status()) && !"CANCELLED".equalsIgnoreCase(p.status())))
                .toList();

        if (filtered.isEmpty()) return ToolResult.ok("No projects match the given filters.");

        StringBuilder sb = new StringBuilder("Found " + filtered.size() + " projects:\n");
        for (var p : filtered) {
            sb.append(String.format("  - %s [%s] | Owner: %s | Status: %s | Pods: %s\n",
                    p.name(), p.priority(), p.owner(), p.status(), p.assignedPods()));
        }
        return ToolResult.ok(sb.toString());
    }

    /**
     * Delegate to centralized AliasResolver for all field matching.
     */
    private boolean smartMatchField(String fieldValue, String searchValue) {
        return AliasResolver.matchesField(fieldValue, searchValue);
    }

    private ToolResult getProjectEstimates(JsonNode params, NlpCatalogResponse catalog) {
        String name = params.path("name").asText("");
        if (name.isBlank()) return ToolResult.fail("Missing 'name' parameter");

        if (catalog.projectEstimates() == null) return ToolResult.fail("No estimate data available");

        var match = catalog.projectEstimates().stream()
                .filter(e -> e.projectName().toLowerCase().contains(name.toLowerCase()))
                .findFirst().orElse(null);

        if (match == null) return ToolResult.fail("No estimates found for project: " + name);

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Project: %s | Total: Dev=%s, QA=%s, BSA=%s, TL=%s | Grand Total=%s hours | %d PODs\n",
                match.projectName(), match.totalDevHours(), match.totalQaHours(),
                match.totalBsaHours(), match.totalTechLeadHours(), match.grandTotalHours(), match.podCount()));
        for (var pod : match.podEstimates()) {
            sb.append(String.format("  POD: %s | Dev=%s, QA=%s, BSA=%s, TL=%s | Total=%s | Contingency=%s | Pattern=%s | Release=%s\n",
                    pod.podName(), pod.devHours(), pod.qaHours(), pod.bsaHours(),
                    pod.techLeadHours(), pod.totalHours(), pod.contingencyPct(),
                    pod.effortPattern(), pod.targetRelease()));
        }
        return ToolResult.ok(sb.toString());
    }

    private ToolResult getSprintAllocations(JsonNode params, NlpCatalogResponse catalog) {
        String filter = params.path("filter").asText(null);

        if (catalog.sprintAllocations() == null) return ToolResult.fail("No sprint allocation data available");

        List<NlpCatalogResponse.SprintAllocationInfo> filtered;
        if (filter == null || "current".equalsIgnoreCase(filter)) {
            filtered = catalog.sprintAllocations().stream()
                    .filter(a -> "Active".equals(a.sprintStatus())).toList();
        } else {
            filtered = catalog.sprintAllocations().stream()
                    .filter(a -> a.sprintName().toLowerCase().contains(filter.toLowerCase())
                            || a.projectName().toLowerCase().contains(filter.toLowerCase())
                            || a.podName().toLowerCase().contains(filter.toLowerCase()))
                    .toList();
        }

        if (filtered.isEmpty()) return ToolResult.ok("No sprint allocations found for the given filter.");

        StringBuilder sb = new StringBuilder("Sprint allocations (" + filtered.size() + " entries):\n");
        for (var a : filtered) {
            sb.append(String.format("  Sprint: %s | Project: %s | Pod: %s | Dev=%s, QA=%s, BSA=%s, TL=%s | Total=%s\n",
                    a.sprintName(), a.projectName(), a.podName(),
                    a.devHours(), a.qaHours(), a.bsaHours(), a.techLeadHours(), a.totalHours()));
        }
        return ToolResult.ok(sb.toString());
    }

    private ToolResult getResourceAvailability(JsonNode params, NlpCatalogResponse catalog) {
        String name = params.path("name").asText("");
        if (name.isBlank()) return ToolResult.fail("Missing 'name' parameter");

        if (catalog.resourceAvailabilities() == null) return ToolResult.fail("No availability data");

        var filtered = catalog.resourceAvailabilities().stream()
                .filter(a -> a.resourceName().toLowerCase().contains(name.toLowerCase()))
                .toList();

        if (filtered.isEmpty()) return ToolResult.fail("No availability data for: " + name);

        StringBuilder sb = new StringBuilder("Availability for " + name + ":\n");
        for (var a : filtered) {
            sb.append(String.format("  %s (%s) — %s: %s hours\n",
                    a.resourceName(), a.role(), a.monthLabel(), a.availableHours()));
        }
        return ToolResult.ok(sb.toString());
    }

    private ToolResult getProjectDependencies(JsonNode params, NlpCatalogResponse catalog) {
        String name = params.path("name").asText(null);

        if (catalog.projectDependencies() == null) return ToolResult.fail("No dependency data");

        List<NlpCatalogResponse.ProjectDependencyInfo> filtered;
        if (name != null && !name.isBlank()) {
            filtered = catalog.projectDependencies().stream()
                    .filter(d -> d.projectName().toLowerCase().contains(name.toLowerCase())
                            || d.blockedByName().toLowerCase().contains(name.toLowerCase()))
                    .toList();
        } else {
            filtered = catalog.projectDependencies();
        }

        if (filtered.isEmpty()) return ToolResult.ok("No dependencies found.");

        StringBuilder sb = new StringBuilder("Dependencies (" + filtered.size() + "):\n");
        for (var d : filtered) {
            sb.append(String.format("  %s is blocked by %s | Status: %s | Blocker status: %s\n",
                    d.projectName(), d.blockedByName(), d.projectStatus(), d.blockedByStatus()));
        }
        return ToolResult.ok(sb.toString());
    }

    private ToolResult getCostRates(JsonNode params, NlpCatalogResponse catalog) {
        String role = params.path("role").asText(null);
        String location = params.path("location").asText(null);

        if (catalog.costRates() == null) return ToolResult.fail("No cost rate data");

        var filtered = catalog.costRates().stream()
                .filter(r -> role == null || r.role().equalsIgnoreCase(role))
                .filter(r -> location == null || r.location().equalsIgnoreCase(location))
                .toList();

        if (filtered.isEmpty()) return ToolResult.ok("No cost rates match the filter.");

        StringBuilder sb = new StringBuilder("Cost rates:\n");
        for (var r : filtered) {
            sb.append(String.format("  %s (%s): %s\n", r.role(), r.location(), r.hourlyRate()));
        }
        return ToolResult.ok(sb.toString());
    }

    private ToolResult getSprintInfo(JsonNode params, NlpCatalogResponse catalog) {
        String name = params.path("name").asText(null);

        if (catalog.sprintDetails() == null) return ToolResult.fail("No sprint data");

        List<NlpCatalogResponse.SprintInfo> filtered;
        if ("current".equalsIgnoreCase(name)) {
            filtered = catalog.sprintDetails().stream()
                    .filter(s -> "Active".equals(s.status())).toList();
        } else if ("upcoming".equalsIgnoreCase(name)) {
            filtered = catalog.sprintDetails().stream()
                    .filter(s -> "Upcoming".equals(s.status())).toList();
        } else if (name != null) {
            filtered = catalog.sprintDetails().stream()
                    .filter(s -> s.name().toLowerCase().contains(name.toLowerCase())).toList();
        } else {
            filtered = catalog.sprintDetails();
        }

        if (filtered.isEmpty()) return ToolResult.ok("No sprints found.");

        StringBuilder sb = new StringBuilder("Sprints (" + filtered.size() + "):\n");
        for (var s : filtered) {
            sb.append(String.format("  %s | %s to %s | Status: %s\n",
                    s.name(), s.startDate(), s.endDate(), s.status()));
        }
        return ToolResult.ok(sb.toString());
    }

    private ToolResult getReleaseInfo(JsonNode params, NlpCatalogResponse catalog) {
        String name = params.path("name").asText(null);
        String month = params.path("month").asText(null);

        if (catalog.releaseDetails() == null) return ToolResult.fail("No release data");

        List<NlpCatalogResponse.ReleaseInfo> filtered;
        if (month != null && !month.isBlank()) {
            // Date-based filtering: "March 2026", "march", "March"
            String monthLower = month.toLowerCase().trim();
            // Extract month name (first word)
            String monthName = monthLower.split("\\s+")[0];
            // Extract year if present
            String year = monthLower.matches(".*\\d{4}.*")
                    ? monthLower.replaceAll(".*?(\\d{4}).*", "$1") : null;
            // Map month name to month number prefix
            String monthNum = monthNameToNumber(monthName);
            filtered = catalog.releaseDetails().stream()
                    .filter(r -> {
                        String relDate = r.releaseDate();
                        if (relDate == null) return false;
                        // Match against month number in date string (YYYY-MM-DD or similar)
                        if (monthNum != null && relDate.contains("-" + monthNum + "-")) {
                            return year == null || relDate.startsWith(year);
                        }
                        // Also try matching month name in date string (e.g. "March 15, 2026")
                        return relDate.toLowerCase().contains(monthName);
                    })
                    .toList();
        } else if ("upcoming".equalsIgnoreCase(name)) {
            filtered = catalog.releaseDetails().stream()
                    .filter(r -> "Upcoming".equals(r.status()) || "Code Frozen".equals(r.status())).toList();
        } else if (name != null) {
            filtered = catalog.releaseDetails().stream()
                    .filter(r -> r.name().toLowerCase().contains(name.toLowerCase())).toList();
        } else {
            filtered = catalog.releaseDetails();
        }

        if (filtered.isEmpty()) return ToolResult.ok("No releases found" +
                (month != null ? " in " + month : "") + ".");

        StringBuilder sb = new StringBuilder("Releases (" + filtered.size() + "):\n");
        for (var r : filtered) {
            sb.append(String.format("  %s | Release: %s | Freeze: %s | Type: %s | Status: %s\n",
                    r.name(), r.releaseDate(), r.codeFreezeDate(), r.type(), r.status()));
        }
        return ToolResult.ok(sb.toString());
    }

    /** Convert month name to two-digit month number string. */
    private String monthNameToNumber(String monthName) {
        return switch (monthName.toLowerCase()) {
            case "jan", "january" -> "01";
            case "feb", "february" -> "02";
            case "mar", "march" -> "03";
            case "apr", "april" -> "04";
            case "may" -> "05";
            case "jun", "june" -> "06";
            case "jul", "july" -> "07";
            case "aug", "august" -> "08";
            case "sep", "september" -> "09";
            case "oct", "october" -> "10";
            case "nov", "november" -> "11";
            case "dec", "december" -> "12";
            default -> null;
        };
    }

    private ToolResult getProjectActuals(JsonNode params, NlpCatalogResponse catalog) {
        String name = params.path("name").asText("");
        if (name.isBlank()) return ToolResult.fail("Missing 'name' parameter");

        if (catalog.projectActuals() == null) return ToolResult.fail("No actuals data");

        var filtered = catalog.projectActuals().stream()
                .filter(a -> a.projectName().toLowerCase().contains(name.toLowerCase()))
                .toList();

        if (filtered.isEmpty()) return ToolResult.fail("No actuals found for: " + name);

        StringBuilder sb = new StringBuilder("Actual hours for " + name + ":\n");
        for (var a : filtered) {
            sb.append(String.format("  %s — %s: %s hours\n", a.projectName(), a.monthLabel(), a.actualHours()));
        }
        return ToolResult.ok(sb.toString());
    }

    private ToolResult getEffortPatterns(NlpCatalogResponse catalog) {
        if (catalog.effortPatterns() == null || catalog.effortPatterns().isEmpty())
            return ToolResult.ok("No effort patterns configured.");

        StringBuilder sb = new StringBuilder("Effort patterns:\n");
        for (var ep : catalog.effortPatterns()) {
            sb.append(String.format("  %s: %s\n", ep.name(), ep.description()));
        }
        return ToolResult.ok(sb.toString());
    }

    private ToolResult getRoleEffortMix(NlpCatalogResponse catalog) {
        if (catalog.roleEffortMixes() == null || catalog.roleEffortMixes().isEmpty())
            return ToolResult.ok("No role effort mix configured.");

        StringBuilder sb = new StringBuilder("Role effort mix:\n");
        for (var mix : catalog.roleEffortMixes()) {
            sb.append(String.format("  %s: %s\n", mix.role(), mix.mixPct()));
        }
        return ToolResult.ok(sb.toString());
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // New analytical tools for comprehensive catalog coverage
    // ═══════════════════════════════════════════════════════════════════════════

    private ToolResult getCapacitySummary(JsonNode params, NlpCatalogResponse catalog) {
        if (catalog.resourceAvailabilities() == null || catalog.resourceAvailabilities().isEmpty())
            return ToolResult.fail("No capacity/availability data available");

        String role = params.path("role").asText(null);
        String pod = params.path("pod").asText(null);
        String location = params.path("location").asText(null);

        // Build resource lookup map for location filtering
        Map<String, String> resourceLocations = new java.util.HashMap<>();
        Map<String, String> resourceRoles = new java.util.HashMap<>();
        if (catalog.resourceDetails() != null) {
            for (var r : catalog.resourceDetails()) {
                resourceLocations.put(r.name().toLowerCase(), r.location());
                resourceRoles.put(r.name().toLowerCase(), r.role());
            }
        }

        var filtered = catalog.resourceAvailabilities().stream()
                .filter(a -> role == null || a.role().equalsIgnoreCase(role))
                .filter(a -> pod == null || (a.podName() != null && a.podName().toLowerCase().contains(pod.toLowerCase())))
                .filter(a -> location == null || location.equalsIgnoreCase(
                        resourceLocations.get(a.resourceName().toLowerCase())))
                .toList();

        if (filtered.isEmpty()) return ToolResult.ok("No capacity data matches the given filters.");

        // Group by month
        Map<String, Double> hoursByMonth = new java.util.LinkedHashMap<>();
        Map<String, Integer> resourcesByMonth = new java.util.LinkedHashMap<>();
        Map<String, Set<String>> uniqueResourcesByMonth = new java.util.LinkedHashMap<>();

        for (var a : filtered) {
            String month = a.monthLabel();
            double hours = 0;
            try { hours = Double.parseDouble(a.availableHours()); } catch (Exception e) { /* skip */ }
            hoursByMonth.merge(month, hours, Double::sum);
            uniqueResourcesByMonth.computeIfAbsent(month, k -> new java.util.HashSet<>()).add(a.resourceName());
        }
        for (var entry : uniqueResourcesByMonth.entrySet()) {
            resourcesByMonth.put(entry.getKey(), entry.getValue().size());
        }

        StringBuilder sb = new StringBuilder("Capacity Summary");
        if (role != null) sb.append(" (Role: ").append(role).append(")");
        if (pod != null) sb.append(" (Pod: ").append(pod).append(")");
        if (location != null) sb.append(" (Location: ").append(location).append(")");
        sb.append(":\n");

        double totalHours = 0;
        for (var entry : hoursByMonth.entrySet()) {
            sb.append(String.format("  %s: %.0f hours (%d resources)\n",
                    entry.getKey(), entry.getValue(), resourcesByMonth.getOrDefault(entry.getKey(), 0)));
            totalHours += entry.getValue();
        }
        sb.append(String.format("  TOTAL across all months: %.0f hours\n", totalHours));

        return ToolResult.ok(sb.toString());
    }

    private ToolResult getUtilizationSummary(JsonNode params, NlpCatalogResponse catalog) {
        if (catalog.resourceAvailabilities() == null || catalog.sprintAllocations() == null)
            return ToolResult.fail("Need both availability and allocation data for utilization");

        String pod = params.path("pod").asText(null);
        String role = params.path("role").asText(null);

        // Get current sprint allocations (allocated hours per resource is not directly available,
        // but we can aggregate by pod)
        var activeAllocs = catalog.sprintAllocations().stream()
                .filter(a -> "Active".equals(a.sprintStatus()))
                .filter(a -> pod == null || a.podName().toLowerCase().contains(pod.toLowerCase()))
                .toList();

        // Aggregate allocated hours by pod
        Map<String, Double> allocByPod = new java.util.LinkedHashMap<>();
        for (var a : activeAllocs) {
            double total = 0;
            try { total = Double.parseDouble(a.totalHours()); } catch (Exception e) { /* skip */ }
            allocByPod.merge(a.podName(), total, Double::sum);
        }

        // Get capacity for current month (first month in availability data)
        var availabilities = catalog.resourceAvailabilities().stream()
                .filter(a -> role == null || a.role().equalsIgnoreCase(role))
                .filter(a -> pod == null || (a.podName() != null && a.podName().toLowerCase().contains(pod.toLowerCase())))
                .toList();

        // Group by resource, take first month as current
        Map<String, Double> capacityByPod = new java.util.LinkedHashMap<>();
        Map<String, List<NlpCatalogResponse.ResourceAvailabilityInfo>> byResource = new java.util.LinkedHashMap<>();
        for (var a : availabilities) {
            byResource.computeIfAbsent(a.resourceName(), k -> new ArrayList<>()).add(a);
        }

        // Use first month entry per resource as "current" capacity
        for (var entry : byResource.entrySet()) {
            if (!entry.getValue().isEmpty()) {
                var first = entry.getValue().get(0);
                double hours = 0;
                try { hours = Double.parseDouble(first.availableHours()); } catch (Exception e) { /* skip */ }
                String podName = first.podName() != null ? first.podName() : "Unassigned";
                capacityByPod.merge(podName, hours, Double::sum);
            }
        }

        StringBuilder sb = new StringBuilder("Utilization Summary (Current Sprint)");
        if (pod != null) sb.append(" — Pod: ").append(pod);
        if (role != null) sb.append(" — Role: ").append(role);
        sb.append(":\n");

        Set<String> allPods = new java.util.LinkedHashSet<>();
        allPods.addAll(allocByPod.keySet());
        allPods.addAll(capacityByPod.keySet());

        double totalAlloc = 0, totalCap = 0;
        List<String> overAllocated = new ArrayList<>();
        List<String> underUtilized = new ArrayList<>();

        for (String podName : allPods) {
            double alloc = allocByPod.getOrDefault(podName, 0.0);
            double cap = capacityByPod.getOrDefault(podName, 0.0);
            double util = cap > 0 ? (alloc / cap * 100) : 0;
            sb.append(String.format("  %s: Allocated=%.0f hrs | Capacity=%.0f hrs | Utilization=%.0f%%\n",
                    podName, alloc, cap, util));
            totalAlloc += alloc;
            totalCap += cap;
            if (util > 100) overAllocated.add(podName);
            if (util < 50 && cap > 0) underUtilized.add(podName);
        }

        double overallUtil = totalCap > 0 ? (totalAlloc / totalCap * 100) : 0;
        sb.append(String.format("  OVERALL: Allocated=%.0f hrs | Capacity=%.0f hrs | Utilization=%.0f%%\n",
                totalAlloc, totalCap, overallUtil));
        if (!overAllocated.isEmpty()) sb.append("  ⚠ OVER-ALLOCATED: ").append(String.join(", ", overAllocated)).append("\n");
        if (!underUtilized.isEmpty()) sb.append("  📊 UNDER-UTILIZED (<50%): ").append(String.join(", ", underUtilized)).append("\n");

        return ToolResult.ok(sb.toString());
    }

    private ToolResult getTeamComposition(JsonNode params, NlpCatalogResponse catalog) {
        if (catalog.resourceDetails() == null || catalog.resourceDetails().isEmpty())
            return ToolResult.fail("No resource data available");

        String pod = params.path("pod").asText(null);

        var filtered = catalog.resourceDetails().stream()
                .filter(r -> pod == null || (r.podName() != null && r.podName().toLowerCase().contains(pod.toLowerCase())))
                .toList();

        if (filtered.isEmpty()) return ToolResult.ok("No resources match the given filter.");

        // Count by role
        Map<String, Integer> byRole = new java.util.LinkedHashMap<>();
        Map<String, Integer> byLocation = new java.util.LinkedHashMap<>();
        Map<String, Map<String, Integer>> byPodRole = new java.util.LinkedHashMap<>();

        for (var r : filtered) {
            byRole.merge(r.role(), 1, Integer::sum);
            byLocation.merge(r.location(), 1, Integer::sum);
            String podName = r.podName() != null ? r.podName() : "Unassigned";
            byPodRole.computeIfAbsent(podName, k -> new java.util.LinkedHashMap<>()).merge(r.role(), 1, Integer::sum);
        }

        StringBuilder sb = new StringBuilder("Team Composition");
        if (pod != null) sb.append(" — ").append(pod).append(" Pod");
        sb.append(" (").append(filtered.size()).append(" total):\n");

        sb.append("  BY ROLE: ");
        byRole.forEach((r, c) -> sb.append(r).append("=").append(c).append(" "));
        sb.append("\n");

        sb.append("  BY LOCATION: ");
        byLocation.forEach((l, c) -> sb.append(l).append("=").append(c).append(" "));
        sb.append("\n");

        // Ratios
        int devCount = byRole.getOrDefault("DEVELOPER", 0);
        int qaCount = byRole.getOrDefault("QA", 0);
        int usCount = byLocation.getOrDefault("US", 0);
        int indiaCount = byLocation.getOrDefault("INDIA", 0);
        sb.append(String.format("  RATIOS: Dev:QA=%d:%d", devCount, qaCount));
        if (qaCount > 0) sb.append(String.format(" (%.1f:1)", (double)devCount / qaCount));
        sb.append(String.format(" | US:India=%d:%d", usCount, indiaCount));
        sb.append("\n");

        // Per-pod breakdown (only if not already filtered to one pod)
        if (pod == null && byPodRole.size() <= 10) {
            sb.append("  PER POD:\n");
            for (var entry : byPodRole.entrySet()) {
                sb.append("    ").append(entry.getKey()).append(": ");
                entry.getValue().forEach((r, c) -> sb.append(r).append("=").append(c).append(" "));
                sb.append("\n");
            }
        }

        return ToolResult.ok(sb.toString());
    }

    private ToolResult getPortfolioSummary(NlpCatalogResponse catalog) {
        StringBuilder sb = new StringBuilder("Portfolio Summary:\n");

        // Projects by status
        if (catalog.projectDetails() != null) {
            Map<String, Integer> byStatus = new java.util.LinkedHashMap<>();
            Map<String, Integer> byPriority = new java.util.LinkedHashMap<>();
            for (var p : catalog.projectDetails()) {
                byStatus.merge(p.status(), 1, Integer::sum);
                byPriority.merge(p.priority(), 1, Integer::sum);
            }
            sb.append("  PROJECTS (").append(catalog.projectDetails().size()).append(" total): ");
            byStatus.forEach((s, c) -> sb.append(s).append("=").append(c).append(" "));
            sb.append("\n    By Priority: ");
            byPriority.forEach((p, c) -> sb.append(p).append("=").append(c).append(" "));
            sb.append("\n");
        }

        // Resources
        if (catalog.resourceDetails() != null) {
            int total = catalog.resourceDetails().size();
            long devs = catalog.resourceDetails().stream().filter(r -> "DEVELOPER".equals(r.role())).count();
            long qas = catalog.resourceDetails().stream().filter(r -> "QA".equals(r.role())).count();
            long bsas = catalog.resourceDetails().stream().filter(r -> "BSA".equals(r.role())).count();
            long tls = catalog.resourceDetails().stream().filter(r -> "TECH_LEAD".equals(r.role())).count();
            sb.append(String.format("  RESOURCES (%d total): DEV=%d QA=%d BSA=%d TL=%d\n", total, devs, qas, bsas, tls));
        }

        // Pods
        if (catalog.podDetails() != null) {
            sb.append("  PODS (").append(catalog.podDetails().size()).append("): ");
            for (var p : catalog.podDetails()) {
                sb.append(p.name()).append("(").append(p.memberCount()).append(" members) ");
            }
            sb.append("\n");
        }

        // Current sprint
        if (catalog.sprintDetails() != null) {
            var active = catalog.sprintDetails().stream().filter(s -> "Active".equals(s.status())).findFirst();
            active.ifPresent(s -> sb.append("  CURRENT SPRINT: ").append(s.name())
                    .append(" (").append(s.startDate()).append(" to ").append(s.endDate()).append(")\n"));
        }

        // Upcoming releases
        if (catalog.releaseDetails() != null) {
            var upcoming = catalog.releaseDetails().stream()
                    .filter(r -> "Upcoming".equals(r.status()) || "Code Frozen".equals(r.status())).toList();
            if (!upcoming.isEmpty()) {
                sb.append("  UPCOMING RELEASES: ");
                for (var r : upcoming) {
                    sb.append(r.name()).append(" (").append(r.releaseDate()).append(") ");
                }
                sb.append("\n");
            }
        }

        // Dependencies/blockers
        if (catalog.projectDependencies() != null && !catalog.projectDependencies().isEmpty()) {
            long blocked = catalog.projectDependencies().stream()
                    .filter(d -> !"COMPLETED".equalsIgnoreCase(d.blockedByStatus())).count();
            sb.append("  BLOCKERS: ").append(blocked).append(" active dependencies\n");
        }

        // Active overrides
        if (catalog.temporaryOverrides() != null && !catalog.temporaryOverrides().isEmpty()) {
            sb.append("  ACTIVE OVERRIDES: ").append(catalog.temporaryOverrides().size()).append(" resource transfers\n");
        }

        return ToolResult.ok(sb.toString());
    }

    private ToolResult getOverrides(JsonNode params, NlpCatalogResponse catalog) {
        if (catalog.temporaryOverrides() == null || catalog.temporaryOverrides().isEmpty())
            return ToolResult.ok("No temporary overrides are currently active.");

        String resource = params.path("resource").asText(null);
        String pod = params.path("pod").asText(null);

        var filtered = catalog.temporaryOverrides().stream()
                .filter(o -> resource == null || o.resourceName().toLowerCase().contains(resource.toLowerCase()))
                .filter(o -> pod == null || (o.fromPod() != null && o.fromPod().toLowerCase().contains(pod.toLowerCase()))
                        || (o.toPod() != null && o.toPod().toLowerCase().contains(pod.toLowerCase())))
                .toList();

        if (filtered.isEmpty()) return ToolResult.ok("No overrides match the given filter.");

        StringBuilder sb = new StringBuilder("Temporary Overrides (" + filtered.size() + "):\n");
        for (var o : filtered) {
            sb.append(String.format("  %s (%s): %s → %s | %s to %s | %s%%",
                    o.resourceName(), o.resourceRole(), o.fromPod(), o.toPod(),
                    o.startLabel(), o.endLabel(), o.allocationPct()));
            if (o.notes() != null && !o.notes().isBlank()) sb.append(" | Notes: ").append(o.notes());
            sb.append("\n");
        }
        return ToolResult.ok(sb.toString());
    }

    private ToolResult getTshirtSizes(NlpCatalogResponse catalog) {
        if (catalog.tshirtSizes() == null || catalog.tshirtSizes().isEmpty())
            return ToolResult.ok("No T-shirt size configuration found.");

        StringBuilder sb = new StringBuilder("T-shirt Size Configuration:\n");
        for (var ts : catalog.tshirtSizes()) {
            sb.append(String.format("  %s: %d base hours\n", ts.name(), ts.baseHours()));
        }
        return ToolResult.ok(sb.toString());
    }
}
