package com.portfolioplanner.service;

import com.portfolioplanner.service.calculation.CalculationEngine;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot.ExecutiveSummaryData;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot.PodMonthGap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Sends a weekly HTML digest email summarising portfolio health.
 *
 * <p>Uses {@link EmailService} + the Thymeleaf template
 * {@code templates/email/weekly-digest.html}.
 *
 * <p>Schedule and recipients are read from the {@code notification_schedule} DB table
 * (managed via Admin Settings → Email / SMTP tab) so changes take effect without a restart.
 * The cron trigger itself is registered by
 * {@link com.portfolioplanner.config.NotificationSchedulerConfig}.
 *
 * <p>An admin can also trigger an immediate send via {@code POST /api/digest/send}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WeeklyDigestService {

    private final CalculationEngine           calculationEngine;
    private final TimelineService             timelineService;
    private final EmailService                emailService;
    private final NotificationScheduleService notificationScheduleService;

    /** Public method called by the scheduler config and by the REST endpoint. */
    public void sendDigest() {
        List<String> recipientList = notificationScheduleService.getRecipientList();

        if (recipientList.isEmpty()) {
            log.warn("WeeklyDigestService: no recipients configured in notification_schedule, aborting.");
            return;
        }

        log.info("WeeklyDigestService: building digest for {} recipient(s)…", recipientList.size());
        try {
            CalculationSnapshot snapshot = calculationEngine.compute();
            ExecutiveSummaryData summary  = snapshot.executiveSummary();
            Map<Integer, String> labels   = timelineService.getMonthLabels();

            // Top 5 capacity gaps (most negative first)
            List<PodMonthGap> topGaps = snapshot.gaps().stream()
                    .filter(g -> g.gapHours().compareTo(BigDecimal.ZERO) < 0)
                    .sorted((a, b) -> a.gapHours().compareTo(b.gapHours()))
                    .limit(5)
                    .collect(Collectors.toList());

            Map<String, Object> ctx = buildContext(summary, topGaps, labels);
            String subject = buildSubject(summary);

            for (String to : recipientList) {
                emailService.sendAlert(to, subject, ctx, "weekly-digest.html");
            }

            log.info("WeeklyDigestService: digest sent to {}", recipientList);
        } catch (Exception e) {
            log.error("WeeklyDigestService: failed to send digest – {}", e.getMessage(), e);
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private String buildSubject(ExecutiveSummaryData s) {
        String date  = LocalDate.now().format(DateTimeFormatter.ofPattern("MMM d, yyyy"));
        String emoji = s.podMonthsInDeficit() > 0 ? "⚠️" : "✅";
        return String.format("%s Portfolio Digest – %s", emoji, date);
    }

    private Map<String, Object> buildContext(ExecutiveSummaryData s,
                                              List<PodMonthGap> topGaps,
                                              Map<Integer, String> labels) {
        Map<String, Object> ctx = new HashMap<>();

        ctx.put("reportDate",    LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy")));
        ctx.put("warningCount",  s.podMonthsInDeficit());
        ctx.put("projectCount",  s.activeProjects());
        ctx.put("resourceCount", s.totalResources());
        ctx.put("podCount",      s.totalPods());
        ctx.put("utilizationPct", s.overallUtilizationPct() != null
                ? s.overallUtilizationPct().intValue() : 0);
        ctx.put("hiringNeed",    s.recommendedHiresNext3Months());

        // Capacity alerts for template table
        List<Map<String, Object>> alerts = topGaps.stream().map(g -> {
            Map<String, Object> row = new HashMap<>();
            row.put("podName",  g.podName());
            row.put("month",    labels.getOrDefault(g.monthIndex(), "M" + g.monthIndex()));
            row.put("gapHours", String.format("%,.0f", g.gapHours().doubleValue()));
            row.put("gapFte",   String.format("%.1f",  g.gapFte().doubleValue()));
            return row;
        }).collect(Collectors.toList());
        ctx.put("capacityAlerts", alerts);

        // Risk projects — single-row list from scalar summary data
        List<Map<String, String>> riskProjects = new java.util.ArrayList<>();
        if (s.highestRiskPod() != null && !s.highestRiskPod().isBlank() && s.projectsAtRisk() > 0) {
            Map<String, String> row = new HashMap<>();
            row.put("name",       s.highestRiskPod());
            row.put("status",     "At Risk");
            row.put("riskReason", s.projectsAtRisk() + " project(s) at risk");
            row.put("owner",      "—");
            riskProjects.add(row);
        }
        ctx.put("riskProjects", riskProjects);

        return ctx;
    }
}
