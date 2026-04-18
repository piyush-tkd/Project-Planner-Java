package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.RolePrivilege;
import com.portfolioplanner.domain.repository.AppUserRepository;
import com.portfolioplanner.security.JwtUtil;
import com.portfolioplanner.service.RefreshTokenService;
import com.portfolioplanner.service.UserManagementService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final AppUserRepository userRepo;
    private final UserManagementService userManagementService;
    private final RefreshTokenService refreshTokenService;

    /** Set to false in local dev (application-local.yml: app.cookie.secure: false). */
    @Value("${app.cookie.secure:true}")
    private boolean cookieSecure;

    private static final String REFRESH_COOKIE_NAME = "refresh_token";

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}

    /** Full response after login or /me — includes role and allowed pages. */
    public record MeResponse(
            String token,
            String username,
            /** Optional display name set by admin; falls back to username if null. */
            String displayName,
            String role,
            /** null means all pages are allowed (ADMIN). Non-null list restricts to those page keys. */
            List<String> allowedPages) {}

    /**
     * POST /api/auth/login
     * Authenticates the user and issues a JWT stored in an HttpOnly cookie.
     * The token is also returned in the response body (field {@code token})
     * for backward compatibility until Prompt 1.10 removes it from the frontend.
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request,
                                   HttpServletRequest httpRequest,
                                   HttpServletResponse response) {
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password())
            );
            String token = jwtUtil.generateToken(auth.getName());
            addTokenCookie(response, token);

            // Issue a rotating refresh token stored in a separate HttpOnly cookie.
            // The access token is intentionally short-lived (15 min); the refresh
            // token allows silent renewal without prompting the user to re-login.
            var user = userRepo.findByUsername(auth.getName()).orElseThrow();
            String rawRefresh = refreshTokenService.issue(user.getId(), httpRequest.getHeader("User-Agent"));
            addRefreshCookie(response, rawRefresh);

            return ResponseEntity.ok(buildMeResponse(token, auth.getName()));
        } catch (AuthenticationException e) {
            return ResponseEntity.status(401)
                    .body(java.util.Map.of("message", "Invalid username or password"));
        }
    }

    /**
     * POST /api/auth/logout
     * Clears the HttpOnly access_token and refresh_token cookies (sets Max-Age=0).
     * Does NOT revoke the refresh token server-side — use /logout-all for that.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        clearTokenCookie(response);
        clearRefreshCookie(response);
        return ResponseEntity.noContent().build();
    }

    /**
     * POST /api/auth/refresh
     * Silently renews the access token using the rotating refresh token cookie.
     * On success: old refresh token is deleted, a new pair of cookies is issued.
     * On failure: both cookies are cleared and the client must re-login (HTTP 401).
     * Intentionally unauthenticated — the access token may already be expired.
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(HttpServletRequest httpRequest, HttpServletResponse response) {
        String rawToken = extractRefreshCookie(httpRequest);
        if (rawToken == null) {
            return ResponseEntity.status(401).body(java.util.Map.of("message", "No refresh token present"));
        }

        String userAgent = httpRequest.getHeader("User-Agent");
        var newRaw = refreshTokenService.rotate(rawToken, userAgent);

        if (newRaw.isEmpty()) {
            // Rotation failed — expired, revoked, or a replay attempt.
            // Clear both cookies so the browser doesn't keep retrying.
            clearTokenCookie(response);
            clearRefreshCookie(response);
            return ResponseEntity.status(401).body(java.util.Map.of("message", "Refresh token invalid or expired"));
        }

        // Rotation succeeded — look up the user and issue a fresh access token.
        Long userId = refreshTokenService.getUserId(newRaw.get()).orElseThrow();
        var user = userRepo.findById(userId).orElseThrow();

        String accessToken = jwtUtil.generateToken(user.getUsername());
        addTokenCookie(response, accessToken);
        addRefreshCookie(response, newRaw.get());

        return ResponseEntity.ok(buildMeResponse(accessToken, user.getUsername()));
    }

    /**
     * POST /api/auth/logout-all
     * Revokes all refresh tokens for the owning user (forces re-login on all devices).
     * Identified via the refresh cookie — intentionally unauthenticated so it works
     * even when the short-lived access token has already expired.
     */
    @PostMapping("/logout-all")
    public ResponseEntity<Void> logoutAll(HttpServletRequest httpRequest, HttpServletResponse response) {
        String rawToken = extractRefreshCookie(httpRequest);
        if (rawToken != null) {
            refreshTokenService.getUserId(rawToken)
                    .ifPresent(refreshTokenService::revokeAll);
        }
        clearTokenCookie(response);
        clearRefreshCookie(response);
        return ResponseEntity.noContent().build();
    }

    /**
     * GET /api/auth/me
     * Returns the current user's username, role, and allowed pages.
     */
    @GetMapping("/me")
    public ResponseEntity<MeResponse> me(Authentication authentication) {
        return ResponseEntity.ok(buildMeResponse(null, authentication.getName()));
    }

    /**
     * GET /api/auth/privileges
     * Returns granular role_privilege rows for the logged-in user's role.
     * ADMIN/SUPER_ADMIN receive an empty list (all access is implicit).
     */
    @GetMapping("/privileges")
    public ResponseEntity<List<RolePrivilege>> privileges(Authentication authentication) {
        var user = userRepo.findByUsername(authentication.getName()).orElseThrow();
        return ResponseEntity.ok(userManagementService.getPrivileges(user.getRole()));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private MeResponse buildMeResponse(String token, String username) {
        var user = userRepo.findByUsername(username).orElseThrow();
        List<String> allowedPages = userManagementService.getAllowedPages(user.getRole());
        return new MeResponse(token, username, user.getDisplayName(), user.getRole(), allowedPages);
    }

    /** Writes the access_token HttpOnly cookie to the response. */
    private void addTokenCookie(HttpServletResponse response, String token) {
        ResponseCookie cookie = ResponseCookie.from("access_token", token)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/")
                .maxAge(Duration.ofMillis(jwtUtil.getExpirationMs()))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    /** Overwrites the access_token cookie with Max-Age=0, causing the browser to delete it. */
    private void clearTokenCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("access_token", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    /**
     * Writes the refresh_token HttpOnly cookie scoped to /api/auth so it is only
     * ever sent to the refresh and logout endpoints — not to every API call.
     */
    private void addRefreshCookie(HttpServletResponse response, String rawToken) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE_NAME, rawToken)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/api/auth")   // narrower scope — never sent to business endpoints
                .maxAge(Duration.ofDays(30))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    /** Overwrites the refresh_token cookie with Max-Age=0, causing the browser to delete it. */
    private void clearRefreshCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    /** Extracts the raw refresh token from the incoming request's cookies, or null if absent. */
    private static String extractRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie c : request.getCookies()) {
            if (REFRESH_COOKIE_NAME.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}
