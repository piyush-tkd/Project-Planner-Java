package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.JiraSupportBoard;
import com.portfolioplanner.domain.model.JiraSyncedIssue;
import com.portfolioplanner.domain.repository.JiraSupportBoardRepository;
import com.portfolioplanner.domain.repository.JiraSyncedIssueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Detects stale Jira support tickets across all configured support boards
 * and sends an alert email using the {@code support-staleness.html} Thymeleaf template.
 *
 * <p>A ticket is considered stale when it has not been updated for at least
 * {@code staleThresholdDays} days (configured per board; defaults to 7).
 *
 * <p>Recipients and the enabled flag are read from the {@code notification_schedule} DB table
 * (managed via Admin Settings → Email / SMTP tab). Schedule changes take effect without restart.
 *
 * <p>Triggered manually via {@code POST /api/digest/send-staleness} (admin only),
 * or automatically by
 * {@link com.portfolioplanner.config.NotificationSchedulerConfig} on the configured cron.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SupportStalenessService {

    private final JiraSupportBoardRepository   boardRepo;
    private final JiraSyncedIssueRepository    issueRepo;
    private final EmailService                 emailService;
    private final NotificationScheduleService  notificationScheduleService;

    @Value("${app.support.app-url:http://localhost:5173}")
    private String appUrl;

    /** Default stale threshold if no boards are configured with their own. */
    private static final int DEFAULT_STALE_DAYS = 7;

    /**
     * Queries all enabled support boards for stale tickets and sends the alert
     * email to configured recipients.  No-ops if there are no configured boards,
     * no recipients, or no stale tickets.
     */
    public void sendStalenessAlert() {
        List<String> recipientList = notificationScheduleService.getRecipientList();

        if (recipientList.isEmpty()) {
            log.warn("SupportStalenessService: no recipients configured in notification_schedule, aborting.");
            return;
        }

        List<JiraSupportBoard> boards = boardRepo.findByEnabledTrue();
        if (boards.isEmpty()) {
            log.info("SupportStalenessService: no enabled support boards configured, skipping.");
            return;
        }

        // Use the minimum threshold across all boards as the query cutoff.
        int minThreshold = boards.stream()
                .mapToInt(JiraSupportBoard::getStaleThresholdDays)
                .min()
                .orElse(DEFAULT_STALE_DAYS);

        List<String> projectKeys = boards.stream()
                .filter(b -> b.getProjectKey() != null && !b.getProjectKey().isBlank())
                .map(JiraSupportBoard::getProjectKey)
                .collect(Collectors.toList());

        if (projectKeys.isEmpty()) {
            log.info("SupportStalenessService: no boards have project keys configured, skipping.");
            return;
        }

        LocalDateTime cutoff = LocalDateTime.now().minusDays(minThreshold);
        List<JiraSyncedIssue> staleIssues = issueRepo.findStaleByProjectKeys(projectKeys, cutoff);

        if (staleIssues.isEmpty()) {
            log.info("SupportStalenessService: no stale tickets found across {} boards.", boards.size());
            return;
        }

        log.info("SupportStalenessService: {} stale ticket(s) found, sending alert to {} recipient(s).",
                staleIssues.size(), recipientList.size());

        Map<String, Object> ctx = buildContext(staleIssues, minThreshold);
        String subject = String.format("⚠️ %d Stale Support Ticket%s – %s",
                staleIssues.size(),
                staleIssues.size() == 1 ? "" : "s",
                LocalDate.now().format(DateTimeFormatter.ofPattern("MMM d, yyyy")));

        for (String to : recipientList) {
            emailService.sendAlert(to, subject, ctx, "support-staleness.html");
        }
        log.info("SupportStalenessService: staleness alert sent to {}", recipientList);
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private Map<String, Object> buildContext(List<JiraSyncedIssue> staleIssues,
                                              int staleThresholdDays) {
        Map<String, Object> ctx = new HashMap<>();

        ctx.put("reportDate", LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy")));
        ctx.put("staleThresholdDays", staleThresholdDays);
        ctx.put("appUrl", appUrl);
        ctx.put("totalStale", staleIssues.size());

        List<Map<String, Object>> tickets = staleIssues.stream().map(issue -> {
            Map<String, Object> row = new HashMap<>();
            row.put("key",      issue.getIssueKey());
            row.put("summary",  issue.getSummary() != null ? issue.getSummary() : "(no summary)");
            row.put("assignee", issue.getAssigneeDisplayName());
            row.put("priority", issue.getPriorityName() != null ? issue.getPriorityName() : "—");
            row.put("status",   issue.getStatusName() != null ? issue.getStatusName() : "—");
            row.put("url",      null);   // Jira URL not stored locally; omit link

            long ageDays = issue.getUpdatedAt() != null
                    ? ChronoUnit.DAYS.between(issue.getUpdatedAt(), LocalDateTime.now())
                    : 0;
            row.put("ageDays", ageDays);

            return row;
        }).collect(Collectors.toList());

        ctx.put("tickets", tickets);
        ctx.put("criticalCount", tickets.stream()
                .filter(t -> (long) t.get("ageDays") >= 14).count());
        ctx.put("warningCount", tickets.stream()
                .filter(t -> { long d = (long) t.get("ageDays"); return d >= 7 && d < 14; }).count());
        ctx.put("unassignedCount", staleIssues.stream()
                .filter(i -> i.getAssigneeDisplayName() == null
                          || i.getAssigneeDisplayName().isBlank()).count());

        return ctx;
    }
}
