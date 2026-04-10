package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ScenarioSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ScenarioSnapshotRepository extends JpaRepository<ScenarioSnapshot, Long> {
    List<ScenarioSnapshot> findByScenarioIdOrderBySnapshotDateAsc(Long scenarioId);
}
