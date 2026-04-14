package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.RiskItem;
import com.portfolioplanner.domain.model.SprintRetroSummary;
import com.portfolioplanner.domain.model.StrategicObjective;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.domain.repository.RiskItemRepository;
import com.portfolioplanner.domain.repository.SprintRetroRepository;
import com.portfolioplanner.domain.repository.StrategicObjectiveRepository;
import com.portfolioplanner.service.calculation.CalculationEngine;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/reports/exec-dashboard")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ExecSummaryController {

    private final ProjectRepository              projectRepository;
    private final StrategicObjectiveRepository   objectiveRepository;
    private final RiskItemRepository             riskRepository;
    private final SprintRetroRepository          retroRepository;
    private final CalculationEngine              calculationEngine;

    // ── Active statuses considered "in-flight" ────────────────────────────────
    private static final Set<String> ACTIVE_STATUSES = Set.of(
            "ACTIVE", "IN_PROGRESS", "IN_DISCOVERY", "NOT_STARTED"
    );
    private static final Set<String> COMPLETED_STATUSES = Set.of(
            "COMPLETED", "DONE", "CLOSED"
    );
    private static final Set<String> AT_RISK_STATUSES = Set.of(
            "BLOCKED", "AT_RISK", "ON_HOLD"
    );

    @GetMapping
    public ResponseEntity<Map<String, Object>> getExecDashboard() {

        // ── 1. Portfolio ──────────────────────────────────────────────────────
        List<Project> allProjects = projectRepository.findAll();
        long totalProjects    = allProjects.size();
        long activeProjects   = allProjects.stream().filter(p -> ACTIVE_STATUSES.contains(p.getStatus())).count();
        long completedProjects= allProjects.stream().filter(p -> COMPLETED_STATUSES.contains(p.getStatus())).count();
        long atRiskProjects   = allProjects.stream().filter(p -> AT_RISK_STATUSES.contains(p.getStatus())).count();
        double onTrackPct     = totalProjects == 0 ? 0.0
                : round((double)(activeProjects - atRiskProjects) / totalProjects * 100, 1);
        double atRiskPct      = totalProjects == 0 ? 0.0
                : round((double) atRiskProjects / totalProjects * 100, 1);
        double completedPct   = totalProjects == 0 ? 0.0
                : round((double) completedProjects / totalProjects * 100, 1);

        Map<String, Object> portfolio = new LinkedHashMap<>();
        portfolio.put("total",        totalProjects);
        portfolio.put("active",       activeProjects);
        portfolio.put("completed",    completedProjects);
        portfolio.put("atRisk",       atRiskProjects);
        portfolio.put("onTrackPct",   onTrackPct);
        portfolio.put("atRiskPct",    atRiskPct);
        portfolio.put("completedPct", completedPct);

        // ── 2. Capacity ───────────────────────────────────────────────────────
        CalculationSnapshot snapshot      = calculationEngine.compute();
        List<CalculationSnapshot.PodMonthGap> gaps = snapshot.gaps();
        double avgUtilPct = 0.0;
        if (!gaps.isEmpty()) {
            // utilisation = demand / (demand - gap) * 100, capped at 200%
            // simpler: use gap sign — negative gap = over-utilised
            double avgGapHours = gaps.stream()
                    .mapToDouble(g -> g.gapHours() != null ? g.gapHours().doubleValue() : 0.0)
                    .average().orElse(0.0);
            // flip: negative gap → high utilisation
            avgUtilPct = Math.min(120, Math.max(0, 100 - (avgGapHours / 8.0 * 5)));
        }

        Map<String, Object> capacity = new LinkedHashMap<>();
        capacity.put("avgUtilizationPct", round(avgUtilPct, 1));
        capacity.put("podsInDeficit",
                gaps.stream().filter(g -> g.gapHours() != null && g.gapHours().doubleValue() < -10).count());
        capacity.put("totalPods",
                gaps.stream().map(CalculationSnapshot.PodMonthGap::podName).distinct().count());

        // ── 3. OKRs ───────────────────────────────────────────────────────────
        List<StrategicObjective> objectives = objectiveRepository.findAll();
        long totalObjs     = objectives.size();
        long completedObjs = objectives.stream().filter(o -> "COMPLETED".equalsIgnoreCase(o.getStatus())).count();
        long activeObjs    = objectives.stream().filter(o -> "ACTIVE".equalsIgnoreCase(o.getStatus())).count();
        long notStartedObjs= objectives.stream().filter(o -> "NOT_STARTED".equalsIgnoreCase(o.getStatus())).count();
        double avgProgress = objectives.isEmpty() ? 0.0
                : objectives.stream().mapToInt(o -> o.getProgress() != null ? o.getProgress() : 0)
                            .average().orElse(0.0);

        Map<String, Object> okrs = new LinkedHashMap<>();
        okrs.put("total",      totalObjs);
        okrs.put("completed",  completedObjs);
        okrs.put("active",     activeObjs);
        okrs.put("notStarted", notStartedObjs);
        okrs.put("avgProgress",round(avgProgress, 1));

        // ── 4. Risks ──────────────────────────────────────────────────────────
        List<RiskItem> allRisks = riskRepository.findAllByOrderByCreatedAtDesc();
        List<RiskItem> openRisks = allRisks.stream()
                .filter(r -> !"CLOSED".equalsIgnoreCase(r.getStatus()) && !"RESOLVED".equalsIgnoreCase(r.getStatus()))
                .collect(Collectors.toList());
        long criticalRisks = openRisks.stream()
                .filter(r -> "HIGH".equalsIgnoreCase(r.getProbability()) && "HIGH".equalsIgnoreCase(r.getSeverity()))
                .count();
        long highRisks = openRisks.stream()
                .filter(r -> "HIGH".equalsIgnoreCase(r.getSeverity()) || "HIGH".equalsIgnoreCase(r.getProbability()))
                .count();
        long mitigatedRisks = allRisks.stream()
                .filter(r -> "MITIGATED".equalsIgnoreCase(r.getStatus()))
                .count();

        Map<String, Object> risks = new LinkedHashMap<>();
        risks.put("totalOpen",  openRisks.size());
        risks.put("critical",   criticalRisks);
        risks.put("high",       highRisks);
        risks.put("mitigated",  mitigatedRisks);

        // ── 5. Sprint Velocity ────────────────────────────────────────────────
        List<SprintRetroSummary> retros = retroRepository.findAllByOrderByGeneratedAtDesc();
        // Take up to last 5 retro records for trend
        List<Map<String, Object>> velocityTrend = retros.stream()
                .limit(5)
                .sorted(Comparator.comparing(SprintRetroSummary::getGeneratedAt))
                .map(r -> {
                    Map<String, Object> point = new LinkedHashMap<>();
                    point.put("sprint", r.getSprintName() != null ? r.getSprintName() : "Sprint");
                    point.put("points", r.getStoryPointsDone() != null
                            ? r.getStoryPointsDone().setScale(1, RoundingMode.HALF_UP).doubleValue() : 0.0);
                    return point;
                })
                .collect(Collectors.toList());

        double avgVelocity = retros.stream().limit(5)
                .filter(r -> r.getStoryPointsDone() != null)
                .mapToDouble(r -> r.getStoryPointsDone().doubleValue())
                .average().orElse(0.0);

        Map<String, Object> velocity = new LinkedHashMap<>();
        velocity.put("avgPoints",    round(avgVelocity, 1));
        velocity.put("trend",        velocityTrend);
        velocity.put("retroCount",   retros.size());

        // ── Assemble ──────────────────────────────────────────────────────────
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("portfolio", portfolio);
        response.put("capacity",  capacity);
        response.put("okrs",      okrs);
        response.put("risks",     risks);
        response.put("velocity",  velocity);
        response.put("generatedAt", java.time.LocalDateTime.now().toString());

        return ResponseEntity.ok(response);
    }

    private static double round(double value, int places) {
        if (places < 0) throw new IllegalArgumentException();
        BigDecimal bd = BigDecimal.valueOf(value);
        bd = bd.setScale(places, RoundingMode.HALF_UP);
        return bd.doubleValue();
    }
}
