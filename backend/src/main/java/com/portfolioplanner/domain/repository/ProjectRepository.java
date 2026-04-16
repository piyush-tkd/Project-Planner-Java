package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.enums.SourceType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByStatusIgnoreCase(String status);

    Page<Project> findByStatusIgnoreCase(String status, Pageable pageable);

    List<Project> findByStatusIn(List<String> statuses);

    Optional<Project> findByNameIgnoreCase(String name);

    Optional<Project> findByJiraEpicKey(String jiraEpicKey);

    List<Project> findBySourceType(SourceType sourceType);

    List<Project> findByArchivedFalse();
}
