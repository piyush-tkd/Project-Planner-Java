package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AppUser;
import com.portfolioplanner.domain.repository.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import jakarta.servlet.http.Cookie;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for JWT HttpOnly cookie flow (Prompt 1.9).
 *
 * Verifies:
 *  1. POST /api/auth/login  → sets HttpOnly access_token cookie
 *  2. POST /api/auth/logout → clears the cookie (Max-Age=0)
 *  3. A request with only the cookie (no Authorization header) is authenticated
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthCookieTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private AppUserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private static final String TEST_USER = "cookietest";
    private static final String TEST_PASS = "Secret123!";

    @BeforeEach
    void seedUser() {
        userRepository.findByUsername(TEST_USER).ifPresentOrElse(
                u -> { /* already exists */ },
                () -> userRepository.save(new AppUser(
                        null, TEST_USER, passwordEncoder.encode(TEST_PASS), "ADMIN", true, "Cookie Tester")));
    }

    // ── 1. Login sets HttpOnly cookie ─────────────────────────────────────────

    @Test
    void login_SetsHttpOnlyAccessTokenCookie() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + TEST_USER + "\",\"password\":\"" + TEST_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();

        Cookie cookie = result.getResponse().getCookie("access_token");
        assertThat(cookie).as("access_token cookie must be present").isNotNull();
        assertThat(cookie.isHttpOnly()).as("cookie must be HttpOnly").isTrue();
        assertThat(cookie.getMaxAge()).as("cookie max-age must be positive").isGreaterThan(0);
        // Path must be "/" so every API request carries it automatically
        assertThat(cookie.getPath()).isEqualTo("/");
    }

    // ── 2. Login returns token in JSON body (backward-compat until Prompt 1.10) ─

    @Test
    void login_ReturnsTokenInJsonBody() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + TEST_USER + "\",\"password\":\"" + TEST_PASS + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.username").value(TEST_USER))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    // ── 3. Logout clears cookie (Max-Age = 0) ─────────────────────────────────

    @Test
    void logout_ClearsAccessTokenCookie() throws Exception {
        // First log in to get a valid cookie
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + TEST_USER + "\",\"password\":\"" + TEST_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();

        Cookie accessToken = loginResult.getResponse().getCookie("access_token");
        assertThat(accessToken).isNotNull();

        // Now log out — cookie must be expired (Max-Age = 0)
        MvcResult logoutResult = mockMvc.perform(post("/api/auth/logout")
                        .cookie(accessToken))
                .andExpect(status().isNoContent())
                .andReturn();

        Cookie clearedCookie = logoutResult.getResponse().getCookie("access_token");
        assertThat(clearedCookie).as("logout must set access_token cookie to clear it").isNotNull();
        assertThat(clearedCookie.getMaxAge()).as("cookie max-age must be 0 to delete it").isEqualTo(0);
    }

    // ── 4. Cookie-only request is authenticated (no Authorization header) ─────

    @Test
    void cookieOnlyRequest_IsAuthenticated() throws Exception {
        // Obtain the cookie via login
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + TEST_USER + "\",\"password\":\"" + TEST_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();

        Cookie accessToken = loginResult.getResponse().getCookie("access_token");
        assertThat(accessToken).isNotNull();

        // Call /api/auth/me with ONLY the cookie — no Authorization header
        mockMvc.perform(get("/api/auth/me")
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(TEST_USER));
    }

    // ── 5. Invalid credentials return 401 ────────────────────────────────────

    @Test
    void login_InvalidCredentials_Returns401() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + TEST_USER + "\",\"password\":\"wrongpass\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }
}
