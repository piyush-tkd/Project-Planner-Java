package com.portfolioplanner.controller;

import com.portfolioplanner.config.FeatureFlagInterceptor;
import com.portfolioplanner.domain.model.OrgSettings;
import com.portfolioplanner.domain.repository.OrgSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.HashMap;
import java.util.Map;

import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies that FeatureFlagInterceptor blocks requests to guarded endpoints
 * when the corresponding flag is disabled, and allows them when enabled.
 *
 * Uses the full Spring context (H2 in-memory) so the interceptor is wired
 * exactly as in production.  Calls invalidateCache() after each DB change
 * so the interceptor picks up the new state immediately.
 */
class FeatureFlagInterceptorTest extends BaseControllerTest {

    @Autowired private OrgSettingsRepository orgSettingsRepository;
    @Autowired private FeatureFlagInterceptor interceptor;

    private OrgSettings settings;

    @BeforeEach
    void seedOrgSettings() {
        orgSettingsRepository.deleteAll();
        settings = new OrgSettings();
        settings.setOrgId(1L);
        settings.setOrgName("Test Org");
        settings.setOrgSlug("test");
        Map<String, Boolean> features = new HashMap<>();
        features.put("ai",         true);
        features.put("financials", true);
        features.put("risk",       true);
        features.put("okr",        true);
        features.put("ideas",      true);
        settings.setFeatures(features);
        settings = orgSettingsRepository.save(settings);
        interceptor.invalidateCache();
    }

    // ── AI flag ──────────────────────────────────────────────────────────────

    @Test
    void ai_flag_on_allows_nlp_catalog() throws Exception {
        mockMvc.perform(get("/api/nlp/catalog"))
               .andExpect(status().isOk());
    }

    @Test
    void ai_flag_off_blocks_nlp_catalog() throws Exception {
        setFlag("ai", false);
        mockMvc.perform(get("/api/nlp/catalog"))
               .andExpect(status().isForbidden());
    }

    @Test
    void ai_flag_restored_allows_nlp_catalog() throws Exception {
        setFlag("ai", false);
        mockMvc.perform(get("/api/nlp/catalog")).andExpect(status().isForbidden());

        setFlag("ai", true);
        mockMvc.perform(get("/api/nlp/catalog")).andExpect(status().isOk());
    }

    // ── Risk flag ─────────────────────────────────────────────────────────────

    @Test
    void risk_flag_off_blocks_risks_endpoint() throws Exception {
        setFlag("risk", false);
        mockMvc.perform(get("/api/risks/"))
               .andExpect(status().isForbidden());
    }

    // ── OKR flag ──────────────────────────────────────────────────────────────

    @Test
    void okr_flag_off_blocks_objectives_endpoint() throws Exception {
        setFlag("okr", false);
        mockMvc.perform(get("/api/objectives/"))
               .andExpect(status().isForbidden());
    }

    // ── Ideas flag ────────────────────────────────────────────────────────────

    @Test
    void ideas_flag_off_blocks_ideas_endpoint() throws Exception {
        setFlag("ideas", false);
        mockMvc.perform(get("/api/ideas/"))
               .andExpect(status().isForbidden());
    }

    // ── Auth + org endpoints are always open ──────────────────────────────────

    @Test
    void auth_endpoint_never_blocked() throws Exception {
        // /api/auth/** is excluded from the interceptor — all flags off
        settings.getFeatures().replaceAll((k, v) -> false);
        orgSettingsRepository.save(settings);
        interceptor.invalidateCache();

        // /api/auth/login is always reachable (even if it returns 400 for bad payload)
        mockMvc.perform(get("/api/auth/me"))
               .andExpect(status().is(not(403)));
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private void setFlag(String flag, boolean value) {
        settings.getFeatures().put(flag, value);
        settings = orgSettingsRepository.save(settings);
        interceptor.invalidateCache();
    }
}
