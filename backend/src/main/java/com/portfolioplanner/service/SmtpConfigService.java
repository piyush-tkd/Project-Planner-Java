package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.SmtpConfig;
import com.portfolioplanner.domain.repository.SmtpConfigRepository;
import com.portfolioplanner.dto.SmtpConfigDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Properties;

/**
 * Manages SMTP configuration stored in the {@code smtp_config} DB table.
 *
 * <p>Callers (e.g. {@link EmailService}) should call {@link #buildMailSender()}
 * at send-time rather than caching it, so that config changes take effect
 * without a restart.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SmtpConfigService {

    private final SmtpConfigRepository repo;

    // ── Read ──────────────────────────────────────────────────────────────────

    /** Returns the current config row (always present after V84 migration). */
    @Transactional(readOnly = true)
    public SmtpConfig load() {
        return repo.findById(1L).orElseGet(() -> {
            log.warn("SmtpConfigService: no smtp_config row found — returning defaults.");
            return new SmtpConfig();
        });
    }

    /** Returns a DTO safe to send to the frontend (password masked). */
    @Transactional(readOnly = true)
    public SmtpConfigDto loadDto() {
        SmtpConfig cfg = load();
        SmtpConfigDto dto = new SmtpConfigDto();
        dto.setHost(cfg.getHost());
        dto.setPort(cfg.getPort());
        dto.setUsername(cfg.getUsername());
        dto.setPassword(null);   // never expose stored password
        dto.setPasswordSet(cfg.getPassword() != null && !cfg.getPassword().isBlank());
        dto.setFromAddress(cfg.getFromAddress());
        dto.setUseTls(cfg.isUseTls());
        dto.setEnabled(cfg.isEnabled());
        return dto;
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /**
     * Saves updated SMTP settings.  If {@code dto.password} is blank the
     * stored password is kept unchanged (allows UI to "not touch" the password
     * field while still saving other fields).
     */
    @Transactional
    public SmtpConfigDto save(SmtpConfigDto dto) {
        SmtpConfig cfg = load();

        if (dto.getHost()        != null) cfg.setHost(dto.getHost().trim());
        if (dto.getPort()        != null) cfg.setPort(dto.getPort());
        if (dto.getUsername()    != null) cfg.setUsername(dto.getUsername().trim());
        if (dto.getFromAddress() != null) cfg.setFromAddress(dto.getFromAddress().trim());
        if (dto.getUseTls()      != null) cfg.setUseTls(dto.getUseTls());
        if (dto.getEnabled()     != null) cfg.setEnabled(dto.getEnabled());

        // Only overwrite the stored password when a non-blank value is supplied
        if (dto.getPassword() != null && !dto.getPassword().isBlank()) {
            cfg.setPassword(dto.getPassword());
        }

        repo.save(cfg);
        log.info("SmtpConfigService: configuration saved (enabled={}, host={}:{})",
                cfg.isEnabled(), cfg.getHost(), cfg.getPort());
        return loadDto();
    }

    // ── Build mail sender ─────────────────────────────────────────────────────

    /**
     * Constructs a {@link JavaMailSenderImpl} from the current DB config.
     * Returns {@code null} if SMTP is disabled or host is blank.
     */
    public JavaMailSenderImpl buildMailSender() {
        SmtpConfig cfg = load();
        if (!cfg.isEnabled()) {
            log.debug("SmtpConfigService: SMTP disabled — not building mail sender.");
            return null;
        }
        if (cfg.getHost() == null || cfg.getHost().isBlank()) {
            log.warn("SmtpConfigService: SMTP host is blank — cannot build mail sender.");
            return null;
        }

        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(cfg.getHost());
        sender.setPort(cfg.getPort());
        sender.setUsername(cfg.getUsername());
        sender.setPassword(cfg.getPassword());
        sender.setDefaultEncoding("UTF-8");

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth",           !cfg.getUsername().isBlank());
        if (cfg.isUseTls()) {
            props.put("mail.smtp.starttls.enable", "true");
        }
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout",           "10000");
        props.put("mail.smtp.writetimeout",      "10000");

        return sender;
    }

    // ── Test connection ───────────────────────────────────────────────────────

    /**
     * Attempts to open a test connection to the SMTP server using current config.
     *
     * @return {@code true} if the connection succeeds
     * @throws SmtpTestException with a human-readable message on failure
     */
    public boolean testConnection() {
        JavaMailSenderImpl sender = buildMailSender();
        if (sender == null) {
            throw new SmtpTestException("SMTP is disabled or not configured.");
        }
        try {
            sender.testConnection();
            log.info("SmtpConfigService: test connection to {}:{} succeeded.",
                    sender.getHost(), sender.getPort());
            return true;
        } catch (Exception e) {
            log.warn("SmtpConfigService: test connection failed — {}", e.getMessage());
            throw new SmtpTestException("Connection failed: " + e.getMessage());
        }
    }

    // ── Exception ─────────────────────────────────────────────────────────────

    public static class SmtpTestException extends RuntimeException {
        public SmtpTestException(String message) { super(message); }
    }
}
