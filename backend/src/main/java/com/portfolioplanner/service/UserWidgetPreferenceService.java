package com.portfolioplanner.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolioplanner.domain.model.UserWidgetPreference;
import com.portfolioplanner.domain.repository.UserWidgetPreferenceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class UserWidgetPreferenceService {

    private final UserWidgetPreferenceRepository repo;
    private final ObjectMapper objectMapper;

    /**
     * Returns parsed preferences for the given user + page, or an empty map if none exist.
     */
    public Map<String, Object> get(String username, String pageKey) {
        Optional<UserWidgetPreference> pref = repo.findByUsernameAndPageKey(username, pageKey);
        if (pref.isEmpty()) return Collections.emptyMap();
        try {
            return objectMapper.readValue(pref.get().getPreferences(), new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse widget preferences for {}/{}: {}", username, pageKey, e.getMessage());
            return Collections.emptyMap();
        }
    }

    /**
     * Upserts the preferences for the given user + page.
     *
     * @throws RuntimeException if serialisation fails
     */
    @Transactional
    public void save(String username, String pageKey, Map<String, Object> preferences) {
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
            log.error("Failed to save widget preferences for {}/{}: {}", username, pageKey, e.getMessage());
            throw new RuntimeException("Failed to persist widget preferences", e);
        }
    }
}
