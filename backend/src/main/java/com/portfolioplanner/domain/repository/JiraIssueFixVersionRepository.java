package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraIssueFixVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JiraIssueFixVersionRepository extends JpaRepository<JiraIssueFixVersion, Long> {

    List<JiraIssueFixVersion> findByIssueKeyIn(List<String> issueKeys);

    /** All distinct fix versions for issues in given projects */
    @Query("SELECT DISTINCT fv.versionName, fv.versionId, fv.released, fv.releaseDate " +
           "FROM JiraIssueFixVersion fv WHERE fv.issueKey IN " +
           "(SELECT i.issueKey FROM JiraSyncedIssue i WHERE i.projectKey IN :keys)")
    List<Object[]> findDistinctVersionsByProjectKeys(@Param("keys") List<String> projectKeys);

    /** All distinct fix versions across all synced issues */
    @Query("SELECT DISTINCT fv.versionName, fv.versionId, fv.released, fv.releaseDate " +
           "FROM JiraIssueFixVersion fv")
    List<Object[]> findAllDistinctVersions();

    /** All fix version records for issues in given projects */
    @Query("SELECT fv FROM JiraIssueFixVersion fv WHERE fv.issueKey IN " +
           "(SELECT i.issueKey FROM JiraSyncedIssue i WHERE i.projectKey IN :keys)")
    List<JiraIssueFixVersion> findByProjectKeys(@Param("keys") List<String> projectKeys);

    @Modifying
    @Query("DELETE FROM JiraIssueFixVersion fv WHERE fv.issueKey = :key")
    void deleteByIssueKey(@Param("key") String issueKey);

    @Modifying
    @Query("DELETE FROM JiraIssueFixVersion fv WHERE fv.issueKey IN :keys")
    void deleteByIssueKeyIn(@Param("keys") List<String> issueKeys);
}
