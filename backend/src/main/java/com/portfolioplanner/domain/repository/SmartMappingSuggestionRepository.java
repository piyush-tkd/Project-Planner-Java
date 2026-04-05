package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.SmartMappingSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface SmartMappingSuggestionRepository extends JpaRepository<SmartMappingSuggestion, Long> {

    List<SmartMappingSuggestion> findByResolutionOrderByScoreDesc(String resolution);

    Optional<SmartMappingSuggestion> findByPpProjectIdAndJiraEpicKey(Long ppProjectId, String jiraEpicKey);

    boolean existsByPpProjectIdAndJiraEpicKey(Long ppProjectId, String jiraEpicKey);

    @Query("SELECT s FROM SmartMappingSuggestion s ORDER BY s.score DESC")
    List<SmartMappingSuggestion> findAllOrderByScoreDesc();
}
