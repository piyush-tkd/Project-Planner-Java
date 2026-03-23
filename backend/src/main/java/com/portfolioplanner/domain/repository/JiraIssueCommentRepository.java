package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraIssueComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface JiraIssueCommentRepository extends JpaRepository<JiraIssueComment, Long> {

    List<JiraIssueComment> findByIssueKeyOrderByCreatedAsc(String issueKey);

    List<JiraIssueComment> findByIssueKeyIn(List<String> issueKeys);

    @Modifying
    @Transactional
    @Query("DELETE FROM JiraIssueComment c WHERE c.issueKey = :issueKey")
    void deleteByIssueKey(String issueKey);
}
