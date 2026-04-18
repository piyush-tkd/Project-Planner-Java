package com.portfolioplanner.controller;

import com.portfolioplanner.dto.NotificationPreferenceDto;
import com.portfolioplanner.service.NotificationPreferenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * REST API for per-user notification preferences.
 *
 * GET  /api/notification-preferences        → fetch current user's preferences (create defaults on first call)
 * PUT  /api/notification-preferences        → update (upsert) current user's preferences
 */
@RestController
@RequestMapping("/api/notification-preferences")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class NotificationPreferenceController {

    private final NotificationPreferenceService service;

    @GetMapping
    public NotificationPreferenceDto get(Authentication auth) {
        String username = auth != null ? auth.getName() : "anonymous";
        return service.get(username);
    }

    @PutMapping
    public ResponseEntity<NotificationPreferenceDto> upsert(
            @RequestBody NotificationPreferenceDto dto,
            Authentication auth) {
        String username = auth != null ? auth.getName() : "anonymous";
        return ResponseEntity.ok(service.upsert(username, dto));
    }
}
