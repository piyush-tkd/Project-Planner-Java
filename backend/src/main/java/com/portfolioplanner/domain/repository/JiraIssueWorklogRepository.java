package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraIssueWorklog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface JiraIssueWorklogRepository extends JpaRepository<JiraIssueWorklog, Long> {

    List<JiraIssueWorklog> findByIssueKey(String issueKey);

    List<JiraIssueWorklog> findByIssueKeyIn(List<String> issueKeys);

    Optional<JiraIssueWorklog> findByWorklogJiraId(String worklogJiraId);

    /** Worklogs for specified issues within a date range */
    @Query("SELECT w FROM JiraIssueWorklog w WHERE w.issueKey IN :keys " +
           "AND w.started >= :since")
    List<JiraIssueWorklog> findByIssueKeysAndStartedSince(@Param("keys") List<String> issueKeys,
                                                           @Param("since") LocalDateTime since);

    /** Total hours logged by author across issues */
    @Query("SELECT w.authorDisplayName, SUM(w.timeSpentSeconds) FROM JiraIssueWorklog w " +
           "WHERE w.issueKey IN :keys GROUP BY w.authorDisplayName")
    List<Object[]> sumTimeByAuthor(@Param("keys") List<String> issueKeys);

    @Modifying
    @Query("DELETE FROM JiraIssueWorklog w WHERE w.issueKey = :key")
    void deleteByIssueKey(@Param("key") String issueKey);

    @Modifying
    @Query("DELETE FROM JiraIssueWorklog w WHERE w.issueKey IN :keys")
    void deleteByIssueKeyIn(@Param("keys") List<String> issueKeys);

    /** Worklogs in a date range (month boundaries) */
    @Query("SELECT w FROM JiraIssueWorklog w WHERE w.started >= :from AND w.started < :to")
    List<JiraIssueWorklog> findByStartedBetween(@Param("from") LocalDateTime from,
                                                  @Param("to") LocalDateTime to);

    /** Worklogs in date range for specific project keys */
    @Query("SELECT w FROM JiraIssueWorklog w WHERE w.started >= :from AND w.started < :to " +
           "AND w.issueKey IN (SELECT i.issueKey FROM JiraSyncedIssue i WHERE i.projectKey IN :keys)")
    List<JiraIssueWorklog> findByProjectKeysAndDateRange(@Param("keys") List<String> projectKeys,
                                                          @Param("from") LocalDateTime from,
                                                          @Param("to") LocalDateTime to);

    /** Sum hours by author for worklogs in date range and project keys */
    @Query("SELECT w.authorDisplayName, SUM(w.timeSpentSeconds) FROM JiraIssueWorklog w " +
           "WHERE w.started >= :from AND w.started < :to " +
           "AND w.issueKey IN (SELECT i.issueKey FROM JiraSyncedIssue i WHERE i.projectKey IN :keys) " +
           "GROUP BY w.authorDisplayName")
    List<Object[]> sumTimeByAuthorAndDateRange(@Param("keys") List<String> projectKeys,
                                                @Param("from") LocalDateTime from,
                                                @Param("to") LocalDateTime to);
}
