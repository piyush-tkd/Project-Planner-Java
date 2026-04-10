package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ResourceSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ResourceSkillRepository extends JpaRepository<ResourceSkill, Long> {

    List<ResourceSkill> findByResourceId(Long resourceId);

    List<ResourceSkill> findBySkillNameOrderByProficiencyDesc(String skillName);

    void deleteByResourceIdAndSkillName(Long resourceId, String skillName);

    @Query("SELECT DISTINCT rs.skillName FROM ResourceSkill rs ORDER BY rs.skillName")
    List<String> findDistinctSkillNames();

    @Query("SELECT rs FROM ResourceSkill rs WHERE rs.skillName = :skillName ORDER BY rs.proficiency DESC")
    List<ResourceSkill> findBySkillNameSorted(@Param("skillName") String skillName);
}
