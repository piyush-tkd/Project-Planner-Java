package com.portfolioplanner.service.nlp;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Provides the entity catalog used by NLP strategies for entity resolution.
 * Cached for 5 minutes to avoid hitting the database on every query.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NlpCatalogService {

    private static final Logger log = LoggerFactory.getLogger(NlpCatalogService.class);

    private final PodRepository podRepo;
    private final ProjectRepository projectRepo;
    private final ResourceRepository resourceRepo;
    private final SprintRepository sprintRepo;
    private final ReleaseCalendarRepository releaseRepo;
    private final ResourcePodAssignmentRepository podAssignmentRepo;
    private final CostRateRepository costRateRepo;
    private final ProjectPodPlanningRepository planningRepo;
    private final BauAssumptionRepository bauRepo;
    private final TshirtSizeConfigRepository tshirtRepo;
    private final ProjectSprintAllocationRepository sprintAllocRepo;
    private final ResourceAvailabilityRepository availabilityRepo;
    private final EffortPatternRepository effortPatternRepo;
    private final RoleEffortMixRepository roleEffortMixRepo;
    private final ProjectActualRepository projectActualRepo;
    private final TemporaryOverrideRepository overrideRepo;

    private static final String[] MONTH_NAMES = {
            "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    };
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMM dd, yyyy");

    @Cacheable(value = "nlp-catalog", unless = "#result == null")
    public NlpCatalogResponse getCatalog() {
        // Pre-load all shared data once to eliminate duplicate DB calls
        List<Pod> allPods = podRepo.findAll();
        List<Project> allProjects = projectRepo.findAll();
        List<Resource> allResources = resourceRepo.findAll();
        List<Sprint> allSprints = sprintRepo.findAllByOrderByStartDateAsc();
        List<ReleaseCalendar> allReleases = releaseRepo.findAll();
        List<ResourcePodAssignment> allAssignments = podAssignmentRepo.findAll();
        List<CostRate> allCostRates = costRateRepo.findAll();
        List<ProjectPodPlanning> allPlannings = planningRepo.findAll();
        List<BauAssumption> allBauAssumptions = bauRepo.findAll();
        List<TshirtSizeConfig> allTshirtSizes = tshirtRepo.findAll();
        List<ProjectSprintAllocation> allSprintAllocs = sprintAllocRepo.findAll();
        List<ResourceAvailability> allAvailability = availabilityRepo.findAll();
        List<EffortPattern> allEffortPatterns = effortPatternRepo.findAll();
        List<RoleEffortMix> allRoleMixes = roleEffortMixRepo.findAll();
        List<ProjectActual> allActuals = projectActualRepo.findAll();
        List<TemporaryOverride> allOverrides = overrideRepo.findAll();

        List<String> pods = allPods.stream()
                .map(Pod::getName).sorted().collect(Collectors.toList());
        List<String> projects = allProjects.stream()
                .map(Project::getName).sorted().collect(Collectors.toList());
        List<String> resources = allResources.stream()
                .filter(r -> r.getActive() != null && r.getActive())
                .map(Resource::getName).sorted().collect(Collectors.toList());
        List<String> sprints = allSprints.stream()
                .map(Sprint::getName).collect(Collectors.toList());
        List<String> releases = allReleases.stream()
                .map(ReleaseCalendar::getName).sorted().collect(Collectors.toList());

        List<String> roles = List.of("DEVELOPER", "QA", "BSA", "TECH_LEAD");
        List<String> statuses = List.of("NOT_STARTED", "IN_DISCOVERY", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED");

        return new NlpCatalogResponse(
                pods, projects, resources, sprints, releases, roles, statuses,
                buildPageRegistry(),
                buildResourceDetails(allResources, allAssignments, allCostRates),
                buildProjectDetails(allProjects, allPlannings),
                buildPodDetails(allPods, allAssignments, allPlannings, allBauAssumptions),
                buildSprintDetails(allSprints),
                buildReleaseDetails(allReleases),
                buildCostRates(allCostRates),
                buildTshirtSizes(allTshirtSizes),
                safeBuild("projectEstimates", () -> buildProjectEstimates(allPlannings, allReleases)),
                safeBuild("sprintAllocations", () -> buildSprintAllocations(allSprintAllocs, allSprints)),
                safeBuild("resourceAvailabilities", () -> buildResourceAvailabilities(allAvailability, allResources, allAssignments)),
                safeBuild("effortPatterns", () -> buildEffortPatterns(allEffortPatterns)),
                safeBuild("roleEffortMixes", () -> buildRoleEffortMixes(allRoleMixes)),
                safeBuild("projectDependencies", () -> buildProjectDependencies(allProjects)),
                safeBuild("projectActuals", () -> buildProjectActuals(allActuals, allProjects)),
                safeBuild("temporaryOverrides", () -> buildTemporaryOverrides(allOverrides, allAssignments))
        );
    }

    // ── POD details ───────────────────────────────────────────────────────────
    private List<NlpCatalogResponse.PodInfo> buildPodDetails(List<Pod> allPods, List<ResourcePodAssignment> allAssignments,
                                                              List<ProjectPodPlanning> allPlannings, List<BauAssumption> allBauAssumptions) {
        // resourceId -> assignment
        Map<Long, ResourcePodAssignment> assignmentMap = allAssignments.stream()
                .collect(Collectors.toMap(a -> a.getResource().getId(), Function.identity(), (a, b) -> a));

        // podId -> list of resource names
        Map<Long, List<String>> membersByPod = allAssignments.stream()
                .collect(Collectors.groupingBy(
                        a -> a.getPod().getId(),
                        Collectors.mapping(a -> a.getResource().getName(), Collectors.toList())
                ));

        // podId -> list of project names
        Map<Long, List<String>> projectsByPod = allPlannings.stream()
                .collect(Collectors.groupingBy(
                        pp -> pp.getPod().getId(),
                        Collectors.mapping(pp -> pp.getProject().getName(), Collectors.toList())
                ));

        // podId -> avg BAU %
        Map<Long, BigDecimal> avgBauByPod = allBauAssumptions.stream()
                .collect(Collectors.groupingBy(
                        b -> b.getPod().getId(),
                        Collectors.collectingAndThen(
                                Collectors.toList(),
                                list -> {
                                    if (list.isEmpty()) return BigDecimal.ZERO;
                                    BigDecimal sum = list.stream()
                                            .map(BauAssumption::getBauPct)
                                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                                    return sum.divide(BigDecimal.valueOf(list.size()), 1, RoundingMode.HALF_UP);
                                }
                        )
                ));

        return allPods.stream()
                .map(pod -> {
                    List<String> members = membersByPod.getOrDefault(pod.getId(), List.of());
                    List<String> podProjects = projectsByPod.getOrDefault(pod.getId(), List.of());
                    BigDecimal avgBau = avgBauByPod.getOrDefault(pod.getId(), BigDecimal.ZERO);

                    return new NlpCatalogResponse.PodInfo(
                            pod.getId(),
                            pod.getName(),
                            members.size(),
                            podProjects.size(),
                            avgBau.toPlainString() + "%",
                            pod.getActive() != null && pod.getActive(),
                            members,
                            podProjects
                    );
                })
                .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
                .toList();
    }

    // ── Sprint details ────────────────────────────────────────────────────────
    private List<NlpCatalogResponse.SprintInfo> buildSprintDetails(List<Sprint> allSprints) {
        LocalDate today = LocalDate.now();
        return allSprints.stream()
                .map(s -> {
                    String status;
                    if (today.isBefore(s.getStartDate())) status = "Upcoming";
                    else if (today.isAfter(s.getEndDate())) status = "Completed";
                    else status = "Active";

                    return new NlpCatalogResponse.SprintInfo(
                            s.getId(),
                            s.getName(),
                            s.getType(),
                            s.getStartDate().format(DATE_FMT),
                            s.getEndDate().format(DATE_FMT),
                            s.getRequirementsLockInDate() != null
                                    ? s.getRequirementsLockInDate().format(DATE_FMT) : null,
                            status
                    );
                })
                .toList();
    }

    // ── Release details ───────────────────────────────────────────────────────
    private List<NlpCatalogResponse.ReleaseInfo> buildReleaseDetails(List<ReleaseCalendar> allReleases) {
        LocalDate today = LocalDate.now();
        return allReleases.stream()
                .sorted((a, b) -> a.getReleaseDate().compareTo(b.getReleaseDate()))
                .map(r -> {
                    String status;
                    if (today.isAfter(r.getReleaseDate())) status = "Released";
                    else if (today.isAfter(r.getCodeFreezeDate())) status = "Code Frozen";
                    else status = "Upcoming";

                    return new NlpCatalogResponse.ReleaseInfo(
                            r.getId(),
                            r.getName(),
                            r.getReleaseDate().format(DATE_FMT),
                            r.getCodeFreezeDate().format(DATE_FMT),
                            r.getType(),
                            r.getNotes(),
                            status
                    );
                })
                .toList();
    }

    // ── Project details ───────────────────────────────────────────────────────
    private List<NlpCatalogResponse.ProjectInfo> buildProjectDetails(List<Project> allProjects, List<ProjectPodPlanning> allPlannings) {
        Map<Long, List<String>> podsByProject = allPlannings.stream()
                .collect(Collectors.groupingBy(
                        pp -> pp.getProject().getId(),
                        Collectors.mapping(pp -> pp.getPod().getName(), Collectors.toList())
                ));

        return allProjects.stream()
                .map(p -> {
                    List<String> podNames = podsByProject.getOrDefault(p.getId(), List.of());
                    String assignedPods = podNames.isEmpty() ? "None" : String.join(", ", podNames);

                    String timeline;
                    if (p.getStartMonth() != null && p.getStartMonth() >= 1 && p.getStartMonth() <= 12) {
                        String startLabel = MONTH_NAMES[p.getStartMonth()];
                        if (p.getDurationMonths() != null && p.getDurationMonths() > 0) {
                            int endMonth = ((p.getStartMonth() - 1 + p.getDurationMonths() - 1) % 12) + 1;
                            timeline = startLabel + " → " + MONTH_NAMES[endMonth]
                                    + " (" + p.getDurationMonths() + " mo)";
                        } else {
                            timeline = "Starts " + startLabel;
                        }
                    } else {
                        timeline = "Not scheduled";
                    }

                    String duration = p.getDurationMonths() != null
                            ? p.getDurationMonths() + " month" + (p.getDurationMonths() != 1 ? "s" : "")
                            : "N/A";

                    return new NlpCatalogResponse.ProjectInfo(
                            p.getId(), p.getName(),
                            p.getPriority() != null ? p.getPriority().name() : "N/A",
                            p.getOwner() != null ? p.getOwner() : "Unassigned",
                            p.getStatus() != null ? p.getStatus() : "N/A",
                            assignedPods, timeline, duration,
                            p.getClient()
                    );
                })
                .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
                .toList();
    }

    // ── Resource details ──────────────────────────────────────────────────────
    private List<NlpCatalogResponse.ResourceInfo> buildResourceDetails(List<Resource> allResources, List<ResourcePodAssignment> allAssignments,
                                                                        List<CostRate> allCostRates) {
        List<Resource> activeResources = allResources.stream()
                .filter(r -> r.getActive() != null && r.getActive()).toList();

        Map<Long, ResourcePodAssignment> assignmentMap = allAssignments.stream()
                .collect(Collectors.toMap(a -> a.getResource().getId(), Function.identity(), (a, b) -> a));

        Map<String, BigDecimal> costRateMap = allCostRates.stream()
                .collect(Collectors.toMap(
                        cr -> cr.getRole().name() + "|" + cr.getLocation().name(),
                        CostRate::getHourlyRate, (a, b) -> a));

        return activeResources.stream()
                .map(r -> {
                    ResourcePodAssignment assignment = assignmentMap.get(r.getId());
                    String podName = assignment != null ? assignment.getPod().getName() : "Unassigned";
                    String fte = assignment != null && assignment.getCapacityFte() != null
                            ? assignment.getCapacityFte().toPlainString() : "N/A";

                    String billingRate;
                    if (r.getActualRate() != null) {
                        billingRate = "$" + r.getActualRate().toPlainString() + "/hr";
                    } else {
                        String rateKey = r.getRole().name() + "|" + r.getLocation().name();
                        BigDecimal rate = costRateMap.get(rateKey);
                        billingRate = rate != null ? "$" + rate.toPlainString() + "/hr" : "N/A";
                    }

                    return new NlpCatalogResponse.ResourceInfo(
                            r.getId(), r.getName(), r.getRole().name(), r.getLocation().name(),
                            podName, billingRate, fte);
                })
                .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
                .toList();
    }

    // ── Page registry ─────────────────────────────────────────────────────────
    private List<NlpCatalogResponse.PageInfo> buildPageRegistry() {
        return List.of(
                page("dashboard", "/", "Dashboard", "Overview with key metrics and alerts", List.of("home", "main")),
                page("projects", "/projects", "Projects", "Manage portfolio projects", List.of("portfolio", "project list")),
                page("resources", "/resources", "Resources", "Manage team members", List.of("team", "people")),
                page("pods", "/pods", "PODs", "Manage PODs with BAU and complexity", List.of("teams")),
                page("availability", "/availability", "Availability", "Monthly capacity grid per resource", List.of("capacity", "hours")),
                page("overrides", "/overrides", "Overrides", "Temporary resource allocations across pods", List.of("temp allocations")),
                page("team-calendar", "/team-calendar", "Team Calendar", "Team calendar view", List.of("calendar")),
                page("sprint-calendar", "/sprint-calendar", "Sprint Calendar", "View and manage sprints", List.of("sprints")),
                page("release-calendar", "/release-calendar", "Release Calendar", "View and manage releases", List.of("releases")),
                page("sprint-planner", "/sprint-planner", "Sprint Planning Recommender", "Capacity vs demand per POD for active sprint", List.of("sprint recommender", "pod health")),
                page("capacity-gap", "/reports/capacity-gap", "Capacity Gap Report", "Shows gap between capacity and demand per POD per month", List.of("gap report")),
                page("utilization", "/reports/utilization", "Utilization Heatmap", "Heatmap of POD utilization across months", List.of("heatmap")),
                page("capacity-demand", "/reports/capacity-demand", "Capacity vs Demand", "Side-by-side capacity and demand comparison", List.of("supply demand")),
                page("concurrency", "/reports/concurrency", "Concurrency Risk", "Number of simultaneous projects per POD", List.of("concurrency risk")),
                page("hiring-forecast", "/reports/hiring-forecast", "Hiring Forecast", "Predicted hiring needs based on demand gaps", List.of("hiring", "hiring needs")),
                page("project-health", "/reports/project-health", "Project Health", "Health status of all projects", List.of("project status", "project risk")),
                page("cross-pod", "/reports/cross-pod", "Cross-POD Dependencies", "Projects spanning multiple PODs", List.of("dependencies")),
                page("gantt", "/reports/gantt", "Project Gantt", "Timeline view of projects", List.of("gantt chart", "timeline chart")),
                page("budget", "/reports/budget", "Budget & Cost", "Budget and cost tracking", List.of("cost report")),
                page("resource-roi", "/reports/resource-roi", "Resource ROI", "Return on investment per resource", List.of("roi")),
                page("jira-pods", "/jira-pods", "Jira POD Dashboard", "Jira metrics per POD", List.of("pod dashboard")),
                page("jira-support", "/jira-support", "Jira Support Queue", "Support ticket metrics and aging", List.of("support tickets")),
                page("jira-worklog", "/jira-worklog", "Jira Worklog", "Time tracking from Jira", List.of("worklog", "time tracking")),
                page("simulator-timeline", "/simulator/timeline", "Timeline Simulator", "What-if analysis for timeline changes", List.of("what if", "simulator")),
                page("simulator-scenario", "/simulator/scenario", "Scenario Simulator", "Scenario-based planning", List.of("scenario")),
                page("nlp-settings", "/settings/nlp", "NLP Settings", "Configure NLP strategy chain and LLM providers", List.of("ai settings", "nlp config"))
        );
    }

    private NlpCatalogResponse.PageInfo page(String id, String route, String title, String description, List<String> aliases) {
        return new NlpCatalogResponse.PageInfo(id, route, title, description, aliases);
    }

    // ── Cost rates ─────────────────────────────────────────────────────────
    private List<NlpCatalogResponse.CostRateInfo> buildCostRates(List<CostRate> allCostRates) {
        return allCostRates.stream()
                .map(cr -> new NlpCatalogResponse.CostRateInfo(
                        cr.getRole().name(),
                        cr.getLocation().name(),
                        "$" + cr.getHourlyRate().setScale(2, RoundingMode.HALF_UP) + "/hr"
                ))
                .collect(Collectors.toList());
    }

    // ── T-shirt sizes ──────────────────────────────────────────────────────
    private List<NlpCatalogResponse.TshirtSizeInfo> buildTshirtSizes(List<TshirtSizeConfig> allTshirtSizes) {
        return allTshirtSizes.stream()
                .map(t -> new NlpCatalogResponse.TshirtSizeInfo(t.getName(), t.getBaseHours()))
                .collect(Collectors.toList());
    }

    // ── Project estimates (per-POD hour breakdowns) ─────────────────────────
    private List<NlpCatalogResponse.ProjectEstimateInfo> buildProjectEstimates(List<ProjectPodPlanning> allPlannings, List<ReleaseCalendar> allReleases) {
        // Group plannings by project ID
        Map<Long, List<ProjectPodPlanning>> byProject = allPlannings.stream()
                .collect(Collectors.groupingBy(pp -> pp.getProject().getId()));

        // Build release name lookup
        Map<Long, String> releaseNames = allReleases.stream()
                .collect(Collectors.toMap(ReleaseCalendar::getId, ReleaseCalendar::getName, (a, b) -> a));

        return byProject.entrySet().stream()
                .map(entry -> {
                    List<ProjectPodPlanning> plannings = entry.getValue();
                    Project project = plannings.get(0).getProject();

                    BigDecimal totalDev = BigDecimal.ZERO;
                    BigDecimal totalQa = BigDecimal.ZERO;
                    BigDecimal totalBsa = BigDecimal.ZERO;
                    BigDecimal totalTl = BigDecimal.ZERO;

                    List<NlpCatalogResponse.PodEstimateDetail> podEstimates = new java.util.ArrayList<>();

                    for (ProjectPodPlanning pp : plannings) {
                        BigDecimal dev = pp.getDevHours() != null ? pp.getDevHours() : BigDecimal.ZERO;
                        BigDecimal qa = pp.getQaHours() != null ? pp.getQaHours() : BigDecimal.ZERO;
                        BigDecimal bsa = pp.getBsaHours() != null ? pp.getBsaHours() : BigDecimal.ZERO;
                        BigDecimal tl = pp.getTechLeadHours() != null ? pp.getTechLeadHours() : BigDecimal.ZERO;
                        BigDecimal podTotal = dev.add(qa).add(bsa).add(tl);

                        BigDecimal contingency = pp.getContingencyPct() != null ? pp.getContingencyPct() : BigDecimal.ZERO;
                        BigDecimal contingencyHours = podTotal.multiply(contingency).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                        BigDecimal podGrand = podTotal.add(contingencyHours);

                        totalDev = totalDev.add(dev);
                        totalQa = totalQa.add(qa);
                        totalBsa = totalBsa.add(bsa);
                        totalTl = totalTl.add(tl);

                        String releaseName = (pp.getTargetRelease() != null)
                                ? releaseNames.getOrDefault(pp.getTargetRelease().getId(), "N/A") : "N/A";

                        podEstimates.add(new NlpCatalogResponse.PodEstimateDetail(
                                pp.getPod().getName(),
                                fmtHours(dev), fmtHours(qa), fmtHours(bsa), fmtHours(tl),
                                fmtHours(podGrand),
                                contingency.toPlainString() + "%",
                                pp.getEffortPattern() != null ? pp.getEffortPattern() : "N/A",
                                releaseName
                        ));
                    }

                    BigDecimal grandTotal = totalDev.add(totalQa).add(totalBsa).add(totalTl);

                    return new NlpCatalogResponse.ProjectEstimateInfo(
                            project.getId(), project.getName(),
                            fmtHours(totalDev), fmtHours(totalQa),
                            fmtHours(totalBsa), fmtHours(totalTl),
                            fmtHours(grandTotal),
                            podEstimates.size(), podEstimates
                    );
                })
                .sorted((a, b) -> a.projectName().compareToIgnoreCase(b.projectName()))
                .toList();
    }

    private String fmtHours(BigDecimal hours) {
        if (hours == null || hours.compareTo(BigDecimal.ZERO) == 0) return "0";
        return hours.setScale(1, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    private String monthLabel(int monthIndex) {
        if (monthIndex >= 1 && monthIndex <= 12) return MONTH_NAMES[monthIndex];
        return "M" + monthIndex;
    }

    /** Wraps a builder call so a failure returns an empty list instead of crashing the whole catalog. */
    private <T> List<T> safeBuild(String name, java.util.function.Supplier<List<T>> builder) {
        try {
            return builder.get();
        } catch (Exception e) {
            log.error("NlpCatalogService: failed to build {} — returning empty list. Error: {}", name, e.getMessage(), e);
            return List.of();
        }
    }

    // ── Sprint allocations ──────────────────────────────────────────────────
    private List<NlpCatalogResponse.SprintAllocationInfo> buildSprintAllocations(List<ProjectSprintAllocation> allSprintAllocs, List<Sprint> allSprints) {
        LocalDate today = LocalDate.now();
        Map<Long, Sprint> sprintMap = allSprints.stream()
                .collect(Collectors.toMap(Sprint::getId, Function.identity(), (a, b) -> a));

        return allSprintAllocs.stream()
                .map(a -> {
                    String sprintStatus;
                    Sprint s = a.getSprint();
                    if (today.isBefore(s.getStartDate())) sprintStatus = "Upcoming";
                    else if (today.isAfter(s.getEndDate())) sprintStatus = "Completed";
                    else sprintStatus = "Active";

                    BigDecimal dev = a.getDevHours() != null ? a.getDevHours() : BigDecimal.ZERO;
                    BigDecimal qa = a.getQaHours() != null ? a.getQaHours() : BigDecimal.ZERO;
                    BigDecimal bsa = a.getBsaHours() != null ? a.getBsaHours() : BigDecimal.ZERO;
                    BigDecimal tl = a.getTechLeadHours() != null ? a.getTechLeadHours() : BigDecimal.ZERO;

                    return new NlpCatalogResponse.SprintAllocationInfo(
                            s.getId(), s.getName(), sprintStatus,
                            a.getProject().getName(), a.getPod().getName(),
                            fmtHours(dev), fmtHours(qa), fmtHours(bsa), fmtHours(tl),
                            fmtHours(dev.add(qa).add(bsa).add(tl))
                    );
                })
                .toList();
    }

    // ── Resource availability ────────────────────────────────────────────────
    private List<NlpCatalogResponse.ResourceAvailabilityInfo> buildResourceAvailabilities(List<ResourceAvailability> allAvailability,
                                                                                           List<Resource> allResources, List<ResourcePodAssignment> allAssignments) {
        // Build resource lookup + pod assignment lookup
        Map<Long, Resource> resourceMap = allResources.stream()
                .collect(Collectors.toMap(Resource::getId, Function.identity(), (a, b) -> a));
        Map<Long, ResourcePodAssignment> assignmentMap = allAssignments.stream()
                .collect(Collectors.toMap(a -> a.getResource().getId(), Function.identity(), (a, b) -> a));

        return allAvailability.stream()
                .filter(a -> {
                    Resource r = resourceMap.get(a.getResource().getId());
                    return r != null && r.getActive() != null && r.getActive();
                })
                .map(a -> {
                    Resource r = resourceMap.get(a.getResource().getId());
                    ResourcePodAssignment assignment = assignmentMap.get(r.getId());
                    String podName = assignment != null ? assignment.getPod().getName() : "Unassigned";

                    return new NlpCatalogResponse.ResourceAvailabilityInfo(
                            r.getId(), r.getName(), r.getRole().name(), podName,
                            a.getMonthIndex(), monthLabel(a.getMonthIndex()),
                            fmtHours(a.getHours())
                    );
                })
                .toList();
    }

    // ── Effort patterns ──────────────────────────────────────────────────────
    private List<NlpCatalogResponse.EffortPatternInfo> buildEffortPatterns(List<EffortPattern> allEffortPatterns) {
        return allEffortPatterns.stream()
                .map(ep -> new NlpCatalogResponse.EffortPatternInfo(
                        ep.getName(),
                        ep.getDescription() != null ? ep.getDescription() : "",
                        ep.getWeights() != null ? ep.getWeights().toString() : "{}"
                ))
                .toList();
    }

    // ── Role effort mixes ────────────────────────────────────────────────────
    private List<NlpCatalogResponse.RoleEffortMixInfo> buildRoleEffortMixes(List<RoleEffortMix> allRoleMixes) {
        return allRoleMixes.stream()
                .map(rem -> new NlpCatalogResponse.RoleEffortMixInfo(
                        rem.getRole().name(),
                        rem.getMixPct().setScale(1, RoundingMode.HALF_UP).toPlainString() + "%"
                ))
                .toList();
    }

    // ── Project dependencies ─────────────────────────────────────────────────
    private List<NlpCatalogResponse.ProjectDependencyInfo> buildProjectDependencies(List<Project> allProjects) {
        return allProjects.stream()
                .filter(p -> p.getBlockedBy() != null)
                .map(p -> new NlpCatalogResponse.ProjectDependencyInfo(
                        p.getId(), p.getName(),
                        p.getBlockedBy().getName(),
                        p.getStatus() != null ? p.getStatus() : "N/A",
                        p.getBlockedBy().getStatus() != null ? p.getBlockedBy().getStatus() : "N/A"
                ))
                .sorted((a, b) -> a.projectName().compareToIgnoreCase(b.projectName()))
                .toList();
    }

    // ── Project actuals ──────────────────────────────────────────────────────
    private List<NlpCatalogResponse.ProjectActualInfo> buildProjectActuals(List<ProjectActual> allActuals, List<Project> allProjects) {
        Map<Long, Project> projectMap = allProjects.stream()
                .collect(Collectors.toMap(Project::getId, Function.identity(), (a, b) -> a));

        return allActuals.stream()
                .filter(a -> a.getActualHours() != null && a.getActualHours().compareTo(BigDecimal.ZERO) > 0)
                .map(a -> {
                    Project p = projectMap.get(a.getProject().getId());
                    String pName = p != null ? p.getName() : "Unknown";
                    return new NlpCatalogResponse.ProjectActualInfo(
                            a.getProject().getId(), pName,
                            a.getMonthKey(), monthLabel(a.getMonthKey()),
                            fmtHours(a.getActualHours())
                    );
                })
                .toList();
    }

    // ── Temporary overrides ──────────────────────────────────────────────────
    private List<NlpCatalogResponse.OverrideInfo> buildTemporaryOverrides(List<TemporaryOverride> allOverrides, List<ResourcePodAssignment> allAssignments) {
        Map<Long, ResourcePodAssignment> assignmentMap = allAssignments.stream()
                .collect(Collectors.toMap(a -> a.getResource().getId(), Function.identity(), (a, b) -> a));

        return allOverrides.stream()
                .map(o -> {
                    Resource r = o.getResource();
                    ResourcePodAssignment homePod = assignmentMap.get(r.getId());
                    String fromPodName = homePod != null ? homePod.getPod().getName() : "Unassigned";

                    return new NlpCatalogResponse.OverrideInfo(
                            o.getId(), r.getName(), r.getRole().name(),
                            fromPodName, o.getToPod().getName(),
                            o.getStartMonth(), o.getEndMonth(),
                            monthLabel(o.getStartMonth()), monthLabel(o.getEndMonth()),
                            o.getAllocationPct() != null ? o.getAllocationPct().toPlainString() + "%" : "100%",
                            o.getNotes()
                    );
                })
                .toList();
    }
}
