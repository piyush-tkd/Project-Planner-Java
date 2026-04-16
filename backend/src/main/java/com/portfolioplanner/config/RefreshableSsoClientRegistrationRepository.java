package com.portfolioplanner.config;

import com.portfolioplanner.domain.model.SsoConfig;
import com.portfolioplanner.domain.repository.SsoConfigRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.stereotype.Component;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;

import java.util.Optional;

/**
 * Refreshable SSO client registration repository.
 *
 * <p>Wraps the {@code sso_config} database row and allows hot reloading
 * without server restart via the {@link #refresh()} method.
 *
 * <p>Implementation is thread-safe using volatile field and synchronized refresh.
 */
@Component
@Primary
@RequiredArgsConstructor
@Slf4j
public class RefreshableSsoClientRegistrationRepository implements ClientRegistrationRepository {

    private static final Long DEFAULT_ORG_ID = 1L;
    static final String REGISTRATION_ID = "sso";

    private final SsoConfigRepository ssoRepo;

    private volatile ClientRegistration registration;

    /**
     * Find a client registration by ID.
     * Returns null if not configured or incomplete.
     */
    @Override
    public ClientRegistration findByRegistrationId(String registrationId) {
        if (!REGISTRATION_ID.equals(registrationId)) {
            return null;
        }
        return registration;
    }

    /**
     * Refresh the client registration from the database.
     * Thread-safe: synchronized to prevent race conditions during rebuild.
     */
    @PostConstruct
    public void init() {
        refresh();
    }

    public synchronized void refresh() {
        Optional<SsoConfig> opt = ssoRepo.findByOrgId(DEFAULT_ORG_ID);

        if (opt.isEmpty()) {
            log.info("SSO: no sso_config row found — OAuth2 login disabled");
            registration = null;
            return;
        }

        SsoConfig cfg = opt.get();
        if (!cfg.isEnabled()
                || cfg.getClientId() == null || cfg.getClientId().isBlank()
                || cfg.getClientSecret() == null || cfg.getClientSecret().isBlank()) {
            log.info("SSO: configuration incomplete or disabled — OAuth2 login disabled");
            registration = null;
            return;
        }

        ClientRegistration builtRegistration = buildRegistration(cfg);
        if (builtRegistration == null) {
            registration = null;
            return;
        }

        log.info("SSO: refreshed OAuth2 client '{}' with provider {}",
                REGISTRATION_ID, cfg.getProvider());
        registration = builtRegistration;
    }

    // ── Builder ──────────────────────────────────────────────────────────────

    private static ClientRegistration buildRegistration(SsoConfig cfg) {
        ClientRegistration.Builder builder = ClientRegistration
                .withRegistrationId(REGISTRATION_ID)
                .clientId(cfg.getClientId())
                .clientSecret(cfg.getClientSecret())
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri(cfg.getRedirectUri() != null && !cfg.getRedirectUri().isBlank()
                        ? cfg.getRedirectUri()
                        : "{baseUrl}/login/oauth2/code/" + REGISTRATION_ID)
                .scope("openid", "email", "profile")
                .userNameAttributeName(IdTokenClaimNames.SUB);

        SsoConfig.SsoProvider provider = cfg.getProvider() != null ? cfg.getProvider() : SsoConfig.SsoProvider.GOOGLE;

        switch (provider) {
            case GOOGLE -> builder
                    .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                    .tokenUri("https://oauth2.googleapis.com/token")
                    .jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
                    .userInfoUri("https://www.googleapis.com/oauth2/v3/userinfo")
                    .userNameAttributeName("email")
                    .clientName("Google");

            case MICROSOFT -> builder
                    .authorizationUri("https://login.microsoftonline.com/common/oauth2/v2.0/authorize")
                    .tokenUri("https://login.microsoftonline.com/common/oauth2/v2.0/token")
                    .jwkSetUri("https://login.microsoftonline.com/common/discovery/v2.0/keys")
                    .userInfoUri("https://graph.microsoft.com/oidc/userinfo")
                    .userNameAttributeName("email")
                    .clientName("Microsoft");

            case OKTA, CUSTOM -> {
                String discoveryUrl = cfg.getDiscoveryUrl();
                if (discoveryUrl == null || discoveryUrl.isBlank()) {
                    log.warn("SSO: OKTA/CUSTOM provider requires a discovery URL — skipping registration");
                    return null;
                }
                // Spring Security can auto-resolve endpoints from the discovery URL
                // by using the issuer-uri property. We set it via the issuer-uri builder.
                builder
                    .authorizationUri(discoveryUrl.replace("/.well-known/openid-configuration", "") + "/v1/authorize")
                    .tokenUri(discoveryUrl.replace("/.well-known/openid-configuration", "") + "/v1/token")
                    .jwkSetUri(discoveryUrl.replace("/.well-known/openid-configuration", "") + "/v1/keys")
                    .userInfoUri(discoveryUrl.replace("/.well-known/openid-configuration", "") + "/v1/userinfo")
                    .userNameAttributeName("email")
                    .clientName(provider == SsoConfig.SsoProvider.OKTA ? "Okta" : "SSO");
            }
        }

        return builder.build();
    }
}
