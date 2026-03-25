package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.Resource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResourceRepository extends JpaRepository<Resource, Long> {

    List<Resource> findByActiveTrue();

    List<Resource> findByActiveTrueAndCountsInCapacityTrue();

    java.util.Optional<Resource> findByNameIgnoreCase(String name);

    /** All resources that have a Jira display name mapped */
    List<Resource> findByJiraDisplayNameIsNotNull();

    /** Check if a Jira display name is already mapped to a resource */
    java.util.Optional<Resource> findByJiraDisplayName(String jiraDisplayName);
}
