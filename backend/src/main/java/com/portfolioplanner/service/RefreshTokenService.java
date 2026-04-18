package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.RefreshToken;
import com.portfolioplanner.domain.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Manages rotating refresh tokens for the Phase 2.1 auth flow.
 *
 * <h3>Security model</h3>
 * <ul>
 *   <li>Raw token — 32 random bytes encoded as URL-safe Base64 (≈44 chars).
 *       Lives only in the browser cookie and is never persisted.</li>
 *   <li>Token hash — SHA-256 hex of the raw token.  Only the hash is stored.</li>
 *   <li>Rotation — every successful refresh replaces the old row with a new one.
 *       Attempting to reuse a rotated token returns 401 and revokes all tokens
 *       for that user (refresh-token reuse detection).</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final SecureRandom RNG = new SecureRandom();

    @Value("${app.auth.refresh-token-ttl-days:30}")
    private int ttlDays;

    private final RefreshTokenRepository refreshTokenRepo;

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Issues a brand-new refresh token for {@code userId}.
     *
     * @param userId    database ID of the owning user
     * @param userAgent HTTP User-Agent header (for audit; may be null)
     * @return the RAW token string — put this in the HttpOnly cookie
     */
    @Transactional
    public String issue(Long userId, String userAgent) {
        String raw  = generateRaw();
        String hash = sha256hex(raw);

        RefreshToken rt = RefreshToken.builder()
                .userId(userId)
                .tokenHash(hash)
                .issuedAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusDays(ttlDays))
                .revoked(false)
                .userAgent(userAgent)
                .build();

        refreshTokenRepo.save(rt);
        log.debug("RefreshTokenService: issued token for userId={}", userId);
        return raw;
    }

    /**
     * Validates and rotates a refresh token.
     *
     * <p>On success: the old row is deleted and a fresh token is issued.
     * On failure (expired, revoked, unknown): all tokens for that user are
     * revoked (reuse-detection) and an empty Optional is returned.
     *
     * @param rawToken the raw value from the browser cookie
     * @param userAgent current request User-Agent
     * @return new raw token (rotate into cookie) or empty if validation failed
     */
    @Transactional
    public Optional<String> rotate(String rawToken, String userAgent) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }

        String hash = sha256hex(rawToken);
        Optional<RefreshToken> found = refreshTokenRepo.findByTokenHash(hash);

        if (found.isEmpty()) {
            log.warn("RefreshTokenService: unknown token presented — possible reuse attack");
            return Optional.empty();
        }

        RefreshToken existing = found.get();

        if (existing.isRevoked()) {
            // Token was already revoked — likely a replay attempt.
            // Revoke all tokens for this user to force re-login.
            log.warn("RefreshTokenService: revoked token reuse detected for userId={} — revoking all tokens",
                    existing.getUserId());
            refreshTokenRepo.revokeAllByUserId(existing.getUserId());
            return Optional.empty();
        }

        if (existing.getExpiresAt().isBefore(LocalDateTime.now())) {
            log.info("RefreshTokenService: expired token for userId={}", existing.getUserId());
            refreshTokenRepo.delete(existing);
            return Optional.empty();
        }

        // Valid — delete old row and issue a fresh token (rotation)
        Long userId = existing.getUserId();
        refreshTokenRepo.delete(existing);

        String newRaw = issue(userId, userAgent);
        log.debug("RefreshTokenService: rotated token for userId={}", userId);
        return Optional.of(newRaw);
    }

    /**
     * Revokes all active refresh tokens for a user.
     * Called on logout-all or when the user changes their password.
     *
     * @return number of rows revoked
     */
    @Transactional
    public int revokeAll(Long userId) {
        int count = refreshTokenRepo.revokeAllByUserId(userId);
        log.info("RefreshTokenService: revoked {} token(s) for userId={}", count, userId);
        return count;
    }

    /**
     * Parses the userId stored in a refresh-token row by its raw value.
     * Returns empty if the token is unknown, revoked, or expired.
     */
    @Transactional(readOnly = true)
    public Optional<Long> getUserId(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return Optional.empty();
        return refreshTokenRepo.findByTokenHash(sha256hex(rawToken))
                .filter(rt -> !rt.isRevoked())
                .filter(rt -> rt.getExpiresAt().isAfter(LocalDateTime.now()))
                .map(RefreshToken::getUserId);
    }

    // ── Housekeeping ───────────────────────────────────────────────────────────

    /** Purge expired and revoked rows daily at 03:15 to keep the table lean. */
    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public void purgeExpired() {
        int deleted = refreshTokenRepo.deleteExpiredAndRevoked(LocalDateTime.now());
        if (deleted > 0) {
            log.info("RefreshTokenService: purged {} expired/revoked token(s)", deleted);
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static String generateRaw() {
        byte[] bytes = new byte[32];
        RNG.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String sha256hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
