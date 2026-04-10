package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.SprintRetroSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SprintRetroRepository extends JpaRepository<SprintRetroSummary, Long> {

    /** All retros, most recently completed sprint first (falls back to generatedAt for old rows). */
    @Query("SELECT r FROM SprintRetroSummary r ORDER BY " +
           "CASE WHEN r.sprintEndDate IS NOT NULL THEN r.sprintEndDate ELSE r.generatedAt END DESC")
    List<SprintRetroSummary> findAllByOrderByGeneratedAtDesc();

    /** Project retros ordered by actual sprint end date (newest sprint first). */
    @Query("SELECT r FROM SprintRetroSummary r WHERE r.projectKey = :key ORDER BY " +
           "CASE WHEN r.sprintEndDate IS NOT NULL THEN r.sprintEndDate ELSE r.generatedAt END DESC")
    List<SprintRetroSummary> findByProjectKeyOrderByGeneratedAtDesc(@Param("key") String projectKey);

    Optional<SprintRetroSummary> findBySprintJiraId(Long sprintJiraId);

    /**
     * Retros for a project whose sprint ended before the given cutoff, ordered by sprint end date
     * descending — used to find the "previous sprint" for velocity delta calculation.
     */
    @Query("SELECT r FROM SprintRetroSummary r WHERE r.projectKey = :key " +
           "AND r.sprintJiraId <> :excludeSprintId " +
           "AND (r.sprintEndDate IS NULL OR r.sprintEndDate < :before) " +
           "ORDER BY CASE WHEN r.sprintEndDate IS NOT NULL THEN r.sprintEndDate ELSE r.generatedAt END DESC")
    List<SprintRetroSummary> findPreviousForVelocity(
            @Param("key") String projectKey,
            @Param("excludeSprintId") Long excludeSprintId,
            @Param("before") LocalDateTime before);
}
