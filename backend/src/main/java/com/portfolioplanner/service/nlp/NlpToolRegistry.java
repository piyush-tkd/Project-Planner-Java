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
        return List.of(
                new ToolDefinition("get_resource_profile",
                        "Get detailed profile of a specific resource/team member by name",
                        """
                        { "name": "string (resource name or partial name)" }
                        """),
                new ToolDefinition("get_project_profile",
                        "Get detailed profile of a specific project by name",
                        """
                        { "name": "string (project name or partial name)" }
                        """),
                new ToolDefinition("get_pod_profile",
                        "Get detailed profile of a POD (team) including members and projects",
                        """
                        { "name": "string (pod name or partial name)" }
                        """),
                new ToolDefinition("list_resources",
                        "List resources filtered by role, location, or pod name",
                        """
                        { "role": "string? (DEVELOPER|QA|BSA|TECH_LEAD)", "location": "string? (US|INDIA)", "pod": "string? (pod name)" }
                        """),
                new ToolDefinition("list_projects",
                        "List projects filtered by owner, status, priority, or pod",
                        """
                        { "owner": "string?", "status": "string? (NOT_STARTED|IN_DISCOVERY|ACTIVE|ON_HOLD|COMPLETED|CANCELLED)", "priority": "string? (P0|P1|P2|P3)", "pod": "string?" }
                        """),
                new ToolDefinition("get_project_estimates",
                        "Get hour estimates and pod breakdown for a project",
                        """
                        { "name": "string (project name)" }
                        """),
                new ToolDefinition("get_sprint_allocations",
                        "Get sprint-level hour allocations, optionally filtered by sprint/project/pod name",
                        """
                        { "filter": "string? (sprint name, project name, pod name, or 'current' for active sprint)" }
                        """),
                new ToolDefinition("get_resource_availability",
                        "Get monthly availability/capacity for a resource",
                        """
                        { "name": "string (resource name)" }
                        """),
                new ToolDefinition("get_project_dependencies",
                        "Get dependency/blocker information for projects",
                        """
                        { "name": "string? (project name, or omit for all dependencies)" }
                        """),
                new ToolDefinition("get_cost_rates",
                        "Get billing/cost rates, optionally filtered by role and location",
                        """
                        { "role": "string? (DEVELOPER|QA|BSA|TECH_LEAD)", "location": "string? (US|INDIA)" }
                        """),
                new ToolDefinition("get_sprint_info",
                        "Get sprint calendar details by name or status",
                        """
                        { "name": "string? (sprint name or 'current' or 'upcoming')" }
                        """),
                new ToolDefinition("get_release_info",
                        "Get release calendar details by name",
                        """
                        { "name": "string? (release name or 'upcoming')" }
                        """),
                new ToolDefinition("get_project_actuals",
                        "Get actual hours logged against a project",
                        """
                        { "name": "string (project name)" }
                        """),
                new ToolDefinition("get_effort_patterns",
                        "Get available effort distribution patterns",
                        """
                        {}
                        """),
                new ToolDefinition("get_role_effort_mix",
                        "Get standard role effort mix percentages",
                        """
                        {}
                        """)
        );
    }

    /**
     * Build the tool definitions section for the LLM system prompt.
     */
    public String buildToolPromptSection() {
        StringBuilder sb = new StringBuilder();
        sb.append("AVAILABLE TOOLS (you may call ONE tool to fetch data before answering):\n\n");

        for (ToolDefinition tool : getToolDefinitions()) {
            sb.append("  tool: \"").append(tool.name()).append("\"\n");
            sb.append("  description: ").append(tool.description()).append("\n");
            sb.append("  params: ").append(tool.parameterSchema().trim()).append("\n\n");
        }

        sb.append("""
                TO CALL A TOOL, return this JSON instead of the normal response:
                { "tool": "tool_name", "params": { ... } }

                IMPORTANT RULES:
                - Only call a tool if you need specific data to answer the question.
                - For greetings, navigation, help, and capabilities questions — answer directly, do NOT call a tool.
                - For entity lookups (show me resource X, what's pod Y) — call the appropriate tool.
                - For list/filter queries — call the appropriate list tool.
                - You will get the tool result back and then produce your final answer.

                """);
        return sb.toString();
    }

    /**
     * Execute a tool call against the catalog and return the result.
     */
    public ToolResult executeTool(String toolName, JsonNode params, NlpCatalogResponse catalog) {
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

        String role = params.path("role").asText(null);
        String location = params.path("location").asText(null);
        String pod = params.path("pod").asText(null);

        var filtered = catalog.resourceDetails().stream()
                .filter(r -> role == null || r.role().equalsIgnoreCase(role))
                .filter(r -> location == null || r.location().equalsIgnoreCase(location))
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
                .filter(p -> status == null || p.status().equalsIgnoreCase(status))
                .filter(p -> priority == null || p.priority().equalsIgnoreCase(priority))
                .filter(p -> pod == null || (p.assignedPods() != null && p.assignedPods().toLowerCase().contains(pod.toLowerCase())))
                .toList();

        if (filtered.isEmpty()) return ToolResult.ok("No projects match the given filters.");

        StringBuilder sb = new StringBuilder("Found " + filtered.size() + " projects:\n");
        for (var p : filtered) {
            sb.append(String.format("  - %s [%s] | Owner: %s | Status: %s | Pods: %s\n",
                    p.name(), p.priority(), p.owner(), p.status(), p.assignedPods()));
        }
        return ToolResult.ok(sb.toString());
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

        if (catalog.releaseDetails() == null) return ToolResult.fail("No release data");

        List<NlpCatalogResponse.ReleaseInfo> filtered;
        if ("upcoming".equalsIgnoreCase(name)) {
            filtered = catalog.releaseDetails().stream()
                    .filter(r -> "Upcoming".equals(r.status()) || "Code Frozen".equals(r.status())).toList();
        } else if (name != null) {
            filtered = catalog.releaseDetails().stream()
                    .filter(r -> r.name().toLowerCase().contains(name.toLowerCase())).toList();
        } else {
            filtered = catalog.releaseDetails();
        }

        if (filtered.isEmpty()) return ToolResult.ok("No releases found.");

        StringBuilder sb = new StringBuilder("Releases (" + filtered.size() + "):\n");
        for (var r : filtered) {
            sb.append(String.format("  %s | Release: %s | Freeze: %s | Type: %s | Status: %s\n",
                    r.name(), r.releaseDate(), r.codeFreezeDate(), r.type(), r.status()));
        }
        return ToolResult.ok(sb.toString());
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
}
