package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.dto.request.ProjectRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Functional tests for ProjectController.
 *
 * Covers CRUD, status filtering, requiredSkills field, and validation.
 */
@DisplayName("ProjectController — functional tests")
class ProjectControllerTest extends BaseControllerTest {

    // ── POST /api/projects ───────────────────────────────────────────────────
    @Nested
    @DisplayName("POST /api/projects")
    class CreateProject {

        @Test
        @DisplayName("creates a project and returns 201 with all fields")
        void createSuccess() throws Exception {
            var req = new ProjectRequest(
                    "Portal Rebuild", Priority.HIGH, "Alice",
                    1, 6, 6, "Flat", "Some notes",
                    "ACTIVE", null, null, null, null, null, null, null, null, null
            );

            mockMvc.perform(post("/api/projects").contentType(JSON).content(json(req)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").isNumber())
                    .andExpect(jsonPath("$.name").value("Portal Rebuild"))
                    .andExpect(jsonPath("$.priority").value("HIGH"))
                    .andExpect(jsonPath("$.status").value("ACTIVE"))
                    .andExpect(jsonPath("$.owner").value("Alice"));
        }

        @Test
        @DisplayName("returns 400 when name is blank")
        void blankNameReturns400() throws Exception {
            var req = new ProjectRequest(
                    "", Priority.MEDIUM, null,
                    null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null
            );

            mockMvc.perform(post("/api/projects").contentType(JSON).content(json(req)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 when priority is null")
        void nullPriorityReturns400() throws Exception {
            String body = """
                    {"name":"Test Project","priority":null}
                    """;

            mockMvc.perform(post("/api/projects").contentType(JSON).content(body))
                    .andExpect(status().isBadRequest());
        }

    }

    // ── GET /api/projects ────────────────────────────────────────────────────
    @Nested
    @DisplayName("GET /api/projects")
    class ListProjects {

        @Test
        @DisplayName("returns empty list when no projects exist")
        void emptyList() throws Exception {
            mockMvc.perform(get("/api/projects"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(0)));
        }

        @Test
        @DisplayName("returns all projects when no status filter is applied")
        void returnsAllProjects() throws Exception {
            createProject("Alpha", Priority.HIGHEST, "ACTIVE");
            createProject("Beta",  Priority.HIGH, "ON_HOLD");
            createProject("Gamma", Priority.MEDIUM, "COMPLETED");

            mockMvc.perform(get("/api/projects"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(3)))
                    .andExpect(jsonPath("$.content[*].name", containsInAnyOrder("Alpha", "Beta", "Gamma")));
        }

        @Test
        @DisplayName("?status=ACTIVE filters to only active projects")
        void filterByActiveStatus() throws Exception {
            createProject("Alpha", Priority.HIGHEST, "ACTIVE");
            createProject("Beta",  Priority.HIGH, "ON_HOLD");

            mockMvc.perform(get("/api/projects").param("status", "ACTIVE"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].name").value("Alpha"));
        }

        @Test
        @DisplayName("?status=ON_HOLD returns only on-hold projects")
        void filterByOnHoldStatus() throws Exception {
            createProject("Alpha",   Priority.HIGHEST, "ACTIVE");
            createProject("Blocked", Priority.MEDIUM, "ON_HOLD");

            mockMvc.perform(get("/api/projects").param("status", "ON_HOLD"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].name").value("Blocked"));
        }

        @Test
        @DisplayName("?status=COMPLETED returns empty when no completed projects")
        void filterByCompletedReturnsEmpty() throws Exception {
            createProject("Alpha", Priority.HIGHEST, "ACTIVE");

            mockMvc.perform(get("/api/projects").param("status", "COMPLETED"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(0)));
        }
    }

    // ── GET /api/projects/{id} ────────────────────────────────────────────────
    @Nested
    @DisplayName("GET /api/projects/{id}")
    class GetById {

        @Test
        @DisplayName("returns a project by id")
        void foundById() throws Exception {
            Long id = createProject("Portal", Priority.HIGH, "ACTIVE");

            mockMvc.perform(get("/api/projects/{id}", id))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(id))
                    .andExpect(jsonPath("$.name").value("Portal"));
        }

        @Test
        @DisplayName("returns 404 for unknown id")
        void notFoundReturns404() throws Exception {
            mockMvc.perform(get("/api/projects/{id}", 99999L))
                    .andExpect(status().isNotFound());
        }
    }

    // ── PUT /api/projects/{id} ────────────────────────────────────────────────
    @Nested
    @DisplayName("PUT /api/projects/{id}")
    class UpdateProject {

        @Test
        @DisplayName("updates fields and persists the change")
        void updateSuccess() throws Exception {
            Long id = createProject("Old Name", Priority.MEDIUM, "ACTIVE");

            var updated = new ProjectRequest(
                    "New Name", Priority.HIGHEST, "Bob",
                    2, 8, 6, "BackLoaded", "Updated notes",
                    "ON_HOLD", null, null, null, null, null, null, null, null, null
            );

            mockMvc.perform(put("/api/projects/{id}", id).contentType(JSON).content(json(updated)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("New Name"))
                    .andExpect(jsonPath("$.priority").value("HIGHEST"))
                    .andExpect(jsonPath("$.status").value("ON_HOLD"));

            // Verify persisted
            mockMvc.perform(get("/api/projects/{id}", id))
                    .andExpect(jsonPath("$.name").value("New Name"));
        }

        @Test
        @DisplayName("returns 404 when updating a non-existent project")
        void updateNotFound() throws Exception {
            var req = new ProjectRequest(
                    "X", Priority.HIGH, null,
                    null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null
            );

            mockMvc.perform(put("/api/projects/{id}", 99999L).contentType(JSON).content(json(req)))
                    .andExpect(status().isNotFound());
        }
    }

    // ── DELETE /api/projects/{id} ─────────────────────────────────────────────
    @Nested
    @DisplayName("DELETE /api/projects/{id}")
    class DeleteProject {

        @Test
        @DisplayName("deletes the project and returns 204")
        void deleteSuccess() throws Exception {
            Long id = createProject("Portal", Priority.HIGH, "ACTIVE");

            mockMvc.perform(delete("/api/projects/{id}", id))
                    .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/projects/{id}", id))
                    .andExpect(status().isNotFound());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Long createProject(String name, Priority priority, String status) throws Exception {
        var req = new ProjectRequest(
                name, priority, null,
                1, 6, 6, "Flat", null,
                status, null, null, null, null, null, null, null, null, null
        );
        String resp = mockMvc.perform(post("/api/projects").contentType(JSON).content(json(req)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).get("id").asLong();
    }
}
