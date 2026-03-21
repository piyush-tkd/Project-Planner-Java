package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.enums.ProjectStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByStatus(ProjectStatus status);

    List<Project> findByStatusIn(List<ProjectStatus> statuses);

    java.util.Optional<Project> findByNameIgnoreCase(String name);
}
