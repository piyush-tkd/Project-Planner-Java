package com.portfolioplanner.service.nlp;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for NlpResponseBuilder — the shared template-based response builder.
 * Validates tool output parsing, template message generation, drill-down inference,
 * and suggestion generation.
 * Pure Java — no Spring context required.
 */
class NlpResponseBuilderTest {

    private NlpResponseBuilder builder;

    @BeforeEach
    void setUp() {
        builder = new NlpResponseBuilder();
    }

    // ══════════════════════════════════════════════════════════════════
    //  parseToolOutput()
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("parseToolOutput() — list format")
    class ParseToolOutputList {

        @Test
        void shouldParseStandardListOutput() {
            String output = "Found 3 projects:\n  - Alpha [P0] | Owner: JD | Status: ACTIVE\n  - Beta [P1] | Owner: MK | Status: ON_HOLD\n  - Gamma [P2] | Owner: TP | Status: COMPLETED";

            Map<String, Object> data = builder.parseToolOutput("list_projects", output);

            assertThat(data).containsEntry("_type", "LIST");
            assertThat(data).containsEntry("listType", "PROJECTS");
            assertThat(data).containsEntry("Count", "3");
            assertThat(data).containsEntry("#1", "Alpha [P0] | Owner: JD | Status: ACTIVE");
            assertThat(data).containsEntry("#2", "Beta [P1] | Owner: MK | Status: ON_HOLD");
            assertThat(data).containsEntry("#3", "Gamma [P2] | Owner: TP | Status: COMPLETED");
        }

        @Test
        void shouldHandleWindowsLineEndings() {
            String output = "Found 2 resources:\r\n  - John Developer [DEV] | Pod: API\r\n  - Jane QA [QA] | Pod: Core";

            Map<String, Object> data = builder.parseToolOutput("list_resources", output);

            assertThat(data).containsEntry("Count", "2");
            assertThat(data).containsEntry("#1", "John Developer [DEV] | Pod: API");
            assertThat(data).containsEntry("#2", "Jane QA [QA] | Pod: Core");
        }

        @Test
        void shouldInferCountWhenNotExplicit() {
            String output = "  - Item One\n  - Item Two";

            Map<String, Object> data = builder.parseToolOutput("list_projects", output);

            assertThat(data).containsEntry("Count", "2");
        }

        @Test
        void shouldParseBulletPoints() {
            String output = "  • Alpha Project\n  • Beta Project";

            Map<String, Object> data = builder.parseToolOutput("list_projects", output);

            assertThat(data).containsEntry("Count", "2");
            assertThat(data).containsEntry("#1", "Alpha Project");
            assertThat(data).containsEntry("#2", "Beta Project");
        }

        @Test
        void shouldReturnEmptyForNullOutput() {
            Map<String, Object> data = builder.parseToolOutput("list_projects", null);
            assertThat(data).isEmpty();
        }

        @Test
        void shouldReturnEmptyForBlankOutput() {
            Map<String, Object> data = builder.parseToolOutput("list_projects", "   ");
            assertThat(data).isEmpty();
        }

        @Test
        void shouldParseStructuredItemFields() {
            String output = "Found 1 projects:\n  - SgNIPT [P0] | Owner: BD | Status: ACTIVE | Pods: API Pod";

            Map<String, Object> data = builder.parseToolOutput("list_projects", output);

            assertThat(data).containsEntry("Count", "1");
            assertThat(data).containsKey("_structuredItems");
            @SuppressWarnings("unchecked")
            List<Map<String, String>> items = (List<Map<String, String>>) data.get("_structuredItems");
            assertThat(items).hasSize(1);
            assertThat(items.get(0)).containsEntry("name", "SgNIPT");
            assertThat(items.get(0)).containsEntry("priority", "P0");
            assertThat(items.get(0)).containsEntry("Owner", "BD");
            assertThat(items.get(0)).containsEntry("Status", "ACTIVE");
        }
    }

    @Nested
    @DisplayName("parseToolOutput() — profile/detail format")
    class ParseToolOutputProfile {

        @Test
        void shouldParseKeyValuePairs() {
            String output = "Name: Alpha Project\nPriority: P0\nOwner: John\nStatus: ACTIVE";

            Map<String, Object> data = builder.parseToolOutput("get_project_profile", output);

            assertThat(data).containsEntry("_type", "PROJECT_PROFILE");
            assertThat(data).containsEntry("Name", "Alpha Project");
            assertThat(data).containsEntry("Priority", "P0");
            assertThat(data).containsEntry("Owner", "John");
            assertThat(data).containsEntry("Status", "ACTIVE");
        }
    }

    @Nested
    @DisplayName("parseToolOutput() — data type inference")
    class ParseToolOutputDataType {

        @Test
        void shouldInferListTypeForProjects() {
            Map<String, Object> data = builder.parseToolOutput("list_projects", "  - X");
            assertThat(data).containsEntry("_type", "LIST");
            assertThat(data).containsEntry("listType", "PROJECTS");
        }

        @Test
        void shouldInferListTypeForResources() {
            Map<String, Object> data = builder.parseToolOutput("list_resources", "  - X");
            assertThat(data).containsEntry("listType", "RESOURCES");
        }

        @Test
        void shouldInferProfileTypeForResourceProfile() {
            Map<String, Object> data = builder.parseToolOutput("get_resource_profile", "Name: X");
            assertThat(data).containsEntry("_type", "RESOURCE_PROFILE");
        }

        @Test
        void shouldInferCostRateType() {
            Map<String, Object> data = builder.parseToolOutput("get_cost_rates", "Role: Dev");
            assertThat(data).containsEntry("_type", "COST_RATE");
        }

        @Test
        void shouldInferJiraType() {
            Map<String, Object> data = builder.parseToolOutput("get_jira_issue", "Key: PROJ-123");
            assertThat(data).containsEntry("_type", "JIRA");
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  buildTemplateMessage()
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("buildTemplateMessage()")
    class BuildTemplateMessage {

        @Test
        void shouldBuildProjectListMessageWithPriority() {
            Map<String, Object> data = Map.of("Count", "5");
            String msg = builder.buildTemplateMessage("list_projects", Map.of("priority", "P0"), data);

            assertThat(msg).isEqualTo("Found 5 P0 projects:");
        }

        @Test
        void shouldBuildProjectListMessageWithStatusAndOwner() {
            Map<String, Object> data = Map.of("Count", "3");
            String msg = builder.buildTemplateMessage("list_projects",
                    Map.of("status", "ACTIVE", "owner", "John"), data);

            assertThat(msg).contains("active");
            assertThat(msg).contains("owned by John");
            assertThat(msg).contains("3");
        }

        @Test
        void shouldBuildResourceListMessageWithRole() {
            Map<String, Object> data = Map.of("Count", "8");
            String msg = builder.buildTemplateMessage("list_resources", Map.of("role", "DEVELOPER"), data);

            assertThat(msg).contains("developer");
            assertThat(msg).contains("8");
        }

        @Test
        void shouldBuildProfileMessage() {
            String msg = builder.buildTemplateMessage("get_resource_profile",
                    Map.of("name", "John"), Map.of());

            assertThat(msg).isEqualTo("Here's the resource profile for John:");
        }

        @Test
        void shouldBuildCurrentSprintMessage() {
            String msg = builder.buildTemplateMessage("get_sprint_info",
                    Map.of("name", "current"), Map.of());

            assertThat(msg).isEqualTo("Here's the current sprint information:");
        }

        @Test
        void shouldBuildGenericMessageForUnknownTool() {
            Map<String, Object> data = Map.of("Count", "10");
            String msg = builder.buildTemplateMessage("unknown_tool", Map.of(), data);

            assertThat(msg).isEqualTo("Found 10 results:");
        }

        @Test
        void shouldBuildDefaultMessageWithoutCount() {
            String msg = builder.buildTemplateMessage("unknown_tool", Map.of(), Map.of());
            assertThat(msg).isEqualTo("Here are the results:");
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  inferDrillDown()
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("inferDrillDown()")
    class InferDrillDown {

        @Test
        void shouldReturnProjectsRoute() {
            assertThat(builder.inferDrillDown("list_projects")).isEqualTo("/projects");
            assertThat(builder.inferDrillDown("get_project_profile")).isEqualTo("/projects");
        }

        @Test
        void shouldReturnResourcesRoute() {
            assertThat(builder.inferDrillDown("list_resources")).isEqualTo("/resources");
            assertThat(builder.inferDrillDown("get_resource_profile")).isEqualTo("/resources");
            assertThat(builder.inferDrillDown("get_team_composition")).isEqualTo("/resources");
        }

        @Test
        void shouldReturnPodsRoute() {
            assertThat(builder.inferDrillDown("get_pod_profile")).isEqualTo("/pods");
        }

        @Test
        void shouldReturnCalendarRoutes() {
            assertThat(builder.inferDrillDown("get_release_info")).isEqualTo("/release-calendar");
            assertThat(builder.inferDrillDown("get_sprint_info")).isEqualTo("/sprint-calendar");
        }

        @Test
        void shouldReturnCostRatesRoute() {
            assertThat(builder.inferDrillDown("get_cost_rates")).isEqualTo("/cost-rates");
        }

        @Test
        void shouldReturnHeatmapRoute() {
            assertThat(builder.inferDrillDown("get_capacity_summary")).isEqualTo("/heatmap");
            assertThat(builder.inferDrillDown("get_utilization_summary")).isEqualTo("/heatmap");
        }

        @Test
        void shouldReturnJiraDashboardRoute() {
            assertThat(builder.inferDrillDown("get_jira_issue")).isEqualTo("/jira-dashboard-builder");
            assertThat(builder.inferDrillDown("search_jira_issues")).isEqualTo("/jira-dashboard-builder");
        }

        @Test
        void shouldReturnNullForUnknownTool() {
            assertThat(builder.inferDrillDown("unknown_tool")).isNull();
        }

        @Test
        void shouldReturnNullForNullTool() {
            assertThat(builder.inferDrillDown(null)).isNull();
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  buildSuggestions()
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("buildSuggestions()")
    class BuildSuggestions {

        @Test
        void shouldBuildProjectSuggestionsWithPriority() {
            List<String> suggestions = builder.buildSuggestions("list_projects", Map.of("priority", "P0"));

            assertThat(suggestions).isNotEmpty();
            assertThat(suggestions).anyMatch(s -> s.contains("P0"));
        }

        @Test
        void shouldBuildProjectSuggestionsWithStatus() {
            List<String> suggestions = builder.buildSuggestions("list_projects", Map.of("status", "ACTIVE"));

            assertThat(suggestions).isNotEmpty();
            assertThat(suggestions).anyMatch(s -> s.toLowerCase().contains("portfolio") || s.toLowerCase().contains("dependencies"));
        }

        @Test
        void shouldBuildResourceSuggestions() {
            List<String> suggestions = builder.buildSuggestions("list_resources", Map.of());

            assertThat(suggestions).isNotEmpty();
            assertThat(suggestions).anyMatch(s -> s.toLowerCase().contains("utilization") || s.toLowerCase().contains("composition"));
        }

        @Test
        void shouldBuildProfileSuggestionsWithName() {
            List<String> suggestions = builder.buildSuggestions("get_resource_profile", Map.of("name", "John"));

            assertThat(suggestions).isNotEmpty();
            assertThat(suggestions).anyMatch(s -> s.contains("John"));
        }

        @Test
        void shouldBuildDefaultSuggestionsForUnknownTool() {
            List<String> suggestions = builder.buildSuggestions("unknown_tool", Map.of());

            assertThat(suggestions).isNotEmpty();
            assertThat(suggestions).hasSizeGreaterThanOrEqualTo(2);
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  buildFromToolResult() — integration
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("buildFromToolResult()")
    class BuildFromToolResult {

        @Test
        void shouldBuildSuccessResult() {
            NlpToolRegistry.ToolResult toolResult = new NlpToolRegistry.ToolResult(
                    true, "Found 2 projects:\n  - Alpha [P0] | Owner: JD\n  - Beta [P1] | Owner: MK", null);
            Map<String, String> params = Map.of("priority", "P0");

            NlpStrategy.NlpResult result = builder.buildFromToolResult("list_projects", params, toolResult);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            assertThat(result.confidence()).isEqualTo(0.92);
            assertThat(result.data()).isNotNull();
            assertThat(result.data()).containsEntry("Count", "2");
            assertThat(result.drillDown()).isEqualTo("/projects");
            assertThat(result.suggestions()).isNotEmpty();
            assertThat(result.message()).contains("P0");
        }

        @Test
        void shouldBuildErrorResultOnFailure() {
            NlpToolRegistry.ToolResult toolResult = new NlpToolRegistry.ToolResult(
                    false, null, "Database connection failed");
            Map<String, String> params = Map.of();

            NlpStrategy.NlpResult result = builder.buildFromToolResult("list_projects", params, toolResult);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            assertThat(result.confidence()).isEqualTo(0.70);
            assertThat(result.data()).containsEntry("_type", "ERROR");
            assertThat(result.message()).contains("Database connection failed");
        }

        @Test
        void shouldBuildErrorResultWithDefaultMessage() {
            NlpToolRegistry.ToolResult toolResult = new NlpToolRegistry.ToolResult(false, null, null);

            NlpStrategy.NlpResult result = builder.buildFromToolResult("list_projects", Map.of(), toolResult);

            assertThat(result.message()).isEqualTo("No results found for your query.");
        }
    }
}
