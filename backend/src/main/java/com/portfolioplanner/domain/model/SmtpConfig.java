package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Singleton row (id = 1) that stores SMTP delivery configuration.
 * Admins configure this via Admin Settings → Email tab instead of
 * environment variables, so no restart is required to change credentials.
 */
@Entity
@Table(name = "smtp_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SmtpConfig {

    /** Always 1 — singleton table pattern. */
    @Id
    private Long id = 1L;

    @Column(nullable = false)
    private String host = "smtp.gmail.com";

    @Column(nullable = false)
    private Integer port = 587;

    @Column(nullable = false)
    private String username = "";

    /** Stored as plain-text; encrypt at rest if needed. */
    @Column(length = 1000)
    private String password = "";

    @Column(name = "from_address", nullable = false)
    private String fromAddress = "noreply@portfolioplanner";

    @Column(name = "use_tls", nullable = false)
    private boolean useTls = true;

    /** Master switch — no emails are sent unless this is true. */
    @Column(nullable = false)
    private boolean enabled = false;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = LocalDateTime.now();
    }
}
