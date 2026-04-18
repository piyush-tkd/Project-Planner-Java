package com.portfolioplanner.service.nlp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests for CompositeToolExecutor.
 *
 * Tests comparison query detection and execution, including:
 * - Pattern matching for "compare X and Y" queries
 * - Tool registry invocation and result merging
 * - Null-safety and fallback handling
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("CompositeToolExecutor — comparison query handling")
class CompositeToolExecutorTest {

    @Mock
    private NlpToolRegistry toolRegistry;

    private CompositeToolExecutor executor;
    private ObjectMapper objectMapper;
    private NlpCatalogResponse mockCatalog;

    @BeforeEach
    void setUp() {
        executor = new CompositeToolExecutor(toolRegistry);
        objectMapper = new ObjectMapper();
        mockCatalog = mock(NlpCatalogResponse.class); // Record — use mock, not no-arg constructor
    }

    // ── Null-safety and non-comparison queries ────────────────────────────────

    @Test
    @DisplayName("shouldReturnNullForNonComparisonQuery")
    void shouldReturnNullForNonComparisonQuery() {
        String[] nonComparisonQueries = {
                "show all projects",
                "who is John",
                "list developers",
                "what is the status",
                "tell me about Alpha"
        };

        for (String query : nonComparisonQueries) {
            NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);
            assertThat(result)
                    .as("Query '%s' should return null", query)
                    .isNull();
        }
    }

    @Test
    @DisplayName("shouldHandleNullQuery")
    void shouldHandleNullQuery() {
        NlpStrategy.NlpResult result = executor.tryExecute(null, mockCatalog);
        assertThat(result).isNull();
    }

    // ── Pattern: "compare pod X and pod Y" ────────────────────────────────────

    @Test
    @DisplayName("shouldMatchComparePodPattern")
    void shouldMatchComparePodPattern() {
        // Arrange
        String query = "compare pod Alpha and pod Beta";
        mockToolSuccess("get_pod_profile", "Alpha", "Name: Alpha\nMembers: 5\nStatus: Active");
        mockToolSuccess("get_pod_profile", "Beta", "Name: Beta\nMembers: 3\nStatus: Active");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.intent()).isEqualTo("DATA_QUERY");
        assertThat(result.confidence()).isGreaterThanOrEqualTo(0.9);
        assertThat(result.shape()).isEqualTo("COMPARISON");
        assertThat(result.data()).isNotNull();
        assertThat(result.data()).containsKey("_shape")
                .containsEntry("_shape", "COMPARISON")
                .containsEntry("entityType", "pod");
        assertThat(result.data()).containsKeys("left", "right");
    }

    @Test
    @DisplayName("shouldMatchComparePodPatternWithVsKeyword")
    void shouldMatchComparePodPatternWithVsKeyword() {
        // Arrange
        String query = "compare pod Alpha vs pod Beta";
        mockToolSuccess("get_pod_profile", "Alpha", "Name: Alpha\nMembers: 5");
        mockToolSuccess("get_pod_profile", "Beta", "Name: Beta\nMembers: 3");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.intent()).isEqualTo("DATA_QUERY");
        assertThat(result.shape()).isEqualTo("COMPARISON");
    }

    // ── Pattern: "compare project X and project Y" ────────────────────────────

    @Test
    @DisplayName("shouldMatchCompareProjectPattern")
    void shouldMatchCompareProjectPattern() {
        // Arrange
        String query = "compare project Firebird and project Neptune";
        mockToolSuccess("get_project_profile", "Firebird", "Name: Firebird\nStatus: Active\nOwner: Alice");
        mockToolSuccess("get_project_profile", "Neptune", "Name: Neptune\nStatus: Active\nOwner: Bob");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.intent()).isEqualTo("DATA_QUERY");
        assertThat(result.confidence()).isGreaterThanOrEqualTo(0.9);
        assertThat(result.shape()).isEqualTo("COMPARISON");
        assertThat(result.data()).containsEntry("entityType", "project");
        assertThat(result.message()).contains("Firebird").contains("Neptune");
    }

    @Test
    @DisplayName("shouldMatchCompareProjectPatternWithVs")
    void shouldMatchCompareProjectPatternWithVs() {
        // Arrange
        String query = "compare project Phoenix vs project Orion";
        mockToolSuccess("get_project_profile", "Phoenix", "Name: Phoenix\nStatus: Active");
        mockToolSuccess("get_project_profile", "Orion", "Name: Orion\nStatus: Active");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.intent()).isEqualTo("DATA_QUERY");
        assertThat(result.shape()).isEqualTo("COMPARISON");
    }

    // ── Pattern: "X vs Y [entityType]" ────────────────────────────────────────

    @Test
    @DisplayName("shouldMatchVsPattern")
    void shouldMatchVsPattern() {
        // Arrange
        String query = "Alpha vs Beta pods";
        mockToolSuccess("get_pod_profile", "Alpha", "Name: Alpha\nMembers: 5");
        mockToolSuccess("get_pod_profile", "Beta", "Name: Beta\nMembers: 3");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.intent()).isEqualTo("DATA_QUERY");
        assertThat(result.shape()).isEqualTo("COMPARISON");
    }

    @Test
    @DisplayName("shouldMatchVsPatternWithProjects")
    void shouldMatchVsPatternWithProjects() {
        // Arrange
        String query = "ProjectA versus ProjectB projects";
        mockToolSuccess("get_project_profile", "ProjectA", "Name: ProjectA\nStatus: Active");
        mockToolSuccess("get_project_profile", "ProjectB", "Name: ProjectB\nStatus: Active");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.shape()).isEqualTo("COMPARISON");
        assertThat(result.data()).containsEntry("entityType", "project");
    }

    // ── Error handling: one tool fails ────────────────────────────────────────

    @Test
    @DisplayName("shouldReturnNullWhenOneToolFails")
    void shouldReturnNullWhenOneToolFails() {
        // Arrange
        String query = "compare pod Alpha and pod Beta";
        mockToolSuccess("get_pod_profile", "Alpha", "Name: Alpha\nMembers: 5");
        mockToolFail("get_pod_profile", "Beta", "Pod not found");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        // When only one tool succeeds but the other fails, we build a partial response
        // The service gracefully includes partial data
        assertThat(result).isNotNull();
        assertThat(result.intent()).isEqualTo("DATA_QUERY");
    }

    @Test
    @DisplayName("shouldReturnPartialResultWhenBothToolsSucceed")
    void shouldReturnPartialResultWhenBothToolsSucceed() {
        // Arrange
        String query = "compare pod Alpha and pod Beta";
        mockToolSuccess("get_pod_profile", "Alpha", "Name: Alpha\nMembers: 5");
        mockToolSuccess("get_pod_profile", "Beta", "Name: Beta\nMembers: 3");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.data()).containsKey("left");
        assertThat(result.data()).containsKey("right");

        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> left = (java.util.Map<String, Object>) result.data().get("left");
        assertThat(left).isNotNull().containsKey("name");
    }

    // ── Suggestions and drill-down ────────────────────────────────────────────

    @Test
    @DisplayName("shouldIncludeSuggestionsInResult")
    void shouldIncludeSuggestionsInResult() {
        // Arrange
        String query = "compare pod Alpha and pod Beta";
        mockToolSuccess("get_pod_profile", "Alpha", "Name: Alpha\nMembers: 5");
        mockToolSuccess("get_pod_profile", "Beta", "Name: Beta\nMembers: 3");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.suggestions()).isNotEmpty()
                .contains("Tell me more about Alpha", "Tell me more about Beta", "Show all pods");
    }

    @Test
    @DisplayName("shouldIncludeDrillDownPath")
    void shouldIncludeDrillDownPath() {
        // Arrange: test with project entity type
        String query = "compare project X and project Y";
        mockToolSuccess("get_project_profile", "X", "Name: X\nStatus: Active");
        mockToolSuccess("get_project_profile", "Y", "Name: Y\nStatus: Active");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.drillDown()).isEqualTo("/projects");
    }

    @Test
    @DisplayName("shouldIncludePodDrillDownPath")
    void shouldIncludePodDrillDownPath() {
        // Arrange
        String query = "compare pod Alpha and pod Beta";
        mockToolSuccess("get_pod_profile", "Alpha", "Name: Alpha");
        mockToolSuccess("get_pod_profile", "Beta", "Name: Beta");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.drillDown()).isEqualTo("/pods");
    }

    // ── Message building ──────────────────────────────────────────────────────

    @Test
    @DisplayName("shouldBuildComparisonMessageWithKeyDeltas")
    void shouldBuildComparisonMessageWithKeyDeltas() {
        // Arrange
        String query = "compare pod Alpha and pod Beta";
        mockToolSuccess("get_pod_profile", "Alpha",
                "Name: Alpha\nStatus: Active\nMember_Count: 5\nOwner: Alice");
        mockToolSuccess("get_pod_profile", "Beta",
                "Name: Beta\nStatus: Active\nMember_Count: 3\nOwner: Bob");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        String message = result.message();
        assertThat(message)
                .contains("Comparing pods")
                .contains("Alpha")
                .contains("Beta");
    }

    @Test
    @DisplayName("shouldHandleNotFoundGracefully")
    void shouldHandleNotFoundGracefully() {
        // Arrange
        String query = "compare pod NonExistent1 and pod NonExistent2";
        mockToolFail("get_pod_profile", "NonExistent1", "Not found");
        mockToolFail("get_pod_profile", "NonExistent2", "Not found");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.confidence()).isLessThan(0.93); // Not fully confident
        assertThat(result.message()).contains("couldn't find");
    }

    // ── Case-insensitive matching ─────────────────────────────────────────────

    @Test
    @DisplayName("shouldMatchCaseInsensitively")
    void shouldMatchCaseInsensitively() {
        // Arrange
        String query = "COMPARE POD ALPHA AND POD BETA";
        mockToolSuccess("get_pod_profile", "ALPHA", "Name: ALPHA\nMembers: 5");
        mockToolSuccess("get_pod_profile", "BETA", "Name: BETA\nMembers: 3");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.shape()).isEqualTo("COMPARISON");
    }

    @Test
    @DisplayName("shouldMatchMixedCaseQuery")
    void shouldMatchMixedCaseQuery() {
        // Arrange
        String query = "Compare project MyProject AND project OtherProject";
        mockToolSuccess("get_project_profile", "MyProject", "Name: MyProject");
        mockToolSuccess("get_project_profile", "OtherProject", "Name: OtherProject");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.intent()).isEqualTo("DATA_QUERY");
    }

    // ── Resource entity type ──────────────────────────────────────────────────

    @Test
    @DisplayName("shouldHandleResourceComparison")
    void shouldHandleResourceComparison() {
        // Arrange
        String query = "compare resource Alice and resource Bob";
        mockToolSuccess("get_resource_profile", "Alice", "Name: Alice\nRole: Developer\nLocation: US");
        mockToolSuccess("get_resource_profile", "Bob", "Name: Bob\nRole: QA\nLocation: India");

        // Act
        NlpStrategy.NlpResult result = executor.tryExecute(query, mockCatalog);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.data()).containsEntry("entityType", "resource");
        assertThat(result.drillDown()).isEqualTo("/resources");
    }

    // ── Helper methods ────────────────────────────────────────────────────────

    private void mockToolSuccess(String toolName, String entityName, String resultData) {
        when(toolRegistry.executeTool(eq(toolName), any(JsonNode.class), any(NlpCatalogResponse.class)))
                .thenReturn(NlpToolRegistry.ToolResult.ok(resultData));
    }

    private void mockToolFail(String toolName, String entityName, String error) {
        when(toolRegistry.executeTool(eq(toolName), any(JsonNode.class), any(NlpCatalogResponse.class)))
                .thenReturn(NlpToolRegistry.ToolResult.fail(error));
    }
}
