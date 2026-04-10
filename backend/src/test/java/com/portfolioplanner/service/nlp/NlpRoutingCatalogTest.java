package com.portfolioplanner.service.nlp;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression test suite for NlpRoutingCatalog.
 *
 * Every catalog entry gets at least one representative query so that
 * any regex change that breaks routing is caught immediately.
 *
 * Structure:
 *   - One @ParameterizedTest per route group (project queries, resource queries, etc.)
 *   - Each test verifies: toolName, shape, intent, and optionally a captured param
 *
 * Coverage goal: 100% of catalog entries have at least one test.
 */
class NlpRoutingCatalogTest {

    private NlpRoutingCatalog catalog;

    @BeforeEach
    void setUp() {
        catalog = new NlpRoutingCatalog();
    }

    // ── Null-safety guard ─────────────────────────────────────────────────────

    @Test
    @DisplayName("findRoute() returns null for unrecognised queries")
    void unknownQueryReturnsNull() {
        assertThat(catalog.findRoute("what time is it?")).isNull();
        assertThat(catalog.findRoute("")).isNull();
        assertThat(catalog.findRoute("gibberish xyz 123")).isNull();
    }

    // ── Project queries ───────────────────────────────────────────────────────

    @ParameterizedTest(name = "[{index}] ''{0}'' → tool={1} shape={2}")
    @MethodSource("projectQueryCases")
    @DisplayName("Project list queries route correctly")
    void projectListQueries(String query, String expectedTool, String expectedShape, String expectedIntent) {
        var decision = catalog.findRoute(query);
        assertThat(decision).as("No route found for: " + query).isNotNull();
        assertThat(decision.toolName()).isEqualTo(expectedTool);
        assertThat(decision.shape()).isEqualTo(expectedShape);
        assertThat(decision.intent()).isEqualTo(expectedIntent);
        assertThat(decision.confidence()).isGreaterThanOrEqualTo(0.90);
    }

    static Stream<Arguments> projectQueryCases() {
        return Stream.of(
                Arguments.of("show me p0 projects",       "list_projects", "LIST", "DATA_QUERY"),
                Arguments.of("list p1 projects",          "list_projects", "LIST", "DATA_QUERY"),
                Arguments.of("get p2 projects",           "list_projects", "LIST", "DATA_QUERY"),
                Arguments.of("find p3 projects",          "list_projects", "LIST", "DATA_QUERY"),
                Arguments.of("show me all active projects","list_projects", "LIST", "DATA_QUERY"),
                Arguments.of("list on-hold projects",     "list_projects", "LIST", "DATA_QUERY"),
                Arguments.of("show completed projects",   "list_projects", "LIST", "DATA_QUERY"),
                Arguments.of("get all projects",          "list_projects", "LIST", "DATA_QUERY"),
                Arguments.of("show me projects",          "list_projects", "LIST", "DATA_QUERY"),
                Arguments.of("list projects",             "list_projects", "LIST", "DATA_QUERY")
        );
    }

    @ParameterizedTest(name = "[{index}] ''{0}'' → owner param = ''{1}''")
    @MethodSource("projectOwnerQueryCases")
    @DisplayName("Projects-by-owner queries capture the owner param")
    void projectsByOwnerQueries(String query, String expectedOwner) {
        var decision = catalog.findRoute(query);
        assertThat(decision).isNotNull();
        assertThat(decision.toolName()).isEqualTo("list_projects");
        assertThat(decision.params()).containsEntry("owner", expectedOwner);
    }

    static Stream<Arguments> projectOwnerQueryCases() {
        return Stream.of(
                Arguments.of("show me projects owned by john",  "john"),
                Arguments.of("find projects by sarah",          "sarah"),
                Arguments.of("list projects for mike",          "mike")
        );
    }

    // ── Resource queries ──────────────────────────────────────────────────────

    @ParameterizedTest(name = "[{index}] ''{0}'' → tool={1} role param={2}")
    @MethodSource("resourceQueryCases")
    @DisplayName("Resource list queries route correctly")
    void resourceListQueries(String query, String expectedTool, String expectedRole) {
        var decision = catalog.findRoute(query);
        assertThat(decision).as("No route for: " + query).isNotNull();
        assertThat(decision.toolName()).isEqualTo(expectedTool);
        assertThat(decision.shape()).isEqualTo("LIST");
        if (expectedRole != null) {
            assertThat(decision.params()).containsEntry("role", expectedRole);
        }
    }

    static Stream<Arguments> resourceQueryCases() {
        return Stream.of(
                Arguments.of("show me developers",          "list_resources", "DEVELOPER"),
                Arguments.of("list all devs",               "list_resources", "DEVELOPER"),
                Arguments.of("show me qa",                  "list_resources", "QA"),
                Arguments.of("find testers",                "list_resources", "QA"),
                Arguments.of("list business analysts",      "list_resources", "BSA"),
                Arguments.of("show me bsa",                 "list_resources", "BSA"),
                Arguments.of("list tech leads",             "list_resources", "TECH_LEAD"),
                Arguments.of("show me tls",                 "list_resources", "TECH_LEAD"),
                Arguments.of("show me resources",           "list_resources", null),
                Arguments.of("list all people",             "list_resources", null),
                Arguments.of("show team members",           "list_resources", null)
        );
    }

    // ── Profile queries ───────────────────────────────────────────────────────

    @ParameterizedTest(name = "[{index}] ''{0}'' → tool={1} name param=''{2}''")
    @MethodSource("profileQueryCases")
    @DisplayName("Profile queries capture the entity name")
    void profileQueries(String query, String expectedTool, String expectedName) {
        var decision = catalog.findRoute(query);
        assertThat(decision).as("No route for: " + query).isNotNull();
        assertThat(decision.toolName()).isEqualTo(expectedTool);
        assertThat(decision.shape()).isEqualTo("DETAIL");
        assertThat(decision.params()).containsEntry("name", expectedName);
    }

    static Stream<Arguments> profileQueryCases() {
        return Stream.of(
                Arguments.of("tell me about project alpha",       "get_project_profile",  "alpha"),
                Arguments.of("details for project sgnpit",        "get_project_profile",  "sgnpit"),
                Arguments.of("info about project beta",           "get_project_profile",  "beta"),
                Arguments.of("tell me about pod api pod",         "get_pod_profile",       "api pod"),
                Arguments.of("details for the team platform pod", "get_pod_profile",       "platform pod")
        );
    }

    // ── Summary/analytics queries ─────────────────────────────────────────────

    @ParameterizedTest(name = "[{index}] ''{0}'' → tool={1}")
    @MethodSource("summaryQueryCases")
    @DisplayName("Summary queries route correctly")
    void summaryQueries(String query, String expectedTool, String expectedShape) {
        var decision = catalog.findRoute(query);
        assertThat(decision).as("No route for: " + query).isNotNull();
        assertThat(decision.toolName()).isEqualTo(expectedTool);
        assertThat(decision.shape()).isEqualTo(expectedShape);
        assertThat(decision.intent()).isEqualTo("DATA_QUERY");
    }

    static Stream<Arguments> summaryQueryCases() {
        return Stream.of(
                Arguments.of("show me the portfolio summary",    "get_portfolio_summary",  "SUMMARY"),
                Arguments.of("portfolio overview",               "get_portfolio_summary",  "SUMMARY"),
                Arguments.of("what is the portfolio health?",    "get_portfolio_summary",  "SUMMARY"),
                Arguments.of("show team composition",            "get_team_composition",   "SUMMARY"),
                Arguments.of("what is the headcount",            "get_team_composition",   "SUMMARY"),
                Arguments.of("show resource utilization",        "get_utilization_summary","SUMMARY"),
                Arguments.of("get utilisation summary",          "get_utilization_summary","SUMMARY"),
                Arguments.of("show capacity",                    "get_capacity_summary",   "SUMMARY"),
                Arguments.of("what is the available capacity",   "get_capacity_summary",   "SUMMARY"),
                Arguments.of("show me cost rates",               "get_cost_rates",          "SUMMARY"),
                Arguments.of("get billing rates",                "get_cost_rates",          "SUMMARY")
        );
    }

    // ── Sprint / Release queries ──────────────────────────────────────────────

    @ParameterizedTest(name = "[{index}] ''{0}'' → tool={1} params={2}")
    @MethodSource("sprintReleaseQueryCases")
    @DisplayName("Sprint and release queries route with correct params")
    void sprintReleaseQueries(String query, String expectedTool, String expectedParamKey, String expectedParamValue) {
        var decision = catalog.findRoute(query);
        assertThat(decision).as("No route for: " + query).isNotNull();
        assertThat(decision.toolName()).isEqualTo(expectedTool);
        if (expectedParamKey != null) {
            assertThat(decision.params()).containsEntry(expectedParamKey, expectedParamValue);
        }
    }

    static Stream<Arguments> sprintReleaseQueryCases() {
        return Stream.of(
                Arguments.of("show me the current sprint",  "get_sprint_info",     "name", "current"),
                Arguments.of("what is the active sprint",   "get_sprint_info",     "name", "current"),
                Arguments.of("show upcoming sprints",       "get_sprint_info",     "name", "upcoming"),
                Arguments.of("get next sprints",            "get_sprint_info",     "name", "upcoming"),
                Arguments.of("show upcoming releases",      "get_release_info",    "name", "upcoming"),
                Arguments.of("what are the next releases",  "get_release_info",    "name", "upcoming"),
                Arguments.of("show sprint allocations",     "get_sprint_allocations", null, null)
        );
    }

    // ── Effort/pattern queries ────────────────────────────────────────────────

    @Test
    @DisplayName("Effort pattern query routes correctly")
    void effortPatternQuery() {
        var d = catalog.findRoute("show me effort patterns");
        assertThat(d).isNotNull();
        assertThat(d.toolName()).isEqualTo("get_effort_patterns");
        assertThat(d.shape()).isEqualTo("SUMMARY");
    }

    @Test
    @DisplayName("Role effort mix query routes correctly")
    void roleEffortMixQuery() {
        var d = catalog.findRoute("show me the role effort mix");
        assertThat(d).isNotNull();
        assertThat(d.toolName()).isEqualTo("get_role_effort_mix");
        assertThat(d.shape()).isEqualTo("SUMMARY");
    }

    // ── Dependency queries ────────────────────────────────────────────────────

    @Test
    @DisplayName("Dependency query captures project name param")
    void dependencyQuery() {
        var d = catalog.findRoute("show me the dependencies for project alpha");
        assertThat(d).isNotNull();
        assertThat(d.toolName()).isEqualTo("get_project_dependencies");
        assertThat(d.params()).containsEntry("name", "alpha");
    }

    // ── Availability queries ──────────────────────────────────────────────────

    @Test
    @DisplayName("Availability query captures resource name param")
    void availabilityQuery() {
        var d = catalog.findRoute("show me john's availability");
        assertThat(d).isNotNull();
        assertThat(d.toolName()).isEqualTo("get_resource_availability");
        assertThat(d.params()).containsEntry("name", "john");
    }

    // ── Estimate queries ──────────────────────────────────────────────────────

    @Test
    @DisplayName("Estimate query captures project name param")
    void estimateQuery() {
        var d = catalog.findRoute("show me the estimates for project beta");
        assertThat(d).isNotNull();
        assertThat(d.toolName()).isEqualTo("get_project_estimates");
        assertThat(d.params()).containsEntry("name", "beta");
    }

    // ── Cross-cutting concerns ────────────────────────────────────────────────

    @ParameterizedTest(name = "[{index}] All routes have confidence >= 0.9")
    @MethodSource("allTestQueries")
    @DisplayName("All matched routes have confidence >= 0.90")
    void allRoutesHaveHighConfidence(String query) {
        var decision = catalog.findRoute(query);
        if (decision != null) {
            assertThat(decision.confidence())
                    .as("Low confidence for query: " + query)
                    .isGreaterThanOrEqualTo(0.90);
        }
    }

    static Stream<Arguments> allTestQueries() {
        return Stream.of(
                "show me p0 projects", "list developers", "show portfolio summary",
                "show me the current sprint", "get resource utilization",
                "show capacity", "list releases", "show team composition"
        ).map(Arguments::of);
    }

    @ParameterizedTest(name = "[{index}] ''{0}'' is case-insensitive")
    @MethodSource("caseVariants")
    @DisplayName("Routing is case-insensitive")
    void caseInsensitiveRouting(String query, String expectedTool) {
        var decision = catalog.findRoute(query);
        assertThat(decision).as("No route for: " + query).isNotNull();
        assertThat(decision.toolName()).isEqualTo(expectedTool);
    }

    static Stream<Arguments> caseVariants() {
        return Stream.of(
                Arguments.of("SHOW ME P0 PROJECTS",    "list_projects"),
                Arguments.of("Show Me P0 Projects",    "list_projects"),
                Arguments.of("LIST DEVELOPERS",        "list_resources"),
                Arguments.of("GET PORTFOLIO SUMMARY",  "get_portfolio_summary")
        );
    }

    @ParameterizedTest(name = "[{index}] ''{0}'' with trailing ? still routes")
    @MethodSource("trailingQuestionMarkCases")
    @DisplayName("Trailing question marks are ignored")
    void trailingQuestionMarkIgnored(String query, String expectedTool) {
        var decision = catalog.findRoute(query);
        assertThat(decision).as("No route for: " + query).isNotNull();
        assertThat(decision.toolName()).isEqualTo(expectedTool);
    }

    static Stream<Arguments> trailingQuestionMarkCases() {
        return Stream.of(
                Arguments.of("show me p0 projects?",    "list_projects"),
                Arguments.of("list developers?",        "list_resources"),
                Arguments.of("show capacity?",          "get_capacity_summary")
        );
    }
}
