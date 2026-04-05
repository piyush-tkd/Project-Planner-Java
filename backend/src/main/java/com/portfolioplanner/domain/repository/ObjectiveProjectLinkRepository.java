package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ObjectiveProjectLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ObjectiveProjectLinkRepository extends JpaRepository<ObjectiveProjectLink, Long> {
    List<ObjectiveProjectLink> findByObjectiveId(Long objectiveId);
    void deleteByObjectiveIdAndProjectId(Long objectiveId, Long projectId);
    boolean existsByObjectiveIdAndProjectId(Long objectiveId, Long projectId);
}
