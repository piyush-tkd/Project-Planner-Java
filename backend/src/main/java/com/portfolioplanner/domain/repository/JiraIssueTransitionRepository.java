package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraIssueTransition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

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

    /**
     * Upsert using ON CONFLICT DO NOTHING to avoid duplicate key violations.
     * Safe to call multiple times for the same transition record.
     */
    @Modifying
    @Transactional
    @Query(value = """
        INSERT INTO jira_issue_transition
          (issue_key, from_status, to_status, author_name, transitioned_at)
        VALUES (:#{#t.issueKey}, :#{#t.fromStatus}, :#{#t.toStatus},
                :#{#t.authorName}, :#{#t.transitionedAt})
        ON CONFLICT ON CONSTRAINT uq_issue_transition DO NOTHING
        """, nativeQuery = true)
    void saveIfNotExists(@Param("t") JiraIssueTransition t);
}
