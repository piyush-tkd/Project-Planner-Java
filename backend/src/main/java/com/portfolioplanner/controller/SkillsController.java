package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Skill;
import com.portfolioplanner.domain.model.SkillCategory;
import com.portfolioplanner.service.SkillsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/skills")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class SkillsController {

    private final SkillsService skillsService;

    @GetMapping("/categories")
    public List<SkillCategory> getCategories() {
        return skillsService.getCategories();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/categories")
    public SkillCategory createCategory(@RequestBody SkillCategory category) {
        return skillsService.createCategory(category);
    }

    @GetMapping
    public List<Skill> getSkills() {
        return skillsService.getSkills();
    }

    @GetMapping("/category/{categoryId}")
    public List<Skill> getSkillsByCategory(@PathVariable Long categoryId) {
        return skillsService.getSkillsByCategory(categoryId);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public Skill createSkill(@RequestBody Skill skill) {
        return skillsService.createSkill(skill);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<Skill> updateSkill(@PathVariable Long id, @RequestBody Skill updated) {
        return skillsService.updateSkill(id, updated).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSkill(@PathVariable Long id) {
        if (!skillsService.deleteSkill(id)) return ResponseEntity.notFound().build();
        return ResponseEntity.noContent().build();
    }
}
