package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraIssueLabel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JiraIssueLabelRepository extends JpaRepository<JiraIssueLabel, Long> {

    List<JiraIssueLabel> findByIssueKey(String issueKey);

    List<JiraIssueLabel> findByIssueKeyIn(List<String> issueKeys);

    @Modifying
    @Query("DELETE FROM JiraIssueLabel l WHERE l.issueKey = :key")
    void deleteByIssueKey(@Param("key") String issueKey);

    @Modifying
    @Query("DELETE FROM JiraIssueLabel l WHERE l.issueKey IN :keys")
    void deleteByIssueKeyIn(@Param("keys") List<String> issueKeys);

    /** Distinct labels for issues in given projects */
    @Query("SELECT DISTINCT l.label FROM JiraIssueLabel l WHERE l.issueKey IN " +
           "(SELECT i.issueKey FROM JiraSyncedIssue i WHERE i.projectKey = :projectKey)")
    List<String> findDistinctLabelsByProjectKey(@Param("projectKey") String projectKey);
}
