package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.Scenario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ScenarioRepository extends JpaRepository<Scenario, Long> {
    List<Scenario> findByStatus(String status);
    List<Scenario> findByOrderByCreatedAtDesc();
}
