package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.AiImpactMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AiImpactMetricRepository extends JpaRepository<AiImpactMetric, Long> {

    List<AiImpactMetric> findByMetricTypeOrderByPeriodAsc(String metricType);

    List<AiImpactMetric> findByMetricTypeAndPodNameOrderByPeriodAsc(String metricType, String podName);

    @Query("SELECT DISTINCT m.podName FROM AiImpactMetric m ORDER BY m.podName")
    List<String> findDistinctPodNames();

    @Query("SELECT DISTINCT m.period FROM AiImpactMetric m ORDER BY m.period ASC")
    List<String> findDistinctPeriods();

    @Query("""
        SELECT m FROM AiImpactMetric m
        WHERE m.metricType = :type
          AND (:pod IS NULL OR m.podName = :pod)
        ORDER BY m.period ASC, m.podName ASC
        """)
    List<AiImpactMetric> findByTypeAndOptionalPod(
            @Param("type") String type,
            @Param("pod")  String pod);
}
