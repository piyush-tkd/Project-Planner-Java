package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ProjectPodPlanning;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectPodPlanningRepository extends JpaRepository<ProjectPodPlanning, Long> {

    List<ProjectPodPlanning> findByProjectId(Long projectId);

    List<ProjectPodPlanning> findByPodId(Long podId);
}
