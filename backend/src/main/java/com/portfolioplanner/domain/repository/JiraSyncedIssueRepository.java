package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraSyncedIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface JiraSyncedIssueRepository extends JpaRepository<JiraSyncedIssue, Long> {

    Optional<JiraSyncedIssue> findByIssueKey(String issueKey);

    List<JiraSyncedIssue> findByProjectKey(String projectKey);

    List<JiraSyncedIssue> findByProjectKeyIn(List<String> projectKeys);

    // ── Analytics queries ────────────────────────────────────────────────

    /** Resolved issues in a date range for given project keys */
    @Query("SELECT i FROM JiraSyncedIssue i WHERE i.projectKey IN :keys " +
           "AND i.resolutionDate >= :since")
    List<JiraSyncedIssue> findResolvedSince(@Param("keys") List<String> projectKeys,
                                             @Param("since") LocalDateTime since);

    /** Created issues in a date range for given project keys */
    @Query("SELECT i FROM JiraSyncedIssue i WHERE i.projectKey IN :keys " +
           "AND i.createdAt >= :since")
    List<JiraSyncedIssue> findCreatedSince(@Param("keys") List<String> projectKeys,
                                            @Param("since") LocalDateTime since);

    /** All open issues (not Done) for given project keys */
    @Query("SELECT i FROM JiraSyncedIssue i WHERE i.projectKey IN :keys " +
           "AND i.statusCategory <> 'done'")
    List<JiraSyncedIssue> findOpenByProjectKeys(@Param("keys") List<String> projectKeys);

    /** Count issues by project key */
    @Query("SELECT i.projectKey, COUNT(i) FROM JiraSyncedIssue i " +
           "WHERE i.projectKey IN :keys GROUP BY i.projectKey")
    List<Object[]> countByProjectKey(@Param("keys") List<String> projectKeys);

    /** Delete all issues for a project key (for full re-sync) */
    @Modifying
    @Query("DELETE FROM JiraSyncedIssue i WHERE i.projectKey = :key")
    void deleteByProjectKey(@Param("key") String projectKey);

    /** Last synced time for a project */
    @Query("SELECT MAX(i.syncedAt) FROM JiraSyncedIssue i WHERE i.projectKey = :key")
    Optional<LocalDateTime> findLastSyncedAt(@Param("key") String projectKey);

    /** Issues belonging to a specific sprint (by Jira sprint ID) */
    @Query("SELECT i FROM JiraSyncedIssue i WHERE i.sprintId = :sprintId")
    List<JiraSyncedIssue> findBySprintId(@Param("sprintId") Long sprintId);

    /** Issues belonging to any of the given sprint IDs */
    @Query("SELECT i FROM JiraSyncedIssue i WHERE i.sprintId IN :sprintIds")
    List<JiraSyncedIssue> findBySprintIdIn(@Param("sprintIds") List<Long> sprintIds);

    /** Backlog issues: no sprint assigned, not Done, for given project keys */
    @Query("SELECT COUNT(i) FROM JiraSyncedIssue i WHERE i.projectKey IN :keys " +
           "AND (i.sprintId IS NULL OR i.sprintState = 'future') " +
           "AND i.statusCategory <> 'done'")
    long countBacklogByProjectKeys(@Param("keys") List<String> projectKeys);

    /** Issues in active sprints for given project keys */
    @Query("SELECT i FROM JiraSyncedIssue i WHERE i.projectKey IN :keys " +
           "AND i.sprintState = 'active'")
    List<JiraSyncedIssue> findActiveSprintIssuesByProjectKeys(@Param("keys") List<String> projectKeys);

    /** Find by issue keys */
    List<JiraSyncedIssue> findByIssueKeyIn(List<String> issueKeys);

    /** Resolved issues with resolution date in range, not subtask/epic */
    @Query("SELECT i FROM JiraSyncedIssue i WHERE i.projectKey IN :keys " +
           "AND i.statusCategory = 'done' " +
           "AND i.resolutionDate >= :since " +
           "AND i.subtask = false " +
           "AND LOWER(i.issueType) NOT IN ('epic', 'sub-task')")
    List<JiraSyncedIssue> findResolvedNonEpicSince(@Param("keys") List<String> projectKeys,
                                                     @Param("since") LocalDateTime since);

    /** Find issues by fix version name (join through fix version table) */
    @Query("SELECT i FROM JiraSyncedIssue i WHERE i.issueKey IN " +
           "(SELECT fv.issueKey FROM JiraIssueFixVersion fv WHERE fv.versionName = :versionName) " +
           "AND i.projectKey IN :keys " +
           "AND i.subtask = false")
    List<JiraSyncedIssue> findByFixVersionAndProjectKeys(@Param("versionName") String versionName,
                                                          @Param("keys") List<String> projectKeys);

    /** Find issues by fix version name (no project scope) */
    @Query("SELECT i FROM JiraSyncedIssue i WHERE i.issueKey IN " +
           "(SELECT fv.issueKey FROM JiraIssueFixVersion fv WHERE fv.versionName = :versionName) " +
           "AND i.subtask = false")
    List<JiraSyncedIssue> findByFixVersion(@Param("versionName") String versionName);

    /** Find issues by epic name */
    @Query("SELECT i FROM JiraSyncedIssue i WHERE i.projectKey = :projectKey " +
           "AND i.epicName = :epicName")
    List<JiraSyncedIssue> findByProjectKeyAndEpicName(@Param("projectKey") String projectKey,
                                                       @Param("epicName") String epicName);

    /** Find issues by label (join through label table) */
    @Query("SELECT i FROM JiraSyncedIssue i WHERE i.issueKey IN " +
           "(SELECT l.issueKey FROM JiraIssueLabel l WHERE l.label = :label) " +
           "AND i.projectKey = :projectKey")
    List<JiraSyncedIssue> findByProjectKeyAndLabel(@Param("projectKey") String projectKey,
                                                    @Param("label") String label);

    /** Find issues by epic key */
    @Query("SELECT i FROM JiraSyncedIssue i WHERE i.projectKey = :projectKey " +
           "AND i.epicKey = :epicKey")
    List<JiraSyncedIssue> findByProjectKeyAndEpicKey(@Param("projectKey") String projectKey,
                                                      @Param("epicKey") String epicKey);

    /**
     * Stale open issues: not Done, not updated since {@code cutoff}, for the given project keys.
     * Used by {@code SupportStalenessService} to identify tickets needing attention.
     */
    @Query("SELECT i FROM JiraSyncedIssue i WHERE i.projectKey IN :keys " +
           "AND i.statusCategory <> 'done' " +
           "AND i.updatedAt < :cutoff " +
           "ORDER BY i.updatedAt ASC")
    List<JiraSyncedIssue> findStaleByProjectKeys(@Param("keys") List<String> projectKeys,
                                                  @Param("cutoff") LocalDateTime cutoff);
}
