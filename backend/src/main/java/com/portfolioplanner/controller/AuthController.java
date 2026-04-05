package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.RolePrivilege;
import com.portfolioplanner.domain.repository.AppUserRepository;
import com.portfolioplanner.security.JwtUtil;
import com.portfolioplanner.service.UserManagementService;
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

    /** Set to false in local dev (application-local.yml: app.cookie.secure: false). */
    @Value("${app.cookie.secure:true}")
    private boolean cookieSecure;

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
                                   HttpServletResponse response) {
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password())
            );
            String token = jwtUtil.generateToken(auth.getName());
            addTokenCookie(response, token);
            return ResponseEntity.ok(buildMeResponse(token, auth.getName()));
        } catch (AuthenticationException e) {
            return ResponseEntity.status(401)
                    .body(java.util.Map.of("message", "Invalid username or password"));
        }
    }

    /**
     * POST /api/auth/logout
     * Clears the HttpOnly access_token cookie (sets Max-Age=0).
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        clearTokenCookie(response);
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
}
