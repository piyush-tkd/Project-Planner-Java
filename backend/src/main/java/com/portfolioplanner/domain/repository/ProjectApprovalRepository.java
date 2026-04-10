package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ProjectApproval;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectApprovalRepository extends JpaRepository<ProjectApproval, Long> {
    List<ProjectApproval> findByProjectIdOrderByRequestedAtDesc(Long projectId);
    List<ProjectApproval> findByStatusOrderByRequestedAtDesc(ProjectApproval.ApprovalStatus status);
    List<ProjectApproval> findAllByOrderByRequestedAtDesc();
    Optional<ProjectApproval> findFirstByProjectIdAndStatusOrderByRequestedAtDesc(Long projectId, ProjectApproval.ApprovalStatus status);
}
