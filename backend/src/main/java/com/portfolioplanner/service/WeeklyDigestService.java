package com.portfolioplanner.service;

import com.portfolioplanner.domain.repository.AppUserRepository;
import com.portfolioplanner.service.nlp.NlpInsightService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Generates and sends weekly portfolio digest emails to all active users.
 * Sends every Monday at 8:00 AM UTC with portfolio insights and metrics.
 */
@Service
@RequiredArgsConstructor
public class WeeklyDigestService {
    private static final Logger log = LoggerFactory.getLogger(WeeklyDigestService.class);
    private final AppUserRepository userRepo;
    private final NlpInsightService insightService;
    private final EmailService emailService;

    /**
     * Runs every Monday at 8:00 AM UTC.
     * Sends weekly portfolio digest to all active users.
     */
    @Scheduled(cron = "0 0 8 * * MON", zone = "UTC")
    public void sendWeeklyDigest() {
        try {
            var insights = insightService.getInsights();
            if (insights.isEmpty()) {
                log.info("Weekly digest skipped: no insights available");
                return;
            }

            var users = userRepo.findAll().stream()
                .filter(u -> u.getEmail() != null && !u.getEmail().isBlank())
                .toList();

            if (users.isEmpty()) {
                log.info("Weekly digest skipped: no active users with email");
                return;
            }

            Map<String, Object> context = new HashMap<>();
            context.put("insights", insights);
            context.put("insightCount", insights.size());
            context.put("weekOf", LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE));

            int sent = 0;
            for (var user : users) {
                try {
                    emailService.sendAlert(
                        user.getEmail(),
                        "Your Weekly Portfolio Digest",
                        context,
                        "weekly_digest"
                    );
                    sent++;
                } catch (Exception e) {
                    log.warn("Failed to send digest to {}: {}", user.getEmail(), e.getMessage());
                }
            }
            log.info("Weekly digest sent to {} users ({} insights)", sent, insights.size());
        } catch (Exception e) {
            log.error("Weekly digest job failed: {}", e.getMessage(), e);
        }
    }
}
