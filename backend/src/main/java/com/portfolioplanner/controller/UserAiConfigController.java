package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.UserAiConfig;
import com.portfolioplanner.domain.repository.UserAiConfigRepository;
import com.portfolioplanner.service.UserAiKeyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Personal AI configuration for individual users.
 *
 * GET    /api/user/ai-config   — returns current user's saved config (key masked)
 * PUT    /api/user/ai-config   — save / update personal key
 * DELETE /api/user/ai-config   — remove personal key
 * GET    /api/user/ai-config/status — returns which key source is active for this user
 */
@RestController
@RequestMapping("/api/user/ai-config")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class UserAiConfigController {

    private final UserAiConfigRepository repo;
    private final UserAiKeyService userAiKeyService;

    public record UserAiConfigRequest(
            String provider,   // ANTHROPIC | OPENAI
            String model,
            String apiKey
    ) {}

    public record UserAiConfigResponse(
            String provider,
            String model,
            boolean apiKeySet,
            String maskedKey   // last 4 chars visible, rest masked
    ) {}

    public record AiStatusResponse(
            String source,        // ORG | USER | NONE
            boolean orgKeyActive,
            boolean userKeySet
    ) {}

    @GetMapping
    public ResponseEntity<UserAiConfigResponse> get(Authentication auth) {
        String username = auth.getName();
        return repo.findByUsername(username)
                .map(c -> ResponseEntity.ok(new UserAiConfigResponse(
                        c.getProvider(),
                        c.getModel(),
                        true,
                        maskKey(c.getApiKey())
                )))
                .orElse(ResponseEntity.ok(new UserAiConfigResponse("ANTHROPIC", "claude-haiku-4-5-20251001", false, null)));
    }

    @PutMapping
    public ResponseEntity<UserAiConfigResponse> save(
            @RequestBody UserAiConfigRequest request,
            Authentication auth) {
        String username = auth.getName();
        UserAiConfig config = repo.findByUsername(username).orElseGet(() -> {
            UserAiConfig c = new UserAiConfig();
            c.setUsername(username);
            return c;
        });
        config.setProvider(request.provider() != null ? request.provider() : "ANTHROPIC");
        config.setModel(request.model() != null ? request.model() : "claude-haiku-4-5-20251001");
        if (request.apiKey() != null && !request.apiKey().isBlank()) {
            config.setApiKey(request.apiKey());
        }
        repo.save(config);
        return ResponseEntity.ok(new UserAiConfigResponse(
                config.getProvider(),
                config.getModel(),
                true,
                maskKey(config.getApiKey())
        ));
    }

    @DeleteMapping
    public ResponseEntity<Map<String, String>> delete(Authentication auth) {
        repo.deleteByUsername(auth.getName());
        return ResponseEntity.ok(Map.of("message", "Personal AI key removed."));
    }

    @GetMapping("/status")
    public ResponseEntity<AiStatusResponse> status(Authentication auth) {
        String username = auth.getName();
        boolean orgActive = userAiKeyService.isOrgKeyConfigured();
        boolean userKeySet = repo.findByUsername(username)
                .map(c -> c.getApiKey() != null && !c.getApiKey().isBlank())
                .orElse(false);
        String source = userAiKeyService.resolve(username).source();
        return ResponseEntity.ok(new AiStatusResponse(source, orgActive, userKeySet));
    }

    private String maskKey(String key) {
        if (key == null || key.length() < 8) return "••••";
        return "••••••••" + key.substring(key.length() - 4);
    }
}
