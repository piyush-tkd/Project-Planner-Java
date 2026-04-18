package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.OrgSettings;
import com.portfolioplanner.service.OrgSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    private final OrgSettingsService service;

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

    @GetMapping("/settings")
    public ResponseEntity<OrgSettingsDto> get() {
        return ResponseEntity.ok(toDto(service.get()));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/settings")
    public ResponseEntity<OrgSettingsDto> update(@RequestBody OrgSettingsDto req) {
        OrgSettings s = new OrgSettings();
        s.setOrgName(req.orgName());
        s.setOrgSlug(req.orgSlug());
        s.setLogoUrl(req.logoUrl());
        s.setPrimaryColor(req.primaryColor());
        s.setSecondaryColor(req.secondaryColor());
        s.setTimezone(req.timezone());
        s.setDateFormat(req.dateFormat());
        s.setFiscalYearStart(req.fiscalYearStart());
        s.setFeatures(req.features());
        return ResponseEntity.ok(toDto(service.update(s)));
    }

    private OrgSettingsDto toDto(OrgSettings s) {
        Map<String, Boolean> features = s.getFeatures() != null ? s.getFeatures() : new HashMap<>();
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
