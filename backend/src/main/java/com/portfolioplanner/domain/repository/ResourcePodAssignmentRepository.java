package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ResourcePodAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ResourcePodAssignmentRepository extends JpaRepository<ResourcePodAssignment, Long> {

    Optional<ResourcePodAssignment> findByResourceId(Long resourceId);

    List<ResourcePodAssignment> findByPodId(Long podId);
}
