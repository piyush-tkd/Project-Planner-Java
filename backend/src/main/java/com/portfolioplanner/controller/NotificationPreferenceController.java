package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.NotificationPreference;
import com.portfolioplanner.domain.repository.NotificationPreferenceRepository;
import com.portfolioplanner.dto.NotificationPreferenceDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * REST API for per-user notification preferences.
 *
 * GET  /api/notification-preferences        → fetch current user's preferences (create defaults on first call)
 * PUT  /api/notification-preferences        → update (upsert) current user's preferences
 */
@RestController
@RequestMapping("/api/notification-preferences")
@RequiredArgsConstructor
public class NotificationPreferenceController {

    private final NotificationPreferenceRepository repo;

    // ── GET (or initialise) ───────────────────────────────────────────────────

    @GetMapping
    public NotificationPreferenceDto get(Authentication auth) {
        String username = auth != null ? auth.getName() : "anonymous";
        NotificationPreference pref = repo.findByUsername(username)
                .orElseGet(() -> createDefaults(username));
        return toDto(pref);
    }

    // ── PUT (upsert) ──────────────────────────────────────────────────────────

    @PutMapping
    public ResponseEntity<NotificationPreferenceDto> upsert(
            @RequestBody NotificationPreferenceDto dto,
            Authentication auth) {

        String username = auth != null ? auth.getName() : "anonymous";
        NotificationPreference pref = repo.findByUsername(username)
                .orElseGet(() -> {
                    NotificationPreference p = new NotificationPreference();
                    p.setUsername(username);
                    return p;
                });

        applyDto(pref, dto);
        return ResponseEntity.ok(toDto(repo.save(pref)));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private NotificationPreference createDefaults(String username) {
        NotificationPreference p = new NotificationPreference();
        p.setUsername(username);
        return repo.save(p);
    }

    private void applyDto(NotificationPreference p, NotificationPreferenceDto dto) {
        p.setOnStatusChange(dto.isOnStatusChange());
        p.setOnRiskAdded(dto.isOnRiskAdded());
        p.setOnCommentMention(dto.isOnCommentMention());
        p.setOnSprintStart(dto.isOnSprintStart());
        p.setOnAutomationFired(dto.isOnAutomationFired());
        p.setOnTargetDatePassed(dto.isOnTargetDatePassed());
        p.setEmailEnabled(dto.isEmailEnabled());
        p.setEmailDigest(dto.getEmailDigest() != null ? dto.getEmailDigest() : "NONE");
        p.setQuietStartHour(dto.getQuietStartHour());
        p.setQuietEndHour(dto.getQuietEndHour());
    }

    private NotificationPreferenceDto toDto(NotificationPreference p) {
        return new NotificationPreferenceDto(
                p.getId(),
                p.getUsername(),
                p.isOnStatusChange(),
                p.isOnRiskAdded(),
                p.isOnCommentMention(),
                p.isOnSprintStart(),
                p.isOnAutomationFired(),
                p.isOnTargetDatePassed(),
                p.isEmailEnabled(),
                p.getEmailDigest(),
                p.getQuietStartHour(),
                p.getQuietEndHour()
        );
    }
}
