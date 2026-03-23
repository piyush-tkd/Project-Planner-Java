package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraIssueTransition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JiraIssueTransitionRepository extends JpaRepository<JiraIssueTransition, Long> {

    List<JiraIssueTransition> findByIssueKeyOrderByTransitionedAtAsc(String issueKey);

    List<JiraIssueTransition> findByIssueKeyIn(List<String> issueKeys);

    @Modifying
    @Query("DELETE FROM JiraIssueTransition t WHERE t.issueKey = :key")
    void deleteByIssueKey(@Param("key") String issueKey);

    @Modifying
    @Query("DELETE FROM JiraIssueTransition t WHERE t.issueKey IN :keys")
    void deleteByIssueKeyIn(@Param("keys") List<String> issueKeys);
}
