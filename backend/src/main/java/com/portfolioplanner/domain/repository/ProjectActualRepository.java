package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ProjectActual;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectActualRepository extends JpaRepository<ProjectActual, Long> {
    List<ProjectActual> findByProjectId(Long projectId);
    void deleteByProjectId(Long projectId);
}
