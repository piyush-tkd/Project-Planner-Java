package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.UserAiConfig;
import com.portfolioplanner.domain.repository.UserAiConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserAiConfigService {

    private final UserAiConfigRepository repo;
    private final UserAiKeyService userAiKeyService;

    /** Returns saved config for the user, or empty if none exists. */
    public Optional<UserAiConfig> findByUsername(String username) {
        return repo.findByUsername(username);
    }

    /** Upserts the user's personal AI config. */
    @Transactional
    public UserAiConfig save(String username, String provider, String model, String apiKey) {
        UserAiConfig config = repo.findByUsername(username).orElseGet(() -> {
            UserAiConfig c = new UserAiConfig();
            c.setUsername(username);
            return c;
        });
        config.setProvider(provider != null ? provider : "ANTHROPIC");
        config.setModel(model != null ? model : "claude-haiku-4-5-20251001");
        if (apiKey != null && !apiKey.isBlank()) {
            config.setApiKey(apiKey);
        }
        return repo.save(config);
    }

    /** Removes the user's personal AI config. */
    @Transactional
    public void delete(String username) {
        repo.deleteByUsername(username);
    }

    /** Returns which key source (ORG / USER / NONE) is active for this user. */
    public AiStatusResult getStatus(String username) {
        boolean orgActive  = userAiKeyService.isOrgKeyConfigured();
        boolean userKeySet = repo.findByUsername(username)
                .map(c -> c.getApiKey() != null && !c.getApiKey().isBlank())
                .orElse(false);
        String source = userAiKeyService.resolve(username).source();
        return new AiStatusResult(source, orgActive, userKeySet);
    }

    public record AiStatusResult(String source, boolean orgKeyActive, boolean userKeySet) {}
}
