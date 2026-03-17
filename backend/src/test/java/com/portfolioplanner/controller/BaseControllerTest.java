package com.portfolioplanner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolioplanner.domain.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Base class for all functional (controller integration) tests.
 *
 * WHAT "FUNCTIONAL TEST" MEANS HERE
 * ──────────────────────────────────
 * @SpringBootTest loads the FULL application context (controllers, services,
 * repositories, JPA) but uses:
 *   • H2 in-memory DB (from application-test.properties)
 *   • Hibernate ddl-auto=create-drop  (schema created fresh each test run)
 *   • Flyway disabled
 *
 * Requests are fired through MockMvc (no real TCP port needed).
 * The HTTP → service → repository → DB stack is exercised exactly as in
 * production.
 *
 * DB ISOLATION BETWEEN TESTS
 * ──────────────────────────
 * Controller methods run inside their own transactions (committed before
 * MockMvc returns), so @Transactional on the test method would NOT roll
 * them back.  Instead every test class calls cleanDb() in @BeforeEach to
 * delete all rows in dependency order.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "admin", roles = "ADMIN")   // all functional tests run as authenticated admin
public abstract class BaseControllerTest {

    @Autowired protected MockMvc mockMvc;
    @Autowired protected ObjectMapper objectMapper;

    // ── Repositories injected for setup / teardown only ──────────────────────
    @Autowired protected ResourceRepository resourceRepository;
    @Autowired protected ResourcePodAssignmentRepository resourcePodAssignmentRepository;
    @Autowired protected ResourceAvailabilityRepository resourceAvailabilityRepository;
    @Autowired protected PodRepository podRepository;
    @Autowired protected ProjectRepository projectRepository;
    @Autowired protected ProjectPodPlanningRepository projectPodPlanningRepository;
    @Autowired protected CostRateRepository costRateRepository;
    @Autowired protected ProjectActualRepository projectActualRepository;
    @Autowired protected BauAssumptionRepository bauAssumptionRepository;
    @Autowired protected TemporaryOverrideRepository temporaryOverrideRepository;
    @Autowired protected ScenarioOverrideRepository scenarioOverrideRepository;
    @Autowired protected ScenarioRepository scenarioRepository;
    @Autowired protected EffortPatternRepository effortPatternRepository;
    @Autowired protected RoleEffortMixRepository roleEffortMixRepository;
    @Autowired protected TshirtSizeConfigRepository tshirtSizeConfigRepository;

    // ── Wipe all rows in FK-safe reverse order before every test ─────────────
    @BeforeEach
    void cleanDb() {
        scenarioOverrideRepository.deleteAllInBatch();
        scenarioRepository.deleteAllInBatch();
        temporaryOverrideRepository.deleteAllInBatch();
        projectPodPlanningRepository.deleteAllInBatch();
        projectActualRepository.deleteAllInBatch();
        projectRepository.deleteAllInBatch();
        costRateRepository.deleteAllInBatch();
        resourceAvailabilityRepository.deleteAllInBatch();
        resourcePodAssignmentRepository.deleteAllInBatch();
        bauAssumptionRepository.deleteAllInBatch();
        resourceRepository.deleteAllInBatch();
        effortPatternRepository.deleteAllInBatch();
        roleEffortMixRepository.deleteAllInBatch();
        tshirtSizeConfigRepository.deleteAllInBatch();
        podRepository.deleteAllInBatch();
    }

    // ── Convenience helpers ───────────────────────────────────────────────────

    /** Serialise any object to a JSON string. */
    protected String json(Object obj) throws Exception {
        return objectMapper.writeValueAsString(obj);
    }

    protected static final MediaType JSON = MediaType.APPLICATION_JSON;
}
