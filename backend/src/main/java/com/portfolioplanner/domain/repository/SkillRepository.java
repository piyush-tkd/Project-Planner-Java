package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.Skill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface SkillRepository extends JpaRepository<Skill, Long> {

    @Query("SELECT s FROM Skill s JOIN FETCH s.category")
    List<Skill> findAllWithCategory();

    @Query("SELECT s FROM Skill s JOIN FETCH s.category WHERE s.category.id = :categoryId")
    List<Skill> findByCategoryId(Long categoryId);
}
