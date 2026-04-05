package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Insight;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.ResourceBooking;
import com.portfolioplanner.domain.model.RiskItem;
import com.portfolioplanner.domain.repository.InsightRepository;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.domain.repository.ResourceBookingRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import com.portfolioplanner.domain.repository.RiskItemRepository;
import com.portfolioplanner.dto.InsightDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * AI Proactive Insights Engine.
 *
 * <p>Runs five signal detectors across the live data and persists the results
 * to the {@code insight} table.  The frontend surfaces them on the Smart
 * Notifications page via {@code GET /api/insights}.
 *
 * <h3>Detectors</h3>
 * <ol>
 *   <li><b>DEADLINE_RISK</b> — Active projects with a target date within 30 days</li>
 *   <li><b>OVERALLOCATION</b> — Resources whose bookings total &gt;100% in next 4 weeks</li>
 *   <li><b>RESOURCE_CONFLICT</b> — Resources with 2+ concurrent project bookings</li>
 *   <li><b>STALE_PROJECT</b> — Active projects not updated in 45+ days</li>
 *   <li><b>OPEN_HIGH_RISK</b> — Projects with open CRITICAL or HIGH severity risk items</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InsightService {

    // ── Detector type constants ───────────────────────────────────────────────
    public static final String DEADLINE_RISK      = "DEADLINE_RISK";
    public static final String OVERALLOCATION     = "OVERALLOCATION";
    public static final String RESOURCE_CONFLICT  = "RESOURCE_CONFLICT";
    public static final String STALE_PROJECT      = "STALE_PROJECT";
    public static final String OPEN_HIGH_RISK     = "OPEN_HIGH_RISK";

    private final InsightRepository        insightRepo;
    private final ProjectRepository        projectRepo;
    private final ResourceRepository       resourceRepo;
    private final ResourceBookingRepository bookingRepo;
    private final RiskItemRepository       riskItemRepo;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Runs all 5 detectors, persists fresh insights, and returns the full
     * unacknowledged list ordered by severity.
     */
    @Transactional
    public List<InsightDto> runDetectors() {
        log.info("InsightService: running all detectors…");
        detectDeadlineRisk();
        detectOverallocation();
        detectResourceConflict();
        detectStaleProjects();
        detectOpenHighRisks();
        log.info("InsightService: detection complete.");
        return listUnacknowledged();
    }

    /** Returns all unacknowledged insights (no re-run). */
    @Transactional(readOnly = true)
    public List<InsightDto> listUnacknowledged() {
        return insightRepo.findAllUnacknowledged().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /** Returns all insights including acknowledged (history view). */
    @Transactional(readOnly = true)
    public List<InsightDto> listAll() {
        return insightRepo.findAllOrderByDetectedAtDesc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /** Acknowledges a single insight. */
    @Transactional
    public InsightDto acknowledge(Long id) {
        Insight insight = insightRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Insight not found: " + id));
        String actor = resolveCurrentUser();
        insight.setAcknowledged(true);
        insight.setAcknowledgedBy(actor);
        insight.setAcknowledgedAt(LocalDateTime.now());
        return toDto(insightRepo.save(insight));
    }

    /** Summary counts used by the Smart Notifications KPI cards. */
    @Transactional(readOnly = true)
    public Map<String, Long> summaryCounts() {
        Map<String, Long> counts = new HashMap<>();
        counts.put("high",   insightRepo.countBySeverityAndAcknowledgedFalse("HIGH"));
        counts.put("medium", insightRepo.countBySeverityAndAcknowledgedFalse("MEDIUM"));
        counts.put("low",    insightRepo.countBySeverityAndAcknowledgedFalse("LOW"));
        counts.put("total",  counts.values().stream().mapToLong(Long::longValue).sum());
        return counts;
    }

    // ── Detector 1: Deadline Risk ─────────────────────────────────────────────

    private void detectDeadlineRisk() {
        insightRepo.deleteUnacknowledgedByType(DEADLINE_RISK);
        LocalDate today = LocalDate.now();
        LocalDate horizon = today.plusDays(30);

        List<Project> at_risk = projectRepo.findByStatusIn(
                List.of("ACTIVE", "IN_DISCOVERY", "NOT_STARTED", "ON_HOLD")
        ).stream()
                .filter(p -> p.getTargetDate() != null
                          && !p.getTargetDate().isAfter(horizon))
                .collect(Collectors.toList());

        List<Insight> insights = new ArrayList<>();
        for (Project p : at_risk) {
            LocalDate targetDate = p.getTargetDate();
            long daysRemaining = ChronoUnit.DAYS.between(today, targetDate);
            String severity;
            String description;

            if (daysRemaining < 0) {
                severity = "HIGH";
                description = String.format(
                        "Project '%s' is OVERDUE by %d day(s). Status: %s. Owner: %s.",
                        p.getName(), Math.abs(daysRemaining), p.getStatus(),
                        p.getOwner() != null ? p.getOwner() : "Unassigned");
            } else if (daysRemaining <= 7) {
                severity = "HIGH";
                description = String.format(
                        "Project '%s' is due in %d day(s) (%s). Status: %s.",
                        p.getName(), daysRemaining, targetDate, p.getStatus());
            } else {
                severity = "MEDIUM";
                description = String.format(
                        "Project '%s' is due in %d days (%s). Ensure it stays on track.",
                        p.getName(), daysRemaining, targetDate);
            }

            Insight insight = new Insight();
            insight.setInsightType(DEADLINE_RISK);
            insight.setSeverity(severity);
            insight.setTitle(daysRemaining < 0
                    ? "⏰ Overdue: " + p.getName()
                    : "📅 Deadline approaching: " + p.getName());
            insight.setDescription(description);
            insight.setEntityType("PROJECT");
            insight.setEntityId(p.getId());
            insight.setEntityName(p.getName());
            insight.setDetectedAt(LocalDateTime.now());
            insights.add(insight);
        }

        insightRepo.saveAll(insights);
        log.debug("InsightService [DEADLINE_RISK]: {} insight(s) created", insights.size());
    }

    // ── Detector 2: Overallocation ────────────────────────────────────────────

    private void detectOverallocation() {
        insightRepo.deleteUnacknowledgedByType(OVERALLOCATION);
        LocalDate today    = LocalDate.now();
        LocalDate horizon  = today.plusDays(28);

        List<ResourceBooking> bookings = bookingRepo.findInDateRange(today, horizon);

        // Sum allocationPct per resource
        Map<Long, Integer> totalPct = new HashMap<>();
        Map<Long, String>  nameMap  = new HashMap<>();
        Map<Long, Long>    idMap    = new HashMap<>();

        for (ResourceBooking b : bookings) {
            if (b.getResource() == null) continue;
            Long rid = b.getResource().getId();
            totalPct.merge(rid, b.getAllocationPct(), Integer::sum);
            nameMap.put(rid, b.getResource().getName());
            idMap.put(rid, rid);
        }

        List<Insight> insights = new ArrayList<>();
        totalPct.forEach((rid, pct) -> {
            if (pct > 100) {
                String severity = pct > 130 ? "HIGH" : "MEDIUM";
                Insight insight = new Insight();
                insight.setInsightType(OVERALLOCATION);
                insight.setSeverity(severity);
                insight.setTitle("👤 Overallocated: " + nameMap.get(rid));
                insight.setDescription(String.format(
                        "%s is booked at %d%% allocation in the next 4 weeks (exceeds 100%% capacity).",
                        nameMap.get(rid), pct));
                insight.setEntityType("RESOURCE");
                insight.setEntityId(rid);
                insight.setEntityName(nameMap.get(rid));
                insight.setDetectedAt(LocalDateTime.now());
                insights.add(insight);
            }
        });

        insightRepo.saveAll(insights);
        log.debug("InsightService [OVERALLOCATION]: {} insight(s) created", insights.size());
    }

    // ── Detector 3: Resource Conflict ─────────────────────────────────────────

    private void detectResourceConflict() {
        insightRepo.deleteUnacknowledgedByType(RESOURCE_CONFLICT);
        LocalDate today   = LocalDate.now();
        LocalDate horizon = today.plusDays(28);

        List<ResourceBooking> bookings = bookingRepo.findInDateRange(today, horizon).stream()
                .filter(b -> "PROJECT".equals(b.getBookingType()))
                .collect(Collectors.toList());

        // Group by resource, then check for overlapping project bookings
        Map<Long, List<ResourceBooking>> byResource = bookings.stream()
                .filter(b -> b.getResource() != null)
                .collect(Collectors.groupingBy(b -> b.getResource().getId()));

        List<Insight> insights = new ArrayList<>();
        byResource.forEach((rid, bkList) -> {
            if (bkList.size() < 2) return;
            // Look for any two bookings whose date ranges overlap
            boolean conflict = false;
            outer:
            for (int i = 0; i < bkList.size(); i++) {
                for (int j = i + 1; j < bkList.size(); j++) {
                    ResourceBooking a = bkList.get(i);
                    ResourceBooking b = bkList.get(j);
                    boolean sameProject = a.getProjectId() != null
                            && a.getProjectId().equals(b.getProjectId());
                    if (sameProject) continue;
                    // Overlap: a.start <= b.end && a.end >= b.start
                    if (!a.getStartDate().isAfter(b.getEndDate())
                            && !a.getEndDate().isBefore(b.getStartDate())) {
                        conflict = true;
                        break outer;
                    }
                }
            }
            if (!conflict) return;

            String resourceName = bkList.get(0).getResource().getName();
            int projectCount = (int) bkList.stream()
                    .map(b -> b.getProjectId() != null ? b.getProjectId() : -1L)
                    .distinct().count();

            Insight insight = new Insight();
            insight.setInsightType(RESOURCE_CONFLICT);
            insight.setSeverity("HIGH");
            insight.setTitle("⚡ Concurrent project conflict: " + resourceName);
            insight.setDescription(String.format(
                    "%s has overlapping bookings across %d project(s) in the next 4 weeks.",
                    resourceName, projectCount));
            insight.setEntityType("RESOURCE");
            insight.setEntityId(rid);
            insight.setEntityName(resourceName);
            insight.setDetectedAt(LocalDateTime.now());
            insights.add(insight);
        });

        insightRepo.saveAll(insights);
        log.debug("InsightService [RESOURCE_CONFLICT]: {} insight(s) created", insights.size());
    }

    // ── Detector 4: Stale Projects ────────────────────────────────────────────

    private void detectStaleProjects() {
        insightRepo.deleteUnacknowledgedByType(STALE_PROJECT);
        LocalDateTime cutoff = LocalDateTime.now().minusDays(45);

        List<Project> stale = projectRepo.findByStatusIn(List.of("ACTIVE")).stream()
                .filter(p -> p.getUpdatedAt() != null && p.getUpdatedAt().isBefore(cutoff))
                .collect(Collectors.toList());

        List<Insight> insights = new ArrayList<>();
        for (Project p : stale) {
            long days = ChronoUnit.DAYS.between(p.getUpdatedAt(), LocalDateTime.now());
            String severity = days > 90 ? "HIGH" : "MEDIUM";
            Insight insight = new Insight();
            insight.setInsightType(STALE_PROJECT);
            insight.setSeverity(severity);
            insight.setTitle("🔄 Stale project: " + p.getName());
            insight.setDescription(String.format(
                    "Project '%s' has been ACTIVE for %d days with no status update. Consider reviewing or closing it.",
                    p.getName(), days));
            insight.setEntityType("PROJECT");
            insight.setEntityId(p.getId());
            insight.setEntityName(p.getName());
            insight.setDetectedAt(LocalDateTime.now());
            insights.add(insight);
        }

        insightRepo.saveAll(insights);
        log.debug("InsightService [STALE_PROJECT]: {} insight(s) created", insights.size());
    }

    // ── Detector 5: Open High-Risk Items ─────────────────────────────────────

    private void detectOpenHighRisks() {
        insightRepo.deleteUnacknowledgedByType(OPEN_HIGH_RISK);

        List<RiskItem> highRisks = riskItemRepo.findAll().stream()
                .filter(r -> ("RISK".equals(r.getItemType()) || "ISSUE".equals(r.getItemType()))
                          && ("OPEN".equals(r.getStatus()) || "IN_PROGRESS".equals(r.getStatus()))
                          && ("CRITICAL".equals(r.getSeverity()) || "HIGH".equals(r.getSeverity())))
                .collect(Collectors.toList());

        List<Insight> insights = new ArrayList<>();
        for (RiskItem r : highRisks) {
            String severity = "CRITICAL".equals(r.getSeverity()) ? "HIGH" : "MEDIUM";
            Insight insight = new Insight();
            insight.setInsightType(OPEN_HIGH_RISK);
            insight.setSeverity(severity);
            insight.setTitle("🚨 Open " + r.getSeverity().toLowerCase() + " risk: " + r.getTitle());
            insight.setDescription(String.format(
                    "%s risk '%s' is still OPEN. Owner: %s. %s",
                    r.getSeverity(), r.getTitle(),
                    r.getOwner() != null ? r.getOwner() : "Unassigned",
                    r.getDescription() != null ? r.getDescription() : ""));
            insight.setEntityType("PROJECT");
            insight.setEntityId(r.getProjectId());
            insight.setEntityName(r.getTitle());
            insight.setDetectedAt(LocalDateTime.now());
            insights.add(insight);
        }

        insightRepo.saveAll(insights);
        log.debug("InsightService [OPEN_HIGH_RISK]: {} insight(s) created", insights.size());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private InsightDto toDto(Insight i) {
        InsightDto dto = new InsightDto();
        dto.setId(i.getId());
        dto.setInsightType(i.getInsightType());
        dto.setSeverity(i.getSeverity());
        dto.setTitle(i.getTitle());
        dto.setDescription(i.getDescription());
        dto.setEntityType(i.getEntityType());
        dto.setEntityId(i.getEntityId());
        dto.setEntityName(i.getEntityName());
        dto.setDetectedAt(i.getDetectedAt());
        dto.setAcknowledged(i.isAcknowledged());
        dto.setAcknowledgedBy(i.getAcknowledgedBy());
        dto.setAcknowledgedAt(i.getAcknowledgedAt());
        return dto;
    }

    private String resolveCurrentUser() {
        try {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            return auth != null ? auth.getName() : "system";
        } catch (Exception e) {
            return "system";
        }
    }
}
