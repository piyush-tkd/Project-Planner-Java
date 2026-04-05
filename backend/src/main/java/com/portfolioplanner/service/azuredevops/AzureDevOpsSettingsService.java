package com.portfolioplanner.service.azuredevops;

import com.portfolioplanner.domain.model.AzureDevOpsSettings;
import com.portfolioplanner.domain.repository.AzureDevOpsSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AzureDevOpsSettingsService {

    private final AzureDevOpsSettingsRepository repo;

    @Transactional(readOnly = true)
    public Optional<AzureDevOpsSettings> get() {
        return repo.findById(1L);
    }

    public boolean isConfigured() {
        return get().map(AzureDevOpsSettings::isConfigured).orElse(false);
    }

    @Transactional
    public AzureDevOpsSettings save(String orgUrl, String projectName,
                                    String pat, String repositories) {
        AzureDevOpsSettings s = repo.findById(1L).orElseGet(AzureDevOpsSettings::new);
        s.setId(1L);
        s.setOrgUrl(orgUrl             != null ? orgUrl.trim()             : "");
        s.setProjectName(projectName   != null ? projectName.trim()        : "");
        s.setPersonalAccessToken(pat   != null ? pat.trim()                : "");
        s.setRepositories(repositories != null ? repositories.trim()       : "");
        s.setUpdatedAt(LocalDateTime.now());
        return repo.save(s);
    }
}
