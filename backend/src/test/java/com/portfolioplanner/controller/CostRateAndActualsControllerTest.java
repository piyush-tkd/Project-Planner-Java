package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.CostRate;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.ProjectActual;
import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.domain.model.enums.ProjectStatus;
import com.portfolioplanner.domain.model.enums.Role;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Functional tests for:
 *   GET /api/cost-rates
 *   GET /api/actuals
 *   GET /api/actuals/by-project/{projectId}
 *
 * Both controllers are read-only (data arrives via Excel import).
 * We seed the H2 DB directly through repositories in each test.
 */
@DisplayName("CostRateController + ProjectActualController — functional tests")
class CostRateAndActualsControllerTest extends BaseControllerTest {

    // ── GET /api/cost-rates ───────────────────────────────────────────────────
    @Nested
    @DisplayName("GET /api/cost-rates")
    class GetCostRates {

        @Test
        @DisplayName("returns empty array when no rates exist")
        void emptyWhenNone() throws Exception {
            mockMvc.perform(get("/api/cost-rates"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        @DisplayName("returns all seeded cost rates with correct fields")
        void returnsAllRates() throws Exception {
            seedCostRate(Role.DEVELOPER, Location.US,    new BigDecimal("150.00"));
            seedCostRate(Role.QA,        Location.INDIA, new BigDecimal("60.00"));
            seedCostRate(Role.BSA,       Location.US,    new BigDecimal("120.00"));

            mockMvc.perform(get("/api/cost-rates"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(3)))
                    .andExpect(jsonPath("$[*].role",     hasItems("DEVELOPER", "QA", "BSA")))
                    .andExpect(jsonPath("$[*].location", hasItems("US", "INDIA")));
        }

        @Test
        @DisplayName("each rate has id, role, location, and hourlyRate")
        void responseHasAllFields() throws Exception {
            seedCostRate(Role.TECH_LEAD, Location.US, new BigDecimal("200.00"));

            mockMvc.perform(get("/api/cost-rates"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].id").isNumber())
                    .andExpect(jsonPath("$[0].role").value("TECH_LEAD"))
                    .andExpect(jsonPath("$[0].location").value("US"))
                    .andExpect(jsonPath("$[0].hourlyRate").value(200.00));
        }

        @Test
        @DisplayName("US and INDIA rates for the same role are both returned")
        void bothLocationsReturnedForSameRole() throws Exception {
            seedCostRate(Role.DEVELOPER, Location.US,    new BigDecimal("150.00"));
            seedCostRate(Role.DEVELOPER, Location.INDIA, new BigDecimal("75.00"));

            mockMvc.perform(get("/api/cost-rates"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[*].hourlyRate", hasItems(150.0, 75.0)));
        }
    }

    // ── GET /api/actuals ──────────────────────────────────────────────────────
    @Nested
    @DisplayName("GET /api/actuals")
    class GetAllActuals {

        @Test
        @DisplayName("returns empty array when no actuals exist")
        void emptyWhenNone() throws Exception {
            mockMvc.perform(get("/api/actuals"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        @DisplayName("returns all actuals across all projects")
        void returnsAll() throws Exception {
            Project alpha = seedProject("Alpha");
            Project beta  = seedProject("Beta");

            seedActual(alpha, 1, new BigDecimal("320.00"));
            seedActual(alpha, 2, new BigDecimal("480.00"));
            seedActual(beta,  1, new BigDecimal("160.00"));

            mockMvc.perform(get("/api/actuals"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(3)));
        }

        @Test
        @DisplayName("results are sorted by projectName then monthKey")
        void sortedByProjectThenMonth() throws Exception {
            Project beta  = seedProject("Beta");
            Project alpha = seedProject("Alpha");

            seedActual(beta,  2, new BigDecimal("100"));
            seedActual(alpha, 1, new BigDecimal("200"));
            seedActual(alpha, 3, new BigDecimal("300"));

            mockMvc.perform(get("/api/actuals"))
                    .andExpect(status().isOk())
                    // Alpha comes before Beta alphabetically
                    .andExpect(jsonPath("$[0].projectName").value("Alpha"))
                    .andExpect(jsonPath("$[0].monthKey").value(1))
                    .andExpect(jsonPath("$[1].projectName").value("Alpha"))
                    .andExpect(jsonPath("$[1].monthKey").value(3))
                    .andExpect(jsonPath("$[2].projectName").value("Beta"));
        }

        @Test
        @DisplayName("each actual has id, projectId, projectName, monthKey, actualHours")
        void responseHasAllFields() throws Exception {
            Project alpha = seedProject("Alpha");
            seedActual(alpha, 1, new BigDecimal("320.00"));

            mockMvc.perform(get("/api/actuals"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].id").isNumber())
                    .andExpect(jsonPath("$[0].projectId").value(alpha.getId()))
                    .andExpect(jsonPath("$[0].projectName").value("Alpha"))
                    .andExpect(jsonPath("$[0].monthKey").value(1))
                    .andExpect(jsonPath("$[0].actualHours").value(320.0));
        }
    }

    // ── GET /api/actuals/by-project/{projectId} ───────────────────────────────
    @Nested
    @DisplayName("GET /api/actuals/by-project/{id}")
    class GetActualsByProject {

        @Test
        @DisplayName("returns only actuals for the requested project")
        void filteredByProject() throws Exception {
            Project alpha = seedProject("Alpha");
            Project beta  = seedProject("Beta");

            seedActual(alpha, 1, new BigDecimal("320"));
            seedActual(alpha, 2, new BigDecimal("480"));
            seedActual(beta,  1, new BigDecimal("160"));

            mockMvc.perform(get("/api/actuals/by-project/{id}", alpha.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[*].projectId", everyItem(is((int)(long) alpha.getId()))));
        }

        @Test
        @DisplayName("results are sorted by monthKey")
        void sortedByMonthKey() throws Exception {
            Project alpha = seedProject("Alpha");
            seedActual(alpha, 3, new BigDecimal("100"));
            seedActual(alpha, 1, new BigDecimal("200"));

            mockMvc.perform(get("/api/actuals/by-project/{id}", alpha.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].monthKey").value(1))
                    .andExpect(jsonPath("$[1].monthKey").value(3));
        }

        @Test
        @DisplayName("returns empty array for a project with no actuals")
        void emptyForProjectWithNoActuals() throws Exception {
            Project alpha = seedProject("Alpha");
            seedProject("Beta"); // seeded but no actuals

            mockMvc.perform(get("/api/actuals/by-project/{id}", alpha.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        @DisplayName("returns empty array for a non-existent project id")
        void emptyForNonExistentProject() throws Exception {
            mockMvc.perform(get("/api/actuals/by-project/{id}", 99999L))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }
    }

    // ── Seed helpers ──────────────────────────────────────────────────────────

    private void seedCostRate(Role role, Location location, BigDecimal rate) {
        costRateRepository.save(new CostRate(null, role, location, rate));
    }

    private Project seedProject(String name) {
        Project p = new Project();
        p.setName(name);
        p.setPriority(Priority.P1);
        p.setStatus(ProjectStatus.ACTIVE);
        return projectRepository.save(p);
    }

    private void seedActual(Project project, int monthKey, BigDecimal hours) {
        projectActualRepository.save(new ProjectActual(null, project, monthKey, hours));
    }
}
