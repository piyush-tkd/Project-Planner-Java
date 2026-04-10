package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.SsoConfig;
import com.portfolioplanner.domain.model.SsoConfig.SsoProvider;
import com.portfolioplanner.domain.repository.SsoConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * CRUD for per-org SSO / OIDC configuration.
 *
 * GET  /api/admin/sso       — retrieve config (client_secret masked)
 * PUT  /api/admin/sso       — create or update config
 */
@RestController
@RequestMapping("/api/admin/sso")
@PreAuthorize("hasRole('ADMIN')")   // S2.3 — SSO config is admin-only
@RequiredArgsConstructor
public class SsoConfigController {

    private static final Long DEFAULT_ORG_ID = 1L;
    private static final String SECRET_MASK = "••••••••";

    private final SsoConfigRepository ssoRepo;

    // ── DTO record ──────────────────────────────────────────────────────────

    public record SsoConfigDTO(
            Long id,
            Long orgId,
            String provider,
            String clientId,
            String clientSecret,   // "••••••••" in GET responses when set
            String redirectUri,
            String discoveryUrl,
            boolean enabled
    ) {}

    // ── GET ─────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<SsoConfigDTO> get() {
        SsoConfig cfg = ssoRepo.findByOrgId(DEFAULT_ORG_ID)
                .orElseGet(() -> buildDefault());
        return ResponseEntity.ok(toDto(cfg, true));
    }

    // ── PUT ─────────────────────────────────────────────────────────────────

    @PutMapping
    public ResponseEntity<SsoConfigDTO> upsert(@RequestBody Map<String, Object> body) {
        SsoConfig cfg = ssoRepo.findByOrgId(DEFAULT_ORG_ID)
                .orElseGet(() -> buildDefault());

        if (body.containsKey("provider")) {
            cfg.setProvider(SsoProvider.valueOf(body.get("provider").toString().toUpperCase()));
        }
        if (body.containsKey("clientId")) {
            cfg.setClientId(body.get("clientId") != null ? body.get("clientId").toString() : null);
        }
        // Only overwrite the secret if a non-masked value is provided
        if (body.containsKey("clientSecret")) {
            String secret = body.get("clientSecret") != null ? body.get("clientSecret").toString() : null;
            if (secret != null && !secret.equals(SECRET_MASK)) {
                cfg.setClientSecret(secret);
            }
        }
        if (body.containsKey("redirectUri")) {
            cfg.setRedirectUri(body.get("redirectUri") != null ? body.get("redirectUri").toString() : null);
        }
        if (body.containsKey("discoveryUrl")) {
            cfg.setDiscoveryUrl(body.get("discoveryUrl") != null ? body.get("discoveryUrl").toString() : null);
        }
        if (body.containsKey("enabled")) {
            cfg.setEnabled(Boolean.parseBoolean(body.get("enabled").toString()));
        }

        SsoConfig saved = ssoRepo.save(cfg);
        return ResponseEntity.ok(toDto(saved, true));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private SsoConfig buildDefault() {
        SsoConfig c = new SsoConfig();
        c.setOrgId(DEFAULT_ORG_ID);
        c.setProvider(SsoProvider.GOOGLE);
        c.setEnabled(false);
        return c;
    }

    private SsoConfigDTO toDto(SsoConfig c, boolean maskSecret) {
        String secret = c.getClientSecret();
        if (maskSecret && secret != null && !secret.isBlank()) {
            secret = SECRET_MASK;
        }
        return new SsoConfigDTO(
                c.getId(),
                c.getOrgId(),
                c.getProvider() != null ? c.getProvider().name() : null,
                c.getClientId(),
                secret,
                c.getRedirectUri(),
                c.getDiscoveryUrl(),
                c.isEnabled()
        );
    }
}
