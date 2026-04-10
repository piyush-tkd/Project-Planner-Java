package com.portfolioplanner.service.calculation;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.domain.repository.*;
import com.portfolioplanner.dto.request.SimulationRequest;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CalculationEngine {

    private final ProjectRepository projectRepository;
    private final ProjectPodPlanningRepository planningRepository;
    private final ResourceRepository resourceRepository;
    private final ResourcePodAssignmentRepository assignmentRepository;
    private final ResourceAvailabilityRepository availabilityRepository;
    private final TemporaryOverrideRepository overrideRepository;
    private final BauAssumptionRepository bauRepository;
    private final TimelineConfigRepository timelineConfigRepository;
    private final EffortPatternRepository effortPatternRepository;
    private final RoleEffortMixRepository roleEffortMixRepository;
    private final PodRepository podRepository;
    private final DemandCalculator demandCalculator;
    private final CapacityCalculator capacityCalculator;
    private final GapAnalyzer gapAnalyzer;
    private final UtilizationCalculator utilizationCalculator;
    private final HiringForecastCalculator hiringForecastCalculator;
    private final ConcurrencyRiskCalculator concurrencyRiskCalculator;
    private final HolidayCalendarRepository holidayCalendarRepository;
    private final LeaveEntryRepository leaveEntryRepository;

    @Cacheable(value = "calculations", sync = true)
    public CalculationSnapshot compute() {
        log.info("Starting calculation engine compute...");
        // Load all data
        List<Project> allProjects = projectRepository.findAll();
        List<ProjectPodPlanning> allPlannings = planningRepository.findAll();
        List<Resource> allResources = resourceRepository.findByActiveTrueAndCountsInCapacityTrue();
        List<ResourcePodAssignment> allAssignments = assignmentRepository.findAll();
        List<ResourceAvailability> allAvailabilities = availabilityRepository.findAll();
        List<TemporaryOverride> allOverrides = overrideRepository.findAll();
        List<BauAssumption> allBau = bauRepository.findAll();
        List<EffortPattern> allPatterns = effortPatternRepository.findAll();
        List<RoleEffortMix> allRoleMix = roleEffortMixRepository.findAll();
        List<Pod> allPods = podRepository.findByActiveTrueOrderByDisplayOrderAsc();
        log.info("Loaded {} projects, {} plannings, {} resources, {} pods", allProjects.size(), allPlannings.size(), allResources.size(), allPods.size());

        return buildSnapshot(allProjects, allPlannings, allResources, allAssignments,
                allAvailabilities, allOverrides, allBau, allPatterns, allRoleMix, allPods);
    }

    @Transactional(readOnly = true)
    public CalculationSnapshot computeWithOverrides(List<SimulationRequest.ProjectOverride> overrides) {
        // Load all data
        List<Project> allProjects = projectRepository.findAll();
        List<ProjectPodPlanning> allPlannings = planningRepository.findAll();
        List<Resource> allResources = resourceRepository.findByActiveTrueAndCountsInCapacityTrue();
        List<ResourcePodAssignment> allAssignments = assignmentRepository.findAll();
        List<ResourceAvailability> allAvailabilities = availabilityRepository.findAll();
        List<TemporaryOverride> allTempOverrides = overrideRepository.findAll();
        List<BauAssumption> allBau = bauRepository.findAll();
        List<EffortPattern> allPatterns = effortPatternRepository.findAll();
        List<RoleEffortMix> allRoleMix = roleEffortMixRepository.findAll();
        List<Pod> allPods = podRepository.findByActiveTrueOrderByDisplayOrderAsc();

        // Clone projects and apply simulation overrides
        Map<Long, Project> projectMap = allProjects.stream()
                .collect(Collectors.toMap(Project::getId, Function.identity()));

        List<Project> simulatedProjects = new ArrayList<>();
        for (Project p : allProjects) {
            Project clone = new Project();
            clone.setId(p.getId());
            clone.setName(p.getName());
            clone.setPriority(p.getPriority());
            clone.setOwner(p.getOwner());
            clone.setStartMonth(p.getStartMonth());
            clone.setTargetEndMonth(p.getTargetEndMonth());
            clone.setDurationMonths(p.getDurationMonths());
            clone.setDefaultPattern(p.getDefaultPattern());
            clone.setNotes(p.getNotes());
            clone.setStatus(p.getStatus());
            clone.setBlockedBy(p.getBlockedBy());
            clone.setTargetDate(p.getTargetDate());
            clone.setStartDate(p.getStartDate());
            clone.setCapacityNote(p.getCapacityNote());
            simulatedProjects.add(clone);
        }

        if (overrides != null) {
            Map<Long, Project> simMap = simulatedProjects.stream()
                    .collect(Collectors.toMap(Project::getId, Function.identity()));

            for (SimulationRequest.ProjectOverride ov : overrides) {
                Project p = simMap.get(ov.projectId());
                if (p == null) continue;

                if (ov.newStartMonth() != null) {
                    p.setStartMonth(ov.newStartMonth());
                }
                if (ov.newDuration() != null) {
                    p.setDurationMonths(ov.newDuration());
                }
                if (ov.newPattern() != null) {
                    p.setDefaultPattern(ov.newPattern());
                }
            }
        }

        return buildSnapshot(simulatedProjects, allPlannings, allResources, allAssignments,
                allAvailabilities, allTempOverrides, allBau, allPatterns, allRoleMix, allPods);
    }

    private CalculationSnapshot buildSnapshot(
            List<Project> projects,
            List<ProjectPodPlanning> plannings,
            List<Resource> resources,
            List<ResourcePodAssignment> assignments,
            List<ResourceAvailability> availabilities,
            List<TemporaryOverride> overrides,
            List<BauAssumption> bauAssumptions,
            List<EffortPattern> patterns,
            List<RoleEffortMix> roleMixes,
            List<Pod> pods) {

        // Build lookup maps
        Map<Long, Project> projectMap = projects.stream()
                .collect(Collectors.toMap(Project::getId, Function.identity()));
        Map<Long, Pod> podMap = pods.stream()
                .collect(Collectors.toMap(Pod::getId, Function.identity()));
        Map<String, EffortPattern> patternMap = patterns.stream()
                .collect(Collectors.toMap(EffortPattern::getName, Function.identity()));
        Map<Role, BigDecimal> roleMixMap = roleMixes.stream()
                .collect(Collectors.toMap(RoleEffortMix::getRole, RoleEffortMix::getMixPct));
        Map<Long, ResourcePodAssignment> assignmentMap = assignments.stream()
                .collect(Collectors.toMap(a -> a.getResource().getId(), Function.identity(), (a, b) -> a));

        // BAU lookup: podId -> role -> bauPct
        Map<Long, Map<Role, BigDecimal>> bauByPodRole = new HashMap<>();
        for (BauAssumption bau : bauAssumptions) {
            bauByPodRole.computeIfAbsent(bau.getPod().getId(), k -> new EnumMap<>(Role.class))
                    .put(bau.getRole(), bau.getBauPct());
        }

        // Working hours map: monthIndex -> BigDecimal hours
        Map<Integer, BigDecimal> workingHoursMap = getWorkingHoursMap();

        // Calculate demand and capacity
        Map<Long, Map<Role, Map<Integer, BigDecimal>>> demandData = demandCalculator.calculate(
                plannings, patternMap, podMap, projectMap);
        log.info("Demand calculated for {} pods", demandData.size());

        // Build holiday deduction map for the planning year (8 hrs per holiday)
        int planningYear = getPlanningYear();
        Map<String, Map<Integer, BigDecimal>> holidayDeductions = buildHolidayDeductionMap(planningYear);

        // Build leave deduction map for the planning year (planned/sick leave per resource)
        Map<Long, Map<Integer, BigDecimal>> leaveDeductions = buildLeaveDeductionMap(planningYear);

        Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacityData = capacityCalculator.calculate(
                resources, assignmentMap, availabilities, overrides, bauByPodRole, holidayDeductions, leaveDeductions);
        log.info("Capacity calculated for {} pods (holiday + leave deductions applied for year {})",
                capacityData.size(), planningYear);

        // Gap analysis
        List<PodMonthGap> gaps = gapAnalyzer.analyze(demandData, capacityData, podMap, workingHoursMap);

        // Utilization
        List<PodMonthUtilization> utilization = utilizationCalculator.calculate(demandData, capacityData, podMap);

        // Hiring forecast
        List<PodRoleMonthHire> hiringForecast = hiringForecastCalculator.calculate(
                demandData, capacityData, podMap, workingHoursMap);

        // Concurrency risk
        List<PodMonthConcurrency> concurrencyRisk = concurrencyRiskCalculator.calculate(
                plannings, podMap, projectMap);

        // Convert to named maps (podName -> roleName -> month -> hours)
        Map<String, Map<String, Map<Integer, BigDecimal>>> demandNamed = toNamedMap(demandData, podMap);
        Map<String, Map<String, Map<Integer, BigDecimal>>> capacityNamed = toNamedMap(capacityData, podMap);

        // Executive summary
        ExecutiveSummaryData executiveSummary = buildExecutiveSummary(
                resources, projects, pods, gaps, utilization, hiringForecast, plannings, podMap);

        log.info("Calculation complete: utilization={}%, deficit months={}, at risk={}", executiveSummary.overallUtilizationPct(), executiveSummary.podMonthsInDeficit(), executiveSummary.projectsAtRisk());

        // Capacity-demand summary by month
        List<CapacityDemandMonth> capacityDemandSummary = buildCapacityDemandSummary(
                demandData, capacityData);

        return new CalculationSnapshot(
                demandNamed, capacityNamed, demandData, capacityData,
                gaps, utilization, hiringForecast, concurrencyRisk,
                executiveSummary, capacityDemandSummary);
    }

    private Map<Integer, BigDecimal> getWorkingHoursMap() {
        Map<Integer, BigDecimal> workingHoursMap = new HashMap<>();
        TimelineConfig config = timelineConfigRepository.findAll().stream().findFirst().orElse(null);
        if (config != null && config.getWorkingHours() != null) {
            for (Map.Entry<String, Integer> entry : config.getWorkingHours().entrySet()) {
                try {
                    String key = entry.getKey().replace("M", "");
                    int monthIndex = Integer.parseInt(key);
                    workingHoursMap.put(monthIndex, BigDecimal.valueOf(entry.getValue()));
                } catch (NumberFormatException ignored) {
                }
            }
        }
        // Default 160 hours for any missing month
        for (int m = 1; m <= 12; m++) {
            workingHoursMap.putIfAbsent(m, BigDecimal.valueOf(160));
        }
        return workingHoursMap;
    }

    /**
     * Returns the planning year from the first TimelineConfig, or the current year as a fallback.
     */
    private int getPlanningYear() {
        return timelineConfigRepository.findAll().stream()
            .findFirst()
            .map(TimelineConfig::getStartYear)
            .orElse(LocalDate.now().getYear());
    }

    /**
     * Builds a holiday deduction map: location → monthIndex → hours to deduct.
     * Each holiday counts as 8 hours.  "ALL" location holidays are merged into
     * both US and INDIA buckets so no cross-location holidays are missed.
     */
    private Map<String, Map<Integer, BigDecimal>> buildHolidayDeductionMap(int year) {
        List<HolidayCalendar> holidays = holidayCalendarRepository.findByYearOrderByHolidayDateAsc(year);

        Map<String, Map<Integer, BigDecimal>> deductions = new HashMap<>();
        for (HolidayCalendar h : holidays) {
            String loc = h.getLocation();
            int month = h.getHolidayDate().getMonthValue();
            BigDecimal hrs = BigDecimal.valueOf(8);

            if ("ALL".equals(loc)) {
                // Add to both US and INDIA
                deductions.computeIfAbsent("US",    k -> new HashMap<>()).merge(month, hrs, BigDecimal::add);
                deductions.computeIfAbsent("INDIA", k -> new HashMap<>()).merge(month, hrs, BigDecimal::add);
            } else {
                deductions.computeIfAbsent(loc, k -> new HashMap<>()).merge(month, hrs, BigDecimal::add);
            }
        }
        log.info("Holiday deductions for {}: {} location buckets, {} total holidays",
            year, deductions.size(), holidays.size());
        return deductions;
    }

    /**
     * Builds a leave deduction map: resourceId → monthIndex → hours to deduct.
     * Aggregates all leave entries for the given year.
     */
    private Map<Long, Map<Integer, BigDecimal>> buildLeaveDeductionMap(int year) {
        List<Object[]> rows = leaveEntryRepository.sumLeaveHoursByResourceAndMonth(year);
        Map<Long, Map<Integer, BigDecimal>> deductions = new HashMap<>();
        for (Object[] row : rows) {
            Long resourceId = ((Number) row[0]).longValue();
            int  monthIndex = ((Number) row[1]).intValue();
            BigDecimal hrs  = new BigDecimal(row[2].toString());
            deductions.computeIfAbsent(resourceId, k -> new HashMap<>())
                      .put(monthIndex, hrs);
        }
        if (!deductions.isEmpty()) {
            log.info("Leave deductions for {}: {} resources with leave entries", year, deductions.size());
        }
        return deductions;
    }

    private Map<String, Map<String, Map<Integer, BigDecimal>>> toNamedMap(
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> data,
            Map<Long, Pod> podMap) {

        Map<String, Map<String, Map<Integer, BigDecimal>>> named = new LinkedHashMap<>();
        for (Map.Entry<Long, Map<Role, Map<Integer, BigDecimal>>> podEntry : data.entrySet()) {
            Pod pod = podMap.get(podEntry.getKey());
            String podName = pod != null ? pod.getName() : "Pod-" + podEntry.getKey();

            Map<String, Map<Integer, BigDecimal>> roleMap = new LinkedHashMap<>();
            for (Map.Entry<Role, Map<Integer, BigDecimal>> roleEntry : podEntry.getValue().entrySet()) {
                roleMap.put(roleEntry.getKey().name(), roleEntry.getValue());
            }
            named.put(podName, roleMap);
        }
        return named;
    }

    private ExecutiveSummaryData buildExecutiveSummary(
            List<Resource> resources,
            List<Project> projects,
            List<Pod> pods,
            List<PodMonthGap> gaps,
            List<PodMonthUtilization> utilization,
            List<PodRoleMonthHire> hiringForecast,
            List<ProjectPodPlanning> plannings,
            Map<Long, Pod> podMap) {

        int totalResources = resources.size();
        int activeProjects = (int) projects.stream()
                .filter(p -> "ACTIVE".equalsIgnoreCase(p.getStatus())).count();
        int totalPods = pods.size();

        // Overall utilization: weighted average by capacity hours (demand / capacity * 100)
        BigDecimal totalDemandAll = BigDecimal.ZERO;
        BigDecimal totalCapacityAll = BigDecimal.ZERO;
        for (PodMonthGap g : gaps) {
            totalDemandAll = totalDemandAll.add(g.demandHours());
            totalCapacityAll = totalCapacityAll.add(g.capacityHours());
        }
        BigDecimal overallUtilPct = totalCapacityAll.compareTo(BigDecimal.ZERO) > 0
                ? totalDemandAll.multiply(BigDecimal.valueOf(100))
                    .divide(totalCapacityAll, 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Pod-months in deficit (gap < 0)
        int podMonthsInDeficit = (int) gaps.stream()
                .filter(g -> g.gapHours().compareTo(BigDecimal.ZERO) < 0).count();

        // Highest risk pod: pod with most CRITICAL/RED months
        Map<String, Integer> riskScore = new HashMap<>();
        for (PodMonthUtilization u : utilization) {
            if ("CRITICAL".equals(u.level()) || "RED".equals(u.level())) {
                riskScore.merge(u.podName(), 1, Integer::sum);
            }
        }
        String highestRiskPod = riskScore.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("None");

        // Projects at risk: count distinct projects assigned to pods with CRITICAL months
        Set<Long> criticalPodIds = new HashSet<>();
        for (PodMonthUtilization u : utilization) {
            if ("CRITICAL".equals(u.level())) {
                criticalPodIds.add(u.podId());
            }
        }
        Set<Long> atRiskProjectIds = new HashSet<>();
        if (!criticalPodIds.isEmpty()) {
            for (ProjectPodPlanning pp : plannings) {
                if (pp.getPod() != null && criticalPodIds.contains(pp.getPod().getId())) {
                    atRiskProjectIds.add(pp.getProject().getId());
                }
            }
        }
        int projectsAtRisk = atRiskProjectIds.size();

        // Recommended hires in next 3 months
        int currentMonthIndex = 1;
        TimelineConfig config = timelineConfigRepository.findAll().stream().findFirst().orElse(null);
        if (config != null && config.getCurrentMonthIndex() != null) {
            currentMonthIndex = config.getCurrentMonthIndex();
        }
        final int startMonth = currentMonthIndex;
        final int endMonth = Math.min(currentMonthIndex + 2, 12);

        BigDecimal totalFtesNeeded = BigDecimal.ZERO;
        for (PodRoleMonthHire h : hiringForecast) {
            if (h.monthIndex() >= startMonth && h.monthIndex() <= endMonth) {
                totalFtesNeeded = totalFtesNeeded.add(h.ftesNeeded());
            }
        }
        int recommendedHires = totalFtesNeeded.setScale(0, RoundingMode.CEILING).intValue();

        return new ExecutiveSummaryData(
                totalResources, activeProjects, totalPods, overallUtilPct,
                podMonthsInDeficit, highestRiskPod, projectsAtRisk, recommendedHires);
    }

    private List<CapacityDemandMonth> buildCapacityDemandSummary(
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demandData,
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacityData) {

        List<CapacityDemandMonth> summary = new ArrayList<>();

        for (int m = 1; m <= 12; m++) {
            BigDecimal totalDemand = BigDecimal.ZERO;
            BigDecimal totalCapacity = BigDecimal.ZERO;

            for (Map<Role, Map<Integer, BigDecimal>> roleMap : demandData.values()) {
                for (Map<Integer, BigDecimal> monthMap : roleMap.values()) {
                    totalDemand = totalDemand.add(monthMap.getOrDefault(m, BigDecimal.ZERO));
                }
            }

            for (Map<Role, Map<Integer, BigDecimal>> roleMap : capacityData.values()) {
                for (Map<Integer, BigDecimal> monthMap : roleMap.values()) {
                    totalCapacity = totalCapacity.add(monthMap.getOrDefault(m, BigDecimal.ZERO));
                }
            }

            BigDecimal netGap = totalCapacity.subtract(totalDemand).setScale(2, RoundingMode.HALF_UP);
            BigDecimal utilizationPct = totalCapacity.compareTo(BigDecimal.ZERO) > 0
                    ? totalDemand.multiply(BigDecimal.valueOf(100))
                    .divide(totalCapacity, 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;

            summary.add(new CapacityDemandMonth(m,
                    totalDemand.setScale(2, RoundingMode.HALF_UP),
                    totalCapacity.setScale(2, RoundingMode.HALF_UP),
                    netGap, utilizationPct));
        }

        return summary;
    }
}
