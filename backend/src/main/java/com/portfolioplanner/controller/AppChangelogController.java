package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AppChangelog;
import com.portfolioplanner.domain.repository.AppChangelogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/changelog")
@RequiredArgsConstructor
public class AppChangelogController {

    private final AppChangelogRepository repo;

    /** Published entries — visible to all users. */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> published() {
        return ResponseEntity.ok(
                repo.findByPublishedTrueOrderByCreatedAtDesc()
                    .stream().map(this::toMap).collect(Collectors.toList())
        );
    }

    /** All entries including drafts — admin view. */
    @GetMapping("/all")
    public ResponseEntity<List<Map<String, Object>>> all() {
        return ResponseEntity.ok(
                repo.findAllByOrderByCreatedAtDesc()
                    .stream().map(this::toMap).collect(Collectors.toList())
        );
    }

    /** Count of published entries since a given ISO datetime (for "unread" badge). */
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Object>> unreadCount(
            @RequestParam(required = false) String since
    ) {
        long count = 0;
        if (since != null) {
            try {
                LocalDateTime dt = LocalDateTime.parse(since);
                count = repo.countByPublishedTrueAndCreatedAtAfter(dt);
            } catch (Exception ignored) {}
        }
        return ResponseEntity.ok(Map.of("count", count));
    }

    /** Create a new changelog entry (admin). */
    @PreAuthorize("hasRole('ADMIN')")   // S2.3
    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody ChangelogRequest req) {
        AppChangelog entry = AppChangelog.builder()
                .version(req.version())
                .title(req.title())
                .description(req.description())
                .changeType(req.changeType() != null ? req.changeType() : "feature")
                .published(req.published() != null ? req.published() : false)
                .build();
        return ResponseEntity.ok(toMap(repo.save(entry)));
    }

    /** Update an existing entry (admin). */
    @PreAuthorize("hasRole('ADMIN')")   // S2.3
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> update(
            @PathVariable Long id,
            @RequestBody ChangelogRequest req
    ) {
        return repo.findById(id).map(entry -> {
            if (req.version()     != null) entry.setVersion(req.version());
            if (req.title()       != null) entry.setTitle(req.title());
            if (req.description() != null) entry.setDescription(req.description());
            if (req.changeType()  != null) entry.setChangeType(req.changeType());
            if (req.published()   != null) entry.setPublished(req.published());
            return ResponseEntity.ok(toMap(repo.save(entry)));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Delete an entry (admin). */
    @PreAuthorize("hasRole('ADMIN')")   // S2.3
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private Map<String, Object> toMap(AppChangelog e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",          e.getId());
        m.put("version",     e.getVersion());
        m.put("title",       e.getTitle());
        m.put("description", e.getDescription());
        m.put("changeType",  e.getChangeType());
        m.put("published",   e.getPublished());
        m.put("createdAt",   e.getCreatedAt() != null ? e.getCreatedAt().toString() : null);
        return m;
    }

    record ChangelogRequest(
            String version, String title, String description,
            String changeType, Boolean published
    ) {}
}
