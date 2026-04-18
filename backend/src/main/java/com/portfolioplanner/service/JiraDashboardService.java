package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.JiraDashboard;
import com.portfolioplanner.domain.repository.JiraDashboardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class JiraDashboardService {

    private final JiraDashboardRepository repo;

    public List<JiraDashboard> listForUser(String username) {
        return repo.findByUsernameOrIsDefaultTrueOrderByUpdatedAtDesc(username);
    }

    public Optional<JiraDashboard> getById(Long id) {
        return repo.findById(id);
    }

    @Transactional
    public JiraDashboard create(String username, Map<String, String> body) {
        JiraDashboard dash = JiraDashboard.builder()
                .name(body.getOrDefault("name", "Untitled Dashboard"))
                .description(body.get("description"))
                .username(username)
                .isDefault(false)
                .widgetsJson(body.getOrDefault("widgetsJson", "[]"))
                .filtersJson(body.getOrDefault("filtersJson", "{}"))
                .build();
        return repo.save(dash);
    }

    @Transactional
    public Optional<JiraDashboard> update(Long id, Map<String, String> body) {
        return repo.findById(id).map(dash -> {
            if (body.containsKey("name")) dash.setName(body.get("name"));
            if (body.containsKey("description")) dash.setDescription(body.get("description"));
            if (body.containsKey("widgetsJson")) dash.setWidgetsJson(body.get("widgetsJson"));
            if (body.containsKey("filtersJson")) dash.setFiltersJson(body.get("filtersJson"));
            return repo.save(dash);
        });
    }

    @Transactional
    public Optional<JiraDashboard> delete(Long id) {
        return repo.findById(id).flatMap(dash -> {
            if (dash.isDefault()) {
                return Optional.empty();
            }
            repo.delete(dash);
            return Optional.of(dash);
        });
    }

    @Transactional
    public Optional<JiraDashboard> clone(Long id, String username) {
        return repo.findById(id).map(source -> {
            JiraDashboard copy = JiraDashboard.builder()
                    .name(source.getName() + " (Copy)")
                    .description(source.getDescription())
                    .username(username)
                    .isDefault(false)
                    .widgetsJson(source.getWidgetsJson())
                    .filtersJson(source.getFiltersJson())
                    .build();
            return repo.save(copy);
        });
    }
}
