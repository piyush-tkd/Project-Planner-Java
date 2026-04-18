package com.portfolioplanner.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Date;
import java.util.Set;

@Slf4j
@Component
public class JwtUtil {

    /** Known-weak placeholder strings that must never reach production. */
    private static final Set<String> KNOWN_PLACEHOLDERS = Set.of(
            "portfolio-planner-secret-key-must-be-at-least-32-chars-long"
    );

    /** Minimum acceptable secret length for HMAC-SHA256 (256 bits / 8 = 32 bytes). */
    private static final int MIN_SECRET_BYTES = 32;

    /**
     * Dummy key used only during context initialization when the real secret is
     * absent/blank. The {@link #validateSecret()} post-construct guard will
     * throw before any request is handled.
     */
    private static final String INIT_DUMMY_KEY =
            "init-only-never-used-in-production-padding-!!";

    private final String rawSecret;
    private final SecretKey secretKey;
    private final long expirationMs;
    private final Environment environment;

    public JwtUtil(
            @Value("${app.jwt.secret:}") String secret,
            @Value("${app.jwt.expiration-ms:86400000}") long expirationMs,   // 24 hours default
            @Value("${app.auth.refresh-token-enabled:true}") boolean refreshTokenEnabled,
            Environment environment) {
        this.rawSecret   = secret;
        // When the refresh-token flow is active, cap access-token lifetime to 15 min.
        // A stolen short-lived token expires quickly; the refresh cookie renews it silently.
        // The original expiration-ms value is kept as a floor so that explicit overrides
        // (e.g. expiration-ms=300000 in tests) are still respected.
        this.expirationMs = refreshTokenEnabled
                ? Math.min(expirationMs, 900_000L)   // 900 000 ms = 15 min
                : expirationMs;
        this.environment  = environment;
        // Use a safe dummy key if the secret is absent so the Spring context
        // finishes loading; validateSecret() will abort startup in prod.
        String effective = (secret == null || secret.isBlank()) ? INIT_DUMMY_KEY : secret;
        this.secretKey = Keys.hmacShaKeyFor(effective.getBytes(StandardCharsets.UTF_8));
    }

    // ── Startup secret validation ─────────────────────────────────────────────

    @PostConstruct
    void validateSecret() {
        boolean insecure = isInsecureSecret(rawSecret);
        boolean isProd   = isProductionProfile();

        if (isProd && insecure) {
            throw new IllegalStateException(
                    "[Security] app.jwt.secret must not be a placeholder value in production. " +
                    "Set the JWT_SECRET environment variable to a cryptographically random " +
                    "string of at least 32 characters (e.g. openssl rand -hex 32). " +
                    "The server will not start without a valid secret.");
        }
        if (insecure) {
            log.warn("[Security] app.jwt.secret is absent or using a placeholder. " +
                     "This is acceptable in local development only. " +
                     "Set JWT_SECRET before deploying to any shared or production environment.");
        }
    }

    private boolean isInsecureSecret(String secret) {
        if (secret == null || secret.isBlank())              return true;
        if (secret.length() < MIN_SECRET_BYTES)              return true;
        if (secret.toLowerCase().contains("changeme"))       return true;
        if (KNOWN_PLACEHOLDERS.contains(secret))             return true;
        return false;
    }

    private boolean isProductionProfile() {
        return Arrays.stream(environment.getActiveProfiles())
                .anyMatch(p -> p.equals("prod") || p.equals("production") || p.equals("railway"));
    }

    /** Generate a signed JWT for the given username. */
    public String generateToken(String username) {
        return Jwts.builder()
                .subject(username)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(secretKey)
                .compact();
    }

    /** Extract the username (subject) from a token. */
    public String extractUsername(String token) {
        return parseClaims(token).getSubject();
    }

    /** Expiration window in milliseconds (used to set cookie Max-Age). */
    public long getExpirationMs() {
        return expirationMs;
    }

    /** Return true if the token is valid for the given user and not expired. */
    public boolean isValid(String token, UserDetails userDetails) {
        try {
            String username = extractUsername(token);
            return username.equals(userDetails.getUsername()) && !isExpired(token);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isExpired(String token) {
        return parseClaims(token).getExpiration().before(new Date());
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
