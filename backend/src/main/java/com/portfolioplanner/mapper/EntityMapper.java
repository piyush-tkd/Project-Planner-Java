package com.portfolioplanner.mapper;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.dto.request.*;
import com.portfolioplanner.dto.response.*;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Mapper(componentModel = "spring")
public interface EntityMapper {

    // Resource mappings
    Resource toEntity(ResourceRequest request);

    void updateEntity(ResourceRequest request, @MappingTarget Resource entity);

    default ResourceResponse toResourceResponse(Resource resource, ResourcePodAssignment assignment) {
        ResourceResponse.PodAssignment podAssignment = null;
        if (assignment != null) {
            podAssignment = new ResourceResponse.PodAssignment(
                    assignment.getPod().getId(),
                    assignment.getPod().getName(),
                    assignment.getCapacityFte()
            );
        }
        return new ResourceResponse(
                resource.getId(),
                resource.getName(),
                resource.getEmail(),
                resource.getRole(),
                resource.getLocation(),
                resource.getActive(),
                resource.getCountsInCapacity(),
                resource.getActualRate(),
                podAssignment,
                resource.getJiraDisplayName(),
                resource.getJiraAccountId()
        );
    }

    // Pod mappings
    PodResponse toPodResponse(Pod pod);

    List<PodResponse> toPodResponseList(List<Pod> pods);

    // Project mappings
    @Mapping(target = "blockedBy", ignore = true)
    Project toEntity(ProjectRequest request);

    @Mapping(target = "blockedBy", ignore = true)
    void updateEntity(ProjectRequest request, @MappingTarget Project entity);

    default ProjectResponse toProjectResponse(Project project) {
        Long blockedById = project.getBlockedBy() != null ? project.getBlockedBy().getId() : null;
        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getPriority(),
                project.getOwner(),
                project.getStartMonth(),
                project.getTargetEndMonth(),
                project.getDurationMonths(),
                project.getDefaultPattern(),
                project.getNotes(),
                project.getStatus(),
                blockedById,
                project.getTargetDate(),
                project.getStartDate(),
                project.getCapacityNote(),
                project.getClient(),
                project.getCreatedAt()
        );
    }

    default List<ProjectResponse> toProjectResponseList(List<Project> projects) {
        return projects.stream().map(this::toProjectResponse).toList();
    }

    // ProjectPodPlanning mappings
    default ProjectPodPlanningResponse toPodPlanningResponse(ProjectPodPlanning planning) {
        BigDecimal dev  = orZero(planning.getDevHours());
        BigDecimal qa   = orZero(planning.getQaHours());
        BigDecimal bsa  = orZero(planning.getBsaHours());
        BigDecimal tl   = orZero(planning.getTechLeadHours());
        BigDecimal contingency = orZero(planning.getContingencyPct());

        BigDecimal total = dev.add(qa).add(bsa).add(tl);
        BigDecimal totalWithContingency = total.multiply(
                BigDecimal.ONE.add(contingency.divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP))
        ).setScale(2, RoundingMode.HALF_UP);

        Long releaseId = planning.getTargetRelease() != null ? planning.getTargetRelease().getId() : null;
        String releaseName = planning.getTargetRelease() != null ? planning.getTargetRelease().getName() : null;

        return new ProjectPodPlanningResponse(
                planning.getId(),
                planning.getPod().getId(),
                planning.getPod().getName(),
                dev, qa, bsa, tl,
                contingency,
                total.setScale(2, RoundingMode.HALF_UP),
                totalWithContingency,
                releaseId,
                releaseName,
                planning.getEffortPattern(),
                planning.getPodStartMonth(),
                planning.getDurationOverride(),
                planning.getDevStartDate(),
                planning.getDevEndDate(),
                planning.getQaStartDate(),
                planning.getQaEndDate(),
                planning.getUatStartDate(),
                planning.getUatEndDate(),
                planning.getScheduleLocked(),
                planning.getDevCount() != null ? planning.getDevCount() : 1,
                planning.getQaCount() != null ? planning.getQaCount() : 1
        );
    }

    default List<ProjectPodPlanningResponse> toPodPlanningResponseList(List<ProjectPodPlanning> plannings) {
        return plannings.stream().map(this::toPodPlanningResponse).toList();
    }

    default ProjectPodMatrixResponse toProjectPodMatrixResponse(ProjectPodPlanning planning) {
        Project project = planning.getProject();

        BigDecimal dev  = orZero(planning.getDevHours());
        BigDecimal qa   = orZero(planning.getQaHours());
        BigDecimal bsa  = orZero(planning.getBsaHours());
        BigDecimal tl   = orZero(planning.getTechLeadHours());
        BigDecimal contingency = orZero(planning.getContingencyPct());

        BigDecimal total = dev.add(qa).add(bsa).add(tl);
        BigDecimal totalWithContingency = total.multiply(
                BigDecimal.ONE.add(contingency.divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP))
        ).setScale(2, RoundingMode.HALF_UP);

        Long releaseId = planning.getTargetRelease() != null ? planning.getTargetRelease().getId() : null;
        String releaseName = planning.getTargetRelease() != null ? planning.getTargetRelease().getName() : null;

        return new ProjectPodMatrixResponse(
                planning.getId(),
                project.getId(),
                project.getName(),
                project.getPriority().name(),
                project.getOwner(),
                project.getStatus().name(),
                project.getStartMonth(),
                project.getDurationMonths(),
                project.getDefaultPattern(),
                planning.getPod().getId(),
                planning.getPod().getName(),
                dev, qa, bsa, tl,
                contingency,
                total.setScale(2, RoundingMode.HALF_UP),
                totalWithContingency,
                releaseId,
                releaseName,
                planning.getEffortPattern(),
                planning.getPodStartMonth(),
                planning.getDurationOverride(),
                planning.getTshirtSize(),
                planning.getPod().getComplexityMultiplier() != null
                        ? planning.getPod().getComplexityMultiplier().doubleValue() : null
        );
    }

    default List<ProjectPodMatrixResponse> toProjectPodMatrixResponseList(List<ProjectPodPlanning> plannings) {
        return plannings.stream().map(this::toProjectPodMatrixResponse).toList();
    }

    // Sprint mappings
    default SprintResponse toSprintResponse(Sprint sprint) {
        return new SprintResponse(
                sprint.getId(),
                sprint.getName(),
                sprint.getType(),
                sprint.getStartDate(),
                sprint.getEndDate(),
                sprint.getRequirementsLockInDate()
        );
    }

    default List<SprintResponse> toSprintResponseList(List<Sprint> sprints) {
        return sprints.stream().map(this::toSprintResponse).toList();
    }

    // ReleaseCalendar mappings
    default ReleaseCalendarResponse toReleaseCalendarResponse(ReleaseCalendar release) {
        return new ReleaseCalendarResponse(
                release.getId(),
                release.getName(),
                release.getReleaseDate(),
                release.getCodeFreezeDate(),
                release.getType(),
                release.getNotes()
        );
    }

    default List<ReleaseCalendarResponse> toReleaseCalendarResponseList(List<ReleaseCalendar> releases) {
        return releases.stream().map(this::toReleaseCalendarResponse).toList();
    }

    // TemporaryOverride mappings
    default TemporaryOverrideResponse toOverrideResponse(TemporaryOverride override) {
        return new TemporaryOverrideResponse(
                override.getId(),
                override.getResource().getId(),
                override.getResource().getName(),
                override.getToPod().getId(),
                override.getToPod().getName(),
                override.getStartMonth(),
                override.getEndMonth(),
                override.getAllocationPct(),
                override.getNotes()
        );
    }

    default List<TemporaryOverrideResponse> toOverrideResponseList(List<TemporaryOverride> overrides) {
        return overrides.stream().map(this::toOverrideResponse).toList();
    }

    // BauAssumption mappings
    default BauAssumptionResponse toBauResponse(BauAssumption bau) {
        return new BauAssumptionResponse(
                bau.getId(),
                bau.getPod().getId(),
                bau.getPod().getName(),
                bau.getRole(),
                bau.getBauPct()
        );
    }

    default List<BauAssumptionResponse> toBauResponseList(List<BauAssumption> bauList) {
        return bauList.stream().map(this::toBauResponse).toList();
    }

    // TimelineConfig mappings
    default TimelineConfigResponse toTimelineResponse(TimelineConfig config, java.util.Map<Integer, String> monthLabels) {
        return new TimelineConfigResponse(
                config.getId(),
                config.getStartYear(),
                config.getStartMonth(),
                config.getCurrentMonthIndex(),
                config.getWorkingHours(),
                monthLabels
        );
    }

    // EffortPattern mappings
    EffortPatternResponse toEffortPatternResponse(EffortPattern pattern);

    List<EffortPatternResponse> toEffortPatternResponseList(List<EffortPattern> patterns);

    // RoleEffortMix mappings
    RoleEffortMixResponse toRoleEffortMixResponse(RoleEffortMix mix);

    List<RoleEffortMixResponse> toRoleEffortMixResponseList(List<RoleEffortMix> mixes);

    // TshirtSizeConfig response helper (kept for settings page)
    default TshirtSizeResponse toTshirtSizeResponse(TshirtSizeConfig config) {
        return new TshirtSizeResponse(config.getId(), config.getName(), config.getBaseHours(), config.getDisplayOrder());
    }

    default java.util.List<TshirtSizeResponse> toTshirtSizeResponseList(java.util.List<TshirtSizeConfig> configs) {
        return configs.stream().map(this::toTshirtSizeResponse).toList();
    }

    private static BigDecimal orZero(BigDecimal val) {
        return val != null ? val : BigDecimal.ZERO;
    }
}
