package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.SsoConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SsoConfigRepository extends JpaRepository<SsoConfig, Long> {

    Optional<SsoConfig> findByOrgId(Long orgId);
}
