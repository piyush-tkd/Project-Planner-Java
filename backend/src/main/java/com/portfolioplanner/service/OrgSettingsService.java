package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.OrgSettings;
import com.portfolioplanner.domain.repository.OrgSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrgSettingsService {

    private static final long DEFAULT_ORG_ID = 1L;
    private final OrgSettingsRepository repo;

    public OrgSettings get() {
        return getOrDefault();
    }

    @Transactional
    public OrgSettings update(OrgSettings req) {
        OrgSettings s = getOrDefault();

        if (req.getOrgName()         != null) s.setOrgName(req.getOrgName());
        if (req.getOrgSlug()         != null) s.setOrgSlug(req.getOrgSlug());
        if (req.getLogoUrl()         != null) s.setLogoUrl(req.getLogoUrl());
        if (req.getPrimaryColor()    != null) s.setPrimaryColor(req.getPrimaryColor());
        if (req.getSecondaryColor()  != null) s.setSecondaryColor(req.getSecondaryColor());
        if (req.getTimezone()        != null) s.setTimezone(req.getTimezone());
        if (req.getDateFormat()      != null) s.setDateFormat(req.getDateFormat());
        if (req.getFiscalYearStart() != null) s.setFiscalYearStart(req.getFiscalYearStart());
        if (req.getFeatures()         != null) {
            Map<String, Boolean> merged = new HashMap<>(defaultFeatures());
            merged.putAll(req.getFeatures());
            s.setFeatures(merged);
        }

        return repo.save(s);
    }

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
}
