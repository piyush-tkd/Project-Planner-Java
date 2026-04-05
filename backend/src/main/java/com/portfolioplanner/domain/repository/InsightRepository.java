package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.Insight;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface InsightRepository extends JpaRepository<Insight, Long> {

    /** All unacknowledged insights, highest severity first, most recent first. */
    @Query("""
        SELECT i FROM Insight i
        WHERE i.acknowledged = false
        ORDER BY
          CASE i.severity WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
          i.detectedAt DESC
    """)
    List<Insight> findAllUnacknowledged();

    /** All insights (for history view). */
    @Query("SELECT i FROM Insight i ORDER BY i.detectedAt DESC")
    List<Insight> findAllOrderByDetectedAtDesc();

    /** Delete unacknowledged insights of a given type before re-running a detector. */
    @Modifying
    @Transactional
    @Query("DELETE FROM Insight i WHERE i.insightType = :type AND i.acknowledged = false")
    void deleteUnacknowledgedByType(@Param("type") String type);

    /** Count by severity for summary cards. */
    long countBySeverityAndAcknowledgedFalse(String severity);
}
