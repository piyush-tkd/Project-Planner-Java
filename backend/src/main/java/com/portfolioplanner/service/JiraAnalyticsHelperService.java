package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class JiraAnalyticsHelperService {

    private final JiraPodRepository podRepo;

    public List<String> resolveProjectKeys(String pods) {
        List<JiraPod> allPods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        if (pods != null && !pods.isBlank()) {
            try {
                List<Long> ids = Arrays.stream(pods.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(Long::parseLong)
                        .collect(Collectors.toList());
                allPods = allPods.stream()
                        .filter(p -> ids.contains(p.getId()))
                        .collect(Collectors.toList());
            } catch (NumberFormatException ignored) { /* return all pods */ }
        }
        return allPods.stream()
                .flatMap(p -> p.getBoards().stream())
                .map(b -> b.getJiraProjectKey())
                .distinct()
                .collect(Collectors.toList());
    }
}
