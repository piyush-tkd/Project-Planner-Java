package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Per-org SSO / OIDC configuration.
 * One row per organisation (unique on org_id).
 * client_secret should be encrypted at rest in production deployments.
 */
@Entity
@Table(name = "sso_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SsoConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Organisation this config belongs to. */
    @Column(name = "org_id", nullable = false, unique = true)
    private Long orgId;

    /** Identity provider type. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "sso_provider")
    private SsoProvider provider = SsoProvider.GOOGLE;

    @Column(name = "client_id", length = 500)
    private String clientId;

    /** Stored plain-text; mask in API responses. */
    @Column(name = "client_secret", length = 2000)
    private String clientSecret;

    @Column(name = "redirect_uri", length = 1000)
    private String redirectUri;

    /** OIDC discovery endpoint URL (required for OKTA and CUSTOM providers). */
    @Column(name = "discovery_url", length = 1000)
    private String discoveryUrl;

    @Column(nullable = false)
    private boolean enabled = false;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum SsoProvider {
        GOOGLE, MICROSOFT, OKTA, CUSTOM
    }
}
