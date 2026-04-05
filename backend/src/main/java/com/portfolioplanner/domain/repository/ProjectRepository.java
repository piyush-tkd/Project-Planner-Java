package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByStatusIgnoreCase(String status);

    List<Project> findByStatusIn(List<String> statuses);

    java.util.Optional<Project> findByNameIgnoreCase(String name);
}
