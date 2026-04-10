package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Skill;
import com.portfolioplanner.domain.model.SkillCategory;
import com.portfolioplanner.domain.repository.SkillCategoryRepository;
import com.portfolioplanner.domain.repository.SkillRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * Skills taxonomy management — categories and skill definitions.
 * Resource skills are managed via ResourceSkillController at /api/resources/{id}/skills.
 */
@RestController
@RequestMapping("/api/skills")
@RequiredArgsConstructor
public class SkillsController {

    private final SkillCategoryRepository categoryRepository;
    private final SkillRepository skillRepository;

    @GetMapping("/categories")
    public List<SkillCategory> getCategories() {
        return categoryRepository.findAll();
    }

    @PostMapping("/categories")
    public SkillCategory createCategory(@RequestBody SkillCategory category) {
        return categoryRepository.save(category);
    }

    @GetMapping
    public List<Skill> getSkills() {
        return skillRepository.findAll();
    }

    @GetMapping("/category/{categoryId}")
    public List<Skill> getSkillsByCategory(@PathVariable Long categoryId) {
        return skillRepository.findByCategoryId(categoryId);
    }

    @PostMapping
    public Skill createSkill(@RequestBody Skill skill) {
        return skillRepository.save(skill);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Skill> updateSkill(@PathVariable Long id, @RequestBody Skill updated) {
        return skillRepository.findById(id)
            .map(existing -> {
                existing.setName(updated.getName());
                existing.setDescription(updated.getDescription());
                existing.setLevelScale(updated.getLevelScale());
                return ResponseEntity.ok(skillRepository.save(existing));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSkill(@PathVariable Long id) {
        if (!skillRepository.existsById(id)) return ResponseEntity.notFound().build();
        skillRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
