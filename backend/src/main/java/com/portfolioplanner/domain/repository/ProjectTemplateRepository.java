package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ProjectTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectTemplateRepository extends JpaRepository<ProjectTemplate, Long> {

    List<ProjectTemplate> findByStarredTrueOrderByUsageCountDesc();

    List<ProjectTemplate> findByCategoryOrderByNameAsc(String category);

    List<ProjectTemplate> findAllByOrderByStarredDescUsageCountDesc();
}
