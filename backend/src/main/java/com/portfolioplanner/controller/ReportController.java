package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.domain.repository.*;
import com.portfolioplanner.dto.response.*;
import com.portfolioplanner.service.ExcelExportService;
import com.portfolioplanner.service.TimelineService;
import com.portfolioplanner.service.calculation.CalculationEngine;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final CalculationEngine calculationEngine;
    private final TimelineService timelineService;
    private final ResourceRepository resourceRepository;
    private final ResourcePodAssignmentRepository assignmentRepository;
    private final TemporaryOverrideRepository overrideRepository;
    private final PodRepository podRepository;
    private final ExcelExportService excelExportService;

    @GetMapping("/executive-summary")
    public ResponseEntity<ExecutiveSummaryResponse> getExecutiveSummary() {
        CalculationSnapshot snapshot = calculationEngine.compute();
        ExecutiveSummaryData data = snapshot.executiveSummary();

        return ResponseEntity.ok(new ExecutiveSummaryResponse(
                data.totalResources(),
                data.activeProjects(),
                data.totalPods(),
                data.overallUtilizationPct(),
                data.podMonthsInDeficit(),
                data.highestRiskPod(),
                data.projectsAtRisk(),
                data.recommendedHiresNext3Months()
        ));
    }

    @GetMapping("/capacity-gap")
    public ResponseEntity<CapacityGapResponse> getCapacityGap(@RequestParam(required = false, defaultValue = "HOURS") String unit) {
        CalculationSnapshot snapshot = calculationEngine.compute();
        Map<Integer, String> monthLabels = timelineService.getMonthLabels();

        List<CapacityGapResponse.PodMonthGap> gaps = snapshot.gaps().stream()
                .map(g -> new CapacityGapResponse.PodMonthGap(
                        g.podId(),
                        g.podName(),
                        g.monthIndex(),
                        monthLabels.getOrDefault(g.monthIndex(), "M" + g.monthIndex()),
                        g.demandHours(),
                        g.capacityHours(),
                        g.gapHours(),
                        g.gapFte()
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(new CapacityGapResponse(gaps));
    }

    @GetMapping("/utilization-heatmap")
    public ResponseEntity<UtilizationHeatmapResponse> getUtilizationHeatmap() {
        CalculationSnapshot snapshot = calculationEngine.compute();
        Map<Integer, String> monthLabels = timelineService.getMonthLabels();

        List<UtilizationHeatmapResponse.PodMonthUtilization> cells = snapshot.utilization().stream()
                .map(u -> new UtilizationHeatmapResponse.PodMonthUtilization(
                        u.podId(),
                        u.podName(),
                        u.monthIndex(),
                        monthLabels.getOrDefault(u.monthIndex(), "M" + u.monthIndex()),
                        u.utilizationPct(),
                        u.level()
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(new UtilizationHeatmapResponse(cells));
    }

    @GetMapping("/hiring-forecast")
    public ResponseEntity<HiringForecastResponse> getHiringForecast() {
        CalculationSnapshot snapshot = calculationEngine.compute();
        Map<Integer, String> monthLabels = timelineService.getMonthLabels();

        List<HiringForecastResponse.PodRoleMonthHire> hires = snapshot.hiringForecast().stream()
                .map(h -> new HiringForecastResponse.PodRoleMonthHire(
                        h.podId(),
                        h.podName(),
                        h.role(),
                        h.monthIndex(),
                        monthLabels.getOrDefault(h.monthIndex(), "M" + h.monthIndex()),
                        h.deficitHours(),
                        h.ftesNeeded()
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(new HiringForecastResponse(hires));
    }

    @GetMapping("/concurrency-risk")
    public ResponseEntity<ConcurrencyRiskResponse> getConcurrencyRisk() {
        CalculationSnapshot snapshot = calculationEngine.compute();
        Map<Integer, String> monthLabels = timelineService.getMonthLabels();

        List<ConcurrencyRiskResponse.PodMonthConcurrency> risks = snapshot.concurrencyRisk().stream()
                .map(c -> new ConcurrencyRiskResponse.PodMonthConcurrency(
                        c.podId(),
                        c.podName(),
                        c.monthIndex(),
                        monthLabels.getOrDefault(c.monthIndex(), "M" + c.monthIndex()),
                        c.activeProjectCount(),
                        c.riskLevel()
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(new ConcurrencyRiskResponse(risks));
    }

    @GetMapping("/resource-allocation")
    public ResponseEntity<ResourceAllocationResponse> getResourceAllocation() {
        CalculationSnapshot snapshot = calculationEngine.compute();

        // Build per-pod/role/month allocation from capacity data
        List<ResourceAllocationResponse.ResourceMonthAllocation> allocations = new ArrayList<>();

        Map<String, Map<String, Map<Integer, BigDecimal>>> demandMap = snapshot.demand();
        Map<String, Map<String, Map<Integer, BigDecimal>>> capacityMap = snapshot.capacity();

        Set<String> allPods = new LinkedHashSet<>();
        allPods.addAll(demandMap.keySet());
        allPods.addAll(capacityMap.keySet());

        long syntheticId = 1;
        for (String podName : allPods) {
            Map<String, Map<Integer, BigDecimal>> podDemand = demandMap.getOrDefault(podName, Map.of());
            Map<String, Map<Integer, BigDecimal>> podCapacity = capacityMap.getOrDefault(podName, Map.of());

            Set<String> allRoles = new LinkedHashSet<>();
            allRoles.addAll(podDemand.keySet());
            allRoles.addAll(podCapacity.keySet());

            for (String roleName : allRoles) {
                Role role;
                try {
                    role = Role.valueOf(roleName);
                } catch (IllegalArgumentException e) {
                    continue;
                }

                Map<Integer, BigDecimal> demandMonths = podDemand.getOrDefault(roleName, Map.of());
                Map<Integer, BigDecimal> capMonths = podCapacity.getOrDefault(roleName, Map.of());

                for (int m = 1; m <= 12; m++) {
                    BigDecimal allocated = demandMonths.getOrDefault(m, BigDecimal.ZERO);
                    BigDecimal available = capMonths.getOrDefault(m, BigDecimal.ZERO);
                    BigDecimal utilPct = available.compareTo(BigDecimal.ZERO) > 0
                            ? allocated.multiply(BigDecimal.valueOf(100))
                            .divide(available, 2, RoundingMode.HALF_UP)
                            : BigDecimal.ZERO;

                    if (allocated.compareTo(BigDecimal.ZERO) > 0 || available.compareTo(BigDecimal.ZERO) > 0) {
                        allocations.add(new ResourceAllocationResponse.ResourceMonthAllocation(
                                syntheticId, podName + " - " + roleName, role, podName,
                                m, allocated, available, utilPct
                        ));
                    }
                }
                syntheticId++;
            }
        }

        return ResponseEntity.ok(new ResourceAllocationResponse(allocations));
    }

    @GetMapping("/capacity-demand-summary")
    public ResponseEntity<CapacityDemandSummaryResponse> getCapacityDemandSummary() {
        CalculationSnapshot snapshot = calculationEngine.compute();
        Map<Integer, String> monthLabels = timelineService.getMonthLabels();

        List<CapacityDemandSummaryResponse.MonthSummary> months = snapshot.capacityDemandSummary().stream()
                .map(cdm -> new CapacityDemandSummaryResponse.MonthSummary(
                        cdm.monthIndex(),
                        monthLabels.getOrDefault(cdm.monthIndex(), "M" + cdm.monthIndex()),
                        cdm.totalDemandHours(),
                        cdm.totalCapacityHours(),
                        cdm.netGapHours(),
                        cdm.utilizationPct()
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(new CapacityDemandSummaryResponse(months));
    }

    @GetMapping("/pod-resource-summary")
    public ResponseEntity<PodResourceSummaryResponse> getPodResourceSummary() {
        Map<Integer, String> monthLabels = timelineService.getMonthLabels();
        List<Pod> pods = podRepository.findByActiveTrueOrderByDisplayOrderAsc();
        List<Resource> resources = resourceRepository.findByActiveTrueAndCountsInCapacityTrue();
        List<ResourcePodAssignment> assignments = assignmentRepository.findAll();
        List<TemporaryOverride> overrides = overrideRepository.findAll();

        // Build assignment lookup: resourceId -> assignment
        Map<Long, ResourcePodAssignment> assignmentMap = new HashMap<>();
        for (ResourcePodAssignment a : assignments) {
            assignmentMap.put(a.getResource().getId(), a);
        }

        // Build resource lookup
        Map<Long, Resource> resourceMap = resources.stream()
                .collect(Collectors.toMap(Resource::getId, r -> r));

        // Home counts and FTE: podId -> role -> count/fte
        Map<Long, Map<String, Integer>> homeCounts = new LinkedHashMap<>();
        Map<Long, Integer> homeTotals = new HashMap<>();
        Map<Long, Map<String, BigDecimal>> homeFteByRole = new LinkedHashMap<>();
        Map<Long, BigDecimal> homeFteTotals = new HashMap<>();
        for (Resource r : resources) {
            ResourcePodAssignment a = assignmentMap.get(r.getId());
            if (a == null) continue;
            Long podId = a.getPod().getId();
            BigDecimal fte = a.getCapacityFte() != null ? a.getCapacityFte() : BigDecimal.ONE;
            homeCounts.computeIfAbsent(podId, k -> new LinkedHashMap<>())
                    .merge(r.getRole().name(), 1, Integer::sum);
            homeTotals.merge(podId, 1, Integer::sum);
            homeFteByRole.computeIfAbsent(podId, k -> new LinkedHashMap<>())
                    .merge(r.getRole().name(), fte, BigDecimal::add);
            homeFteTotals.merge(podId, fte, BigDecimal::add);
        }

        // Effective FTE per pod/role/month
        // Start with home FTE, apply overrides
        // podId -> role -> month -> effectiveFte
        Map<Long, Map<String, Map<Integer, BigDecimal>>> effective = new LinkedHashMap<>();

        // Initialize with home FTE values
        for (Resource r : resources) {
            ResourcePodAssignment a = assignmentMap.get(r.getId());
            if (a == null) continue;
            Long podId = a.getPod().getId();
            BigDecimal fte = a.getCapacityFte() != null ? a.getCapacityFte() : BigDecimal.ONE;
            String role = r.getRole().name();
            for (int m = 1; m <= 12; m++) {
                effective.computeIfAbsent(podId, k -> new LinkedHashMap<>())
                        .computeIfAbsent(role, k -> new HashMap<>())
                        .merge(m, fte, BigDecimal::add);
            }
        }

        // Apply overrides: deduct from home pod, add to destination pod
        for (TemporaryOverride ov : overrides) {
            Resource r = resourceMap.get(ov.getResource().getId());
            if (r == null) continue;
            ResourcePodAssignment a = assignmentMap.get(r.getId());
            if (a == null) continue;

            Long homePodId = a.getPod().getId();
            Long destPodId = ov.getToPod().getId();
            BigDecimal fte = a.getCapacityFte() != null ? a.getCapacityFte() : BigDecimal.ONE;
            BigDecimal loanFte = fte.multiply(ov.getAllocationPct())
                    .divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            String role = r.getRole().name();

            for (int m = ov.getStartMonth(); m <= ov.getEndMonth() && m <= 12; m++) {
                // Deduct from home pod
                effective.computeIfAbsent(homePodId, k -> new LinkedHashMap<>())
                        .computeIfAbsent(role, k -> new HashMap<>())
                        .merge(m, loanFte.negate(), BigDecimal::add);
                // Add to destination pod
                effective.computeIfAbsent(destPodId, k -> new LinkedHashMap<>())
                        .computeIfAbsent(role, k -> new HashMap<>())
                        .merge(m, loanFte, BigDecimal::add);
            }
        }

        // Build response
        List<PodResourceSummaryResponse.PodSummary> podSummaries = new ArrayList<>();
        for (Pod pod : pods) {
            Long podId = pod.getId();
            Map<String, Integer> roleCount = homeCounts.getOrDefault(podId, Map.of());
            int homeTotal = homeTotals.getOrDefault(podId, 0);

            List<PodResourceSummaryResponse.MonthEffective> monthlyEffective = new ArrayList<>();
            Map<String, Map<Integer, BigDecimal>> podEffective = effective.getOrDefault(podId, Map.of());

            for (int m = 1; m <= 12; m++) {
                BigDecimal totalFte = BigDecimal.ZERO;
                Map<String, BigDecimal> byRole = new LinkedHashMap<>();
                for (Map.Entry<String, Map<Integer, BigDecimal>> roleEntry : podEffective.entrySet()) {
                    BigDecimal roleFte = roleEntry.getValue().getOrDefault(m, BigDecimal.ZERO)
                            .setScale(2, RoundingMode.HALF_UP);
                    byRole.put(roleEntry.getKey(), roleFte);
                    totalFte = totalFte.add(roleFte);
                }
                monthlyEffective.add(new PodResourceSummaryResponse.MonthEffective(
                        m,
                        monthLabels.getOrDefault(m, "M" + m),
                        totalFte.setScale(2, RoundingMode.HALF_UP),
                        byRole
                ));
            }

            BigDecimal homeFte = homeFteTotals.getOrDefault(podId, BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
            Map<String, BigDecimal> podHomeFteByRole = new LinkedHashMap<>();
            homeFteByRole.getOrDefault(podId, Map.of()).forEach((role, fte) ->
                    podHomeFteByRole.put(role, fte.setScale(2, RoundingMode.HALF_UP)));

            podSummaries.add(new PodResourceSummaryResponse.PodSummary(
                    podId, pod.getName(), homeTotal, homeFte, roleCount, podHomeFteByRole, monthlyEffective
            ));
        }

        return ResponseEntity.ok(new PodResourceSummaryResponse(podSummaries));
    }

    @GetMapping("/export/reconciliation")
    public ResponseEntity<byte[]> exportReconciliation() throws IOException {
        byte[] bytes = excelExportService.buildReconciliationWorkbook();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"capacity-reconciliation.xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(bytes.length)
                .body(bytes);
    }
}
