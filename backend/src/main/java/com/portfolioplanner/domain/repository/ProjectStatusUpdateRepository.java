package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ProjectStatusUpdate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectStatusUpdateRepository extends JpaRepository<ProjectStatusUpdate, Long> {
    List<ProjectStatusUpdate> findByProjectIdOrderByCreatedAtDesc(Long projectId);
    List<ProjectStatusUpdate> findAllByOrderByCreatedAtDesc();
    List<ProjectStatusUpdate> findTop50ByOrderByCreatedAtDesc();
}
