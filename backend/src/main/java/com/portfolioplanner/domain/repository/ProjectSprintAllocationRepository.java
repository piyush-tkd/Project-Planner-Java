package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ProjectSprintAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProjectSprintAllocationRepository extends JpaRepository<ProjectSprintAllocation, Long> {
    List<ProjectSprintAllocation> findByProjectId(Long projectId);
    List<ProjectSprintAllocation> findBySprintId(Long sprintId);
    List<ProjectSprintAllocation> findByPodId(Long podId);
    void deleteByProjectIdAndPodId(Long projectId, Long podId);
}
