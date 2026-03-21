package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.NlpQueryLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface NlpQueryLogRepository extends JpaRepository<NlpQueryLog, Long> {
    List<NlpQueryLog> findTop20ByUserIdOrderByCreatedAtDesc(Long userId);
    List<NlpQueryLog> findTop100ByOrderByCreatedAtDesc();

    // ── Learner queries ──

    /** Low-confidence or UNKNOWN queries for review */
    @Query("SELECT q FROM NlpQueryLog q WHERE q.confidence < 0.75 OR q.intent = 'UNKNOWN' ORDER BY q.createdAt DESC")
    List<NlpQueryLog> findLowConfidenceQueries();

    /** Queries that got negative feedback */
    List<NlpQueryLog> findByUserRatingOrderByCreatedAtDesc(Short userRating);

    /** All queries ordered by creation (for full log view) */
    List<NlpQueryLog> findAllByOrderByCreatedAtDesc();

    /** Count queries by intent */
    @Query("SELECT q.intent, COUNT(q) FROM NlpQueryLog q GROUP BY q.intent ORDER BY COUNT(q) DESC")
    List<Object[]> countByIntent();

    /** Count queries by resolved_by strategy */
    @Query("SELECT q.resolvedBy, COUNT(q) FROM NlpQueryLog q GROUP BY q.resolvedBy ORDER BY COUNT(q) DESC")
    List<Object[]> countByStrategy();

    /** Average confidence per strategy */
    @Query("SELECT q.resolvedBy, AVG(q.confidence), COUNT(q) FROM NlpQueryLog q GROUP BY q.resolvedBy")
    List<Object[]> avgConfidenceByStrategy();
}
