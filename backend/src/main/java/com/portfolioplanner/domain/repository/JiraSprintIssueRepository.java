package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraSprintIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JiraSprintIssueRepository extends JpaRepository<JiraSprintIssue, Long> {

    List<JiraSprintIssue> findBySprintJiraId(Long sprintJiraId);

    List<JiraSprintIssue> findBySprintJiraIdIn(List<Long> sprintJiraIds);

    List<JiraSprintIssue> findByIssueKey(String issueKey);

    @Modifying
    @Query("DELETE FROM JiraSprintIssue si WHERE si.sprintJiraId = :sprintId")
    void deleteBySprintJiraId(@Param("sprintId") Long sprintJiraId);

    @Modifying
    @Query("DELETE FROM JiraSprintIssue si WHERE si.issueKey IN :keys")
    void deleteByIssueKeyIn(@Param("keys") List<String> issueKeys);
}
