package com.portfolioplanner.service;

import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link EmailService}.
 *
 * Uses Mockito to stub {@link SmtpConfigService} and {@link EmailTemplateService}
 * so no SMTP server, DB, or Thymeleaf engine is required.
 */
@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock private SmtpConfigService    smtpConfigService;
    @Mock private EmailTemplateService emailTemplateService;
    @Mock private JavaMailSenderImpl   mailSender;
    @Mock private MimeMessage          mimeMessage;

    private EmailService emailService;

    private static final String RENDERED_HTML =
            "<html><body><h1>Test Email</h1></body></html>";
    private static final String FROM = "noreply@portfolioplanner";

    @BeforeEach
    void setUp() {
        emailService = new EmailService(smtpConfigService, emailTemplateService);
    }

    // ── 1. Happy path via public sendAlert(to,subject,ctx,template) ──────────

    @Test
    void sendAlert_whenSmtpEnabled_rendersTemplateAndSends() {
        when(smtpConfigService.buildMailSender()).thenReturn(mailSender);
        when(smtpConfigService.load()).thenReturn(smtpConfigWithFrom(FROM));
        when(emailTemplateService.renderHtml(eq("weekly-digest.html"), any()))
                .thenReturn(RENDERED_HTML);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailService.sendAlert(
                "pm@example.com",
                "Weekly Digest",
                Map.of("projectCount", 12, "warningCount", 0),
                "weekly-digest.html"
        );

        // EmailTemplateService called with correct template name
        verify(emailTemplateService).renderHtml(eq("weekly-digest.html"), any());

        // mailSender.send was called
        verify(mailSender, times(1)).send(any(MimeMessage.class));
    }

    // ── 2. SMTP disabled → no-op ──────────────────────────────────────────────

    @Test
    void sendAlert_whenSmtpDisabled_doesNotSend() {
        when(smtpConfigService.buildMailSender()).thenReturn(null);

        emailService.sendAlert("x@y.com", "Subject", Map.of(), "weekly-digest.html");

        verify(mailSender, never()).send(any(MimeMessage.class));
        verify(emailTemplateService, never()).renderHtml(anyString(), any());
    }

    // ── 3. Null context map is handled gracefully ─────────────────────────────

    @Test
    void sendAlert_nullContext_doesNotThrow() {
        when(emailTemplateService.renderHtml(anyString(), isNull())).thenReturn(RENDERED_HTML);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailService.sendAlert("a@b.com", "Subject", null, "weekly-digest.html",
                FROM, mailSender);

        verify(mailSender, times(1)).send(any(MimeMessage.class));
    }

    // ── 4. Template render failure → EmailDeliveryException ──────────────────

    @Test
    void sendAlert_templateFailure_throwsEmailDeliveryException() {
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        when(emailTemplateService.renderHtml(anyString(), any()))
                .thenThrow(new RuntimeException("Template not found"));

        assertThatThrownBy(() ->
                emailService.sendAlert("x@y.com", "Subject", Map.of(), "missing.html",
                        FROM, mailSender))
                .isInstanceOf(EmailService.EmailDeliveryException.class)
                .hasMessageContaining("missing.html");

        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    // ── 5. Context variables are passed through to EmailTemplateService ───────

    @Test
    void sendAlert_contextVariablesReachTemplate() {
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        when(emailTemplateService.renderHtml(anyString(), any())).thenReturn(RENDERED_HTML);

        Map<String, Object> ctx = Map.of(
                "totalStale",         14,
                "criticalCount",       4,
                "staleThresholdDays",  7
        );
        emailService.sendAlert("ops@example.com", "Stale Tickets", ctx,
                "support-staleness.html", FROM, mailSender);

        verify(emailTemplateService).renderHtml(eq("support-staleness.html"), eq(ctx));
        verify(mailSender, times(1)).send(any(MimeMessage.class));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private com.portfolioplanner.domain.model.SmtpConfig smtpConfigWithFrom(String from) {
        com.portfolioplanner.domain.model.SmtpConfig cfg =
                new com.portfolioplanner.domain.model.SmtpConfig();
        cfg.setFromAddress(from);
        cfg.setEnabled(true);
        return cfg;
    }
}
