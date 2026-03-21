package com.portfolioplanner.dto.response;

import java.util.List;

public record NlpCatalogResponse(
        List<String> pods,
        List<String> projects,
        List<String> resources,
        List<String> sprints,
        List<String> releases,
        List<String> roles,
        List<String> statuses,
        List<PageInfo> pages,
        List<ResourceInfo> resourceDetails,
        List<ProjectInfo> projectDetails,
        List<PodInfo> podDetails,
        List<SprintInfo> sprintDetails,
        List<ReleaseInfo> releaseDetails,
        List<CostRateInfo> costRates,
        List<TshirtSizeInfo> tshirtSizes,
        List<ProjectEstimateInfo> projectEstimates,
        List<SprintAllocationInfo> sprintAllocations,
        List<ResourceAvailabilityInfo> resourceAvailabilities,
        List<EffortPatternInfo> effortPatterns,
        List<RoleEffortMixInfo> roleEffortMixes,
        List<ProjectDependencyInfo> projectDependencies,
        List<ProjectActualInfo> projectActuals,
        List<OverrideInfo> temporaryOverrides
) {
    public record PageInfo(
            String id,
            String route,
            String title,
            String description,
            List<String> aliases
    ) {}

    /** Rich resource info for NLP resource-lookup queries. */
    public record ResourceInfo(
            Long id,
            String name,
            String role,
            String location,
            String podName,
            String billingRate,
            String fte
    ) {}

    /** Rich project info for NLP project-lookup queries. */
    public record ProjectInfo(
            Long id,
            String name,
            String priority,
            String owner,
            String status,
            String assignedPods,
            String timeline,
            String durationMonths,
            String client
    ) {}

    /** Rich POD info for NLP pod-lookup queries. */
    public record PodInfo(
            Long id,
            String name,
            int memberCount,
            int projectCount,
            String avgBauPct,
            boolean active,
            List<String> members,
            List<String> projectNames
    ) {}

    /** Rich sprint info for NLP sprint-lookup queries. */
    public record SprintInfo(
            Long id,
            String name,
            String type,
            String startDate,
            String endDate,
            String lockInDate,
            String status
    ) {}

    /** Rich release info for NLP release-lookup queries. */
    public record ReleaseInfo(
            Long id,
            String name,
            String releaseDate,
            String codeFreezeDate,
            String type,
            String notes,
            String status
    ) {}

    /** Cost rate by role × location. */
    public record CostRateInfo(
            String role,
            String location,
            String hourlyRate
    ) {}

    /** T-shirt size → base hours mapping. */
    public record TshirtSizeInfo(
            String name,
            int baseHours
    ) {}

    /** Per-POD hour breakdown within a project. */
    public record PodEstimateDetail(
            String podName,
            String devHours,
            String qaHours,
            String bsaHours,
            String techLeadHours,
            String totalHours,
            String contingencyPct,
            String effortPattern,
            String targetRelease
    ) {}

    /** Project-level estimates with per-POD hour breakdowns. */
    public record ProjectEstimateInfo(
            Long projectId,
            String projectName,
            String totalDevHours,
            String totalQaHours,
            String totalBsaHours,
            String totalTechLeadHours,
            String grandTotalHours,
            int podCount,
            List<PodEstimateDetail> podEstimates
    ) {}

    /** Sprint allocation: hours allocated per project per pod per sprint. */
    public record SprintAllocationInfo(
            Long sprintId,
            String sprintName,
            String sprintStatus,
            String projectName,
            String podName,
            String devHours,
            String qaHours,
            String bsaHours,
            String techLeadHours,
            String totalHours
    ) {}

    /** Resource monthly availability (capacity hours). */
    public record ResourceAvailabilityInfo(
            Long resourceId,
            String resourceName,
            String role,
            String podName,
            int monthIndex,
            String monthLabel,
            String availableHours
    ) {}

    /** Named effort distribution pattern. */
    public record EffortPatternInfo(
            String name,
            String description,
            String weights
    ) {}

    /** Standard role effort mix percentages. */
    public record RoleEffortMixInfo(
            String role,
            String mixPct
    ) {}

    /** Project dependency (blocked-by relationship). */
    public record ProjectDependencyInfo(
            Long projectId,
            String projectName,
            String blockedByName,
            String projectStatus,
            String blockedByStatus
    ) {}

    /** Actual hours logged per project per month. */
    public record ProjectActualInfo(
            Long projectId,
            String projectName,
            int monthKey,
            String monthLabel,
            String actualHours
    ) {}

    /** Temporary resource override / cross-pod allocation. */
    public record OverrideInfo(
            Long id,
            String resourceName,
            String resourceRole,
            String fromPod,
            String toPod,
            int startMonth,
            int endMonth,
            String startLabel,
            String endLabel,
            String allocationPct,
            String notes
    ) {}
}
