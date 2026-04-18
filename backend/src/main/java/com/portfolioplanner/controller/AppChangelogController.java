package com.portfolioplanner.controller;

import com.portfolioplanner.service.AppChangelogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/changelog")
@RequiredArgsConstructor
public class AppChangelogController {

    private final AppChangelogService service;

    /** Published entries — visible to all users. */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> published() {
        return ResponseEntity.ok(service.getPublished());
    }

    /** All entries including drafts — admin view. */
    @GetMapping("/all")
    public ResponseEntity<List<Map<String, Object>>> all() {
        return ResponseEntity.ok(service.getAll());
    }

    /** Count of published entries since a given ISO datetime (for "unread" badge). */
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Object>> unreadCount(
            @RequestParam(required = false) String since
    ) {
        return ResponseEntity.ok(Map.of("count", service.countUnreadSince(since)));
    }

    /** Create a new changelog entry (admin). */
    @PreAuthorize("hasRole('ADMIN')")   // S2.3
    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody ChangelogRequest req) {
        var entry = service.create(req.version(), req.title(), req.description(), req.changeType(), req.published());
        // Note: toMap helper moved to service; reconstruct here
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",          entry.getId());
        m.put("version",     entry.getVersion());
        m.put("title",       entry.getTitle());
        m.put("description", entry.getDescription());
        m.put("changeType",  entry.getChangeType());
        m.put("published",   entry.getPublished());
        m.put("createdAt",   entry.getCreatedAt() != null ? entry.getCreatedAt().toString() : null);
        return ResponseEntity.ok(m);
    }

    /** Update an existing entry (admin). */
    @PreAuthorize("hasRole('ADMIN')")   // S2.3
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> update(
            @PathVariable Long id,
            @RequestBody ChangelogRequest req
    ) {
        return service.update(id, req.version(), req.title(), req.description(), req.changeType(), req.published())
                .map(entry -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",          entry.getId());
                    m.put("version",     entry.getVersion());
                    m.put("title",       entry.getTitle());
                    m.put("description", entry.getDescription());
                    m.put("changeType",  entry.getChangeType());
                    m.put("published",   entry.getPublished());
                    m.put("createdAt",   entry.getCreatedAt() != null ? entry.getCreatedAt().toString() : null);
                    return ResponseEntity.ok(m);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /** Delete an entry (admin). */
    @PreAuthorize("hasRole('ADMIN')")   // S2.3
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    record ChangelogRequest(
            String version, String title, String description,
            String changeType, Boolean published
    ) {}
}
