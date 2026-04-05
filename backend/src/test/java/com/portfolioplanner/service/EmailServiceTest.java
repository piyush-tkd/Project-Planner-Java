package com.portfolioplanner.service;

import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link EmailService}.
 *
 * Uses Mockito to stub {@link SmtpConfigService} and {@link TemplateEngine}
 * so no SMTP server or DB is required.
 */
@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock private SmtpConfigService smtpConfigService;
    @Mock private TemplateEngine    templateEngine;
    @Mock private JavaMailSenderImpl mailSender;
    @Mock private MimeMessage       mimeMessage;

    private EmailService emailService;

    private static final String RENDERED_HTML =
            "<html><body><h1>Test Email</h1></body></html>";
    private static final String FROM = "noreply@portfolioplanner";

    @BeforeEach
    void setUp() {
        emailService = new EmailService(smtpConfigService, templateEngine);
    }

    // ── 1. Happy path via public sendAlert(to,subject,ctx,template) ──────────

    @Test
    void sendAlert_whenSmtpEnabled_rendersTemplateAndSends() {
        when(smtpConfigService.buildMailSender()).thenReturn(mailSender);
        when(smtpConfigService.load()).thenReturn(smtpConfigWithFrom(FROM));
        when(templateEngine.process(eq("email/weekly-digest.html"), any(Context.class)))
                .thenReturn(RENDERED_HTML);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailService.sendAlert(
                "pm@example.com",
                "Weekly Digest",
                Map.of("projectCount", 12, "warningCount", 0),
                "weekly-digest.html"
        );

        // TemplateEngine called with correct path and variables
        ArgumentCaptor<Context> ctxCaptor = ArgumentCaptor.forClass(Context.class);
        verify(templateEngine).process(eq("email/weekly-digest.html"), ctxCaptor.capture());
        assertThat(ctxCaptor.getValue().getVariable("projectCount")).isEqualTo(12);

        // mailSender.send was called
        verify(mailSender, times(1)).send(any(MimeMessage.class));
    }

    // ── 2. SMTP disabled → no-op ──────────────────────────────────────────────

    @Test
    void sendAlert_whenSmtpDisabled_doesNotSend() {
        when(smtpConfigService.buildMailSender()).thenReturn(null);

        emailService.sendAlert("x@y.com", "Subject", Map.of(), "weekly-digest.html");

        verify(mailSender, never()).send(any(MimeMessage.class));
        verify(templateEngine, never()).process(anyString(), any());
    }

    // ── 3. Null context map is handled gracefully ─────────────────────────────

    @Test
    void sendAlert_nullContext_doesNotThrow() {
        when(templateEngine.process(anyString(), any(Context.class))).thenReturn(RENDERED_HTML);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailService.sendAlert("a@b.com", "Subject", null, "weekly-digest.html",
                FROM, mailSender);

        verify(mailSender, times(1)).send(any(MimeMessage.class));
    }

    // ── 4. Template engine failure → EmailDeliveryException ──────────────────

    @Test
    void sendAlert_templateFailure_throwsEmailDeliveryException() {
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        when(templateEngine.process(anyString(), any(Context.class)))
                .thenThrow(new RuntimeException("Template not found"));

        assertThatThrownBy(() ->
                emailService.sendAlert("x@y.com", "Subject", Map.of(), "missing.html",
                        FROM, mailSender))
                .isInstanceOf(EmailService.EmailDeliveryException.class)
                .hasMessageContaining("missing.html");

        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    // ── 5. Context variables are passed through ───────────────────────────────

    @Test
    void sendAlert_contextVariablesReachTemplate() {
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        when(templateEngine.process(anyString(), any(Context.class))).thenReturn(RENDERED_HTML);

        Map<String, Object> ctx = Map.of(
                "totalStale",         14,
                "criticalCount",       4,
                "staleThresholdDays",  7
        );
        emailService.sendAlert("ops@example.com", "Stale Tickets", ctx,
                "support-staleness.html", FROM, mailSender);

        ArgumentCaptor<Context> cap = ArgumentCaptor.forClass(Context.class);
        verify(templateEngine).process(eq("email/support-staleness.html"), cap.capture());
        assertThat(cap.getValue().getVariable("totalStale")).isEqualTo(14);
        assertThat(cap.getValue().getVariable("staleThresholdDays")).isEqualTo(7);
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
