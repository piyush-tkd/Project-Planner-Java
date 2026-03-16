package com.portfolioplanner.mapper;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.dto.request.*;
import com.portfolioplanner.dto.response.*;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

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
                resource.getRole(),
                resource.getLocation(),
                resource.getActive(),
                resource.getCountsInCapacity(),
                podAssignment
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
                project.getCapacityNote()
        );
    }

    default List<ProjectResponse> toProjectResponseList(List<Project> projects) {
        return projects.stream().map(this::toProjectResponse).toList();
    }

    // ProjectPodPlanning mappings
    default ProjectPodPlanningResponse toPodPlanningResponse(ProjectPodPlanning planning) {
        return new ProjectPodPlanningResponse(
                planning.getId(),
                planning.getPod().getId(),
                planning.getPod().getName(),
                planning.getTshirtSize(),
                planning.getComplexityOverride(),
                planning.getEffortPattern(),
                planning.getPodStartMonth(),
                planning.getDurationOverride()
        );
    }

    default List<ProjectPodPlanningResponse> toPodPlanningResponseList(List<ProjectPodPlanning> plannings) {
        return plannings.stream().map(this::toPodPlanningResponse).toList();
    }

    default ProjectPodMatrixResponse toProjectPodMatrixResponse(ProjectPodPlanning planning) {
        Project project = planning.getProject();
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
                planning.getTshirtSize(),
                planning.getComplexityOverride(),
                planning.getEffortPattern(),
                planning.getPodStartMonth(),
                planning.getDurationOverride()
        );
    }

    default List<ProjectPodMatrixResponse> toProjectPodMatrixResponseList(List<ProjectPodPlanning> plannings) {
        return plannings.stream().map(this::toProjectPodMatrixResponse).toList();
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

    // TshirtSizeConfig response helper
    default TshirtSizeResponse toTshirtSizeResponse(TshirtSizeConfig config) {
        return new TshirtSizeResponse(config.getId(), config.getName(), config.getBaseHours(), config.getDisplayOrder());
    }

    default java.util.List<TshirtSizeResponse> toTshirtSizeResponseList(java.util.List<TshirtSizeConfig> configs) {
        return configs.stream().map(this::toTshirtSizeResponse).toList();
    }
}
