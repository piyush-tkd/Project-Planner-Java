package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ScenarioOverride;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ScenarioOverrideRepository extends JpaRepository<ScenarioOverride, Long> {

    List<ScenarioOverride> findByScenarioId(Long scenarioId);
}
