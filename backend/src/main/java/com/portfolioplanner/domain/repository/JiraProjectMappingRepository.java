package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraProjectMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JiraProjectMappingRepository extends JpaRepository<JiraProjectMapping, Long> {

    List<JiraProjectMapping> findByActiveTrueOrderByJiraProjectKey();

    List<JiraProjectMapping> findByProjectId(Long projectId);

    Optional<JiraProjectMapping> findByProjectIdAndJiraProjectKey(Long projectId, String jiraProjectKey);

    List<JiraProjectMapping> findByJiraProjectKey(String jiraProjectKey);
}
