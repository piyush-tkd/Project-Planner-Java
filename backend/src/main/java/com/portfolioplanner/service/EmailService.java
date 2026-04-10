package com.portfolioplanner.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * General-purpose email delivery service backed by Thymeleaf HTML templates.
 *
 * <p>SMTP credentials are read from the DB via {@link SmtpConfigService} on
 * every call to {@link #sendAlert}, so config changes take effect immediately
 * without a server restart.  If SMTP is disabled the call is a no-op (logged
 * at INFO level).
 *
 * <p>Templates live in {@code src/main/resources/templates/email/} but may be
 * overridden by admin-configured content stored in {@code email_template_override}
 * (resolved by {@link EmailTemplateService}).
 *
 * <h3>Usage</h3>
 * <pre>{@code
 * emailService.sendAlert(
 *     "pm@example.com",
 *     "Weekly Portfolio Digest",
 *     Map.of("projectCount", 12, "warningCount", 3),
 *     "weekly-digest.html"
 * );
 * }</pre>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final SmtpConfigService      smtpConfigService;
    private final EmailTemplateService   emailTemplateService;

    /**
     * Renders {@code templateName} with {@code context} variables and sends
     * the resulting HTML to {@code to}.
     *
     * <p>If SMTP is disabled or not configured the method logs a warning and
     * returns without throwing, so callers do not need to guard against it.
     *
     * @param to           recipient email address
     * @param subject      email subject line
     * @param context      template variables (key → value); may be null
     * @param templateName Thymeleaf template filename under {@code templates/email/}
     */
    public void sendAlert(String to,
                          String subject,
                          Map<String, Object> context,
                          String templateName) {
        JavaMailSenderImpl sender = smtpConfigService.buildMailSender();
        if (sender == null) {
            log.info("EmailService: SMTP not configured/disabled — skipping send to {}", to);
            return;
        }
        sendAlert(to, subject, context, templateName,
                smtpConfigService.load().getFromAddress(), sender);
    }

    /**
     * Overload allowing an explicit from-address and pre-built sender.
     * Primarily used by tests.
     */
    public void sendAlert(String to,
                          String subject,
                          Map<String, Object> context,
                          String templateName,
                          String from,
                          JavaMailSenderImpl sender) {
        log.info("EmailService: sending '{}' to {} via template '{}'", subject, to, templateName);
        try {
            // Render via EmailTemplateService (DB override first, Thymeleaf fallback)
            String html = emailTemplateService.renderHtml(templateName, context);

            // Build and send the MIME message
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, /* html= */ true);
            sender.send(message);
            log.debug("EmailService: delivery confirmed → {}", to);

        } catch (MessagingException e) {
            log.error("EmailService: SMTP error sending to {} – {}", to, e.getMessage(), e);
            throw new EmailDeliveryException("Failed to send email to " + to, e);
        } catch (Exception e) {
            log.error("EmailService: template/render error for '{}' – {}", templateName, e.getMessage(), e);
            throw new EmailDeliveryException("Failed to render template " + templateName, e);
        }
    }

    // ── Checked exception wrapper ─────────────────────────────────────────────

    /** Unchecked wrapper so callers don't need to handle checked exceptions. */
    public static class EmailDeliveryException extends RuntimeException {
        public EmailDeliveryException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
