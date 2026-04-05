package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.AzureDevOpsSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AzureDevOpsSettingsRepository extends JpaRepository<AzureDevOpsSettings, Long> {
}
