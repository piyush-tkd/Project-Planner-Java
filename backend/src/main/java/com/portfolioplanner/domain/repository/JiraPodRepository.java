package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraPod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface JiraPodRepository extends JpaRepository<JiraPod, Long> {

    /**
     * All enabled PODs with their boards fetched in a single LEFT JOIN.
     * boards is now LAZY, so the JOIN FETCH prevents N+1 on every caller
     * that iterates pod.getBoards().
     */
    @Query("SELECT DISTINCT p FROM JiraPod p LEFT JOIN FETCH p.boards " +
           "WHERE p.enabled = true ORDER BY p.sortOrder ASC, p.podDisplayName ASC")
    List<JiraPod> findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();

    /**
     * All PODs (enabled + disabled) for the settings page — boards fetched in the same query.
     */
    @Query("SELECT DISTINCT p FROM JiraPod p LEFT JOIN FETCH p.boards " +
           "ORDER BY p.sortOrder ASC, p.podDisplayName ASC")
    List<JiraPod> findAllByOrderBySortOrderAscPodDisplayNameAsc();

    /**
     * Single POD by id with boards eagerly fetched.
     * Use this instead of findById() whenever boards will be accessed,
     * otherwise Hibernate throws LazyInitializationException after the session closes.
     */
    @Query("SELECT p FROM JiraPod p LEFT JOIN FETCH p.boards WHERE p.id = :id")
    Optional<JiraPod> findByIdWithBoards(@Param("id") Long id);
}
