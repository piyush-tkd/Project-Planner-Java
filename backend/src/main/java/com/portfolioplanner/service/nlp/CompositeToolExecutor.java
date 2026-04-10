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
 * CompositeToolExecutor — handles queries that require TWO tool calls and comparison merging.
 *
 * Primary use case: "Compare pod A and pod B", "Compare project X vs project Y".
 * Calls the same tool twice (once per entity), merges results into a COMPARISON shape,
 * and returns a single NlpResult. Zero LLM involvement.
 *
 * Called from DeterministicStrategy.classify() BEFORE the single-tool route matching.
 */
@Component
public class CompositeToolExecutor {

    private static final Logger log = LoggerFactory.getLogger(CompositeToolExecutor.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final NlpToolRegistry toolRegistry;

    public CompositeToolExecutor(NlpToolRegistry toolRegistry) {
        this.toolRegistry = toolRegistry;
    }

    // ── Comparison patterns ────────────────────────────────────────────────────

    /** Detects "compare pod/project/resource A and/vs B" queries. Group 1=type, 2=nameA, 3=nameB. */
    private static final Pattern COMPARE_EXPLICIT = Pattern.compile(
            "(?i)^(?:compare|contrast|difference\\s+between|how\\s+does?|compare\\s+and\\s+contrast)\\s+" +
            "(?:the\\s+)?(pod|project|resource|team)s?\\s+(.+?)\\s+(?:and|vs\\.?|versus|with|against)\\s+" +
            "(?:the\\s+)?(?:pod|project|resource|team)?\\s*(.+?)\\s*\\??$"
    );

    /** Detects "A vs B pods/projects" queries. Group 1=nameA, 2=nameB, 3=type. */
    private static final Pattern COMPARE_VS = Pattern.compile(
            "(?i)^(.+?)\\s+(?:vs\\.?|versus|compared?\\s+to|against)\\s+(.+?)\\s+(pods?|projects?|teams?|resources?)\\s*\\??$"
    );

    /** Detects "compare project A and project B" (explicit per-noun type). Group 1=nameA, 2=nameB. */
    private static final Pattern COMPARE_PROJECTS = Pattern.compile(
            "(?i)^(?:compare|contrast)\\s+(?:the\\s+)?project\\s+(.+?)\\s+(?:and|vs\\.?|versus|with)\\s+" +
            "(?:the\\s+)?(?:project\\s+)?(.+?)\\s*\\??$"
    );

    /** Detects "compare pod A and pod B". Group 1=nameA, 2=nameB. */
    private static final Pattern COMPARE_PODS = Pattern.compile(
            "(?i)^(?:compare|contrast)\\s+(?:the\\s+)?(?:pod|team)\\s+(.+?)\\s+(?:and|vs\\.?|versus|with)\\s+" +
            "(?:the\\s+)?(?:pod|team\\s+)?(.+?)\\s*\\??$"
    );

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Attempt to detect and execute a comparison query.
     * Returns null if the query is not a comparison query.
     */
    public NlpStrategy.NlpResult tryExecute(String query, NlpCatalogResponse catalog) {
        ComparisonIntent intent = detectComparison(query);
        if (intent == null) return null;

        log.info("COMPOSITE: detected comparison — type={} nameA='{}' nameB='{}'",
                intent.entityType, intent.nameA, intent.nameB);

        return executeComparison(intent, catalog);
    }

    // ── Detection ──────────────────────────────────────────────────────────────

    private ComparisonIntent detectComparison(String query) {
        // Pattern 1: "compare pod A and pod B"
        Matcher m1 = COMPARE_PODS.matcher(query);
        if (m1.matches()) {
            return new ComparisonIntent("pod", m1.group(1).trim(), m1.group(2).trim());
        }

        // Pattern 2: "compare project A and project B"
        Matcher m2 = COMPARE_PROJECTS.matcher(query);
        if (m2.matches()) {
            return new ComparisonIntent("project", m2.group(1).trim(), m2.group(2).trim());
        }

        // Pattern 3: "compare pod/project/resource A and B" (explicit type prefix)
        Matcher m3 = COMPARE_EXPLICIT.matcher(query);
        if (m3.matches()) {
            String type = normaliseType(m3.group(1));
            return new ComparisonIntent(type, m3.group(2).trim(), m3.group(3).trim());
        }

        // Pattern 4: "A vs B pods/projects"
        Matcher m4 = COMPARE_VS.matcher(query);
        if (m4.matches()) {
            String type = normaliseType(m4.group(3));
            return new ComparisonIntent(type, m4.group(1).trim(), m4.group(2).trim());
        }

        return null;
    }

    private String normaliseType(String raw) {
        String lower = raw.toLowerCase().replaceAll("s$", ""); // strip trailing 's'
        return switch (lower) {
            case "project" -> "project";
            case "resource" -> "resource";
            case "team" -> "pod";
            default -> "pod";
        };
    }

    // ── Execution ──────────────────────────────────────────────────────────────

    private NlpStrategy.NlpResult executeComparison(ComparisonIntent intent, NlpCatalogResponse catalog) {
        String toolName = switch (intent.entityType) {
            case "project" -> "get_project_profile";
            case "resource" -> "get_resource_profile";
            default -> "get_pod_profile"; // pod / team
        };

        // Execute tool for both entities
        NlpToolRegistry.ToolResult resultA = executeTool(toolName, intent.nameA, catalog);
        NlpToolRegistry.ToolResult resultB = executeTool(toolName, intent.nameB, catalog);

        if (!resultA.success() && !resultB.success()) {
            return buildNotFoundResult(intent);
        }

        // Build comparison response
        Map<String, Object> leftData = parseProfileText(resultA);
        Map<String, Object> rightData = parseProfileText(resultB);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("type", "COMPARISON");
        data.put("entityType", intent.entityType);
        data.put("nameA", intent.nameA);
        data.put("nameB", intent.nameB);
        data.put("left", leftData);
        data.put("right", rightData);
        data.put("_shape", "COMPARISON");

        // Build key-delta summary for the message
        String message = buildComparisonMessage(intent, leftData, rightData);

        List<String> suggestions = List.of(
                "Tell me more about " + intent.nameA,
                "Tell me more about " + intent.nameB,
                "Show all " + intent.entityType + "s"
        );

        return new NlpStrategy.NlpResult(
                "DATA_QUERY", 0.93, message, null, null,
                data, inferDrillDown(intent.entityType), suggestions, "COMPARISON"
        );
    }

    private NlpToolRegistry.ToolResult executeTool(String toolName, String name,
                                                    NlpCatalogResponse catalog) {
        try {
            Map<String, String> params = Map.of("name", name);
            JsonNode toolParams = objectMapper.valueToTree(params);
            return toolRegistry.executeTool(toolName, toolParams, catalog);
        } catch (Exception e) {
            log.warn("COMPOSITE: tool {} failed for '{}': {}", toolName, name, e.getMessage());
            return NlpToolRegistry.ToolResult.fail("No data found for: " + name);
        }
    }

    // ── Parsing ────────────────────────────────────────────────────────────────

    /**
     * Parse a tool result's text output into a key→value map.
     * Handles "Key: value" lines and bullet "- Item" lines.
     */
    private Map<String, Object> parseProfileText(NlpToolRegistry.ToolResult result) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (!result.success() || result.data() == null) {
            out.put("error", "No data found");
            return out;
        }

        String[] lines = result.data().split("\n");
        List<String> bullets = new ArrayList<>();

        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty()) continue;

            // Key: Value line
            int colonIdx = line.indexOf(':');
            if (colonIdx > 0 && colonIdx < line.length() - 1) {
                String key = line.substring(0, colonIdx).trim().toLowerCase().replace(' ', '_');
                String value = line.substring(colonIdx + 1).trim();
                if (!key.isBlank() && !value.isBlank()) {
                    out.put(key, value);
                    continue;
                }
            }

            // Bullet line
            if (line.startsWith("- ") || line.startsWith("• ")) {
                bullets.add(line.substring(2).trim());
                continue;
            }

            // Numeric result line (e.g. "Found 3 items")
            if (line.startsWith("Found ")) {
                out.put("count_line", line);
            }
        }

        if (!bullets.isEmpty()) {
            out.put("items", bullets);
        }
        return out;
    }

    private String buildComparisonMessage(ComparisonIntent intent,
                                           Map<String, Object> leftData,
                                           Map<String, Object> rightData) {
        if (leftData.containsKey("error") && rightData.containsKey("error")) {
            return "I couldn't find data for either " + intent.nameA + " or " + intent.nameB + ".";
        }
        if (leftData.containsKey("error")) {
            return "I couldn't find data for " + intent.nameA + ". Showing data for " + intent.nameB + " only.";
        }
        if (rightData.containsKey("error")) {
            return "I couldn't find data for " + intent.nameB + ". Showing data for " + intent.nameA + " only.";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("Comparing ").append(intent.entityType).append("s: ")
          .append(intent.nameA).append(" vs ").append(intent.nameB).append(".\n\n");

        // Surface a few key delta fields
        List<String> sharedKeys = List.of("status", "priority", "member_count", "role", "location",
                "project_count", "avg_bau%", "owner", "fte");
        for (String key : sharedKeys) {
            Object valA = leftData.get(key);
            Object valB = rightData.get(key);
            if (valA != null || valB != null) {
                sb.append("• ").append(capitalise(key.replace('_', ' '))).append(": ")
                  .append(valA != null ? valA : "—").append(" vs ")
                  .append(valB != null ? valB : "—").append("\n");
            }
        }

        return sb.toString().trim();
    }

    private NlpStrategy.NlpResult buildNotFoundResult(ComparisonIntent intent) {
        String message = "I couldn't find data for either '" + intent.nameA + "' or '" +
                intent.nameB + "'. Please check the " + intent.entityType + " names and try again.";
        return new NlpStrategy.NlpResult(
                "DATA_QUERY", 0.7, message, null, null, null, null,
                List.of("Show all " + intent.entityType + "s"), null
        );
    }

    private String inferDrillDown(String entityType) {
        return switch (entityType) {
            case "project" -> "/projects";
            case "resource" -> "/resources";
            default -> "/pods";
        };
    }

    private String capitalise(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    // ── Inner types ────────────────────────────────────────────────────────────

    private record ComparisonIntent(String entityType, String nameA, String nameB) {}
}
