package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.AppChangelog;
import com.portfolioplanner.domain.repository.AppChangelogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AppChangelogService {

    private final AppChangelogRepository repo;

    public List<Map<String, Object>> getPublished() {
        return repo.findByPublishedTrueOrderByCreatedAtDesc().stream()
                .map(this::toMap).toList();
    }

    public List<Map<String, Object>> getAll() {
        return repo.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toMap).toList();
    }

    public long countUnreadSince(String since) {
        if (since == null || since.isBlank()) return 0;
        try {
            LocalDateTime dt = LocalDateTime.parse(since);
            return repo.countByPublishedTrueAndCreatedAtAfter(dt);
        } catch (Exception e) {
            return 0;
        }
    }

    @Transactional
    public AppChangelog create(String version, String title, String description,
                                String changeType, Boolean published) {
        AppChangelog entry = AppChangelog.builder()
                .version(version)
                .title(title)
                .description(description)
                .changeType(changeType != null ? changeType : "feature")
                .published(published != null ? published : false)
                .build();
        return repo.save(entry);
    }

    @Transactional
    public Optional<AppChangelog> update(Long id, String version, String title, String description,
                                          String changeType, Boolean published) {
        return repo.findById(id).map(entry -> {
            if (version    != null) entry.setVersion(version);
            if (title      != null) entry.setTitle(title);
            if (description != null) entry.setDescription(description);
            if (changeType != null) entry.setChangeType(changeType);
            if (published  != null) entry.setPublished(published);
            return repo.save(entry);
        });
    }

    @Transactional
    public void delete(Long id) {
        if (!repo.existsById(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Changelog entry not found");
        repo.deleteById(id);
    }

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
}
