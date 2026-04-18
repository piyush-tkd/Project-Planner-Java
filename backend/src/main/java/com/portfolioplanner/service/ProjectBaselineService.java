package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.ProjectBaseline;
import com.portfolioplanner.domain.repository.ProjectBaselineRepository;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.dto.ProjectBaselineDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectBaselineService {

    private final ProjectBaselineRepository baselineRepo;
    private final ProjectRepository projectRepo;

    public List<ProjectBaselineDto> list(Long projectId) {
        return baselineRepo.findByProjectIdOrderBySnappedAtDesc(projectId)
                .stream().map(ProjectBaselineDto::from).collect(Collectors.toList());
    }

    @Transactional
    public ProjectBaselineDto snap(Long projectId, String label, String snappedBy) {
        Project p = projectRepo.findById(projectId).orElseThrow();

        ProjectBaseline b = new ProjectBaseline();
        b.setProjectId(projectId);
        b.setLabel(label != null && !label.isBlank()
                ? label : "Baseline " + LocalDate.now());
        b.setSnappedBy(snappedBy != null ? snappedBy : "anonymous");
        b.setPlannedStart(p.getStartDate());
        b.setPlannedTarget(p.getTargetDate());
        b.setPlannedHours(null);
        return ProjectBaselineDto.from(baselineRepo.save(b));
    }

    @Transactional
    public Optional<ProjectBaseline> delete(Long projectId, Long id) {
        return baselineRepo.findById(id).flatMap(b -> {
            if (!b.getProjectId().equals(projectId)) {
                return Optional.empty();
            }
            baselineRepo.delete(b);
            return Optional.of(b);
        });
    }
}
