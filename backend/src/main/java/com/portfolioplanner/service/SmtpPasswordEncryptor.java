package com.portfolioplanner.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

/**
 * Symmetric AES-256-GCM encryption for SMTP passwords stored in the database.
 *
 * <p><strong>Storage format:</strong> {@code {enc}BASE64(IV||CIPHERTEXT||TAG)}
 * Passwords that do not carry the {@code {enc}} prefix are treated as
 * legacy/plain-text and returned as-is so that existing empty values are
 * handled transparently.
 *
 * <p><strong>Configuration:</strong> Set {@code SMTP_ENCRYPTION_KEY} in your
 * environment (or override {@code app.smtp.encryption-key} in
 * application-local.yml) to a secret phrase.  The key is SHA-256 hashed so
 * any string length is accepted.  Change the key only before saving a new
 * password; previously-encrypted values will fail to decrypt if the key is
 * rotated without migrating stored values.
 */
@Slf4j
@Service
public class SmtpPasswordEncryptor {

    private static final String PREFIX         = "{enc}";
    private static final String ALGORITHM      = "AES/GCM/NoPadding";
    private static final int    GCM_IV_BYTES   = 12;   // 96-bit IV as per NIST recommendation
    private static final int    GCM_TAG_BITS   = 128;  // authentication tag length

    /** Known-weak placeholder strings that must never reach production. */
    private static final String PLACEHOLDER_MARKER = "changeme";

    /** Safe dummy used during context init when the real key is absent. */
    private static final String INIT_DUMMY_KEY = "init-only-never-used-in-production-padding-!!";

    private final String rawEncryptionKey;
    private final SecretKey secretKey;
    private final Environment environment;

    public SmtpPasswordEncryptor(
            @Value("${app.smtp.encryption-key:}") String rawKey,
            Environment environment) {
        this.rawEncryptionKey = rawKey;
        this.environment      = environment;
        // Use a safe dummy key if absent so the Spring context finishes loading;
        // validateKey() will abort startup in prod.
        String effective = (rawKey == null || rawKey.isBlank()) ? INIT_DUMMY_KEY : rawKey;
        this.secretKey = deriveKey(effective);
    }

    // ── Startup key validation ────────────────────────────────────────────────

    @PostConstruct
    void validateKey() {
        boolean insecure = isInsecureKey(rawEncryptionKey);
        boolean isProd   = isProductionProfile();

        if (isProd && insecure) {
            throw new IllegalStateException(
                    "[Security] app.smtp.encryption-key must not be a placeholder value in production. " +
                    "Set the SMTP_ENCRYPTION_KEY environment variable to a cryptographically random " +
                    "string (e.g. openssl rand -hex 32). " +
                    "The server will not start without a valid encryption key.");
        }
        if (insecure) {
            log.warn("[Security] app.smtp.encryption-key is absent or using a placeholder. " +
                     "This is acceptable in local development only. " +
                     "Set SMTP_ENCRYPTION_KEY before deploying to any shared or production environment.");
        }
    }

    private boolean isInsecureKey(String key) {
        if (key == null || key.isBlank())                   return true;
        if (key.toLowerCase().contains(PLACEHOLDER_MARKER)) return true;
        return false;
    }

    private boolean isProductionProfile() {
        return Arrays.stream(environment.getActiveProfiles())
                .anyMatch(p -> p.equals("prod") || p.equals("production") || p.equals("railway"));
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Encrypts {@code plaintext} and returns a prefixed, base64-encoded string
     * suitable for DB storage.  Returns {@code null} or empty string unchanged.
     */
    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) return plaintext;
        try {
            byte[] iv = generateIv();
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            // Concatenate IV + ciphertext (tag is appended to ciphertext by AES/GCM/NoPadding)
            byte[] combined = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(encrypted, 0, combined, iv.length, encrypted.length);

            return PREFIX + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            log.error("SmtpPasswordEncryptor: encryption failed — storing password as-is: {}", e.getMessage());
            return plaintext; // fail-safe: better to store than to lose
        }
    }

    /**
     * Decrypts a value produced by {@link #encrypt}.
     * Values without the {@code {enc}} prefix are returned unchanged (legacy
     * plain-text compat).  Returns {@code null} or empty string unchanged.
     */
    public String decrypt(String stored) {
        if (stored == null || stored.isBlank()) return stored;
        if (!stored.startsWith(PREFIX)) {
            // Not encrypted (empty default or legacy plain-text) — return as-is
            return stored;
        }
        try {
            byte[] combined = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            byte[] iv       = Arrays.copyOfRange(combined, 0, GCM_IV_BYTES);
            byte[] ciphertext = Arrays.copyOfRange(combined, GCM_IV_BYTES, combined.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] decrypted = cipher.doFinal(ciphertext);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("SmtpPasswordEncryptor: decryption failed — check that SMTP_ENCRYPTION_KEY matches "
                    + "the key used when the password was saved: {}", e.getMessage());
            return ""; // fail-safe: return blank so mail sender is built but auth fails visibly
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static SecretKey deriveKey(String rawKey) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = sha.digest(rawKey.getBytes(StandardCharsets.UTF_8));
            return new SecretKeySpec(keyBytes, "AES"); // 256-bit key
        } catch (Exception e) {
            throw new IllegalStateException("SmtpPasswordEncryptor: failed to derive AES key", e);
        }
    }

    private static byte[] generateIv() {
        byte[] iv = new byte[GCM_IV_BYTES];
        new SecureRandom().nextBytes(iv);
        return iv;
    }
}
