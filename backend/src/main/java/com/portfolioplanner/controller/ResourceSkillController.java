package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.ResourceSkill;
import com.portfolioplanner.domain.repository.ResourceRepository;
import com.portfolioplanner.domain.repository.ResourceSkillRepository;
import jakarta.transaction.Transactional;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor
public class ResourceSkillController {

    private final ResourceSkillRepository skillRepo;
    private final ResourceRepository resourceRepo;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public record SkillResponse(
        Long id,
        Long resourceId,
        String skillName,
        int proficiency,
        String proficiencyLabel,
        Double yearsExperience
    ) {}

    public record SkillRequest(
        @NotBlank String skillName,
        Integer proficiency,         // 1–4
        Double yearsExperience
    ) {}

    public record SkillMatrixRow(
        Long   resourceId,
        String resourceName,
        String role,
        String podName,
        List<SkillResponse> skills
    ) {}

    public record SkillSummary(
        String skillName,
        long resourceCount,
        double avgProficiency
    ) {}

    private static final String[] PROFICIENCY_LABELS = {"", "Beginner", "Intermediate", "Advanced", "Expert"};

    private SkillResponse toDto(ResourceSkill s) {
        int p = s.getProficiency() == null ? 2 : s.getProficiency();
        return new SkillResponse(
            s.getId(), s.getResourceId(), s.getSkillName(), p,
            p >= 1 && p <= 4 ? PROFICIENCY_LABELS[p] : "Unknown",
            s.getYearsExperience() != null ? s.getYearsExperience().doubleValue() : null
        );
    }

    // ── Endpoints ────────────────────────────────────────────────────────────

    /** List skills for a single resource */
    @GetMapping("/{resourceId}/skills")
    public List<SkillResponse> getSkills(@PathVariable Long resourceId) {
        if (!resourceRepo.existsById(resourceId))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Resource not found");
        return skillRepo.findByResourceId(resourceId).stream().map(this::toDto).toList();
    }

    /** Add or update a skill for a resource */
    @PostMapping("/{resourceId}/skills")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<SkillResponse> addSkill(@PathVariable Long resourceId,
                                                   @RequestBody SkillRequest req) {
        if (!resourceRepo.existsById(resourceId))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Resource not found");
        // Upsert: if skill already exists for this resource, update proficiency
        ResourceSkill skill = skillRepo.findByResourceId(resourceId).stream()
            .filter(s -> s.getSkillName().equalsIgnoreCase(req.skillName()))
            .findFirst()
            .orElse(new ResourceSkill());
        skill.setResourceId(resourceId);
        skill.setSkillName(req.skillName());
        skill.setProficiency(req.proficiency() != null ? req.proficiency().shortValue() : 2);
        if (req.yearsExperience() != null)
            skill.setYearsExperience(BigDecimal.valueOf(req.yearsExperience()));
        skill = skillRepo.save(skill);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(skill));
    }

    /** Remove a skill from a resource */
    @DeleteMapping("/{resourceId}/skills/{skillName}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    @Transactional
    public ResponseEntity<Void> removeSkill(@PathVariable Long resourceId,
                                             @PathVariable String skillName) {
        skillRepo.deleteByResourceIdAndSkillName(resourceId, skillName);
        return ResponseEntity.noContent().build();
    }

    /** Full skills matrix: all resources with their skills */
    @GetMapping("/skills/matrix")
    public List<SkillMatrixRow> getMatrix() {
        List<Resource> resources = resourceRepo.findAll();
        List<ResourceSkill> allSkills = skillRepo.findAll();

        Map<Long, List<ResourceSkill>> byResource = allSkills.stream()
            .collect(Collectors.groupingBy(ResourceSkill::getResourceId));

        return resources.stream()
            .filter(r -> Boolean.TRUE.equals(r.getCountsInCapacity()))
            .map(r -> new SkillMatrixRow(
                r.getId(),
                r.getName(),
                r.getRole() != null ? r.getRole().name() : null,
                null, // pod name resolved via assignment on frontend
                byResource.getOrDefault(r.getId(), List.of()).stream()
                    .map(this::toDto).toList()
            ))
            .toList();
    }

    /** Summary: distinct skills with resource count and avg proficiency */
    @GetMapping("/skills/summary")
    public List<SkillSummary> getSummary() {
        List<String> skills = skillRepo.findDistinctSkillNames();
        return skills.stream().map(skillName -> {
            List<ResourceSkill> rows = skillRepo.findBySkillNameOrderByProficiencyDesc(skillName);
            double avg = rows.stream().mapToInt(s -> s.getProficiency() == null ? 2 : s.getProficiency())
                .average().orElse(0);
            return new SkillSummary(skillName, rows.size(), Math.round(avg * 10.0) / 10.0);
        }).toList();
    }
}
