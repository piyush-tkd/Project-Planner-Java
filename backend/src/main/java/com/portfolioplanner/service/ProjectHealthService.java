package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.RiskItem;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.domain.repository.RiskItemRepository;
import com.portfolioplanner.dto.ProjectHealthDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Computes a three-dimension health scorecard (schedule / budget / risk) for
 * each active project.
 *
 * <h3>Scoring rules</h3>
 *
 * <b>Schedule (weight 40%)</b> — based on days to/from {@code targetDate}:
 * <ul>
 *   <li>No target date → 50 (neutral)</li>
 *   <li>≥ 30 days remaining → 100</li>
 *   <li>14–29 days remaining → 80</li>
 *   <li>1–13 days remaining → 60</li>
 *   <li>Due today → 50</li>
 *   <li>1–7 days overdue → 30</li>
 *   <li>8–30 days overdue → 10</li>
 *   <li>&gt; 30 days overdue → 0</li>
 * </ul>
 *
 * <b>Budget (weight 35%)</b> — based on {@code actualCost / estimatedBudget}:
 * <ul>
 *   <li>No data → null (neutral, excluded from average)</li>
 *   <li>≤ 75% spent → 100</li>
 *   <li>≤ 90% → 85</li>
 *   <li>≤ 100% → 70</li>
 *   <li>≤ 110% → 40</li>
 *   <li>≤ 125% → 20</li>
 *   <li>&gt; 125% → 0</li>
 * </ul>
 *
 * <b>Risk (weight 25%)</b> — based on open RISK-type items:
 * <ul>
 *   <li>Start at 100; deduct per open risk: CRITICAL −40, HIGH −20, MEDIUM −10, LOW −5</li>
 *   <li>Clamped to 0–100</li>
 * </ul>
 *
 * <b>RAG</b>: GREEN ≥ 70, AMBER 40–69, RED &lt; 40, GREY for COMPLETED/CANCELLED.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectHealthService {

    private final ProjectRepository  projectRepository;
    private final RiskItemRepository riskItemRepository;

    private static final double W_SCHEDULE = 0.40;
    private static final double W_BUDGET   = 0.35;
    private static final double W_RISK     = 0.25;

    private static final List<String> TERMINAL_STATUSES = List.of("COMPLETED", "CANCELLED");

    /**
     * Returns health DTOs for all non-archived projects.
     * Terminal-status projects receive RAG = GREY.
     */
    @Transactional(readOnly = true)
    public List<ProjectHealthDto> computeAll() {
        List<Project> projects = projectRepository.findByArchivedFalse();

        // Load all risk items and group by projectId — single query
        Map<Long, List<RiskItem>> risksByProject = riskItemRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .filter(r -> r.getProjectId() != null)
                .collect(Collectors.groupingBy(RiskItem::getProjectId));

        return projects.stream()
                .map(p -> compute(p, risksByProject.getOrDefault(p.getId(), List.of())))
                .collect(Collectors.toList());
    }

    /**
     * Returns a health DTO for a single project.
     */
    @Transactional(readOnly = true)
    public ProjectHealthDto computeOne(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));
        List<RiskItem> risks = riskItemRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        return compute(project, risks);
    }

    // ── Core computation ──────────────────────────────────────────────────────

    private ProjectHealthDto compute(Project p, List<RiskItem> risks) {
        boolean terminal = TERMINAL_STATUSES.stream()
                .anyMatch(s -> s.equalsIgnoreCase(p.getStatus()));

        if (terminal) {
            return ProjectHealthDto.builder()
                    .projectId(p.getId())
                    .projectName(p.getName())
                    .projectStatus(p.getStatus())
                    .ragStatus("GREY")
                    .overallScore(null)
                    .targetDate(p.getTargetDate())
                    .build();
        }

        // ── Schedule ─────────────────────────────────────────────────────────
        Integer schedScore;
        String  schedLabel;
        if (p.getTargetDate() == null) {
            schedScore = 50;
            schedLabel = "No target date";
        } else {
            long daysRemaining = ChronoUnit.DAYS.between(LocalDate.now(), p.getTargetDate());
            if (daysRemaining >= 30) {
                schedScore = 100; schedLabel = daysRemaining + " days remaining";
            } else if (daysRemaining >= 14) {
                schedScore = 80;  schedLabel = daysRemaining + " days remaining";
            } else if (daysRemaining >= 1) {
                schedScore = 60;  schedLabel = daysRemaining + " day" + (daysRemaining == 1 ? "" : "s") + " remaining";
            } else if (daysRemaining == 0) {
                schedScore = 50;  schedLabel = "Due today";
            } else if (daysRemaining >= -7) {
                schedScore = 30;  schedLabel = (-daysRemaining) + " day" + (daysRemaining == -1 ? "" : "s") + " overdue";
            } else if (daysRemaining >= -30) {
                schedScore = 10;  schedLabel = (-daysRemaining) + " days overdue";
            } else {
                schedScore = 0;   schedLabel = (-daysRemaining) + " days overdue";
            }
        }

        // ── Budget ────────────────────────────────────────────────────────────
        Integer budScore;
        String  budLabel;
        if (p.getEstimatedBudget() == null || p.getEstimatedBudget().compareTo(BigDecimal.ZERO) <= 0) {
            budScore = null;
            budLabel = "No budget set";
        } else if (p.getActualCost() == null) {
            budScore = null;
            budLabel = "No actuals recorded";
        } else {
            double pct = p.getActualCost().doubleValue() / p.getEstimatedBudget().doubleValue();
            if (pct <= 0.75)      { budScore = 100; }
            else if (pct <= 0.90) { budScore = 85;  }
            else if (pct <= 1.00) { budScore = 70;  }
            else if (pct <= 1.10) { budScore = 40;  }
            else if (pct <= 1.25) { budScore = 20;  }
            else                  { budScore = 0;   }
            budLabel = String.format("%.0f%% of budget used", pct * 100);
        }

        // ── Risk ──────────────────────────────────────────────────────────────
        List<RiskItem> openRisks = risks.stream()
                .filter(r -> "RISK".equalsIgnoreCase(r.getItemType()))
                .filter(r -> "OPEN".equalsIgnoreCase(r.getStatus()) || "IN_PROGRESS".equalsIgnoreCase(r.getStatus()))
                .collect(Collectors.toList());

        int critCount = (int) openRisks.stream().filter(r -> "CRITICAL".equalsIgnoreCase(r.getSeverity())).count();
        int highCount = (int) openRisks.stream().filter(r -> "HIGH".equalsIgnoreCase(r.getSeverity())).count();
        int medCount  = (int) openRisks.stream().filter(r -> "MEDIUM".equalsIgnoreCase(r.getSeverity())).count();
        int lowCount  = (int) openRisks.stream().filter(r -> "LOW".equalsIgnoreCase(r.getSeverity())).count();

        int riskDeduction = critCount * 40 + highCount * 20 + medCount * 10 + lowCount * 5;
        int riskScore     = Math.max(0, 100 - riskDeduction);

        String riskLabel;
        if (openRisks.isEmpty()) {
            riskLabel = "No open risks";
        } else {
            StringBuilder sb = new StringBuilder();
            if (critCount > 0) sb.append(critCount).append(" critical");
            if (highCount > 0) { if (sb.length() > 0) sb.append(", "); sb.append(highCount).append(" high"); }
            if (medCount  > 0) { if (sb.length() > 0) sb.append(", "); sb.append(medCount).append(" medium"); }
            if (lowCount  > 0) { if (sb.length() > 0) sb.append(", "); sb.append(lowCount).append(" low"); }
            sb.append(openRisks.size() == 1 ? " risk open" : " risks open");
            riskLabel = sb.toString();
        }

        // ── Overall weighted score ────────────────────────────────────────────
        double weightSum  = W_SCHEDULE;
        double weightedSum = schedScore * W_SCHEDULE;

        if (budScore != null) {
            weightedSum += budScore * W_BUDGET;
            weightSum   += W_BUDGET;
        }
        // Risk is always scoreable (zero open risks → 100)
        weightedSum += riskScore * W_RISK;
        weightSum   += W_RISK;

        int overall = (int) Math.round(weightedSum / weightSum);

        String rag;
        if (overall >= 70)      rag = "GREEN";
        else if (overall >= 40) rag = "AMBER";
        else                    rag = "RED";

        return ProjectHealthDto.builder()
                .projectId(p.getId())
                .projectName(p.getName())
                .projectStatus(p.getStatus())
                .ragStatus(rag)
                .overallScore(overall)
                .scheduleScore(schedScore)
                .scheduleLabel(schedLabel)
                .budgetScore(budScore)
                .budgetLabel(budLabel)
                .riskScore(riskScore)
                .riskLabel(riskLabel)
                .criticalRisks(critCount)
                .highRisks(highCount)
                .targetDate(p.getTargetDate())
                .build();
    }
}
