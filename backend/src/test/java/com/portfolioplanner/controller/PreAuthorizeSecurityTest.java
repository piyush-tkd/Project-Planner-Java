package com.portfolioplanner.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Security integration tests: verify that every protected controller endpoint
 * returns 401 (or 403) when called WITHOUT any authentication.
 *
 * This test deliberately does NOT use @WithMockUser, so no Spring Security
 * context is established — requests arrive as anonymous.
 *
 * Each test corresponds to a domain group of controllers.
 * Pattern: anonymous GET → expect 401/403.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("PreAuthorize Security — Unauthenticated Rejection Tests")
class PreAuthorizeSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    // ── Helper: assert endpoint requires authentication ───────────────────────
    private void assertRequiresAuth(String path) throws Exception {
        mockMvc.perform(get(path))
               .andExpect(result -> {
                   int status = result.getResponse().getStatus();
                   if (status != 401 && status != 403) {
                       throw new AssertionError(
                           "Expected 401 or 403 for " + path + " but got " + status);
                   }
               });
    }

    // ── Project domain ────────────────────────────────────────────────────────

    @Test @DisplayName("GET /api/projects requires auth")
    void projects_RequiresAuth() throws Exception { assertRequiresAuth("/api/projects"); }

    @Test @DisplayName("GET /api/project-actuals requires auth")
    void projectActuals_RequiresAuth() throws Exception { assertRequiresAuth("/api/project-actuals"); }

    @Test @DisplayName("GET /api/project-comments requires auth")
    void projectComments_RequiresAuth() throws Exception { assertRequiresAuth("/api/project-comments"); }

    @Test @DisplayName("GET /api/project-status-updates requires auth")
    void projectStatusUpdates_RequiresAuth() throws Exception { assertRequiresAuth("/api/project-status-updates"); }

    @Test @DisplayName("GET /api/project-templates requires auth")
    void projectTemplates_RequiresAuth() throws Exception { assertRequiresAuth("/api/project-templates"); }

    @Test @DisplayName("GET /api/project-baselines requires auth")
    void projectBaselines_RequiresAuth() throws Exception { assertRequiresAuth("/api/project-baselines"); }

    @Test @DisplayName("GET /api/project-approvals requires auth")
    void projectApprovals_RequiresAuth() throws Exception { assertRequiresAuth("/api/project-approvals"); }

    // ── Resource domain ───────────────────────────────────────────────────────

    @Test @DisplayName("GET /api/resources requires auth")
    void resources_RequiresAuth() throws Exception { assertRequiresAuth("/api/resources"); }

    @Test @DisplayName("GET /api/resource-skills requires auth")
    void resourceSkills_RequiresAuth() throws Exception { assertRequiresAuth("/api/resource-skills"); }

    @Test @DisplayName("GET /api/resource-pools requires auth")
    void resourcePools_RequiresAuth() throws Exception { assertRequiresAuth("/api/resource-pools"); }

    @Test @DisplayName("GET /api/resource-bookings requires auth")
    void resourceBookings_RequiresAuth() throws Exception { assertRequiresAuth("/api/resource-bookings"); }

    @Test @DisplayName("GET /api/resource-allocations requires auth")
    void resourceAllocations_RequiresAuth() throws Exception { assertRequiresAuth("/api/resource-allocations"); }

    @Test @DisplayName("GET /api/resource-performance requires auth")
    void resourcePerformance_RequiresAuth() throws Exception { assertRequiresAuth("/api/resource-performance"); }

    // ── Pod / Sprint domain ───────────────────────────────────────────────────

    @Test @DisplayName("GET /api/pods requires auth")
    void pods_RequiresAuth() throws Exception { assertRequiresAuth("/api/pods"); }

    @Test @DisplayName("GET /api/pod-hours requires auth")
    void podHours_RequiresAuth() throws Exception { assertRequiresAuth("/api/pod-hours"); }

    @Test @DisplayName("GET /api/sprints requires auth")
    void sprints_RequiresAuth() throws Exception { assertRequiresAuth("/api/sprints"); }

    @Test @DisplayName("GET /api/sprint-backlog requires auth")
    void sprintBacklog_RequiresAuth() throws Exception { assertRequiresAuth("/api/sprint-backlog"); }

    @Test @DisplayName("GET /api/sprint-retros requires auth")
    void sprintRetros_RequiresAuth() throws Exception { assertRequiresAuth("/api/sprint-retros"); }

    @Test @DisplayName("GET /api/sprint-recommender requires auth")
    void sprintRecommender_RequiresAuth() throws Exception { assertRequiresAuth("/api/sprint-recommender"); }

    // ── Financial domain ──────────────────────────────────────────────────────

    @Test @DisplayName("GET /api/cost-rates requires auth")
    void costRates_RequiresAuth() throws Exception { assertRequiresAuth("/api/cost-rates"); }

    @Test @DisplayName("GET /api/bau-assumptions requires auth")
    void bauAssumptions_RequiresAuth() throws Exception { assertRequiresAuth("/api/bau-assumptions"); }

    @Test @DisplayName("GET /api/financial-intelligence/overview requires auth")
    void financialIntelligence_RequiresAuth() throws Exception { assertRequiresAuth("/api/financial-intelligence/overview"); }

    @Test @DisplayName("GET /api/scenarios requires auth")
    void scenarios_RequiresAuth() throws Exception { assertRequiresAuth("/api/scenarios"); }

    // ── Jira domain ───────────────────────────────────────────────────────────

    @Test @DisplayName("GET /api/jira/config requires auth")
    void jiraConfig_RequiresAuth() throws Exception { assertRequiresAuth("/api/jira/config"); }

    @Test @DisplayName("GET /api/jira-sprints requires auth")
    void jiraSprints_RequiresAuth() throws Exception { assertRequiresAuth("/api/jira-sprints"); }

    @Test @DisplayName("GET /api/jira-worklog requires auth")
    void jiraWorklog_RequiresAuth() throws Exception { assertRequiresAuth("/api/jira-worklog"); }

    @Test @DisplayName("GET /api/jira-capex requires auth")
    void jiraCapex_RequiresAuth() throws Exception { assertRequiresAuth("/api/jira-capex"); }

    // ── AI / NLP domain ───────────────────────────────────────────────────────

    @Test @DisplayName("GET /api/nlp requires auth")
    void nlp_RequiresAuth() throws Exception { assertRequiresAuth("/api/nlp"); }

    @Test @DisplayName("GET /api/ai-content requires auth")
    void aiContent_RequiresAuth() throws Exception { assertRequiresAuth("/api/ai-content"); }

    @Test @DisplayName("GET /api/user-ai-config requires auth")
    void userAiConfig_RequiresAuth() throws Exception { assertRequiresAuth("/api/user-ai-config"); }

    @Test @DisplayName("GET /api/insights requires auth")
    void insights_RequiresAuth() throws Exception { assertRequiresAuth("/api/insights"); }

    // ── User / Settings domain ────────────────────────────────────────────────

    @Test @DisplayName("GET /api/users requires auth")
    void users_RequiresAuth() throws Exception { assertRequiresAuth("/api/users"); }

    @Test @DisplayName("GET /api/org-settings requires auth")
    void orgSettings_RequiresAuth() throws Exception { assertRequiresAuth("/api/org-settings"); }

    @Test @DisplayName("GET /api/notification-preferences requires auth")
    void notificationPreferences_RequiresAuth() throws Exception { assertRequiresAuth("/api/notification-preferences"); }

    @Test @DisplayName("GET /api/skills requires auth")
    void skills_RequiresAuth() throws Exception { assertRequiresAuth("/api/skills"); }

    @Test @DisplayName("GET /api/objectives requires auth")
    void objectives_RequiresAuth() throws Exception { assertRequiresAuth("/api/objectives"); }

    @Test @DisplayName("GET /api/risks requires auth")
    void risks_RequiresAuth() throws Exception { assertRequiresAuth("/api/risks"); }

    @Test @DisplayName("GET /api/audit-log requires auth")
    void auditLog_RequiresAuth() throws Exception { assertRequiresAuth("/api/audit-log"); }

    @Test @DisplayName("GET /api/dora-metrics requires auth")
    void doraMetrics_RequiresAuth() throws Exception { assertRequiresAuth("/api/dora-metrics"); }

    @Test @DisplayName("GET /api/demand-requests requires auth")
    void demandRequests_RequiresAuth() throws Exception { assertRequiresAuth("/api/demand-requests"); }

    @Test @DisplayName("GET /api/leave requires auth")
    void leave_RequiresAuth() throws Exception { assertRequiresAuth("/api/leave"); }

    @Test @DisplayName("GET /api/ideas requires auth")
    void ideas_RequiresAuth() throws Exception { assertRequiresAuth("/api/ideas"); }

    @Test @DisplayName("GET /api/power-query requires auth")
    void powerQuery_RequiresAuth() throws Exception { assertRequiresAuth("/api/power-query"); }

    @Test @DisplayName("GET /api/webhooks requires auth")
    void webhooks_RequiresAuth() throws Exception { assertRequiresAuth("/api/webhooks"); }

    @Test @DisplayName("GET /api/automation-rules requires auth")
    void automationRules_RequiresAuth() throws Exception { assertRequiresAuth("/api/automation-rules"); }

    // ── Public endpoints MUST remain accessible ───────────────────────────────

    @Test @DisplayName("POST /api/auth/login is PUBLIC (no auth needed)")
    void authLogin_IsPublic() throws Exception {
        // Returns 400 (bad body) not 401 — endpoint is reachable without auth
        mockMvc.perform(post("/api/auth/login")
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{}"))
               .andExpect(result -> {
                   int status = result.getResponse().getStatus();
                   // Any non-401/403 status means we reached the controller
                   // (405 Method Not Allowed is fine for GET on a POST endpoint)
                   if (status == 401 || status == 403) {
                       throw new AssertionError(
                           "/api/auth/login should be public, got " + status);
                   }
               });
    }

    @Test @DisplayName("GET /actuator/health is PUBLIC")
    void actuatorHealth_IsPublic() throws Exception {
        mockMvc.perform(get("/actuator/health"))
               .andExpect(result -> {
                   int status = result.getResponse().getStatus();
                   if (status == 401 || status == 403) {
                       throw new AssertionError("Actuator health should be public, got " + status);
                   }
               });
    }
}
