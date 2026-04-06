package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AppUser;
import com.portfolioplanner.domain.model.PasswordResetToken;
import com.portfolioplanner.domain.repository.AppUserRepository;
import com.portfolioplanner.domain.repository.PasswordResetTokenRepository;
import com.portfolioplanner.service.EmailService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Map;

/**
 * Password-reset flow — both endpoints are public (no JWT required).
 *
 * POST /api/auth/forgot-password  — request a reset link (sends email if address is known)
 * POST /api/auth/reset-password   — consume token + set new password
 *
 * Security note: both endpoints return the same 200 OK response regardless of
 * whether the email/username exists, to prevent user-enumeration attacks.
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class PasswordResetController {

    private static final int    TOKEN_BYTES      = 32;   // 256 bits → 64 hex chars
    private static final long   TOKEN_TTL_HOURS  = 1;
    private static final String GENERIC_OK_MSG   = "If that account exists, a reset link has been sent.";

    private final AppUserRepository            userRepo;
    private final PasswordResetTokenRepository tokenRepo;
    private final PasswordEncoder              passwordEncoder;
    private final EmailService                 emailService;

    @Value("${app.frontend.base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    // ── Request records ─────────────────────────────────────────────────────

    public record ForgotRequest(@NotBlank @Email String email) {}

    public record ResetRequest(
            @NotBlank String token,
            @NotBlank @Size(min = 8, max = 128) String newPassword
    ) {}

    // ── Endpoints ───────────────────────────────────────────────────────────

    /**
     * Step 1 — user submits their email address.
     * If found, generate a token, persist it, and email a reset link.
     * Always returns 200 to prevent email enumeration.
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @Valid @RequestBody ForgotRequest req) {

        userRepo.findByEmailIgnoreCase(req.email()).ifPresent(user -> {
            // Clean up any existing (unused) tokens for this user first
            String token = generateToken();
            PasswordResetToken prt = new PasswordResetToken();
            prt.setToken(token);
            prt.setUsername(user.getUsername());
            prt.setExpiresAt(Instant.now().plus(TOKEN_TTL_HOURS, ChronoUnit.HOURS));
            tokenRepo.save(prt);

            String resetUrl = frontendBaseUrl + "/reset-password?token=" + token;
            log.info("Password reset requested for user '{}' — link expires in {} hour(s)",
                    user.getUsername(), TOKEN_TTL_HOURS);

            try {
                emailService.sendAlert(
                        req.email(),
                        "Portfolio Planner — Reset your password",
                        Map.of(
                                "displayName", user.getDisplayName() != null
                                        ? user.getDisplayName() : user.getUsername(),
                                "resetUrl",    resetUrl,
                                "expiryHours", TOKEN_TTL_HOURS
                        ),
                        "password-reset.html"
                );
            } catch (EmailService.EmailDeliveryException ex) {
                // Log but do NOT surface the error — still return generic OK
                log.error("Could not send password-reset email to {}: {}", req.email(), ex.getMessage());
            }
        });

        return ResponseEntity.ok(Map.of("message", GENERIC_OK_MSG));
    }

    /**
     * Step 2 — user submits the token from the link + their new password.
     * Returns 400 with a specific message on validation failure (token
     * not found / expired / already used), which is safe because the
     * attacker already needs to possess the token.
     */
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @Valid @RequestBody ResetRequest req) {

        PasswordResetToken prt = tokenRepo.findByToken(req.token())
                .orElse(null);

        if (prt == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Invalid or expired reset link. Please request a new one."));
        }
        if (prt.isUsed()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "This reset link has already been used. Please request a new one."));
        }
        if (prt.isExpired()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "This reset link has expired. Please request a new one."));
        }

        AppUser user = userRepo.findByUsername(prt.getUsername()).orElse(null);
        if (user == null || !user.isEnabled()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Account not found or disabled. Contact your administrator."));
        }

        // Update the password and mark the token as used atomically
        user.setPassword(passwordEncoder.encode(req.newPassword()));
        userRepo.save(user);

        prt.setUsed(true);
        tokenRepo.save(prt);

        log.info("Password successfully reset for user '{}'", user.getUsername());
        return ResponseEntity.ok(Map.of("message", "Password updated successfully. You can now log in."));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static final SecureRandom RNG = new SecureRandom();

    private static String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RNG.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
