package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraResourceMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JiraResourceMappingRepository extends JpaRepository<JiraResourceMapping, Long> {

    Optional<JiraResourceMapping> findByJiraDisplayName(String jiraDisplayName);

    List<JiraResourceMapping> findAllByOrderByJiraDisplayNameAsc();

    List<JiraResourceMapping> findByMappingType(String mappingType);

    List<JiraResourceMapping> findByConfirmedFalse();

    List<JiraResourceMapping> findByResourceId(Long resourceId);

    long countByMappingType(String mappingType);

    long countByConfirmedTrue();
}
