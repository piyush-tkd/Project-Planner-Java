package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraResourceMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JiraResourceMappingRepository extends JpaRepository<JiraResourceMapping, Long> {

    Optional<JiraResourceMapping> findByJiraDisplayName(String jiraDisplayName);

    /**
     * Fetch all mappings with their optional Resource in a single LEFT JOIN.
     * resource is now LAZY; without the JOIN FETCH every getResource() call
     * inside JiraResourceMappingService would trigger a separate SELECT.
     */
    @Query("SELECT rm FROM JiraResourceMapping rm LEFT JOIN FETCH rm.resource " +
           "ORDER BY rm.jiraDisplayName ASC")
    List<JiraResourceMapping> findAllByOrderByJiraDisplayNameAsc();

    List<JiraResourceMapping> findByMappingType(String mappingType);

    /**
     * Unconfirmed mappings — resource fetched eagerly to avoid N+1 during the
     * auto-confirmation loop in JiraResourceMappingService.
     */
    @Query("SELECT rm FROM JiraResourceMapping rm LEFT JOIN FETCH rm.resource " +
           "WHERE rm.confirmed = false")
    List<JiraResourceMapping> findByConfirmedFalse();

    List<JiraResourceMapping> findByResourceId(Long resourceId);

    long countByMappingType(String mappingType);

    long countByConfirmedTrue();
}
