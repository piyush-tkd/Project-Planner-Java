package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.dto.request.ResourceRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Functional tests for ResourceController — exercises the full
 * HTTP → Service → JPA → H2 stack.
 *
 * Each @Test starts with a clean database (see BaseControllerTest.cleanDb).
 *
 * HOW TO READ THESE TESTS
 * ───────────────────────
 * perform(post("/api/resources").content(json(req)))
 *   ▲ fires a real request through the servlet / Spring MVC pipeline
 * .andExpect(status().isCreated())
 *   ▲ asserts the HTTP status
 * .andExpect(jsonPath("$.name").value("Alice"))
 *   ▲ asserts the JSON response body using JsonPath
 */
@DisplayName("ResourceController — functional tests")
class ResourceControllerTest extends BaseControllerTest {

    // ── POST /api/resources ──────────────────────────────────────────────────
    @Nested
    @DisplayName("POST /api/resources")
    class CreateResource {

        @Test
        @DisplayName("creates a resource and returns 201 with the saved entity")
        void createSuccess() throws Exception {
            var req = new ResourceRequest("Alice", Role.DEVELOPER, Location.US, true, true);

            mockMvc.perform(post("/api/resources").contentType(JSON).content(json(req)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").isNumber())
                    .andExpect(jsonPath("$.name").value("Alice"))
                    .andExpect(jsonPath("$.role").value("DEVELOPER"))
                    .andExpect(jsonPath("$.location").value("US"))
                    .andExpect(jsonPath("$.active").value(true));
        }

        @Test
        @DisplayName("returns 400 when name is blank")
        void blankNameReturns400() throws Exception {
            var req = new ResourceRequest("", Role.DEVELOPER, Location.US, true, true);

            mockMvc.perform(post("/api/resources").contentType(JSON).content(json(req)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 when role is null")
        void nullRoleReturns400() throws Exception {
            // Raw JSON — record can't have null Role, so we craft the JSON directly
            String body = """
                    {"name":"Alice","role":null,"location":"US","active":true,"countsInCapacity":true}
                    """;

            mockMvc.perform(post("/api/resources").contentType(JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    // ── GET /api/resources ───────────────────────────────────────────────────
    @Nested
    @DisplayName("GET /api/resources")
    class ListResources {

        @Test
        @DisplayName("returns empty list when no resources exist")
        void emptyList() throws Exception {
            mockMvc.perform(get("/api/resources"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        @DisplayName("returns all created resources")
        void returnsSavedResources() throws Exception {
            // Create two resources first
            createResource("Alice", Role.DEVELOPER, Location.US);
            createResource("Bob",   Role.QA,        Location.INDIA);

            mockMvc.perform(get("/api/resources"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[*].name", containsInAnyOrder("Alice", "Bob")));
        }

        @Test
        @DisplayName("returned resource includes the skills field (null when not set)")
        void skillsFieldPresentAndNull() throws Exception {
            createResource("Alice", Role.DEVELOPER, Location.US);

            mockMvc.perform(get("/api/resources"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].skills").doesNotExist()
                            // skills is null — JsonPath either omits or null-returns it
                    );
        }
    }

    // ── GET /api/resources/{id} ───────────────────────────────────────────────
    @Nested
    @DisplayName("GET /api/resources/{id}")
    class GetById {

        @Test
        @DisplayName("returns the resource when it exists")
        void foundById() throws Exception {
            Long id = createResource("Alice", Role.DEVELOPER, Location.US);

            mockMvc.perform(get("/api/resources/{id}", id))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(id))
                    .andExpect(jsonPath("$.name").value("Alice"));
        }

        @Test
        @DisplayName("returns 404 when resource does not exist")
        void notFoundReturns404() throws Exception {
            mockMvc.perform(get("/api/resources/{id}", 99999L))
                    .andExpect(status().isNotFound());
        }
    }

    // ── PUT /api/resources/{id} ───────────────────────────────────────────────
    @Nested
    @DisplayName("PUT /api/resources/{id}")
    class UpdateResource {

        @Test
        @DisplayName("updates the resource and persists the change")
        void updateSuccess() throws Exception {
            Long id = createResource("Alice", Role.DEVELOPER, Location.US);

            var updated = new ResourceRequest("Alice Updated", Role.TECH_LEAD, Location.INDIA, false, false);

            mockMvc.perform(put("/api/resources/{id}", id).contentType(JSON).content(json(updated)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("Alice Updated"))
                    .andExpect(jsonPath("$.role").value("TECH_LEAD"))
                    .andExpect(jsonPath("$.location").value("INDIA"))
                    .andExpect(jsonPath("$.active").value(false));

            // Verify it's persisted by fetching again
            mockMvc.perform(get("/api/resources/{id}", id))
                    .andExpect(jsonPath("$.name").value("Alice Updated"));
        }

        @Test
        @DisplayName("returns 404 when updating a non-existent resource")
        void updateNotFound() throws Exception {
            var req = new ResourceRequest("X", Role.QA, Location.US, true, true);

            mockMvc.perform(put("/api/resources/{id}", 99999L).contentType(JSON).content(json(req)))
                    .andExpect(status().isNotFound());
        }
    }

    // ── DELETE /api/resources/{id} ────────────────────────────────────────────
    @Nested
    @DisplayName("DELETE /api/resources/{id}")
    class DeleteResource {

        @Test
        @DisplayName("deletes the resource and returns 204")
        void deleteSuccess() throws Exception {
            Long id = createResource("Alice", Role.DEVELOPER, Location.US);

            mockMvc.perform(delete("/api/resources/{id}", id))
                    .andExpect(status().isNoContent());

            // Confirm it's gone
            mockMvc.perform(get("/api/resources/{id}", id))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 404 when deleting a non-existent resource")
        void deleteNotFound() throws Exception {
            mockMvc.perform(delete("/api/resources/{id}", 99999L))
                    .andExpect(status().isNotFound());
        }
    }

    // ── PUT /api/resources/{id}/assignment ────────────────────────────────────
    @Nested
    @DisplayName("PUT /api/resources/{id}/assignment")
    class AssignToPod {

        @Test
        @DisplayName("assigns a resource to a pod with the given FTE")
        void assignSuccess() throws Exception {
            Long resourceId = createResource("Alice", Role.DEVELOPER, Location.US);
            Long podId      = createPod("Alpha");

            String body = """
                    {"podId":%d,"capacityFte":0.8}
                    """.formatted(podId);

            mockMvc.perform(put("/api/resources/{id}/assignment", resourceId)
                            .contentType(JSON).content(body))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.podAssignment.podName").value("Alpha"))
                    .andExpect(jsonPath("$.podAssignment.capacityFte").value(0.8));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** POST /api/resources and return the new id. */
    private Long createResource(String name, Role role, Location location) throws Exception {
        var req = new ResourceRequest(name, role, location, true, true);
        String resp = mockMvc.perform(post("/api/resources").contentType(JSON).content(json(req)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resp).get("id").asLong();
    }

    /** POST to pod repository directly (no REST endpoint for pods) and return id. */
    private Long createPod(String name) {
        Pod pod = new Pod();
        pod.setName(name);
        pod.setComplexityMultiplier(BigDecimal.ONE);
        pod.setDisplayOrder(1);
        pod.setActive(true);
        return podRepository.save(pod).getId();
    }
}
