package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.WebhookConfig;
import com.portfolioplanner.domain.repository.WebhookConfigRepository;
import com.portfolioplanner.service.WebhookService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
@PreAuthorize("hasRole('ADMIN')")   // S2.3 — webhook config is admin-only
@RequiredArgsConstructor
public class WebhookConfigController {

    private final WebhookConfigRepository repo;
    private final WebhookService webhookService;

    // ── DTO ──────────────────────────────────────────────────────────────────

    public record WebhookDto(
            Long   id,
            String name,
            String url,
            String provider,
            String secret,
            boolean enabled,
            String events,
            String createdAt
    ) {}

    public record WebhookRequest(
            String  name,
            String  url,
            String  provider,
            String  secret,
            Boolean enabled,
            String  events
    ) {}

    // ── GET list ─────────────────────────────────────────────────────────────

    @GetMapping
    public List<WebhookDto> list() {
        return repo.findAllByOrderByCreatedAtDesc()
                   .stream().map(this::toDto).toList();
    }

    // ── POST create ──────────────────────────────────────────────────────────

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WebhookDto create(@RequestBody WebhookRequest req) {
        WebhookConfig wh = new WebhookConfig();
        applyRequest(wh, req);
        return toDto(repo.save(wh));
    }

    // ── PUT update ───────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public WebhookDto update(@PathVariable Long id, @RequestBody WebhookRequest req) {
        WebhookConfig wh = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        applyRequest(wh, req);
        return toDto(repo.save(wh));
    }

    // ── DELETE ───────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        if (!repo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        repo.deleteById(id);
    }

    // ── POST test ping ────────────────────────────────────────────────────────

    @PostMapping("/{id}/test")
    public ResponseEntity<Void> testPing(@PathVariable Long id) {
        WebhookConfig wh = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!wh.isEnabled()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Webhook is disabled");
        }
        // Fire a synthetic test event
        webhookService.fireProjectStatusChanged(0L, "Test Project", "PLANNING", "ACTIVE");
        return ResponseEntity.ok().build();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void applyRequest(WebhookConfig wh, WebhookRequest req) {
        if (req.name()     != null) wh.setName(req.name());
        if (req.url()      != null) wh.setUrl(req.url());
        if (req.provider() != null) wh.setProvider(req.provider().toUpperCase());
        if (req.secret()   != null) wh.setSecret(req.secret().isBlank() ? null : req.secret());
        if (req.enabled()  != null) wh.setEnabled(req.enabled());
        if (req.events()   != null) wh.setEvents(req.events());
    }

    private WebhookDto toDto(WebhookConfig wh) {
        return new WebhookDto(
                wh.getId(),
                wh.getName(),
                wh.getUrl(),
                wh.getProvider(),
                wh.getSecret() != null ? "••••••••" : null,
                wh.isEnabled(),
                wh.getEvents(),
                wh.getCreatedAt() != null ? wh.getCreatedAt().toString() : null
        );
    }
}
