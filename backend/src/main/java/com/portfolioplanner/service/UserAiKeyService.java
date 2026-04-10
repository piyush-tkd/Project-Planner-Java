package com.portfolioplanner.service;

import com.portfolioplanner.domain.repository.UserAiConfigRepository;
import com.portfolioplanner.service.nlp.NlpConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves the effective AI credentials for a given request.
 *
 * Priority:
 *  1. Org-level key in nlp_config (cloud_api_key) — if set, ALL users use this.
 *  2. User's personal key in user_ai_config — used when no org key is configured.
 *  3. NONE — no AI available, callers should return HTTP 503.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserAiKeyService {

    private final NlpConfigService nlpConfigService;
    private final UserAiConfigRepository userAiConfigRepository;

    public record ResolvedCredentials(
            String provider,
            String model,
            String apiKey,
            String source   // "ORG" | "USER" | "NONE"
    ) {}

    /**
     * Resolves which credentials to use for the given username.
     * Org key always wins if it's configured.
     */
    public ResolvedCredentials resolve(String username) {
        // 1. Org-level key
        String orgKey = nlpConfigService.getOrgCloudApiKey();
        if (orgKey != null && !orgKey.isBlank()) {
            return new ResolvedCredentials(
                    nlpConfigService.getOrgCloudProvider(),
                    nlpConfigService.getOrgCloudModel(),
                    orgKey,
                    "ORG"
            );
        }

        // 2. User's personal key
        return userAiConfigRepository.findByUsername(username)
                .filter(c -> c.getApiKey() != null && !c.getApiKey().isBlank())
                .map(c -> new ResolvedCredentials(c.getProvider(), c.getModel(), c.getApiKey(), "USER"))
                .orElse(new ResolvedCredentials(null, null, null, "NONE"));
    }

    /** Returns true if the org has a key configured (used by status endpoints). */
    public boolean isOrgKeyConfigured() {
        String k = nlpConfigService.getOrgCloudApiKey();
        return k != null && !k.isBlank();
    }
}
