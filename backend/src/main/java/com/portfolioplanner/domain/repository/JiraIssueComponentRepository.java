package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraIssueComponent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JiraIssueComponentRepository extends JpaRepository<JiraIssueComponent, Long> {

    List<JiraIssueComponent> findByIssueKeyIn(List<String> issueKeys);

    @Modifying
    @Query("DELETE FROM JiraIssueComponent c WHERE c.issueKey = :key")
    void deleteByIssueKey(@Param("key") String issueKey);

    @Modifying
    @Query("DELETE FROM JiraIssueComponent c WHERE c.issueKey IN :keys")
    void deleteByIssueKeyIn(@Param("keys") List<String> issueKeys);
}
