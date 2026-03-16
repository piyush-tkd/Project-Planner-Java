package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.ProjectPodPlanning;
import com.portfolioplanner.domain.model.TimelineConfig;
import com.portfolioplanner.domain.model.enums.ProjectStatus;
import com.portfolioplanner.domain.repository.PodRepository;
import com.portfolioplanner.domain.repository.ProjectPodPlanningRepository;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.domain.repository.TimelineConfigRepository;
import com.portfolioplanner.dto.request.ProjectPodPlanningRequest;
import com.portfolioplanner.dto.request.ProjectRequest;
import com.portfolioplanner.dto.response.ProjectPodMatrixResponse;
import com.portfolioplanner.dto.response.ProjectPodPlanningResponse;
import com.portfolioplanner.dto.response.ProjectResponse;
import com.portfolioplanner.exception.ResourceNotFoundException;
import com.portfolioplanner.mapper.EntityMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectPodPlanningRepository planningRepository;
    private final PodRepository podRepository;
    private final TimelineConfigRepository timelineRepository;
    private final EntityMapper mapper;

    public List<ProjectResponse> getAll(ProjectStatus status) {
        List<Project> projects;
        if (status != null) {
            projects = projectRepository.findByStatus(status);
        } else {
            projects = projectRepository.findAll();
        }
        return mapper.toProjectResponseList(projects);
    }

    public ProjectResponse getById(Long id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", id));
        return mapper.toProjectResponse(project);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public ProjectResponse create(ProjectRequest request) {
        Project project = mapper.toEntity(request);
        if (project.getStatus() == null) project.setStatus(ProjectStatus.ACTIVE);
        if (request.blockedById() != null) {
            Project blockedBy = projectRepository.findById(request.blockedById())
                    .orElseThrow(() -> new ResourceNotFoundException("Project", request.blockedById()));
            project.setBlockedBy(blockedBy);
        }
        deriveMonthFieldsFromDates(project);
        project = projectRepository.save(project);
        return mapper.toProjectResponse(project);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public ProjectResponse update(Long id, ProjectRequest request) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", id));
        mapper.updateEntity(request, project);
        if (request.blockedById() != null) {
            Project blockedBy = projectRepository.findById(request.blockedById())
                    .orElseThrow(() -> new ResourceNotFoundException("Project", request.blockedById()));
            project.setBlockedBy(blockedBy);
        } else {
            project.setBlockedBy(null);
        }
        deriveMonthFieldsFromDates(project);
        project = projectRepository.save(project);
        return mapper.toProjectResponse(project);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public void delete(Long id) {
        if (!projectRepository.existsById(id)) {
            throw new ResourceNotFoundException("Project", id);
        }
        List<ProjectPodPlanning> plannings = planningRepository.findByProjectId(id);
        planningRepository.deleteAll(plannings);
        projectRepository.deleteById(id);
    }

    public List<ProjectPodMatrixResponse> getAllPodPlannings() {
        List<ProjectPodPlanning> plannings = planningRepository.findAll();
        return mapper.toProjectPodMatrixResponseList(plannings);
    }

    public List<ProjectPodMatrixResponse> getPodPlanningsByPodId(Long podId) {
        List<ProjectPodPlanning> plannings = planningRepository.findByPodId(podId);
        return mapper.toProjectPodMatrixResponseList(plannings);
    }

    public List<ProjectPodPlanningResponse> getPodPlannings(Long projectId) {
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project", projectId);
        }
        List<ProjectPodPlanning> plannings = planningRepository.findByProjectId(projectId);
        return mapper.toPodPlanningResponseList(plannings);
    }

    /**
     * When a project has startDate and targetDate set, derive the month-index fields
     * (startMonth, targetEndMonth, durationMonths) from those dates using the timeline config.
     */
    private void deriveMonthFieldsFromDates(Project project) {
        if (project.getStartDate() == null || project.getTargetDate() == null) return;

        TimelineConfig config = timelineRepository.findAll().stream().findFirst().orElse(null);
        if (config == null) return;

        LocalDate startDate = project.getStartDate();
        LocalDate targetDate = project.getTargetDate();

        // Timeline anchor: the 1st day of the planning horizon's first month
        LocalDate anchorDate = LocalDate.of(config.getStartYear(), config.getStartMonth(), 1);

        // Compute month index (1-based) for start date
        int startMonthIdx = monthsBetween(anchorDate, startDate) + 1;
        startMonthIdx = Math.max(1, Math.min(12, startMonthIdx));

        // Compute month index for target date
        int endMonthIdx = monthsBetween(anchorDate, targetDate) + 1;
        endMonthIdx = Math.max(startMonthIdx, Math.min(12, endMonthIdx));

        int duration = endMonthIdx - startMonthIdx + 1;

        project.setStartMonth(startMonthIdx);
        project.setTargetEndMonth(endMonthIdx);
        project.setDurationMonths(duration);
    }

    private int monthsBetween(LocalDate anchor, LocalDate date) {
        int yearDiff = date.getYear() - anchor.getYear();
        int monthDiff = date.getMonthValue() - anchor.getMonthValue();
        return yearDiff * 12 + monthDiff;
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public List<ProjectPodPlanningResponse> setPodPlannings(Long projectId, List<ProjectPodPlanningRequest> requests) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));

        List<ProjectPodPlanning> existing = planningRepository.findByProjectId(projectId);
        Set<Long> requestPodIds = requests.stream()
                .map(ProjectPodPlanningRequest::podId)
                .collect(Collectors.toSet());

        // Remove plannings not in the new request set
        List<ProjectPodPlanning> toRemove = existing.stream()
                .filter(p -> !requestPodIds.contains(p.getPod().getId()))
                .toList();
        planningRepository.deleteAll(toRemove);

        // Create or update plannings
        List<ProjectPodPlanning> result = new ArrayList<>();
        for (ProjectPodPlanningRequest req : requests) {
            Pod pod = podRepository.findById(req.podId())
                    .orElseThrow(() -> new ResourceNotFoundException("Pod", req.podId()));

            ProjectPodPlanning planning = existing.stream()
                    .filter(p -> p.getPod().getId().equals(req.podId()))
                    .findFirst()
                    .orElseGet(() -> {
                        ProjectPodPlanning newPlanning = new ProjectPodPlanning();
                        newPlanning.setProject(project);
                        newPlanning.setPod(pod);
                        return newPlanning;
                    });

            planning.setTshirtSize(req.tshirtSize());
            planning.setComplexityOverride(req.complexityOverride());
            planning.setEffortPattern(req.effortPattern());
            planning.setPodStartMonth(req.podStartMonth());
            planning.setDurationOverride(req.durationOverride());

            result.add(planningRepository.save(planning));
        }

        return mapper.toPodPlanningResponseList(result);
    }
}
