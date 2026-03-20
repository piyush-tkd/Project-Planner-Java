package com.portfolioplanner.service;

import com.portfolioplanner.service.calculation.CalculationEngine;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot.ExecutiveSummaryData;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot.PodMonthGap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Sends a weekly HTML digest email summarising portfolio health.
 *
 * Activation: set {@code app.digest.enabled=true} and configure SMTP
 * credentials via environment variables (MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD,
 * DIGEST_RECIPIENTS, DIGEST_FROM).
 *
 * The default cron fires every Monday at 08:00 server-local time; override via
 * {@code DIGEST_CRON}.  An admin can also trigger an immediate send via
 * {@code POST /api/digest/send}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WeeklyDigestService {

    private final CalculationEngine calculationEngine;
    private final TimelineService   timelineService;
    private final JavaMailSender    mailSender;

    @Value("${app.digest.enabled:false}")
    private boolean enabled;

    @Value("${app.digest.recipients:}")
    private String recipients;

    @Value("${app.digest.from:noreply@portfolioplanner}")
    private String from;

    /** Runs on the configured cron schedule; no-ops when digest is disabled. */
    @Scheduled(cron = "${app.digest.cron:0 0 8 * * MON}")
    public void sendScheduled() {
        if (!enabled) {
            log.debug("WeeklyDigestService: digest disabled, skipping scheduled run.");
            return;
        }
        sendDigest();
    }

    /** Public method that can be called on demand (e.g. from a REST endpoint). */
    public void sendDigest() {
        List<String> recipientList = Arrays.stream(recipients.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());

        if (recipientList.isEmpty()) {
            log.warn("WeeklyDigestService: no recipients configured (app.digest.recipients), aborting.");
            return;
        }

        log.info("WeeklyDigestService: building digest for {} recipient(s)…", recipientList.size());

        try {
            CalculationSnapshot snapshot  = calculationEngine.compute();
            ExecutiveSummaryData summary  = snapshot.executiveSummary();
            Map<Integer, String> labels   = timelineService.getMonthLabels();

            // Worst 5 POD-month gaps by gap magnitude
            List<PodMonthGap> topGaps = snapshot.gaps().stream()
                    .filter(g -> g.gapHours().compareTo(BigDecimal.ZERO) < 0)
                    .sorted((a, b) -> a.gapHours().compareTo(b.gapHours()))   // most negative first
                    .limit(5)
                    .collect(Collectors.toList());

            String subject = buildSubject(summary);
            String body    = buildHtml(summary, topGaps, labels);

            for (String to : recipientList) {
                sendHtmlEmail(to, subject, body);
            }

            log.info("WeeklyDigestService: digest sent to {}", recipientList);
        } catch (Exception e) {
            log.error("WeeklyDigestService: failed to send digest – {}", e.getMessage(), e);
        }
    }

    // ── Private helpers ─────────────────────────────────────────────────────────

    private String buildSubject(ExecutiveSummaryData summary) {
        String date  = LocalDate.now().format(DateTimeFormatter.ofPattern("MMM d, yyyy"));
        String emoji = summary.podMonthsInDeficit() > 0 ? "⚠️" : "✅";
        return String.format("%s Portfolio Digest – %s", emoji, date);
    }

    private String buildHtml(ExecutiveSummaryData s, List<PodMonthGap> topGaps,
                             Map<Integer, String> labels) {
        String date = LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy"));

        StringBuilder sb = new StringBuilder();
        sb.append("""
                <!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="UTF-8"/>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                         background:#f4f6f9; margin:0; padding:0; color:#222; }
                  .wrap  { max-width:640px; margin:32px auto; background:#fff;
                           border-radius:8px; overflow:hidden;
                           box-shadow:0 2px 12px rgba(0,0,0,.08); }
                  .hdr   { background:#0C2340; color:#fff; padding:28px 32px; }
                  .hdr h1{ margin:0; font-size:20px; font-weight:700; }
                  .hdr p { margin:6px 0 0; font-size:13px; opacity:.75; }
                  .body  { padding:28px 32px; }
                  .kpi-row { display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
                  .kpi   { flex:1 1 120px; border:1px solid #e0e4ea; border-radius:6px;
                           padding:14px 16px; text-align:center; }
                  .kpi .v{ font-size:26px; font-weight:800; color:#0C2340; }
                  .kpi .l{ font-size:11px; color:#777; text-transform:uppercase; letter-spacing:.04em; }
                  .section-title { font-size:14px; font-weight:700; color:#0C2340;
                                   border-bottom:2px solid #1F9196; padding-bottom:6px;
                                   margin:24px 0 12px; }
                  table  { width:100%; border-collapse:collapse; font-size:13px; }
                  th     { background:#f0f3f7; text-align:left; padding:8px 10px;
                           font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#555; }
                  td     { padding:8px 10px; border-bottom:1px solid #eee; }
                  .red   { color:#fa5252; font-weight:700; }
                  .ok    { color:#51cf66; font-weight:700; }
                  .foot  { background:#f8fafb; padding:18px 32px; font-size:12px; color:#888;
                           border-top:1px solid #e8ecf2; }
                  .badge-red  { background:#ffd8d8; color:#c92a2a; border-radius:4px;
                                padding:2px 8px; font-size:11px; font-weight:600; }
                  .badge-grn  { background:#d3f9d8; color:#2b8a3e; border-radius:4px;
                                padding:2px 8px; font-size:11px; font-weight:600; }
                </style>
                </head>
                <body>
                <div class="wrap">
                  <div class="hdr">
                    <h1>📊 Engineering Portfolio Digest</h1>
                    <p>""").append(date).append("""
                    </p>
                  </div>
                  <div class="body">
                """);

        // KPI row
        String healthBadge = s.podMonthsInDeficit() > 0
                ? "<span class=\"badge-red\">⚠ " + s.podMonthsInDeficit() + " deficit month(s)</span>"
                : "<span class=\"badge-grn\">✅ On track</span>";

        sb.append("""
                    <div class="section-title">At a Glance &nbsp;""").append(healthBadge).append("""
                    </div>
                    <div class="kpi-row">
                """);

        appendKpi(sb, String.valueOf(s.totalResources()),   "Resources");
        appendKpi(sb, String.valueOf(s.activeProjects()),   "Active Projects");
        appendKpi(sb, String.valueOf(s.totalPods()),        "PODs");
        appendKpi(sb, s.overallUtilizationPct().intValue() + "%", "Avg Utilization");
        appendKpi(sb, String.valueOf(s.recommendedHiresNext3Months()), "Hiring Need (3m)");

        sb.append("    </div>\n");

        // Top gaps table
        if (!topGaps.isEmpty()) {
            sb.append("""
                    <div class="section-title">⚠️ Top Capacity Gaps</div>
                    <table>
                      <thead>
                        <tr>
                          <th>POD</th>
                          <th>Month</th>
                          <th>Gap (hrs)</th>
                          <th>Gap (FTE)</th>
                        </tr>
                      </thead>
                      <tbody>
                    """);
            for (PodMonthGap g : topGaps) {
                sb.append(String.format(
                        "    <tr><td>%s</td><td>%s</td>"
                        + "<td class=\"red\">%,.0f</td>"
                        + "<td class=\"red\">%.1f</td></tr>%n",
                        escHtml(g.podName()),
                        escHtml(labels.getOrDefault(g.monthIndex(), "M" + g.monthIndex())),
                        g.gapHours().doubleValue(), g.gapFte().doubleValue()));
            }
            sb.append("      </tbody>\n    </table>\n");
        } else {
            sb.append("""
                    <div class="section-title">✅ Capacity Gaps</div>
                    <p class="ok">No capacity deficits this planning cycle — great work!</p>
                    """);
        }

        // Highest risk POD
        if (s.highestRiskPod() != null && !s.highestRiskPod().isBlank()) {
            sb.append("<p style=\"margin-top:16px;font-size:13px;\">")
              .append("<strong>Highest-risk POD:</strong> ")
              .append(escHtml(s.highestRiskPod()))
              .append(" &nbsp;|&nbsp; <strong>Projects at risk:</strong> ")
              .append(s.projectsAtRisk())
              .append("</p>\n");
        }

        sb.append("""
                  </div>
                  <div class="foot">
                    This digest was generated automatically by Engineering Portfolio Planner.
                    To unsubscribe, remove your address from <code>DIGEST_RECIPIENTS</code>.
                  </div>
                </div>
                </body>
                </html>
                """);

        return sb.toString();
    }

    private void appendKpi(StringBuilder sb, String value, String label) {
        sb.append(String.format("""
                      <div class="kpi">
                        <div class="v">%s</div>
                        <div class="l">%s</div>
                      </div>
                """, escHtml(value), escHtml(label)));
    }

    private void sendHtmlEmail(String to, String subject, String html) throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(from);
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(html, true);
        mailSender.send(message);
        log.debug("WeeklyDigestService: email sent to {}", to);
    }

    private static String escHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
