package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.WebhookConfig;
import com.portfolioplanner.service.WebhookConfigService;
import com.portfolioplanner.service.WebhookConfigService.WebhookRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * CRUD for outbound webhook configurations.
 *
 * GET    /api/admin/webhooks           — list all
 * POST   /api/admin/webhooks           — create
 * PUT    /api/admin/webhooks/{id}      — update
 * DELETE /api/admin/webhooks/{id}      — delete
 * POST   /api/admin/webhooks/{id}/test — fire a test ping to the endpoint
 */
@RestController
@RequestMapping("/api/admin/webhooks")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class WebhookConfigController {

    private final WebhookConfigService webhookConfigService;

    // ── DTO ──────────────────────────────────────────────────────────────────

    public record WebhookDto(
            Long    id,
            String  name,
            String  url,
            String  provider,
            String  secret,
            boolean enabled,
            String  events,
            String  createdAt
    ) {}

    public record WebhookApiRequest(
            String  name,
            String  url,
            String  provider,
            String  secret,
            Boolean enabled,
            String  events
    ) {}

    // ── Endpoints ─────────────────────────────────────────────────────────────

    @GetMapping
    public List<WebhookDto> list() {
        return webhookConfigService.listAll().stream().map(this::toDto).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WebhookDto create(@RequestBody WebhookApiRequest req) {
        return toDto(webhookConfigService.create(toServiceRequest(req)));
    }

    @PutMapping("/{id}")
    public WebhookDto update(@PathVariable Long id, @RequestBody WebhookApiRequest req) {
        return toDto(webhookConfigService.update(id, toServiceRequest(req)));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        webhookConfigService.delete(id);
    }

    @PostMapping("/{id}/test")
    public ResponseEntity<Void> testPing(@PathVariable Long id) {
        webhookConfigService.testPing(id);
        return ResponseEntity.ok().build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private WebhookRequest toServiceRequest(WebhookApiRequest req) {
        return new WebhookRequest(req.name(), req.url(), req.provider(),
                req.secret(), req.enabled(), req.events());
    }

    private WebhookDto toDto(WebhookConfig wh) {
        return new WebhookDto(
                wh.getId(), wh.getName(), wh.getUrl(), wh.getProvider(),
                wh.getSecret() != null ? "••••••••" : null,
                wh.isEnabled(), wh.getEvents(),
                wh.getCreatedAt() != null ? wh.getCreatedAt().toString() : null);
    }
}
