package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ProjectBaseline;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectBaselineRepository extends JpaRepository<ProjectBaseline, Long> {
    List<ProjectBaseline> findByProjectIdOrderBySnappedAtDesc(Long projectId);
    void deleteByProjectId(Long projectId);
}
