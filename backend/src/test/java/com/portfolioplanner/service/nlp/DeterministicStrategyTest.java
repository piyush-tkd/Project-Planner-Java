package com.portfolioplanner.service.nlp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for DeterministicStrategy — the zero-LLM, regex-based
 * first-in-chain strategy that handles 70-80% of all queries.
 */
@ExtendWith(MockitoExtension.class)
class DeterministicStrategyTest {

    @Mock private NlpToolRegistry toolRegistry;
    @Mock private NlpJiraToolExecutor jiraToolExecutor;

    private NlpResponseBuilder responseBuilder;
    private DeterministicStrategy strategy;
    private NlpCatalogResponse mockCatalog;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        responseBuilder = new NlpResponseBuilder(); // Real instance — it's a pure function class
        strategy = new DeterministicStrategy(toolRegistry, jiraToolExecutor, responseBuilder);
        mockCatalog = mock(NlpCatalogResponse.class);
        objectMapper = new ObjectMapper();
    }

    @Test
    @DisplayName("name() should return DETERMINISTIC")
    void shouldReturnCorrectName() {
        assertThat(strategy.name()).isEqualTo("DETERMINISTIC");
    }

    @Test
    @DisplayName("isAvailable() should always return true")
    void shouldAlwaysBeAvailable() {
        assertThat(strategy.isAvailable()).isTrue();
    }

    // ══════════════════════════════════════════════════════════════════
    //  PROJECT QUERY PATTERNS
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Project queries")
    class ProjectQueries {

        @ParameterizedTest
        @ValueSource(strings = {
                "show me P0 projects",
                "list P0 projects",
                "find all P0 projects",
                "Show me P0 projects?",
                "get P1 projects",
                "display P2 projects",
                "show me P3 projects"
        })
        void shouldMatchProjectsByPriority(String query) {
            setupToolSuccess("list_projects", "Found 3 projects:\n  - Alpha [P0]\n  - Beta [P0]\n  - Gamma [P0]");

            NlpStrategy.NlpResult result = strategy.classify(query, mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            assertThat(result.confidence()).isGreaterThan(0.5);
            verify(toolRegistry).executeTool(eq("list_projects"), any(JsonNode.class), eq(mockCatalog));
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "show me ACTIVE projects",
                "list ON_HOLD projects",
                "find COMPLETED projects",
                "show CANCELLED projects",
                // Human-friendly status names (hyphen/space variants)
                "show on-hold projects",
                "show active projects",
                "list completed projects",
                "find not-started projects"
        })
        void shouldMatchProjectsByStatus(String query) {
            setupToolSuccess("list_projects", "Found 2 projects:\n  - X\n  - Y");

            NlpStrategy.NlpResult result = strategy.classify(query, mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(toolRegistry).executeTool(eq("list_projects"), any(JsonNode.class), eq(mockCatalog));
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "show projects owned by John",
                "list projects by Sarah",
                "find projects for Mike"
        })
        void shouldMatchProjectsByOwner(String query) {
            setupToolSuccess("list_projects", "Found 1 projects:\n  - Project X");

            NlpStrategy.NlpResult result = strategy.classify(query, mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(toolRegistry).executeTool(eq("list_projects"), any(JsonNode.class), eq(mockCatalog));
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "show all projects",
                "list projects",
                "get projects?",
                "display all projects"
        })
        void shouldMatchAllProjects(String query) {
            setupToolSuccess("list_projects", "Found 10 projects:\n  - A\n  - B");

            NlpStrategy.NlpResult result = strategy.classify(query, mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(toolRegistry).executeTool(eq("list_projects"), any(JsonNode.class), eq(mockCatalog));
        }

        @Test
        void shouldMatchProjectProfile() {
            setupToolSuccess("get_project_profile", "Name: Alpha\nPriority: P0\nStatus: ACTIVE");

            NlpStrategy.NlpResult result = strategy.classify("tell me about project Alpha", mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(toolRegistry).executeTool(eq("get_project_profile"), any(JsonNode.class), eq(mockCatalog));
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  RESOURCE QUERY PATTERNS
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Resource queries")
    class ResourceQueries {

        @ParameterizedTest
        @ValueSource(strings = {
                "show me all developers",
                "list developers",
                "find devs"
        })
        void shouldMatchResourcesByRole(String query) {
            setupToolSuccess("list_resources", "Found 5 resources:\n  - John [DEV]\n  - Jane [DEV]");

            NlpStrategy.NlpResult result = strategy.classify(query, mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(toolRegistry).executeTool(eq("list_resources"), any(JsonNode.class), eq(mockCatalog));
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "show all QA",
                "list testers",
                "show all BSA",
                "list tech leads"
        })
        void shouldMatchOtherRoles(String query) {
            setupToolSuccess("list_resources", "Found 3 resources:\n  - A\n  - B\n  - C");

            NlpStrategy.NlpResult result = strategy.classify(query, mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(toolRegistry).executeTool(eq("list_resources"), any(JsonNode.class), eq(mockCatalog));
        }

        @Test
        void shouldMatchResourceProfile() {
            setupToolSuccess("get_resource_profile", "Name: John\nRole: DEVELOPER\nPod: API Pod");

            NlpStrategy.NlpResult result = strategy.classify("who is John", mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(toolRegistry).executeTool(eq("get_resource_profile"), any(JsonNode.class), eq(mockCatalog));
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  ANALYTICS QUERY PATTERNS
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Analytics queries")
    class AnalyticsQueries {

        @Test
        void shouldMatchTeamComposition() {
            setupToolSuccess("get_team_composition", "Developers: 10\nQA: 5\nBSA: 3");

            NlpStrategy.NlpResult result = strategy.classify("show team composition", mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(toolRegistry).executeTool(eq("get_team_composition"), any(JsonNode.class), eq(mockCatalog));
        }

        @Test
        void shouldMatchUtilization() {
            setupToolSuccess("get_utilization_summary", "Average: 85%");

            NlpStrategy.NlpResult result = strategy.classify("show resource utilization", mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(toolRegistry).executeTool(eq("get_utilization_summary"), any(JsonNode.class), eq(mockCatalog));
        }

        @Test
        void shouldMatchCapacity() {
            setupToolSuccess("get_capacity_summary", "Available: 200h");

            NlpStrategy.NlpResult result = strategy.classify("show capacity summary", mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(toolRegistry).executeTool(eq("get_capacity_summary"), any(JsonNode.class), eq(mockCatalog));
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "show portfolio summary",
                "get portfolio overview",
                "give me a portfolio overview"
        })
        void shouldMatchPortfolioSummary(String query) {
            setupToolSuccess("get_portfolio_summary", "Total: 20 projects");

            NlpStrategy.NlpResult result = strategy.classify(query, mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(toolRegistry).executeTool(eq("get_portfolio_summary"), any(JsonNode.class), eq(mockCatalog));
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  SPRINT & RELEASE QUERIES
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Sprint & Release queries")
    class SprintReleaseQueries {

        @Test
        void shouldMatchCurrentSprint() {
            setupToolSuccess("get_sprint_info", "Sprint 10\nStart: 2026-03-01\nEnd: 2026-03-14");

            NlpStrategy.NlpResult result = strategy.classify("show current sprint", mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(toolRegistry).executeTool(eq("get_sprint_info"), any(JsonNode.class), eq(mockCatalog));
        }

        @Test
        void shouldMatchUpcomingReleases() {
            setupToolSuccess("get_release_info", "  - Release 5.0 (March 2026)");

            NlpStrategy.NlpResult result = strategy.classify("show upcoming releases", mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(toolRegistry).executeTool(eq("get_release_info"), any(JsonNode.class), eq(mockCatalog));
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  JIRA QUERIES
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Jira queries")
    class JiraQueries {

        @Test
        void shouldMatchJiraIssueByKey() {
            when(jiraToolExecutor.executeTool(eq("get_jira_issue"), any(JsonNode.class)))
                    .thenReturn(new NlpToolRegistry.ToolResult(true, "Key: PROJ-123\nSummary: Fix bug", null));

            NlpStrategy.NlpResult result = strategy.classify("show PROJ-123", mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(jiraToolExecutor).executeTool(eq("get_jira_issue"), any(JsonNode.class));
        }

        @Test
        void shouldMatchJiraAnalytics() {
            when(jiraToolExecutor.executeTool(eq("get_jira_analytics_summary"), any(JsonNode.class)))
                    .thenReturn(new NlpToolRegistry.ToolResult(true, "Open: 50\nClosed: 120", null));

            NlpStrategy.NlpResult result = strategy.classify("show jira analytics", mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            verify(jiraToolExecutor).executeTool(eq("get_jira_analytics_summary"), any(JsonNode.class));
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  UNMATCHED QUERIES
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Unmatched queries should fall through")
    class UnmatchedQueries {

        @ParameterizedTest
        @ValueSource(strings = {
                "hello",
                "what can you do?",
                "how's the weather?",
                "analyze the risk profile for Q2",
                "random gibberish that doesn't match anything"
        })
        void shouldReturnLowConfidenceForUnmatchedQueries(String query) {
            NlpStrategy.NlpResult result = strategy.classify(query, mockCatalog);

            assertThat(result.intent()).isEqualTo("UNKNOWN");
            assertThat(result.confidence()).isEqualTo(0.0);
            verifyNoInteractions(toolRegistry);
            verifyNoInteractions(jiraToolExecutor);
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  ERROR HANDLING
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Error handling")
    class ErrorHandling {

        @Test
        void shouldHandleToolFailure() {
            when(toolRegistry.executeTool(eq("list_projects"), any(JsonNode.class), eq(mockCatalog)))
                    .thenReturn(new NlpToolRegistry.ToolResult(false, null, "Database error"));

            NlpStrategy.NlpResult result = strategy.classify("show all projects", mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            assertThat(result.data()).containsEntry("_type", "ERROR");
        }

        @Test
        void shouldHandleToolException() {
            when(toolRegistry.executeTool(eq("list_projects"), any(JsonNode.class), eq(mockCatalog)))
                    .thenThrow(new RuntimeException("Connection refused"));

            NlpStrategy.NlpResult result = strategy.classify("show all projects", mockCatalog);

            assertThat(result.intent()).isEqualTo("DATA_QUERY");
            assertThat(result.data()).containsEntry("_type", "ERROR");
        }
    }

    // ── Helper ──

    private void setupToolSuccess(String toolName, String output) {
        if (toolName.startsWith("get_jira_") || toolName.equals("search_jira_issues")) {
            when(jiraToolExecutor.executeTool(eq(toolName), any(JsonNode.class)))
                    .thenReturn(new NlpToolRegistry.ToolResult(true, output, null));
        } else {
            when(toolRegistry.executeTool(eq(toolName), any(JsonNode.class), eq(mockCatalog)))
                    .thenReturn(new NlpToolRegistry.ToolResult(true, output, null));
        }
    }
}
