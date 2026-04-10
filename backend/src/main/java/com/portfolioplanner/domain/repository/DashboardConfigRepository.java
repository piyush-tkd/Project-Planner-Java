package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.DashboardConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DashboardConfigRepository extends JpaRepository<DashboardConfig, Long> {
    List<DashboardConfig> findByOwnerUsernameOrderByUpdatedAtDesc(String username);
    List<DashboardConfig> findByIsTemplateTrue();
    Optional<DashboardConfig> findByOwnerUsernameAndIsDefaultTrue(String username);
}
