package com.portfolioplanner.security;

import com.portfolioplanner.domain.model.AppUser;
import com.portfolioplanner.domain.repository.AppUserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Duration;
import java.util.UUID;

/**
 * Bridges a successful OIDC / OAuth2 login to the existing JWT cookie
 * authentication used by the rest of the application.
 *
 * <p>On first SSO login the user is <em>provisioned</em> automatically with
 * the READ_WRITE role. Admins can change the role afterwards in User Management.
 *
 * <p>After issuing the JWT cookie the handler redirects the browser back to
 * the frontend root so the React SPA can pick up the session.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SsoAuthSuccessHandler implements AuthenticationSuccessHandler {

    private final AppUserRepository userRepo;
    private final JwtUtil           jwtUtil;
    private final PasswordEncoder   passwordEncoder;

    @Value("${app.frontend.base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    @Value("${app.cookie.secure:true}")
    private boolean cookieSecure;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        // ── 1. Extract email from OIDC/OAuth2 principal ───────────────────
        String email    = extractEmail(authentication);
        String fullName = extractName(authentication);

        if (email == null || email.isBlank()) {
            log.warn("SSO login: no email claim in OIDC token — denying login");
            response.sendRedirect(frontendBaseUrl + "/login?error=sso_no_email");
            return;
        }

        // ── 2. Find or provision local user ───────────────────────────────
        AppUser user = userRepo.findByEmailIgnoreCase(email)
                .orElseGet(() -> provisionUser(email, fullName));

        if (!user.isEnabled()) {
            log.warn("SSO login: account for {} is disabled", email);
            response.sendRedirect(frontendBaseUrl + "/login?error=sso_disabled");
            return;
        }

        // ── 3. Issue JWT cookie (same pattern as AuthController) ──────────
        String token = jwtUtil.generateToken(user.getUsername());
        ResponseCookie cookie = ResponseCookie.from("access_token", token)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/")
                .maxAge(Duration.ofMillis(jwtUtil.getExpirationMs()))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        log.info("SSO login successful for user '{}' ({})", user.getUsername(), email);

        // ── 4. Redirect to the React app ──────────────────────────────────
        response.sendRedirect(frontendBaseUrl + "/");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String extractEmail(Authentication auth) {
        Object principal = auth.getPrincipal();
        if (principal instanceof OidcUser oidc) {
            return oidc.getEmail();
        }
        if (principal instanceof OAuth2User oauth) {
            Object emailAttr = oauth.getAttribute("email");
            return emailAttr != null ? emailAttr.toString() : null;
        }
        return null;
    }

    private String extractName(Authentication auth) {
        Object principal = auth.getPrincipal();
        if (principal instanceof OidcUser oidc) {
            return oidc.getFullName();
        }
        if (principal instanceof OAuth2User oauth) {
            Object nameAttr = oauth.getAttribute("name");
            return nameAttr != null ? nameAttr.toString() : null;
        }
        return null;
    }

    /**
     * Creates a new AppUser from an SSO login.
     * Username = email local-part (before @), de-duplicated with a suffix if needed.
     * Password = a random UUID hash (user can never actually use it; SSO is the only login path for them).
     */
    private AppUser provisionUser(String email, String displayName) {
        String baseUsername = email.contains("@") ? email.split("@")[0] : email;
        // De-duplicate username
        String username = baseUsername;
        int suffix = 1;
        while (userRepo.findByUsername(username).isPresent()) {
            username = baseUsername + suffix++;
        }

        AppUser user = new AppUser();
        user.setUsername(username);
        user.setEmail(email);
        user.setDisplayName(displayName != null ? displayName : username);
        user.setRole("READ_WRITE");
        user.setEnabled(true);
        // Random unusable password — SSO users authenticate via OIDC, not password
        user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        AppUser saved = userRepo.save(user);
        log.info("SSO: auto-provisioned new user '{}' for email {}", saved.getUsername(), email);
        return saved;
    }
}
