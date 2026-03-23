package com.portfolioplanner.service.nlp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Shared response builder used by ALL strategies.
 * Builds deterministic responses from tool output — no LLM involved.
 *
 * Responsibilities:
 * 1. Parse tool output text into structured data maps (standard response shapes)
 * 2. Generate template-based messages from tool name + params + result count
 * 3. Infer drill-down routes
 * 4. Generate contextual follow-up suggestions
 *
 * This replaces the unreliable LLM synthesis step for data queries.
 */
@Component
public class NlpResponseBuilder {

    private static final Logger log = LoggerFactory.getLogger(NlpResponseBuilder.class);
    private static final Pattern COUNT_PATTERN = Pattern.compile("Found (\\d+)");
    private static final Pattern BULLET_PATTERN = Pattern.compile("^\\s*[-•]\\s+(.+)$");
    private static final Pattern KEY_VALUE_PATTERN = Pattern.compile("^\\s*([^:]+?):\\s+(.+)$");

    // ══════════════════════════════════════════════════════════════════
    //  PUBLIC API
    // ══════════════════════════════════════════════════════════════════

    /**
     * Build a complete NlpResult from a tool execution result.
     * This is the primary entry point — deterministic, no LLM.
     */
    public NlpStrategy.NlpResult buildFromToolResult(String toolName, Map<String, String> params,
                                                      NlpToolRegistry.ToolResult toolResult) {
        if (!toolResult.success()) {
            return buildErrorResult(toolName, params, toolResult.error());
        }

        Map<String, Object> data = parseToolOutput(toolName, toolResult.data());
        String message = buildTemplateMessage(toolName, params, data);
        String drillDown = inferDrillDown(toolName);
        List<String> suggestions = buildSuggestions(toolName, params);
        String shape = inferShape(toolName, data);
        data.put("_shape", shape);  // Also store in data for backward compatibility

        return new NlpStrategy.NlpResult(
                "DATA_QUERY", 0.92, message, null, null,
                data, drillDown, suggestions, shape
        );
    }

    /**
     * Build an error result when a tool fails or returns no data.
     */
    public NlpStrategy.NlpResult buildErrorResult(String toolName, Map<String, String> params, String error) {
        String message = error != null ? error : "No results found for your query.";
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "ERROR");
        data.put("error", message);
        String shape = "ERROR";
        data.put("_shape", shape);

        return new NlpStrategy.NlpResult(
                "DATA_QUERY", 0.70, message, null, null,
                data, null, buildSuggestions(toolName, params), shape
        );
    }

    // ══════════════════════════════════════════════════════════════════
    //  TOOL OUTPUT PARSER
    // ══════════════════════════════════════════════════════════════════

    /**
     * Parse raw tool output text into a structured data map.
     * Handles the standard format: "Found N items:\n  - item1\n  - item2\n..."
     * Also handles key-value and profile formats.
     */
    public Map<String, Object> parseToolOutput(String toolName, String rawOutput) {
        Map<String, Object> data = new LinkedHashMap<>();
        if (rawOutput == null || rawOutput.isBlank()) return data;

        // Set _type based on tool name
        data.put("_type", inferDataType(toolName));

        // Also set listType for list-producing tools
        String listType = inferListType(toolName);
        if (listType != null) {
            data.put("listType", listType);
        }

        // Split into lines — handle both \n and \r\n
        String[] lines = rawOutput.split("\\r?\\n");
        int itemIndex = 0;
        List<Map<String, String>> structuredItems = new ArrayList<>();

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;

            // Try bullet point match (the primary list item format)
            Matcher bulletMatch = BULLET_PATTERN.matcher(line);
            if (bulletMatch.matches()) {
                itemIndex++;
                String itemText = bulletMatch.group(1).trim();
                data.put("#" + itemIndex, itemText);

                // Also parse structured fields from pipe-delimited format
                // e.g., "SgNIPT [P0] | Owner: BD | Status: ACTIVE | Pods: API Pod"
                Map<String, String> itemFields = parsePipeDelimitedItem(itemText);
                if (!itemFields.isEmpty()) {
                    structuredItems.add(itemFields);
                }
                continue;
            }

            // Try "Found N ..." count line
            Matcher countMatch = COUNT_PATTERN.matcher(trimmed);
            if (countMatch.find() && itemIndex == 0) {
                data.put("Count", countMatch.group(1));
                continue;
            }

            // Try key-value pairs (for profile/detail tools)
            if (itemIndex == 0 && !trimmed.startsWith("Found ")) {
                Matcher kvMatch = KEY_VALUE_PATTERN.matcher(trimmed);
                if (kvMatch.matches()) {
                    data.put(kvMatch.group(1).trim(), kvMatch.group(2).trim());
                    continue;
                }
            }

            // If nothing else matched and we haven't found items yet, could be a header/label
            if (itemIndex == 0 && !data.containsKey("Count")) {
                // Check if this is a count line in a different format
                Matcher altCount = Pattern.compile("(\\d+)\\s+\\w+").matcher(trimmed);
                if (altCount.find() && trimmed.contains(":")) {
                    data.put("Count", altCount.group(1));
                }
            }
        }

        // Set count if we found items but no explicit count line
        if (itemIndex > 0 && !data.containsKey("Count")) {
            data.put("Count", String.valueOf(itemIndex));
        }

        // Store structured items if we parsed them
        if (!structuredItems.isEmpty()) {
            data.put("_structuredItems", structuredItems);
        }

        return data;
    }

    /**
     * Parse a pipe-delimited item line into structured fields.
     * "SgNIPT [P0] | Owner: BD | Status: ACTIVE | Pods: API Pod"
     * → {name: "SgNIPT", priority: "P0", Owner: "BD", Status: "ACTIVE", Pods: "API Pod"}
     */
    private Map<String, String> parsePipeDelimitedItem(String itemText) {
        Map<String, String> fields = new LinkedHashMap<>();
        if (!itemText.contains("|")) return fields;

        String[] segments = itemText.split("\\|");
        for (int i = 0; i < segments.length; i++) {
            String segment = segments[i].trim();
            if (i == 0) {
                // First segment is often "Name [Priority]" or just "Name"
                Matcher nameWithBracket = Pattern.compile("^(.+?)\\s+\\[([^]]+)]$").matcher(segment);
                if (nameWithBracket.matches()) {
                    fields.put("name", nameWithBracket.group(1).trim());
                    fields.put("priority", nameWithBracket.group(2).trim());
                } else {
                    fields.put("name", segment);
                }
            } else {
                // Subsequent segments are "Key: Value"
                Matcher kv = KEY_VALUE_PATTERN.matcher(segment);
                if (kv.matches()) {
                    fields.put(kv.group(1).trim(), kv.group(2).trim());
                }
            }
        }
        return fields;
    }

    // ══════════════════════════════════════════════════════════════════
    //  TEMPLATE MESSAGE GENERATION
    // ══════════════════════════════════════════════════════════════════

    /**
     * Generate a human-readable message from the tool name, parameters, and parsed data.
     * No LLM involved — pure template-based generation.
     */
    public String buildTemplateMessage(String toolName, Map<String, String> params, Map<String, Object> data) {
        String count = data.containsKey("Count") ? String.valueOf(data.get("Count")) : null;

        return switch (toolName) {
            // ── List tools ──
            case "list_projects" -> buildProjectListMessage(params, count);
            case "list_resources" -> buildResourceListMessage(params, count);

            // ── Profile tools ──
            case "get_resource_profile" -> buildProfileMessage("resource", params.get("name"));
            case "get_project_profile" -> buildProfileMessage("project", params.get("name"));
            case "get_pod_profile" -> buildProfileMessage("pod", params.get("name"));

            // ── Analytics tools ──
            case "get_team_composition" -> "Here's the team composition breakdown:";
            case "get_utilization_summary" -> "Here's the current resource utilization summary:";
            case "get_capacity_summary" -> "Here's the capacity summary:";
            case "get_portfolio_summary" -> "Here's the portfolio overview:";

            // ── Sprint/Release tools ──
            case "get_sprint_info" -> buildSprintMessage(params);
            case "get_release_info" -> buildReleaseMessage(params);
            case "get_sprint_allocations" -> "Here are the sprint allocations:";

            // ── Cost/Estimation tools ──
            case "get_cost_rates" -> "Here are the current billing rates:";
            case "get_project_estimates" -> buildEstimateMessage(params.get("name"));
            case "get_resource_availability" -> buildAvailabilityMessage(params.get("name"));

            // ── Dependency/Analytics tools ──
            case "get_project_dependencies" -> "Here are the project dependencies:";
            case "get_project_actuals" -> "Here are the actual hours logged:";
            case "get_effort_patterns" -> "Here are the available effort distribution patterns:";
            case "get_role_effort_mix" -> "Here's the standard role effort mix:";
            case "get_overrides" -> "Here are the current resource overrides (cross-pod loans):";
            case "get_tshirt_sizes" -> "Here's the T-shirt size configuration:";

            // ── Jira tools ──
            case "get_jira_issue" -> "Here are the Jira issue details:";
            case "search_jira_issues" -> "Here are the matching Jira issues:";
            case "get_jira_analytics_summary" -> "Here's the Jira analytics summary:";
            case "get_jira_workload" -> "Here's the Jira workload breakdown:";
            case "get_jira_sprint_health" -> "Here's the Jira sprint health:";
            case "get_jira_bug_summary" -> "Here's the bug summary:";
            case "get_project_jira_issues" -> "Here are the Jira issues linked to this project:";
            case "get_jira_issue_contributors" -> "Here are the issue contributors:";

            default -> count != null ? "Found " + count + " results:" : "Here are the results:";
        };
    }

    private String buildProjectListMessage(Map<String, String> params, String count) {
        StringBuilder sb = new StringBuilder();
        if (count != null) sb.append("Found ").append(count);
        else sb.append("Here are the");

        String priority = params.get("priority");
        String status = params.get("status");
        String owner = params.get("owner");
        String pod = params.get("pod");

        if (priority != null) sb.append(" ").append(priority.toUpperCase());
        if (status != null) sb.append(" ").append(formatStatus(status));
        sb.append(" project");
        if (count == null || !"1".equals(count)) sb.append("s");

        if (owner != null) sb.append(" owned by ").append(owner);
        if (pod != null) sb.append(" in ").append(pod);
        sb.append(":");

        return sb.toString();
    }

    private String buildResourceListMessage(Map<String, String> params, String count) {
        StringBuilder sb = new StringBuilder();
        if (count != null) sb.append("Found ").append(count);
        else sb.append("Here are the");

        String role = params.get("role");
        String pod = params.get("pod");
        String location = params.get("location");

        if (role != null) sb.append(" ").append(formatRole(role));
        sb.append(" resource");
        if (count == null || !"1".equals(count)) sb.append("s");

        if (pod != null) sb.append(" in ").append(pod);
        if (location != null) sb.append(" in ").append(location);
        sb.append(":");

        return sb.toString();
    }

    private String buildProfileMessage(String entityType, String name) {
        if (name != null && !name.isBlank()) {
            return "Here's the " + entityType + " profile for " + name + ":";
        }
        return "Here's the " + entityType + " profile:";
    }

    private String buildSprintMessage(Map<String, String> params) {
        String name = params.get("name");
        if ("current".equalsIgnoreCase(name)) return "Here's the current sprint information:";
        if ("upcoming".equalsIgnoreCase(name)) return "Here are the upcoming sprints:";
        if (name != null) return "Here's the sprint information for " + name + ":";
        return "Here's the sprint information:";
    }

    private String buildReleaseMessage(Map<String, String> params) {
        String name = params.get("name");
        if ("upcoming".equalsIgnoreCase(name)) return "Here are the upcoming releases:";
        if (name != null) return "Here's the release information for " + name + ":";
        return "Here's the release information:";
    }

    private String buildEstimateMessage(String name) {
        if (name != null && !name.isBlank()) return "Here are the estimates for " + name + ":";
        return "Here are the project estimates:";
    }

    private String buildAvailabilityMessage(String name) {
        if (name != null && !name.isBlank()) return "Here's the availability for " + name + ":";
        return "Here's the resource availability:";
    }

    // ══════════════════════════════════════════════════════════════════
    //  DRILL-DOWN & SUGGESTIONS
    // ══════════════════════════════════════════════════════════════════

    /**
     * Infer the frontend drill-down route from the tool name.
     */
    public String inferDrillDown(String toolName) {
        if (toolName == null) return null;
        if (toolName.contains("project")) return "/projects";
        if (toolName.contains("resource") || toolName.contains("team_composition")) return "/resources";
        if (toolName.contains("pod")) return "/pods";
        if (toolName.contains("release")) return "/release-calendar";
        if (toolName.contains("sprint")) return "/sprint-calendar";
        if (toolName.contains("cost") || toolName.contains("rate")) return "/cost-rates";
        if (toolName.contains("capacity") || toolName.contains("utilization")) return "/heatmap";
        if (toolName.contains("jira")) return "/jira-dashboard-builder";
        return null;
    }

    /**
     * Build contextual follow-up suggestions based on what was just queried.
     */
    public List<String> buildSuggestions(String toolName, Map<String, String> params) {
        return switch (toolName) {
            case "list_projects" -> {
                String priority = params.get("priority");
                if (priority != null) {
                    yield List.of(
                            "Which " + priority + " projects are at risk?",
                            "Show me " + priority + " project estimates",
                            "What's the capacity for " + priority + " projects?"
                    );
                }
                String status = params.get("status");
                if (status != null) {
                    yield List.of(
                            "Show me project dependencies",
                            "What's the portfolio summary?",
                            "Show resource utilization"
                    );
                }
                yield List.of("Show me P0 projects", "What's the portfolio summary?", "Show resource utilization");
            }
            case "list_resources" -> List.of(
                    "Show resource utilization",
                    "What's the team composition?",
                    "Who's over-allocated?"
            );
            case "get_resource_profile" -> {
                String name = params.get("name");
                yield List.of(
                        name != null ? "What's " + name + "'s availability?" : "Show resource availability",
                        "Show resource utilization",
                        "List all resources"
                );
            }
            case "get_project_profile" -> {
                String name = params.get("name");
                yield List.of(
                        name != null ? "Show estimates for " + name : "Show project estimates",
                        name != null ? "What are " + name + "'s dependencies?" : "Show project dependencies",
                        "Show portfolio summary"
                );
            }
            case "get_pod_profile" -> List.of(
                    "Show team composition",
                    "Show resource utilization",
                    "List all pods"
            );
            case "get_utilization_summary" -> List.of(
                    "Who's over-allocated?",
                    "Show capacity summary",
                    "Show team composition"
            );
            case "get_capacity_summary" -> List.of(
                    "Show utilization summary",
                    "Who has availability?",
                    "Show resource availability"
            );
            case "get_portfolio_summary" -> List.of(
                    "Show P0 projects",
                    "What projects are at risk?",
                    "Show resource utilization"
            );
            default -> List.of(
                    "Show portfolio summary",
                    "Show resource utilization",
                    "Show P0 projects"
            );
        };
    }

    // ══════════════════════════════════════════════════════════════════
    //  PRIVATE HELPERS
    // ══════════════════════════════════════════════════════════════════

    private String inferDataType(String toolName) {
        if (toolName == null) return "LIST";
        if (toolName.startsWith("list_")) return "LIST";
        if (toolName.equals("get_resource_profile")) return "RESOURCE_PROFILE";
        if (toolName.equals("get_project_profile")) return "PROJECT_PROFILE";
        if (toolName.equals("get_pod_profile")) return "POD_PROFILE";
        if (toolName.equals("get_sprint_info")) return "SPRINT_PROFILE";
        if (toolName.equals("get_release_info")) return "RELEASE_PROFILE";
        if (toolName.equals("get_cost_rates")) return "COST_RATE";
        if (toolName.equals("get_project_estimates")) return "PROJECT_ESTIMATES";
        if (toolName.equals("get_sprint_allocations")) return "SPRINT_ALLOCATIONS";
        if (toolName.equals("get_resource_availability")) return "RESOURCE_AVAILABILITY";
        if (toolName.equals("get_project_dependencies")) return "PROJECT_DEPENDENCIES";
        if (toolName.equals("get_project_actuals")) return "PROJECT_ACTUALS";
        if (toolName.equals("get_effort_patterns")) return "EFFORT_PATTERN";
        if (toolName.equals("get_role_effort_mix")) return "ROLE_EFFORT_MIX";
        if (toolName.equals("get_team_composition")) return "TEAM_COMPOSITION";
        if (toolName.equals("get_utilization_summary")) return "UTILIZATION_SUMMARY";
        if (toolName.equals("get_capacity_summary")) return "CAPACITY_SUMMARY";
        if (toolName.equals("get_portfolio_summary")) return "PORTFOLIO_SUMMARY";
        if (toolName.equals("get_overrides")) return "OVERRIDES";
        if (toolName.equals("get_tshirt_sizes")) return "TSHIRT_SIZES";
        if (toolName.contains("jira")) return "JIRA";
        return "LIST";
    }

    private String inferListType(String toolName) {
        if (toolName == null) return null;
        if (toolName.contains("project")) return "PROJECTS";
        if (toolName.contains("resource")) return "RESOURCES";
        if (toolName.contains("pod")) return "PODS";
        if (toolName.contains("release")) return "RELEASES";
        if (toolName.contains("sprint")) return "SPRINTS";
        if (toolName.contains("jira")) return "JIRA_ISSUES";
        return null;
    }

    /**
     * Infer the response shape from the tool name and data type.
     * Shapes: LIST, DETAIL, SUMMARY, COMPARISON, ERROR
     */
    public String inferShape(String toolName, Map<String, Object> data) {
        if (data == null || data.isEmpty()) return "ERROR";

        String type = String.valueOf(data.getOrDefault("_type", ""));

        // Direct type mapping
        return switch (type) {
            case "LIST" -> "LIST";
            case "PROJECT_PROFILE", "RESOURCE_PROFILE", "POD_PROFILE",
                 "SPRINT_PROFILE", "RELEASE_PROFILE" -> "DETAIL";
            case "COMPARISON" -> "COMPARISON";
            case "ERROR" -> "ERROR";
            case "PORTFOLIO_SUMMARY", "UTILIZATION_SUMMARY", "CAPACITY_SUMMARY",
                 "TEAM_COMPOSITION", "RESOURCE_ANALYTICS", "RISK_SUMMARY",
                 "COST_RATE", "EFFORT_PATTERN", "ROLE_EFFORT_MIX",
                 "PROJECT_ESTIMATES", "SPRINT_ALLOCATIONS", "RESOURCE_AVAILABILITY",
                 "PROJECT_DEPENDENCIES", "PROJECT_ACTUALS" -> "SUMMARY";
            default -> {
                // Infer from tool name
                if (toolName != null) {
                    if (toolName.startsWith("list_")) yield "LIST";
                    if (toolName.startsWith("get_") && toolName.contains("profile")) yield "DETAIL";
                    if (toolName.contains("summary") || toolName.contains("composition") ||
                        toolName.contains("utilization") || toolName.contains("capacity")) yield "SUMMARY";
                }
                yield "SUMMARY"; // Default fallback
            }
        };
    }

    private String formatStatus(String status) {
        if (status == null) return "";
        return switch (status.toUpperCase()) {
            case "ACTIVE" -> "active";
            case "ON_HOLD" -> "on-hold";
            case "COMPLETED" -> "completed";
            case "CANCELLED" -> "cancelled";
            case "NOT_STARTED" -> "not-started";
            case "IN_DISCOVERY" -> "in-discovery";
            default -> status.toLowerCase();
        };
    }

    private String formatRole(String role) {
        if (role == null) return "";
        return switch (role.toUpperCase()) {
            case "DEVELOPER" -> "developer";
            case "QA" -> "QA";
            case "BSA" -> "BSA";
            case "TECH_LEAD" -> "tech lead";
            default -> role.toLowerCase();
        };
    }
}
