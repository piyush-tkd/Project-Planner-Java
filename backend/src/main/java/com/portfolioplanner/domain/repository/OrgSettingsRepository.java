package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.OrgSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrgSettingsRepository extends JpaRepository<OrgSettings, Long> {
    Optional<OrgSettings> findByOrgId(Long orgId);
}
