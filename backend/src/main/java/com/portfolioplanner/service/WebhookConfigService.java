package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.WebhookConfig;
import com.portfolioplanner.domain.repository.WebhookConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WebhookConfigService {

    private final WebhookConfigRepository repo;
    private final WebhookService webhookService;

    public List<WebhookConfig> listAll() {
        return repo.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public WebhookConfig create(WebhookRequest req) {
        WebhookConfig wh = new WebhookConfig();
        applyRequest(wh, req);
        return repo.save(wh);
    }

    @Transactional
    public WebhookConfig update(Long id, WebhookRequest req) {
        WebhookConfig wh = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        applyRequest(wh, req);
        return repo.save(wh);
    }

    @Transactional
    public void delete(Long id) {
        if (!repo.existsById(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        repo.deleteById(id);
    }

    /** Fires a synthetic test ping. Throws 404 if not found, 422 if disabled. */
    public void testPing(Long id) {
        WebhookConfig wh = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!wh.isEnabled()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Webhook is disabled");
        }
        webhookService.fireProjectStatusChanged(0L, "Test Project", "PLANNING", "ACTIVE");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void applyRequest(WebhookConfig wh, WebhookRequest req) {
        if (req.name()     != null) wh.setName(req.name());
        if (req.url()      != null) wh.setUrl(req.url());
        if (req.provider() != null) wh.setProvider(req.provider().toUpperCase());
        if (req.secret()   != null) wh.setSecret(req.secret().isBlank() ? null : req.secret());
        if (req.enabled()  != null) wh.setEnabled(req.enabled());
        if (req.events()   != null) wh.setEvents(req.events());
    }

    public record WebhookRequest(
            String  name,
            String  url,
            String  provider,
            String  secret,
            Boolean enabled,
            String  events
    ) {}
}
