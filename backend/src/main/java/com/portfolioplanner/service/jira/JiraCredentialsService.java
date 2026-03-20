package com.portfolioplanner.service.jira;

import com.portfolioplanner.config.JiraProperties;
import com.portfolioplanner.domain.model.JiraCredentials;
import com.portfolioplanner.domain.repository.JiraCredentialsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Provides Jira API credentials.
 *
 * Priority order:
 *   1. DB-stored credentials (jira_credentials table) — entered via Settings UI
 *   2. application*.yml properties (jira.base-url / jira.email / jira.api-token)
 *
 * This lets teams configure Jira from the UI without touching YAML files,
 * while still supporting the file-based approach as a fallback.
 */
@Service
@RequiredArgsConstructor
public class JiraCredentialsService {

    private final JiraCredentialsRepository repo;
    private final JiraProperties            fileProps;   // loaded from application*.yml

    // ── Effective getters (DB wins over file) ─────────────────────────

    public String getBaseUrl() {
        return dbCredentials().map(JiraCredentials::getBaseUrl)
                .filter(s -> s != null && !s.isBlank())
                .orElse(fileProps.getBaseUrl());
    }

    public String getEmail() {
        return dbCredentials().map(JiraCredentials::getEmail)
                .filter(s -> s != null && !s.isBlank())
                .orElse(fileProps.getEmail());
    }

    public String getApiToken() {
        return dbCredentials().map(JiraCredentials::getApiToken)
                .filter(s -> s != null && !s.isBlank())
                .orElse(fileProps.getApiToken());
    }

    public boolean isConfigured() {
        String url   = getBaseUrl();
        String email = getEmail();
        String token = getApiToken();
        return url   != null && !url.isBlank()
            && email != null && !email.isBlank()
            && token != null && !token.isBlank();
    }

    /** Returns the base URL that is currently active (for display in the status endpoint). */
    public String effectiveBaseUrl() {
        return isConfigured() ? getBaseUrl() : "";
    }

    /**
     * Returns the configured CapEx custom field ID (e.g. "customfield_10060").
     * Null/blank means not yet set.
     */
    public String getCapexFieldId() {
        return dbCredentials().map(JiraCredentials::getCapexFieldId)
                .filter(s -> s != null && !s.isBlank())
                .orElse(null);
    }

    // ── DB read/write ─────────────────────────────────────────────────

    /** Returns the DB row if it has been saved, otherwise empty. */
    @Transactional(readOnly = true)
    public Optional<JiraCredentials> dbCredentials() {
        return repo.findById(1L);
    }

    /**
     * Save (or update) credentials in the DB.
     * Evicts nothing — the caller (JiraClient) must clear caches after saving
     * since the endpoint will differ.
     */
    @Transactional
    public JiraCredentials save(String baseUrl, String email, String apiToken) {
        JiraCredentials creds = repo.findById(1L).orElseGet(JiraCredentials::new);
        creds.setId(1L);
        creds.setBaseUrl(baseUrl  != null ? baseUrl.trim()  : "");
        creds.setEmail(email      != null ? email.trim()    : "");
        creds.setApiToken(apiToken != null ? apiToken.trim() : "");
        creds.setUpdatedAt(LocalDateTime.now());
        return repo.save(creds);
    }

    /** Saves only the CapEx field ID, leaving other credential fields untouched. */
    @Transactional
    public JiraCredentials saveCapexFieldId(String fieldId) {
        JiraCredentials creds = repo.findById(1L).orElseGet(JiraCredentials::new);
        creds.setId(1L);
        creds.setCapexFieldId(fieldId != null ? fieldId.trim() : null);
        creds.setUpdatedAt(LocalDateTime.now());
        return repo.save(creds);
    }
}
