package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraIssueCustomField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JiraIssueCustomFieldRepository extends JpaRepository<JiraIssueCustomField, Long> {

    List<JiraIssueCustomField> findByIssueKey(String issueKey);

    List<JiraIssueCustomField> findByIssueKeyIn(List<String> issueKeys);

    /** Get all values for a specific custom field across issues */
    @Query("SELECT cf FROM JiraIssueCustomField cf WHERE cf.fieldId = :fieldId " +
           "AND cf.issueKey IN :keys")
    List<JiraIssueCustomField> findByFieldIdAndIssueKeyIn(@Param("fieldId") String fieldId,
                                                           @Param("keys") List<String> issueKeys);

    @Modifying
    @Query("DELETE FROM JiraIssueCustomField cf WHERE cf.issueKey = :key")
    void deleteByIssueKey(@Param("key") String issueKey);

    @Modifying
    @Query("DELETE FROM JiraIssueCustomField cf WHERE cf.issueKey IN :keys")
    void deleteByIssueKeyIn(@Param("keys") List<String> issueKeys);
}
