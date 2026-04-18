package com.portfolioplanner.controller;

import com.portfolioplanner.service.UserAiConfigService;
import com.portfolioplanner.service.UserAiConfigService.AiStatusResult;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Personal AI configuration for individual users.
 *
 * GET    /api/user/ai-config        — current user's saved config (key masked)
 * PUT    /api/user/ai-config        — save / update personal key
 * DELETE /api/user/ai-config        — remove personal key
 * GET    /api/user/ai-config/status — which key source is active for this user
 */
@RestController
@RequestMapping("/api/user/ai-config")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class UserAiConfigController {

    private final UserAiConfigService userAiConfigService;

    public record UserAiConfigRequest(String provider, String model, String apiKey) {}

    public record UserAiConfigResponse(
            String  provider,
            String  model,
            boolean apiKeySet,
            String  maskedKey
    ) {}

    public record AiStatusResponse(String source, boolean orgKeyActive, boolean userKeySet) {}

    @GetMapping
    public ResponseEntity<UserAiConfigResponse> get(Authentication auth) {
        return userAiConfigService.findByUsername(auth.getName())
                .map(c -> ResponseEntity.ok(new UserAiConfigResponse(
                        c.getProvider(), c.getModel(), true, maskKey(c.getApiKey()))))
                .orElse(ResponseEntity.ok(new UserAiConfigResponse(
                        "ANTHROPIC", "claude-haiku-4-5-20251001", false, null)));
    }

    @PutMapping
    public ResponseEntity<UserAiConfigResponse> save(
            @RequestBody UserAiConfigRequest request,
            Authentication auth) {
        var config = userAiConfigService.save(
                auth.getName(), request.provider(), request.model(), request.apiKey());
        return ResponseEntity.ok(new UserAiConfigResponse(
                config.getProvider(), config.getModel(), true, maskKey(config.getApiKey())));
    }

    @DeleteMapping
    public ResponseEntity<Map<String, String>> delete(Authentication auth) {
        userAiConfigService.delete(auth.getName());
        return ResponseEntity.ok(Map.of("message", "Personal AI key removed."));
    }

    @GetMapping("/status")
    public ResponseEntity<AiStatusResponse> status(Authentication auth) {
        AiStatusResult r = userAiConfigService.getStatus(auth.getName());
        return ResponseEntity.ok(new AiStatusResponse(r.source(), r.orgKeyActive(), r.userKeySet()));
    }

    private String maskKey(String key) {
        if (key == null || key.length() < 8) return "••••";
        return "••••••••" + key.substring(key.length() - 4);
    }
}
