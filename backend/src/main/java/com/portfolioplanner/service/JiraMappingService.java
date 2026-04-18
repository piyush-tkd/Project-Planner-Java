package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.JiraProjectMapping;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.repository.JiraProjectMappingRepository;
import com.portfolioplanner.domain.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class JiraMappingService {

    private final JiraProjectMappingRepository mappingRepo;
    private final ProjectRepository projectRepo;

    public record SaveMappingRequest(
            Long ppProjectId,
            String jiraProjectKey,
            String matchType,
            String matchValue) {}

    public record MappingResponse(
            Long id,
            Long ppProjectId,
            String ppProjectName,
            String jiraProjectKey,
            String matchType,
            String matchValue,
            Boolean active) {}

    public List<MappingResponse> getMappings() {
        return mappingRepo.findByActiveTrueOrderByJiraProjectKey().stream()
                .map(m -> new MappingResponse(
                        m.getId(),
                        m.getProject().getId(),
                        m.getProject().getName(),
                        m.getJiraProjectKey(),
                        m.getMatchType(),
                        m.getMatchValue(),
                        m.getActive()))
                .toList();
    }

    @Transactional
    public MappingResponse saveMapping(SaveMappingRequest req) {
        Project project = projectRepo.findById(req.ppProjectId())
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + req.ppProjectId()));

        JiraProjectMapping mapping = mappingRepo
                .findByProjectIdAndJiraProjectKey(req.ppProjectId(), req.jiraProjectKey())
                .orElseGet(JiraProjectMapping::new);

        mapping.setProject(project);
        mapping.setJiraProjectKey(req.jiraProjectKey());
        mapping.setMatchType(req.matchType());
        mapping.setMatchValue(req.matchValue());
        mapping.setActive(true);
        mapping = mappingRepo.save(mapping);

        return new MappingResponse(
                mapping.getId(),
                project.getId(),
                project.getName(),
                mapping.getJiraProjectKey(),
                mapping.getMatchType(),
                mapping.getMatchValue(),
                mapping.getActive());
    }

    @Transactional
    public List<MappingResponse> saveMappingsBulk(List<SaveMappingRequest> requests) {
        return requests.stream()
                .map(this::saveMapping)
                .toList();
    }

    @Transactional
    public void deleteMapping(Long id) {
        mappingRepo.findById(id).ifPresent(m -> {
            m.setActive(false);
            mappingRepo.save(m);
        });
    }
}
