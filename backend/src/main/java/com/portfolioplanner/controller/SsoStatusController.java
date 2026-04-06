package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.SsoConfig;
import com.portfolioplanner.domain.repository.SsoConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Public endpoint — no JWT required.
 * Used by the login page to decide whether to show the SSO button.
 *
 * Returns: { enabled: boolean, provider: string | null }
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class SsoStatusController {

    private static final Long DEFAULT_ORG_ID = 1L;

    private final SsoConfigRepository ssoRepo;

    @GetMapping("/sso-status")
    public ResponseEntity<Map<String, Object>> ssoStatus() {
        return ssoRepo.findByOrgId(DEFAULT_ORG_ID)
                .map(cfg -> {
                    // Only report as enabled if the config is actually complete
                    // (client ID must be set, otherwise the OAuth2 flow would fail immediately)
                    boolean ready = cfg.isEnabled()
                            && cfg.getClientId() != null
                            && !cfg.getClientId().isBlank();
                    return ResponseEntity.ok(Map.<String, Object>of(
                            "enabled",  ready,
                            "provider", cfg.getProvider() != null ? cfg.getProvider().name() : "GOOGLE"
                    ));
                })
                .orElseGet(() -> ResponseEntity.ok(Map.<String, Object>of(
                        "enabled",  false,
                        "provider", "GOOGLE"
                )));
    }
}
