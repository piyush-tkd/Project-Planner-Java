package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ProjectComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectCommentRepository extends JpaRepository<ProjectComment, Long> {

    /** All top-level comments for a project, newest first */
    List<ProjectComment> findByProjectIdAndParentIdIsNullOrderByCreatedAtDesc(Long projectId);

    /** All replies to a specific comment */
    List<ProjectComment> findByParentIdOrderByCreatedAtAsc(Long parentId);

    /** Total comment count for a project (top-level + replies) */
    int countByProjectId(Long projectId);

    /** Delete all comments for a project */
    void deleteByProjectId(Long projectId);
}
