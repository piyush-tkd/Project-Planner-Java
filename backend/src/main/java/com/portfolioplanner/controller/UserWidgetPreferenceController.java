package com.portfolioplanner.controller;

import com.portfolioplanner.service.UserWidgetPreferenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Stores and retrieves per-user widget layout preferences (order + visibility)
 * for any page in the application.
 *
 * GET  /api/widget-preferences/{pageKey} — load preferences for a page
 * PUT  /api/widget-preferences/{pageKey} — save preferences for a page
 */
@RestController
@RequestMapping("/api/widget-preferences")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class UserWidgetPreferenceController {

    private final UserWidgetPreferenceService userWidgetPreferenceService;

    @GetMapping("/{pageKey}")
    public ResponseEntity<Map<String, Object>> get(
            @PathVariable String pageKey,
            Authentication auth) {
        return ResponseEntity.ok(userWidgetPreferenceService.get(auth.getName(), pageKey));
    }

    @PutMapping("/{pageKey}")
    public ResponseEntity<Void> put(
            @PathVariable String pageKey,
            @RequestBody Map<String, Object> preferences,
            Authentication auth) {
        try {
            userWidgetPreferenceService.save(auth.getName(), pageKey, preferences);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            log.error("Widget preference save failed for {}/{}", auth.getName(), pageKey, e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
