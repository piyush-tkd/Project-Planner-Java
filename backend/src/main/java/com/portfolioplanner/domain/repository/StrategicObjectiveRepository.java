package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.StrategicObjective;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StrategicObjectiveRepository extends JpaRepository<StrategicObjective, Long> {
    List<StrategicObjective> findAllByOrderByCreatedAtDesc();
    List<StrategicObjective> findByStatusOrderByCreatedAtDesc(String status);
    List<StrategicObjective> findByQuarterOrderByCreatedAtDesc(String quarter);
}
