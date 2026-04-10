package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ScenarioChange;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ScenarioChangeRepository extends JpaRepository<ScenarioChange, Long> {
    List<ScenarioChange> findByScenarioId(Long scenarioId);
    List<ScenarioChange> findByScenarioIdAndChangeType(Long scenarioId, String changeType);
}
