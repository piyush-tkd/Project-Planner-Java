package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.ProjectTemplate;
import com.portfolioplanner.domain.repository.ProjectTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectTemplateService {

    private final ProjectTemplateRepository projectTemplateRepository;

    public record TemplateResponse(
        Long id,
        String name,
        String description,
        String category,
        String duration,
        String team,
        String effort,
        List<String> tags,
        boolean starred,
        int usageCount,
        String lastUsed,
        String phases
    ) {}

    public record TemplateRequest(
        String name,
        String description,
        String category,
        String duration,
        String team,
        String effort,
        List<String> tags,
        boolean starred,
        String phases
    ) {}

    public List<TemplateResponse> getAll() {
        return projectTemplateRepository.findAllByOrderByStarredDescUsageCountDesc()
            .stream().map(this::toDto).collect(Collectors.toList());
    }

    public Optional<TemplateResponse> getOne(Long id) {
        return projectTemplateRepository.findById(id).map(this::toDto);
    }

    @Transactional
    public TemplateResponse create(TemplateRequest request) {
        ProjectTemplate template = new ProjectTemplate();
        applyRequest(template, request);
        return toDto(projectTemplateRepository.save(template));
    }

    @Transactional
    public Optional<TemplateResponse> update(Long id, TemplateRequest request) {
        return projectTemplateRepository.findById(id)
            .map(t -> {
                applyRequest(t, request);
                return toDto(projectTemplateRepository.save(t));
            });
    }

    @Transactional
    public Optional<TemplateResponse> toggleStar(Long id) {
        return projectTemplateRepository.findById(id)
            .map(t -> {
                t.setStarred(!Boolean.TRUE.equals(t.getStarred()));
                return toDto(projectTemplateRepository.save(t));
            });
    }

    @Transactional
    public Optional<TemplateResponse> markUsed(Long id) {
        return projectTemplateRepository.findById(id)
            .map(t -> {
                t.setUsageCount(t.getUsageCount() + 1);
                t.setLastUsed(LocalDate.now());
                return toDto(projectTemplateRepository.save(t));
            });
    }

    @Transactional
    public boolean delete(Long id) {
        if (!projectTemplateRepository.existsById(id)) {
            return false;
        }
        projectTemplateRepository.deleteById(id);
        return true;
    }

    private TemplateResponse toDto(ProjectTemplate t) {
        List<String> tagList = t.getTags() != null && !t.getTags().isBlank()
            ? Arrays.stream(t.getTags().split(",")).map(String::trim).collect(Collectors.toList())
            : List.of();
        return new TemplateResponse(
            t.getId(), t.getName(), t.getDescription(),
            t.getCategory(), t.getDuration(), t.getTeamDesc(), t.getEffort(),
            tagList, Boolean.TRUE.equals(t.getStarred()), t.getUsageCount(),
            t.getLastUsed() != null ? t.getLastUsed().toString() : null,
            t.getPhases()
        );
    }

    private void applyRequest(ProjectTemplate t, TemplateRequest req) {
        t.setName(req.name());
        t.setDescription(req.description());
        t.setCategory(req.category());
        t.setDuration(req.duration());
        t.setTeamDesc(req.team());
        t.setEffort(req.effort());
        t.setTags(req.tags() != null ? String.join(",", req.tags()) : null);
        t.setStarred(req.starred());
        t.setPhases(req.phases() != null ? req.phases() : "[]");
    }
}
