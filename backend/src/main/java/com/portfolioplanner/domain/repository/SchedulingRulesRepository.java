package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.SchedulingRules;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SchedulingRulesRepository extends JpaRepository<SchedulingRules, Long> {
    Optional<SchedulingRules> findByProjectId(Long projectId);
}
