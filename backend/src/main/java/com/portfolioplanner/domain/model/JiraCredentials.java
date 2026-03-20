package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "jira_credentials")
public class JiraCredentials {

    @Id
    @Column(name = "id")
    private Long id = 1L;   // always the same single row

    @Column(name = "base_url", length = 500)
    private String baseUrl;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "api_token", columnDefinition = "TEXT")
    private String apiToken;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    /** Jira custom field ID used for CapEx/OpEx classification (e.g. customfield_10060). */
    @Column(name = "capex_field_id", length = 100)
    private String capexFieldId;

    public Long getId()             { return id; }
    public String getBaseUrl()      { return baseUrl; }
    public String getEmail()        { return email; }
    public String getApiToken()     { return apiToken; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public String getCapexFieldId() { return capexFieldId; }

    public void setId(Long id)           { this.id = id; }
    public void setBaseUrl(String v)     { this.baseUrl = v; }
    public void setEmail(String v)       { this.email = v; }
    public void setApiToken(String v)    { this.apiToken = v; }
    public void setUpdatedAt(LocalDateTime v) { this.updatedAt = v; }
    public void setCapexFieldId(String v)    { this.capexFieldId = v; }

    public boolean isConfigured() {
        return baseUrl != null && !baseUrl.isBlank()
            && email    != null && !email.isBlank()
            && apiToken != null && !apiToken.isBlank();
    }
}
