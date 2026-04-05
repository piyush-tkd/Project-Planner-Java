package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.SprintRetroSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SprintRetroRepository extends JpaRepository<SprintRetroSummary, Long> {
    List<SprintRetroSummary> findAllByOrderByGeneratedAtDesc();
    List<SprintRetroSummary> findByProjectKeyOrderByGeneratedAtDesc(String projectKey);
    Optional<SprintRetroSummary> findBySprintJiraId(Long sprintJiraId);
}
