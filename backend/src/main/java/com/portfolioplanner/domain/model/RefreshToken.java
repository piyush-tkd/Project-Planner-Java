package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Persisted record for a single rotating refresh token.
 *
 * <p>Raw token bytes are NEVER stored — only a SHA-256 hex hash.
 * The browser holds the raw value in an HttpOnly cookie; on
 * {@code POST /api/auth/refresh} the server hashes the cookie value
 * and looks it up here.
 */
@Entity
@Table(name = "refresh_tokens")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** FK to the owning user. Cascades on user delete via DB constraint. */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** SHA-256 hex of the raw token (64 chars). Unique across all rows. */
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "issued_at", nullable = false, updatable = false)
    private LocalDateTime issuedAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    /** Set to true when explicitly revoked (logout / logout-all). */
    @Column(nullable = false)
    private boolean revoked;

    /** Optional — stored for audit/anomaly-detection purposes. */
    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @PrePersist
    void prePersist() {
        if (issuedAt == null) issuedAt = LocalDateTime.now();
        if (!revoked) revoked = false;
    }
}
