package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.SmartMappingSuggestion;
import com.portfolioplanner.service.SmartMappingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST endpoints for the Smart Mapping panel.
 *
 * <ul>
 *   <li>{@code GET  /api/smart-mapping/suggestions}       — list all suggestions (ADMIN)</li>
 *   <li>{@code GET  /api/smart-mapping/suggestions/pending} — list PENDING suggestions (ADMIN)</li>
 *   <li>{@code POST /api/smart-mapping/run}                — run the analysis (ADMIN)</li>
 *   <li>{@code POST /api/smart-mapping/{id}/resolve}       — resolve a suggestion (ADMIN)</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/smart-mapping")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SmartMappingController {

    private final SmartMappingService smartMappingService;

    /** Returns all suggestions, ordered by score descending. */
    @GetMapping("/suggestions")
    public ResponseEntity<List<SmartMappingSuggestion>> getAllSuggestions() {
        return ResponseEntity.ok(smartMappingService.getAllSuggestions());
    }

    /** Returns only PENDING suggestions. */
    @GetMapping("/suggestions/pending")
    public ResponseEntity<List<SmartMappingSuggestion>> getPendingSuggestions() {
        return ResponseEntity.ok(smartMappingService.getPendingSuggestions());
    }

    /**
     * Triggers a fresh smart-mapping analysis run.
     *
     * @return count of new suggestions created
     */
    @PostMapping("/run")
    public ResponseEntity<Map<String, Object>> runAnalysis() {
        log.info("SmartMappingController: analysis triggered");
        int count = smartMappingService.runAnalysis();
        return ResponseEntity.ok(Map.of("newSuggestions", count));
    }

    /**
     * Resolves a suggestion.
     *
     * @param id         suggestion id
     * @param body       must contain {@code "resolution"}: "LINKED" | "IGNORED"
     */
    @PostMapping("/{id}/resolve")
    public ResponseEntity<SmartMappingSuggestion> resolve(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String resolution = body.get("resolution");
        if (resolution == null || resolution.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        log.info("SmartMappingController: resolving suggestion {} as {}", id, resolution);
        SmartMappingSuggestion result = smartMappingService.resolve(id, resolution);
        return ResponseEntity.ok(result);
    }
}
