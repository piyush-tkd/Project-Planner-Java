package com.portfolioplanner.controller;

import com.portfolioplanner.domain.repository.AppUserRepository;
import com.portfolioplanner.dto.SmtpConfigDto;
import com.portfolioplanner.service.ApprovalNotificationService;
import com.portfolioplanner.service.SmtpConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST endpoints for managing SMTP configuration stored in the database.
 *
 * <pre>
 *   GET  /api/settings/smtp         → current config (password masked)
 *   PUT  /api/settings/smtp         → save config
 *   POST /api/settings/smtp/test    → verify SMTP connectivity
 * </pre>
 *
 * All endpoints require ADMIN or SUPER_ADMIN role.
 */
@RestController
@RequestMapping("/api/settings/smtp")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
public class SmtpConfigController {

    private final SmtpConfigService             smtpConfigService;
    private final ApprovalNotificationService   approvalNotificationService;
    private final AppUserRepository             appUserRepository;

    /** Returns current SMTP settings with password masked. */
    @GetMapping
    public ResponseEntity<SmtpConfigDto> get() {
        return ResponseEntity.ok(smtpConfigService.loadDto());
    }

    /** Saves SMTP settings. Blank password in body → keep existing password. */
    @PutMapping
    public ResponseEntity<SmtpConfigDto> save(@RequestBody SmtpConfigDto dto) {
        return ResponseEntity.ok(smtpConfigService.save(dto));
    }

    /**
     * Sends a live org-branded test email (approval-pending template) to the
     * authenticated admin's own email address. Verifies the full send path:
     * SMTP connection → Thymeleaf render → inbox delivery.
     */
    @PostMapping("/send-test")
    public ResponseEntity<Map<String, Object>> sendTestEmail(Authentication auth) {
        try {
            String username = auth != null ? auth.getName() : null;
            String recipientEmail = username == null ? null :
                    appUserRepository.findByUsername(username)
                            .map(u -> u.getEmail())
                            .orElse(null);

            if (recipientEmail == null || recipientEmail.isBlank()) {
                return ResponseEntity.ok(Map.of(
                        "success", false,
                        "message", "No email address is set on your account. Add an email in your profile settings first."
                ));
            }

            approvalNotificationService.sendTestEmail(recipientEmail, username);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Test email sent to " + recipientEmail + ". Check your inbox."
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "Failed to send test email: " + e.getMessage()
            ));
        }
    }

    /** Opens a test SMTP connection using the current (saved) configuration. */
    @PostMapping("/test")
    public ResponseEntity<Map<String, Object>> test() {
        try {
            smtpConfigService.testConnection();
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Connection successful — SMTP server responded correctly."
            ));
        } catch (SmtpConfigService.SmtpTestException e) {
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", e.getMessage()
            ));
        }
    }
}
