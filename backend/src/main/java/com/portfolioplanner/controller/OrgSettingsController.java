package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.OrgSettings;
import com.portfolioplanner.domain.repository.OrgSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * REST endpoints for org-level branding and workspace settings.
 *
 * GET  /api/org/settings        – fetch current org config (always org_id=1 for now)
 * PUT  /api/org/settings        – update org config
 */
@RestController
@RequestMapping("/api/org")
@RequiredArgsConstructor
public class OrgSettingsController {

    private static final long DEFAULT_ORG_ID = 1L;

    private final OrgSettingsRepository repo;

    /** Response + request DTO (same shape for simplicity) */
    public record OrgSettingsDto(
        Long   id,
        String orgName,
        String orgSlug,
        String logoUrl,
        String primaryColor,
        String secondaryColor,
        String timezone,
        String dateFormat,
        String fiscalYearStart,
        Map<String, Boolean> features
    ) {}

    // ── GET /api/org/settings ────────────────────────────────────────────────
    @GetMapping("/settings")
    public ResponseEntity<OrgSettingsDto> get() {
        OrgSettings s = getOrDefault();
        return ResponseEntity.ok(toDto(s));
    }

    // ── PUT /api/org/settings ────────────────────────────────────────────────
    @PutMapping("/settings")
    public ResponseEntity<OrgSettingsDto> update(@RequestBody OrgSettingsDto req) {
        OrgSettings s = getOrDefault();

        if (req.orgName()        != null) s.setOrgName(req.orgName());
        if (req.orgSlug()        != null) s.setOrgSlug(req.orgSlug());
        if (req.logoUrl()        != null) s.setLogoUrl(req.logoUrl());
        if (req.primaryColor()   != null) s.setPrimaryColor(req.primaryColor());
        if (req.secondaryColor() != null) s.setSecondaryColor(req.secondaryColor());
        if (req.timezone()       != null) s.setTimezone(req.timezone());
        if (req.dateFormat()     != null) s.setDateFormat(req.dateFormat());
        if (req.fiscalYearStart()!= null) s.setFiscalYearStart(req.fiscalYearStart());
        if (req.features()        != null) {
            Map<String, Boolean> merged = new HashMap<>(defaultFeatures());
            merged.putAll(req.features());
            s.setFeatures(merged);
        }

        repo.save(s);
        return ResponseEntity.ok(toDto(s));
    }

    // ── helpers ─────────────────────────────────────────────────────────────
    private OrgSettings getOrDefault() {
        return repo.findByOrgId(DEFAULT_ORG_ID).orElseGet(() -> {
            OrgSettings fresh = new OrgSettings();
            fresh.setOrgId(DEFAULT_ORG_ID);
            fresh.setOrgName("Engineering Portfolio Planner");
            fresh.setOrgSlug("epp");
            fresh.setPrimaryColor("#2DCCD3");
            fresh.setSecondaryColor("#0C2340");
            fresh.setTimezone("America/Chicago");
            fresh.setDateFormat("MMM DD, YYYY");
            fresh.setFiscalYearStart("January");
            fresh.setFeatures(defaultFeatures());
            return repo.save(fresh);
        });
    }

    private Map<String, Boolean> defaultFeatures() {
        Map<String, Boolean> m = new HashMap<>();
        m.put("ai",         true);
        m.put("okr",        true);
        m.put("risk",       true);
        m.put("ideas",      true);
        m.put("financials", true);
        return m;
    }

    private OrgSettingsDto toDto(OrgSettings s) {
        Map<String, Boolean> features = s.getFeatures() != null ? s.getFeatures() : defaultFeatures();
        return new OrgSettingsDto(
            s.getId(),
            s.getOrgName(),
            s.getOrgSlug(),
            s.getLogoUrl(),
            s.getPrimaryColor(),
            s.getSecondaryColor(),
            s.getTimezone(),
            s.getDateFormat(),
            s.getFiscalYearStart(),
            features
        );
    }
}
