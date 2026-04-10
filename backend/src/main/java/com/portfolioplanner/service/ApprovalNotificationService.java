package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.OrgSettings;
import com.portfolioplanner.domain.model.ProjectApproval;
import com.portfolioplanner.domain.repository.AppUserRepository;
import com.portfolioplanner.domain.repository.OrgSettingsRepository;
import com.portfolioplanner.domain.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Sends email notifications related to project approval requests.
 *
 * <ul>
 *   <li>{@code notifyNewApprovalPending} — emails ADMIN reviewers when a new request is submitted</li>
 *   <li>{@code notifyDecision} — emails the requester when their request is APPROVED or REJECTED</li>
 * </ul>
 *
 * <p>All methods are {@code @Async} so they never block the HTTP response.
 * Failures are caught and logged — they do not roll back the approval save.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalNotificationService {

    private final EmailService            emailService;
    private final EmailTemplateService    emailTemplateService;
    private final AppUserRepository       appUserRepository;
    private final ProjectRepository       projectRepository;
    private final OrgSettingsRepository   orgSettingsRepository;

    @Value("${app.org-id:1}")
    private Long orgId;

    @Value("${app.frontend-base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    /**
     * Sends a live test email to the given address using the approval-pending template
     * with placeholder data. Called from Admin → Settings → Notifications.
     * NOT @Async — we want exceptions to propagate so the controller can report failure.
     */
    public void sendTestEmail(String recipientEmail, String username) {
        Map<String, Object> ctx = orgContext();
        String orgName = (String) ctx.get("orgName");
        String subject = "[" + orgName + "] Test email — SMTP configuration verified";
        ctx.put("projectName",       "Sample Project");
        ctx.put("requestedBy",       username != null ? username : "you");
        ctx.put("changeDescription", "Status: PLANNING → ACTIVE");
        ctx.put("requestNote",       "This is a test email sent from Admin → Settings → Notifications. If you received it, your SMTP configuration and org branding are working correctly.");
        ctx.put("projectUrl",        "#");
        emailService.sendAlert(recipientEmail, subject, ctx, "approval-pending.html");
    }

    // ── org branding helper ────────────────────────────────────────────────

    private Map<String, Object> orgContext() {
        OrgSettings org = orgSettingsRepository.findByOrgId(orgId).orElse(null);
        String name    = (org != null && org.getOrgName() != null && !org.getOrgName().isBlank())
                         ? org.getOrgName() : "Portfolio Planner";
        String logoUrl = (org != null) ? org.getLogoUrl() : null;
        String color   = (org != null && org.getPrimaryColor() != null && !org.getPrimaryColor().isBlank())
                         ? org.getPrimaryColor() : "#1971c2";
        Map<String, Object> ctx = new HashMap<>();
        ctx.put("orgName",   name);
        ctx.put("orgLogoUrl", logoUrl);
        ctx.put("orgColor",  color);
        return ctx;
    }

    /**
     * Fire-and-forget email to all ADMIN reviewers when a pending approval is withdrawn by the requester.
     *
     * @param approval    the just-withdrawn approval record
     * @param projectName the project name
     * @param changeDesc  human-readable description of the change that was requested
     */
    @Async
    public void notifyWithdrawn(ProjectApproval approval, String projectName, String changeDesc) {
        try {
            var reviewers = appUserRepository.findByRoleAndEnabledTrue("ADMIN");
            if (reviewers.isEmpty()) return;

            String requestedBy = approval.getRequestedBy() != null ? approval.getRequestedBy() : "system";
            Map<String, Object> ctx = orgContext();
            String orgName = (String) ctx.get("orgName");
            ctx.put("projectName",       projectName);
            ctx.put("requestedBy",       requestedBy);
            ctx.put("changeDescription", changeDesc != null ? changeDesc : "General approval");
            String defaultSubject = "[" + orgName + "] Approval request withdrawn: \"" + projectName + "\"";
            String subject = emailTemplateService.resolveSubject("approval-withdrawn", defaultSubject, ctx);

            for (var reviewer : reviewers) {
                String email = reviewer.getEmail();
                if (email == null || email.isBlank()) continue;
                try {
                    emailService.sendAlert(email, subject, ctx, "approval-withdrawn.html");
                    log.info("ApprovalNotificationService: sent WITHDRAWN notification to reviewer {}", email);
                } catch (Exception ex) {
                    log.warn("ApprovalNotificationService: failed to notify reviewer {} of withdrawal — {}", email, ex.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("ApprovalNotificationService: failed to send withdrawn notification for approval {} — {}",
                    approval.getId(), e.getMessage(), e);
        }
    }

    /**
     * Fire-and-forget email to all ADMIN reviewers when a new approval request is submitted.
     *
     * @param approval    the just-created approval record (status = PENDING)
     * @param projectName the project name (for the email subject and body)
     * @param changeDesc  human-readable description of the proposed change
     */
    @Async
    public void notifyNewApprovalPending(ProjectApproval approval, String projectName, String changeDesc) {
        try {
            var reviewers = appUserRepository.findByRoleAndEnabledTrue("ADMIN");
            if (reviewers.isEmpty()) {
                log.info("ApprovalNotificationService: no ADMIN reviewers found — skipping pending notification");
                return;
            }

            String requestedBy = approval.getRequestedBy() != null ? approval.getRequestedBy() : "system";
            Map<String, Object> ctx = orgContext();
            String orgName = (String) ctx.get("orgName");
            String projectUrl = frontendBaseUrl + "/projects/" + approval.getProjectId() + "?tab=approval";
            ctx.put("projectName",       projectName);
            ctx.put("requestedBy",       requestedBy);
            ctx.put("changeDescription", changeDesc != null ? changeDesc : "General approval");
            ctx.put("requestNote",       approval.getRequestNote());
            ctx.put("projectUrl",        projectUrl);
            String defaultSubject = "[" + orgName + "] Approval required: \"" + projectName + "\"";
            String subject = emailTemplateService.resolveSubject("approval-pending", defaultSubject, ctx);

            for (var reviewer : reviewers) {
                String email = reviewer.getEmail();
                if (email == null || email.isBlank()) continue;
                try {
                    emailService.sendAlert(email, subject, ctx, "approval-pending.html");
                    log.info("ApprovalNotificationService: sent PENDING notification to reviewer {}", email);
                } catch (Exception ex) {
                    log.warn("ApprovalNotificationService: failed to notify reviewer {} — {}", email, ex.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("ApprovalNotificationService: failed to send pending notification for approval {} — {}",
                    approval.getId(), e.getMessage(), e);
        }
    }

    /**
     * Fire-and-forget email to the approval requester.
     *
     * @param approval   the just-reviewed approval record (status = APPROVED or REJECTED)
     * @param changeDesc human-readable description of the proposed change (may be null)
     */
    @Async
    public void notifyDecision(ProjectApproval approval, String changeDesc) {
        try {
            // Resolve requester email — skip if user not found or no email set
            String requestedBy = approval.getRequestedBy();
            if (requestedBy == null || requestedBy.isBlank() || "system".equalsIgnoreCase(requestedBy)) {
                log.debug("ApprovalNotificationService: requestedBy='{}' — skipping email", requestedBy);
                return;
            }

            String recipientEmail = appUserRepository.findByUsername(requestedBy)
                    .map(u -> u.getEmail())
                    .filter(e -> e != null && !e.isBlank())
                    .orElse(null);

            if (recipientEmail == null) {
                log.info("ApprovalNotificationService: no email found for user '{}' — skipping", requestedBy);
                return;
            }

            String projectName = projectRepository.findById(approval.getProjectId())
                    .map(p -> p.getName())
                    .orElse("Project #" + approval.getProjectId());

            String decision = approval.getStatus().name(); // "APPROVED" or "REJECTED"
            Map<String, Object> ctx = orgContext();
            String orgName = (String) ctx.get("orgName");
            String projectUrl = frontendBaseUrl + "/projects/" + approval.getProjectId();
            ctx.put("projectName",       projectName);
            ctx.put("decision",          decision);
            ctx.put("ownerName",         requestedBy);
            ctx.put("changeDescription", changeDesc != null ? changeDesc : "General approval");
            ctx.put("reviewedBy",        approval.getReviewedBy());
            ctx.put("reviewComment",     approval.getReviewComment());
            ctx.put("projectUrl",        projectUrl);
            String defaultSubject = "[" + orgName + "] Your request for \"" + projectName + "\" was " + decision.toLowerCase();
            String subject = emailTemplateService.resolveSubject("approval-decision", defaultSubject, ctx);

            emailService.sendAlert(recipientEmail, subject, ctx, "approval-decision.html");
            log.info("ApprovalNotificationService: sent {} notification to {}", decision, recipientEmail);

        } catch (Exception e) {
            // Never let notification failure propagate — approval is already saved
            log.error("ApprovalNotificationService: failed to send notification for approval {} — {}",
                    approval.getId(), e.getMessage(), e);
        }
    }
}
