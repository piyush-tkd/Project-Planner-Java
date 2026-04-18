package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Skill;
import com.portfolioplanner.domain.model.SkillCategory;
import com.portfolioplanner.domain.repository.SkillCategoryRepository;
import com.portfolioplanner.domain.repository.SkillRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SkillsService {

    private final SkillCategoryRepository skillCategoryRepository;
    private final SkillRepository skillRepository;

    public List<SkillCategory> getCategories() {
        return skillCategoryRepository.findAll();
    }

    @Transactional
    public SkillCategory createCategory(SkillCategory category) {
        return skillCategoryRepository.save(category);
    }

    public List<Skill> getSkills() {
        return skillRepository.findAllWithCategory();
    }

    public List<Skill> getSkillsByCategory(Long categoryId) {
        return skillRepository.findByCategoryId(categoryId);
    }

    @Transactional
    public Skill createSkill(Skill skill) {
        return skillRepository.save(skill);
    }

    @Transactional
    public Optional<Skill> updateSkill(Long id, Skill updated) {
        return skillRepository.findById(id).map(existing -> {
            existing.setName(updated.getName());
            existing.setDescription(updated.getDescription());
            existing.setLevelScale(updated.getLevelScale());
            return skillRepository.save(existing);
        });
    }

    @Transactional
    public boolean deleteSkill(Long id) {
        if (!skillRepository.existsById(id)) {
            return false;
        }
        skillRepository.deleteById(id);
        return true;
    }
}
