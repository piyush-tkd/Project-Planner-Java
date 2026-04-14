package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import com.portfolioplanner.service.jira.DoraJiraService;
import com.portfolioplanner.service.jira.JiraCredentialsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * Engineering Productivity Metrics Controller.
 *
 * Aggregates data from multiple existing sources to produce a single
 * executive-level productivity dashboard covering:
 *   1. Investment — total engineering spend, spend by POD/project
 *   2. Output    — projects delivered, throughput per sprint
 *   3. Efficiency — DORA metrics, cost-per-project, planned vs actual
 *   4. Impact    — priority distribution, project-by-status breakdown
 */
@RestController
@RequestMapping("/api/reports/productivity")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class ProductivityMetricsController {

    private final ProjectRepository projectRepo;
    private final ProjectPodPlanningRepository planningRepo;
    private final PodRepository podRepo;
    private final ResourceRepository resourceRepo;
    private final ResourcePodAssignmentRepository assignmentRepo;
    private final CostRateRepository costRateRepo;
    private final DoraJiraService doraJiraService;
    private final JiraCredentialsService jiraCreds;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getProductivityMetrics(
            @RequestParam(required = false) Integer months) {

        int lookbackMonths = months != null ? months : 6;
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("lookbackMonths", lookbackMonths);
        response.put("generatedAt", java.time.LocalDateTime.now().toString());

        try {
            // ── 1. INVESTMENT — How much did we spend? ──────────────────────
            response.put("investment", buildInvestmentMetrics());
        } catch (Exception e) {
            log.error("Error building investment metrics: {}", e.getMessage(), e);
            response.put("investment", Map.of("error", e.getMessage() != null ? e.getMessage() : "Unknown error"));
        }

        try {
            // ── 2. OUTPUT — What was delivered? ─────────────────────────────
            response.put("output", buildOutputMetrics());
        } catch (Exception e) {
            log.error("Error building output metrics: {}", e.getMessage(), e);
            response.put("output", Map.of("error", e.getMessage() != null ? e.getMessage() : "Unknown error"));
        }

        try {
            // ── 3. EFFICIENCY — DORA + cost per project ─────────────────────
            response.put("efficiency", buildEfficiencyMetrics(lookbackMonths));
        } catch (Exception e) {
            log.error("Error building efficiency metrics: {}", e.getMessage(), e);
            response.put("efficiency", Map.of("error", e.getMessage() != null ? e.getMessage() : "Unknown error"));
        }

        try {
            // ── 4. IMPACT — Priority alignment ──────────────────────────────
            response.put("impact", buildImpactMetrics());
        } catch (Exception e) {
            log.error("Error building impact metrics: {}", e.getMessage(), e);
            response.put("impact", Map.of("error", e.getMessage() != null ? e.getMessage() : "Unknown error"));
        }

        return ResponseEntity.ok(response);
    }

    /* ═══════════════════════════════════════════════════════════════════
       Section 1: Investment — Total spend, spend by POD, spend by project
       ═══════════════════════════════════════════════════════════════════ */

    private Map<String, Object> buildInvestmentMetrics() {
        Map<String, Object> section = new LinkedHashMap<>();

        // Cost rate lookup: role+location → hourlyRate
        Map<String, BigDecimal> rateMap = new HashMap<>();
        costRateRepo.findAll().forEach(cr ->
                rateMap.put(cr.getRole().name() + "::" + cr.getLocation().name(), cr.getHourlyRate()));

        // Resource location lookup
        Map<Long, String> locationMap = new HashMap<>();
        resourceRepo.findAll().forEach(r -> locationMap.put(r.getId(), r.getLocation() != null ? r.getLocation().name() : "UNKNOWN"));

        // Resource role lookup
        Map<Long, String> roleMap = new HashMap<>();
        resourceRepo.findAll().forEach(r -> roleMap.put(r.getId(), r.getRole() != null ? r.getRole().name() : "UNKNOWN"));

        // Assignments: resourceId → podName, capacityFte
        List<ResourcePodAssignment> assignments = assignmentRepo.findAll();
        Map<Long, ResourcePodAssignment> assignMap = new HashMap<>();
        assignments.forEach(a -> assignMap.put(a.getResource().getId(), a));

        // Compute spend per POD from resource assignments × cost rates × 12 months × 160h/month
        Map<String, BigDecimal> podSpend = new LinkedHashMap<>();
        BigDecimal totalSpend = BigDecimal.ZERO;

        for (ResourcePodAssignment a : assignments) {
            Resource r = a.getResource();
            if (r == null || !Boolean.TRUE.equals(r.getActive()) || !Boolean.TRUE.equals(r.getCountsInCapacity())) continue;

            String role = r.getRole() != null ? r.getRole().name() : "UNKNOWN";
            String location = r.getLocation() != null ? r.getLocation().name() : "UNKNOWN";
            BigDecimal rate = rateMap.getOrDefault(role + "::" + location, BigDecimal.ZERO);
            BigDecimal fte = a.getCapacityFte() != null ? a.getCapacityFte() : BigDecimal.ONE;

            // Annual cost = rate × 160 hours/month × 12 months × FTE
            BigDecimal annualCost = rate.multiply(BigDecimal.valueOf(160))
                    .multiply(BigDecimal.valueOf(12))
                    .multiply(fte);

            String podName = a.getPod().getName();
            podSpend.merge(podName, annualCost, BigDecimal::add);
            totalSpend = totalSpend.add(annualCost);
        }

        section.put("totalAnnualSpend", totalSpend.setScale(0, RoundingMode.HALF_UP));
        section.put("avgMonthlySpend", totalSpend.divide(BigDecimal.valueOf(12), 0, RoundingMode.HALF_UP));

        // Top PODs by spend
        final BigDecimal finalTotalSpend = totalSpend;
        List<Map<String, Object>> podSpendList = podSpend.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("pod", e.getKey());
                    m.put("annualSpend", e.getValue().setScale(0, RoundingMode.HALF_UP));
                    m.put("pct", finalTotalSpend.compareTo(BigDecimal.ZERO) > 0
                            ? e.getValue().multiply(BigDecimal.valueOf(100))
                            .divide(finalTotalSpend, 1, RoundingMode.HALF_UP)
                            : BigDecimal.ZERO);
                    return m;
                })
                .collect(Collectors.toList());
        section.put("spendByPod", podSpendList);

        // Project cost from planning hours
        List<Map<String, Object>> projectCosts = buildProjectCostList(rateMap);
        section.put("spendByProject", projectCosts);

        return section;
    }

    /* ═══════════════════════════════════════════════════════════════════
       Section 2: Output — What was delivered?
       ═══════════════════════════════════════════════════════════════════ */

    private Map<String, Object> buildOutputMetrics() {
        Map<String, Object> section = new LinkedHashMap<>();

        List<Project> allProjects = projectRepo.findAll();

        // Status breakdown
        Map<String, Long> statusCounts = allProjects.stream()
                .collect(Collectors.groupingBy(p -> p.getStatus() != null ? p.getStatus() : "UNKNOWN", Collectors.counting()));
        section.put("statusBreakdown", statusCounts);

        long completed = statusCounts.getOrDefault("COMPLETED", 0L);
        long active = statusCounts.getOrDefault("ACTIVE", 0L);
        long total = allProjects.size();
        section.put("totalProjects", total);
        section.put("completedProjects", completed);
        section.put("activeProjects", active);
        section.put("completionRate", total > 0
                ? BigDecimal.valueOf(completed * 100).divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO);

        // Priority breakdown
        Map<String, Long> priorityCounts = allProjects.stream()
                .collect(Collectors.groupingBy(p -> p.getPriority().name(), Collectors.counting()));
        section.put("priorityBreakdown", priorityCounts);

        // Critical/High projects delivered
        long criticalDelivered = allProjects.stream()
                .filter(p -> "COMPLETED".equalsIgnoreCase(p.getStatus()))
                .filter(p -> "CRITICAL".equals(p.getPriority().name()) || "HIGH".equals(p.getPriority().name()))
                .count();
        section.put("criticalHighDelivered", criticalDelivered);

        // Projects with effort data
        List<Map<String, Object>> projectSummaries = new ArrayList<>();
        for (Project p : allProjects) {
            List<ProjectPodPlanning> plannings = planningRepo.findByProjectId(p.getId());
            if (plannings.isEmpty()) continue;

            BigDecimal totalHours = BigDecimal.ZERO;
            int podCount = plannings.size();
            for (ProjectPodPlanning pp : plannings) {
                BigDecimal hours = pp.getDevHours().add(pp.getQaHours())
                        .add(pp.getBsaHours()).add(pp.getTechLeadHours());
                BigDecimal contingency = BigDecimal.ONE.add(
                        pp.getContingencyPct().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
                totalHours = totalHours.add(hours.multiply(contingency));
            }

            Map<String, Object> ps = new LinkedHashMap<>();
            ps.put("id", p.getId());
            ps.put("name", p.getName());
            ps.put("status", p.getStatus());
            ps.put("priority", p.getPriority().name());
            ps.put("owner", p.getOwner());
            ps.put("pods", podCount);
            ps.put("totalHours", totalHours.setScale(0, RoundingMode.HALF_UP));
            ps.put("durationMonths", p.getDurationMonths());
            projectSummaries.add(ps);
        }
        projectSummaries.sort((a, b) -> ((BigDecimal) b.get("totalHours")).compareTo((BigDecimal) a.get("totalHours")));
        section.put("projectEffortSummary", projectSummaries);

        return section;
    }

    /* ═══════════════════════════════════════════════════════════════════
       Section 3: Efficiency — DORA + Cost per Project
       ═══════════════════════════════════════════════════════════════════ */

    private Map<String, Object> buildEfficiencyMetrics(int lookbackMonths) {
        Map<String, Object> section = new LinkedHashMap<>();

        // DORA metrics (reuse existing service)
        try {
            if (jiraCreds.isConfigured()) {
                Map<String, Object> dora = doraJiraService.computeFromJira(lookbackMonths);
                if (!dora.containsKey("error")) {
                    Map<String, Object> doraSnapshot = new LinkedHashMap<>();
                    doraSnapshot.put("deploymentFrequency", dora.get("deploymentFrequency"));
                    doraSnapshot.put("leadTimeForChanges", dora.get("leadTimeForChanges"));
                    doraSnapshot.put("changeFailureRate", dora.get("changeFailureRate"));
                    doraSnapshot.put("meanTimeToRecovery", dora.get("meanTimeToRecovery"));
                    doraSnapshot.put("source", dora.getOrDefault("source", "db"));
                    section.put("dora", doraSnapshot);
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch DORA metrics for productivity: {}", e.getMessage());
        }

        // Cost per project delivered
        Map<String, BigDecimal> rateMap = new HashMap<>();
        costRateRepo.findAll().forEach(cr ->
                rateMap.put(cr.getRole().name() + "::" + cr.getLocation().name(), cr.getHourlyRate()));

        List<Map<String, Object>> projectCosts = buildProjectCostList(rateMap);
        List<Map<String, Object>> deliveredProjectCosts = projectCosts.stream()
                .filter(pc -> "COMPLETED".equals(pc.get("status")))
                .collect(Collectors.toList());

        if (!deliveredProjectCosts.isEmpty()) {
            BigDecimal totalDeliveredCost = deliveredProjectCosts.stream()
                    .map(pc -> (BigDecimal) pc.get("totalCost"))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal avgCostPerProject = totalDeliveredCost.divide(
                    BigDecimal.valueOf(deliveredProjectCosts.size()), 0, RoundingMode.HALF_UP);
            section.put("deliveredProjectCount", deliveredProjectCosts.size());
            section.put("totalDeliveredCost", totalDeliveredCost.setScale(0, RoundingMode.HALF_UP));
            section.put("avgCostPerProjectDelivered", avgCostPerProject);
            section.put("costPerProject", deliveredProjectCosts);
        } else {
            section.put("deliveredProjectCount", 0);
            section.put("totalDeliveredCost", BigDecimal.ZERO);
            section.put("avgCostPerProjectDelivered", BigDecimal.ZERO);
            section.put("costPerProject", List.of());
        }

        // Cost per project (all projects, not just delivered)
        if (!projectCosts.isEmpty()) {
            BigDecimal totalPlannedCost = projectCosts.stream()
                    .map(pc -> (BigDecimal) pc.get("totalCost"))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            section.put("totalPlannedCost", totalPlannedCost.setScale(0, RoundingMode.HALF_UP));
            section.put("allProjectCosts", projectCosts);
        }

        return section;
    }

    /* ═══════════════════════════════════════════════════════════════════
       Section 4: Impact — Priority alignment, business-critical delivery
       ═══════════════════════════════════════════════════════════════════ */

    private Map<String, Object> buildImpactMetrics() {
        Map<String, Object> section = new LinkedHashMap<>();

        List<Project> allProjects = projectRepo.findAll();

        // Critical priority allocation
        long criticalHigh = allProjects.stream()
                .filter(p -> "CRITICAL".equals(p.getPriority().name()) || "HIGH".equals(p.getPriority().name()))
                .count();
        long total = allProjects.size();

        section.put("criticalHighPct", total > 0
                ? BigDecimal.valueOf(criticalHigh * 100).divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO);

        // Effort allocated to critical/high vs medium/low
        BigDecimal criticalEffort = BigDecimal.ZERO;
        BigDecimal totalEffort = BigDecimal.ZERO;

        for (Project p : allProjects) {
            List<ProjectPodPlanning> plannings = planningRepo.findByProjectId(p.getId());
            BigDecimal projectHours = BigDecimal.ZERO;
            for (ProjectPodPlanning pp : plannings) {
                BigDecimal h = pp.getDevHours().add(pp.getQaHours())
                        .add(pp.getBsaHours()).add(pp.getTechLeadHours());
                BigDecimal contingency = BigDecimal.ONE.add(
                        pp.getContingencyPct().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
                projectHours = projectHours.add(h.multiply(contingency));
            }
            totalEffort = totalEffort.add(projectHours);
            if ("CRITICAL".equals(p.getPriority().name()) || "HIGH".equals(p.getPriority().name())) {
                criticalEffort = criticalEffort.add(projectHours);
            }
        }

        section.put("criticalHighEffortPct", totalEffort.compareTo(BigDecimal.ZERO) > 0
                ? criticalEffort.multiply(BigDecimal.valueOf(100))
                .divide(totalEffort, 1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO);
        section.put("totalPlannedEffortHours", totalEffort.setScale(0, RoundingMode.HALF_UP));

        // By owner — who's sponsoring the most work
        Map<String, BigDecimal> ownerEffort = new LinkedHashMap<>();
        for (Project p : allProjects) {
            String owner = p.getOwner() != null ? p.getOwner() : "Unassigned";
            List<ProjectPodPlanning> plannings = planningRepo.findByProjectId(p.getId());
            BigDecimal hours = BigDecimal.ZERO;
            for (ProjectPodPlanning pp : plannings) {
                hours = hours.add(pp.getDevHours().add(pp.getQaHours())
                        .add(pp.getBsaHours()).add(pp.getTechLeadHours()));
            }
            ownerEffort.merge(owner, hours, BigDecimal::add);
        }

        final BigDecimal finalTotalEffort = totalEffort;
        List<Map<String, Object>> ownerBreakdown = ownerEffort.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("owner", e.getKey());
                    m.put("totalHours", e.getValue().setScale(0, RoundingMode.HALF_UP));
                    m.put("pct", finalTotalEffort.compareTo(BigDecimal.ZERO) > 0
                            ? e.getValue().multiply(BigDecimal.valueOf(100))
                            .divide(finalTotalEffort, 1, RoundingMode.HALF_UP)
                            : BigDecimal.ZERO);
                    return m;
                })
                .collect(Collectors.toList());
        section.put("effortByOwner", ownerBreakdown);

        return section;
    }

    /* ═══════════════════════════════════════════════════════════════════
       Helper: Build cost-per-project list
       ═══════════════════════════════════════════════════════════════════ */

    private List<Map<String, Object>> buildProjectCostList(Map<String, BigDecimal> rateMap) {
        // For each project, compute total cost = sum of (role hours × blended rate)
        // We use a blended rate per role (average across locations) as a simplification
        Map<String, BigDecimal> blendedRates = new HashMap<>();
        Map<String, Integer> rateCounts = new HashMap<>();
        rateMap.forEach((key, rate) -> {
            String role = key.split("::")[0];
            blendedRates.merge(role, rate, BigDecimal::add);
            rateCounts.merge(role, 1, Integer::sum);
        });
        blendedRates.replaceAll((role, total) ->
                total.divide(BigDecimal.valueOf(rateCounts.get(role)), 2, RoundingMode.HALF_UP));

        List<Project> allProjects = projectRepo.findAll();
        List<Map<String, Object>> result = new ArrayList<>();

        for (Project p : allProjects) {
            List<ProjectPodPlanning> plannings = planningRepo.findByProjectId(p.getId());
            if (plannings.isEmpty()) continue;

            BigDecimal totalCost = BigDecimal.ZERO;
            BigDecimal totalHours = BigDecimal.ZERO;
            Map<String, BigDecimal> roleCosts = new LinkedHashMap<>();

            for (ProjectPodPlanning pp : plannings) {
                BigDecimal contingency = BigDecimal.ONE.add(
                        pp.getContingencyPct().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));

                // Dev
                BigDecimal devCost = pp.getDevHours().multiply(contingency)
                        .multiply(blendedRates.getOrDefault("DEVELOPER", BigDecimal.ZERO));
                roleCosts.merge("DEV", devCost, BigDecimal::add);
                totalCost = totalCost.add(devCost);
                totalHours = totalHours.add(pp.getDevHours().multiply(contingency));

                // QA
                BigDecimal qaCost = pp.getQaHours().multiply(contingency)
                        .multiply(blendedRates.getOrDefault("QA", BigDecimal.ZERO));
                roleCosts.merge("QA", qaCost, BigDecimal::add);
                totalCost = totalCost.add(qaCost);
                totalHours = totalHours.add(pp.getQaHours().multiply(contingency));

                // BSA
                BigDecimal bsaCost = pp.getBsaHours().multiply(contingency)
                        .multiply(blendedRates.getOrDefault("BSA", BigDecimal.ZERO));
                roleCosts.merge("BSA", bsaCost, BigDecimal::add);
                totalCost = totalCost.add(bsaCost);
                totalHours = totalHours.add(pp.getBsaHours().multiply(contingency));

                // Tech Lead
                BigDecimal tlCost = pp.getTechLeadHours().multiply(contingency)
                        .multiply(blendedRates.getOrDefault("TECH_LEAD", BigDecimal.ZERO));
                roleCosts.merge("TECH_LEAD", tlCost, BigDecimal::add);
                totalCost = totalCost.add(tlCost);
                totalHours = totalHours.add(pp.getTechLeadHours().multiply(contingency));
            }

            Map<String, Object> pc = new LinkedHashMap<>();
            pc.put("id", p.getId());
            pc.put("name", p.getName());
            pc.put("status", p.getStatus());
            pc.put("priority", p.getPriority().name());
            pc.put("owner", p.getOwner());
            pc.put("totalHours", totalHours.setScale(0, RoundingMode.HALF_UP));
            pc.put("totalCost", totalCost.setScale(0, RoundingMode.HALF_UP));
            pc.put("pods", plannings.size());
            pc.put("durationMonths", p.getDurationMonths());
            pc.put("roleCosts", roleCosts.entrySet().stream()
                    .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().setScale(0, RoundingMode.HALF_UP))));
            result.add(pc);
        }

        result.sort((a, b) -> ((BigDecimal) b.get("totalCost")).compareTo((BigDecimal) a.get("totalCost")));
        return result;
    }
}
