package com.portfolioplanner.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolioplanner.domain.model.UserWidgetPreference;
import com.portfolioplanner.domain.repository.UserWidgetPreferenceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * Stores and retrieves per-user widget layout preferences (order + visibility)
 * for any page in the application.
 *
 * <p>Endpoints:
 * <ul>
 *   <li>{@code GET  /api/widget-preferences/{pageKey}} — load preferences for a page</li>
 *   <li>{@code PUT  /api/widget-preferences/{pageKey}} — save preferences for a page</li>
 * </ul>
 *
 * <p>The response/request body is a plain JSON object:
 * <pre>
 * {
 *   "order":  ["kpi", "trend", "throughput"],   // widget IDs in display order
 *   "hidden": ["throughput"]                     // widget IDs to hide
 * }
 * </pre>
 */
@RestController
@RequestMapping("/api/widget-preferences")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class UserWidgetPreferenceController {

    private final UserWidgetPreferenceRepository repo;
    private final ObjectMapper objectMapper;

    /** Returns the saved preferences for {@code pageKey}, or an empty object if none exist yet. */
    @GetMapping("/{pageKey}")
    public ResponseEntity<Map<String, Object>> get(
            @PathVariable String pageKey,
            Authentication auth) {
        String username = auth.getName();
        return repo.findByUsernameAndPageKey(username, pageKey)
                .map(pref -> {
                    try {
                        Map<String, Object> map = objectMapper.readValue(
                                pref.getPreferences(),
                                new TypeReference<>() {});
                        return ResponseEntity.ok(map);
                    } catch (Exception e) {
                        log.warn("Failed to parse widget preferences for {}/{}: {}",
                                username, pageKey, e.getMessage());
                        return ResponseEntity.ok(Collections.<String, Object>emptyMap());
                    }
                })
                .orElse(ResponseEntity.ok(Collections.emptyMap()));
    }

    /** Saves (upserts) the preferences for {@code pageKey}. */
    @PutMapping("/{pageKey}")
    public ResponseEntity<Void> put(
            @PathVariable String pageKey,
            @RequestBody Map<String, Object> preferences,
            Authentication auth) {
        String username = auth.getName();
        try {
            String json = objectMapper.writeValueAsString(preferences);
            UserWidgetPreference pref = repo
                    .findByUsernameAndPageKey(username, pageKey)
                    .orElseGet(() -> UserWidgetPreference.builder()
                            .username(username)
                            .pageKey(pageKey)
                            .build());
            pref.setPreferences(json);
            repo.save(pref);
        } catch (Exception e) {
            log.error("Failed to save widget preferences for {}/{}: {}",
                    username, pageKey, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
        return ResponseEntity.ok().build();
    }
}
