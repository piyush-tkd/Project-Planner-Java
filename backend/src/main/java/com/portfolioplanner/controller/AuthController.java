package com.portfolioplanner.controller;

import com.portfolioplanner.security.JwtUtil;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}
    public record LoginResponse(String token, String username) {}

    /**
     * POST /api/auth/login
     * Body: { "username": "admin", "password": "admin" }
     * Returns: { "token": "<jwt>", "username": "admin" }
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password())
            );
            String token = jwtUtil.generateToken(auth.getName());
            return ResponseEntity.ok(new LoginResponse(token, auth.getName()));
        } catch (AuthenticationException e) {
            return ResponseEntity.status(401)
                    .body(java.util.Map.of("message", "Invalid username or password"));
        }
    }

    /**
     * POST /api/auth/logout
     * JWT is stateless — logout is handled client-side by discarding the token.
     * This endpoint exists so the frontend has a clean API to call.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().build();
    }

    /**
     * GET /api/auth/me
     * Returns the username of the currently authenticated user.
     */
    @GetMapping("/me")
    public ResponseEntity<LoginResponse> me(Authentication authentication) {
        return ResponseEntity.ok(new LoginResponse(null, authentication.getName()));
    }
}
