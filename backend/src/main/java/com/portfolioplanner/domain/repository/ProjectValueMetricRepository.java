package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ProjectValueMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ProjectValueMetricRepository extends JpaRepository<ProjectValueMetric, Long> {
    List<ProjectValueMetric> findByProjectId(Long projectId);

    @Query("SELECT SUM(m.projectedValue) FROM ProjectValueMetric m WHERE m.project.id = :projectId")
    Double sumProjectedValueByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT SUM(m.capexAmount + m.opexAmount) FROM ProjectValueMetric m WHERE m.project.id = :projectId")
    Double sumTotalCostByProjectId(@Param("projectId") Long projectId);
}
