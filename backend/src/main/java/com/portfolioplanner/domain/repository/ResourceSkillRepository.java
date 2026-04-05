package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ResourceSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResourceSkillRepository extends JpaRepository<ResourceSkill, Long> {
    List<ResourceSkill> findByResourceId(Long resourceId);
    void deleteByResourceIdAndSkillName(Long resourceId, String skillName);
    boolean existsByResourceIdAndSkillName(Long resourceId, String skillName);

    @Query("SELECT DISTINCT rs.skillName FROM ResourceSkill rs ORDER BY rs.skillName")
    List<String> findDistinctSkillNames();

    @Query("SELECT rs FROM ResourceSkill rs WHERE rs.skillName = :skillName ORDER BY rs.proficiency DESC")
    List<ResourceSkill> findBySkillNameOrderByProficiencyDesc(String skillName);
}
