package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.ProjectStatusUpdate;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.domain.repository.ProjectStatusUpdateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectStatusUpdateService {

    private final ProjectStatusUpdateRepository projectStatusUpdateRepository;
    private final ProjectRepository projectRepository;

    public List<Map<String, Object>> listForProject(Long projectId) {
        List<ProjectStatusUpdate> updates = projectStatusUpdateRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        return updates.stream().map(this::toMap).collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> create(Long projectId, CreateRequest request) {
        if (!projectRepository.existsById(projectId)) {
            throw new IllegalArgumentException("Project not found");
        }
        ProjectStatusUpdate update = ProjectStatusUpdate.builder()
                .projectId(projectId)
                .ragStatus(request.ragStatus())
                .summary(request.summary())
                .whatDone(request.whatDone())
                .whatsNext(request.whatsNext())
                .blockers(request.blockers())
                .author(request.author())
                .build();
        ProjectStatusUpdate saved = projectStatusUpdateRepository.save(update);
        return toMap(saved);
    }

    @Transactional
    public void delete(Long projectId, Long updateId) {
        projectStatusUpdateRepository.findById(updateId).ifPresent(u -> {
            if (u.getProjectId().equals(projectId)) {
                projectStatusUpdateRepository.delete(u);
            }
        });
    }

    public List<Map<String, Object>> getFeed(Long projectId, String ragStatus) {
        List<ProjectStatusUpdate> all = projectStatusUpdateRepository.findTop50ByOrderByCreatedAtDesc();

        // Build project name lookup
        Set<Long> projectIds = all.stream().map(ProjectStatusUpdate::getProjectId).collect(Collectors.toSet());
        Map<Long, String> nameMap = projectRepository.findAllById(projectIds).stream()
                .collect(Collectors.toMap(Project::getId, Project::getName));

        return all.stream()
                .filter(u -> projectId == null || u.getProjectId().equals(projectId))
                .filter(u -> ragStatus == null || ragStatus.equalsIgnoreCase(u.getRagStatus()))
                .map(u -> {
                    Map<String, Object> m = toMap(u);
                    m.put("projectName", nameMap.getOrDefault(u.getProjectId(), "Unknown"));
                    return m;
                })
                .collect(Collectors.toList());
    }

    private Map<String, Object> toMap(ProjectStatusUpdate u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",        u.getId());
        m.put("projectId", u.getProjectId());
        m.put("ragStatus", u.getRagStatus());
        m.put("summary",   u.getSummary());
        m.put("whatDone",  u.getWhatDone());
        m.put("whatsNext", u.getWhatsNext());
        m.put("blockers",  u.getBlockers());
        m.put("author",    u.getAuthor());
        m.put("createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : null);
        return m;
    }

    public record CreateRequest(
            String ragStatus, String summary,
            String whatDone,  String whatsNext,
            String blockers,  String author
    ) {}
}
