package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.SkillCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillCategoryRepository extends JpaRepository<SkillCategory, Long> {
}
