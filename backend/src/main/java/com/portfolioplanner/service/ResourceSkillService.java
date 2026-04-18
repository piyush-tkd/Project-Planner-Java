package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.ResourceSkill;
import com.portfolioplanner.domain.repository.ResourceRepository;
import com.portfolioplanner.domain.repository.ResourceSkillRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ResourceSkillService {

    private final ResourceSkillRepository resourceSkillRepository;
    private final ResourceRepository resourceRepository;

    private static final String[] PROFICIENCY_LABELS = {"", "Beginner", "Intermediate", "Advanced", "Expert"};

    public record SkillResponse(
        Long id,
        Long resourceId,
        String skillName,
        int proficiency,
        String proficiencyLabel,
        Double yearsExperience
    ) {}

    public record SkillRequest(
        String skillName,
        Integer proficiency,
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

    public List<SkillResponse> getSkills(Long resourceId) {
        if (!resourceRepository.existsById(resourceId))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Resource not found");
        return resourceSkillRepository.findByResourceId(resourceId).stream().map(this::toDto).toList();
    }

    @Transactional
    public SkillResponse addSkill(Long resourceId, SkillRequest request) {
        if (!resourceRepository.existsById(resourceId))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Resource not found");
        ResourceSkill skill = resourceSkillRepository.findByResourceId(resourceId).stream()
            .filter(s -> s.getSkillName().equalsIgnoreCase(request.skillName()))
            .findFirst()
            .orElse(new ResourceSkill());
        skill.setResourceId(resourceId);
        skill.setSkillName(request.skillName());
        skill.setProficiency(request.proficiency() != null ? request.proficiency().shortValue() : 2);
        if (request.yearsExperience() != null)
            skill.setYearsExperience(BigDecimal.valueOf(request.yearsExperience()));
        skill = resourceSkillRepository.save(skill);
        return toDto(skill);
    }

    @Transactional
    public void removeSkill(Long resourceId, String skillName) {
        resourceSkillRepository.deleteByResourceIdAndSkillName(resourceId, skillName);
    }

    public List<SkillMatrixRow> getMatrix() {
        List<Resource> resources = resourceRepository.findAll();
        List<ResourceSkill> allSkills = resourceSkillRepository.findAll();

        Map<Long, List<ResourceSkill>> byResource = allSkills.stream()
            .collect(Collectors.groupingBy(ResourceSkill::getResourceId));

        return resources.stream()
            .filter(r -> Boolean.TRUE.equals(r.getCountsInCapacity()))
            .map(r -> new SkillMatrixRow(
                r.getId(),
                r.getName(),
                r.getRole() != null ? r.getRole().name() : null,
                null,
                byResource.getOrDefault(r.getId(), List.of()).stream()
                    .map(this::toDto).toList()
            ))
            .toList();
    }

    public List<SkillSummary> getSummary() {
        List<String> skills = resourceSkillRepository.findDistinctSkillNames();
        return skills.stream().map(skillName -> {
            List<ResourceSkill> rows = resourceSkillRepository.findBySkillNameOrderByProficiencyDesc(skillName);
            double avg = rows.stream().mapToInt(s -> s.getProficiency() == null ? 2 : s.getProficiency())
                .average().orElse(0);
            return new SkillSummary(skillName, rows.size(), Math.round(avg * 10.0) / 10.0);
        }).toList();
    }

    private SkillResponse toDto(ResourceSkill s) {
        int p = s.getProficiency() == null ? 2 : s.getProficiency();
        return new SkillResponse(
            s.getId(), s.getResourceId(), s.getSkillName(), p,
            p >= 1 && p <= 4 ? PROFICIENCY_LABELS[p] : "Unknown",
            s.getYearsExperience() != null ? s.getYearsExperience().doubleValue() : null
        );
    }
}
