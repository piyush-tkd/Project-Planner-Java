package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

@Entity
@Table(name = "azure_devops_settings")
public class AzureDevOpsSettings {

    @Id
    @Column(name = "id")
    private Long id = 1L;   // always the same single row

    @Column(name = "org_url", length = 500)
    private String orgUrl;

    @Column(name = "project_name", length = 255)
    private String projectName;

    @Column(name = "personal_access_token", columnDefinition = "TEXT")
    private String personalAccessToken;

    /** Comma-separated list of repository names configured by the user. */
    @Column(name = "repositories", columnDefinition = "TEXT")
    private String repositories;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    // ── Accessors ─────────────────────────────────────────────────────────────

    public Long getId()                   { return id; }
    public String getOrgUrl()             { return orgUrl; }
    public String getProjectName()        { return projectName; }
    public String getPersonalAccessToken(){ return personalAccessToken; }
    public String getRepositories()       { return repositories; }
    public LocalDateTime getUpdatedAt()   { return updatedAt; }

    public void setId(Long id)                        { this.id = id; }
    public void setOrgUrl(String v)                   { this.orgUrl = v; }
    public void setProjectName(String v)              { this.projectName = v; }
    public void setPersonalAccessToken(String v)      { this.personalAccessToken = v; }
    public void setRepositories(String v)             { this.repositories = v; }
    public void setUpdatedAt(LocalDateTime v)         { this.updatedAt = v; }

    /** Convenience: split repos string into trimmed list, ignoring blanks. */
    public List<String> repoList() {
        if (repositories == null || repositories.isBlank()) return List.of();
        return Arrays.stream(repositories.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    public boolean isConfigured() {
        return orgUrl             != null && !orgUrl.isBlank()
            && projectName        != null && !projectName.isBlank()
            && personalAccessToken != null && !personalAccessToken.isBlank();
    }
}
