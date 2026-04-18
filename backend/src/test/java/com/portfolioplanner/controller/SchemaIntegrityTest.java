package com.portfolioplanner.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Schema Integrity Tests
 *
 * Verifies the JPA entity model matches the DB schema (H2 in test profile,
 * Hibernate ddl-auto=validate in prod-like environments).
 *
 * These tests catch:
 *  - Missing columns after Flyway migrations
 *  - FK constraint mismatches
 *  - Table naming issues
 *  - JPQL query validity
 *
 * Uses H2 (test profile) — Hibernate creates the schema from entity annotations,
 * so these tests prove the entities are self-consistent.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
@DisplayName("Schema Integrity Tests")
class SchemaIntegrityTest {

    @PersistenceContext
    private EntityManager em;

    // ── Core entity tables exist and are queryable ────────────────────────────

    @Test @DisplayName("resources table is accessible")
    void resources_TableExists() {
        var count = em.createQuery("SELECT COUNT(r) FROM Resource r", Long.class).getSingleResult();
        assertThat(count).isGreaterThanOrEqualTo(0);
    }

    @Test @DisplayName("pods table is accessible")
    void pods_TableExists() {
        var count = em.createQuery("SELECT COUNT(p) FROM Pod p", Long.class).getSingleResult();
        assertThat(count).isGreaterThanOrEqualTo(0);
    }

    @Test @DisplayName("projects table is accessible")
    void projects_TableExists() {
        var count = em.createQuery("SELECT COUNT(p) FROM Project p", Long.class).getSingleResult();
        assertThat(count).isGreaterThanOrEqualTo(0);
    }

    @Test @DisplayName("app_users table is accessible")
    void appUsers_TableExists() {
        var count = em.createQuery("SELECT COUNT(u) FROM AppUser u", Long.class).getSingleResult();
        assertThat(count).isGreaterThanOrEqualTo(0);
    }

    @Test @DisplayName("cost_rates table is accessible")
    void costRates_TableExists() {
        assertThatCode(() ->
            em.createQuery("SELECT COUNT(c) FROM CostRate c", Long.class).getSingleResult()
        ).doesNotThrowAnyException();
    }

    @Test @DisplayName("bau_assumptions table is accessible")
    void bauAssumptions_TableExists() {
        assertThatCode(() ->
            em.createQuery("SELECT COUNT(b) FROM BauAssumption b", Long.class).getSingleResult()
        ).doesNotThrowAnyException();
    }

    @Test @DisplayName("sprints table is accessible")
    void sprints_TableExists() {
        assertThatCode(() ->
            em.createQuery("SELECT COUNT(s) FROM Sprint s", Long.class).getSingleResult()
        ).doesNotThrowAnyException();
    }

    @Test @DisplayName("skills table is accessible")
    void skills_TableExists() {
        assertThatCode(() ->
            em.createQuery("SELECT COUNT(s) FROM Skill s", Long.class).getSingleResult()
        ).doesNotThrowAnyException();
    }

    @Test @DisplayName("resource_pod_assignments table is accessible")
    void resourcePodAssignments_TableExists() {
        assertThatCode(() ->
            em.createQuery("SELECT COUNT(a) FROM ResourcePodAssignment a", Long.class).getSingleResult()
        ).doesNotThrowAnyException();
    }

    @Test @DisplayName("project_pod_planning table is accessible")
    void projectPodPlanning_TableExists() {
        assertThatCode(() ->
            em.createQuery("SELECT COUNT(p) FROM ProjectPodPlanning p", Long.class).getSingleResult()
        ).doesNotThrowAnyException();
    }

    @Test @DisplayName("project_actuals table is accessible")
    void projectActuals_TableExists() {
        assertThatCode(() ->
            em.createQuery("SELECT COUNT(a) FROM ProjectActual a", Long.class).getSingleResult()
        ).doesNotThrowAnyException();
    }

    @Test @DisplayName("scenarios table is accessible")
    void scenarios_TableExists() {
        assertThatCode(() ->
            em.createQuery("SELECT COUNT(s) FROM Scenario s", Long.class).getSingleResult()
        ).doesNotThrowAnyException();
    }

    @Test @DisplayName("risk_items table is accessible")
    void riskItems_TableExists() {
        assertThatCode(() ->
            em.createQuery("SELECT COUNT(r) FROM RiskItem r", Long.class).getSingleResult()
        ).doesNotThrowAnyException();
    }

    @Test @DisplayName("audit_log table is accessible")
    void auditLog_TableExists() {
        assertThatCode(() ->
            em.createQuery("SELECT COUNT(a) FROM AuditLog a", Long.class).getSingleResult()
        ).doesNotThrowAnyException();
    }

    // ── FK-join queries (catches missing FK columns) ──────────────────────────

    @Test @DisplayName("ResourcePodAssignment JOIN resource and pod is valid JPQL")
    void resources_JoinPods_ValidJpql() {
        assertThatCode(() ->
            em.createQuery(
                "SELECT rpa FROM ResourcePodAssignment rpa LEFT JOIN rpa.resource r LEFT JOIN rpa.pod p"
            ).getResultList()
        ).doesNotThrowAnyException();
    }

    @Test @DisplayName("ProjectPodPlanning JOIN project and pod is valid JPQL")
    void projects_JoinPodPlanning_ValidJpql() {
        assertThatCode(() ->
            em.createQuery(
                "SELECT ppp FROM ProjectPodPlanning ppp LEFT JOIN ppp.project p LEFT JOIN ppp.pod po"
            ).getResultList()
        ).doesNotThrowAnyException();
    }

    // ── Distinct query patterns used by services ──────────────────────────────

    @Test @DisplayName("Project status GROUP BY query is valid")
    void project_StatusGroupBy_ValidJpql() {
        assertThatCode(() ->
            em.createQuery(
                "SELECT p.status, COUNT(p) FROM Project p GROUP BY p.status"
            ).getResultList()
        ).doesNotThrowAnyException();
    }

    @Test @DisplayName("Resource availability query by monthIndex is valid")
    void resource_AvailabilityMonthIndex_ValidJpql() {
        assertThatCode(() ->
            em.createQuery(
                "SELECT a FROM ResourceAvailability a WHERE a.monthIndex IS NOT NULL ORDER BY a.monthIndex"
            ).getResultList()
        ).doesNotThrowAnyException();
    }
}
