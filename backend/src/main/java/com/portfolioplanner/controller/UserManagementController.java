package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AppUser;
import com.portfolioplanner.service.UserManagementService;
import com.portfolioplanner.service.UserManagementService.CreateUserRequest;
import com.portfolioplanner.service.UserManagementService.UpdateUserRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class UserManagementController {

    private final UserManagementService svc;

    // ── Users ──────────────────────────────────────────────────────────────────

    @GetMapping
    public List<UserResponse> listUsers() {
        return svc.listUsers().stream().map(UserResponse::from).toList();
    }

    @PostMapping
    public ResponseEntity<UserResponse> createUser(@RequestBody CreateUserRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(UserResponse.from(svc.createUser(req)));
    }

    @PutMapping("/{id}")
    public UserResponse updateUser(@PathVariable Long id, @RequestBody UpdateUserRequest req) {
        return UserResponse.from(svc.updateUser(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        svc.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    // ── Page permissions ───────────────────────────────────────────────────────

    /** GET /api/users/permissions/{role} — returns map of pageKey → allowed */
    @GetMapping("/permissions/{role}")
    public Map<String, Boolean> getPermissions(@PathVariable String role) {
        Map<String, Boolean> perms = svc.getPermissions(role);
        return perms != null ? perms : Map.of();
    }

    /** PUT /api/users/permissions/{role} — bulk upsert; body: { "dashboard": true, "settings": false, ... } */
    @PutMapping("/permissions/{role}")
    public ResponseEntity<Void> setPermissions(
            @PathVariable String role,
            @RequestBody Map<String, Boolean> permissions) {
        svc.setPermissions(role, permissions);
        return ResponseEntity.noContent().build();
    }

    // ── Response DTO ───────────────────────────────────────────────────────────

    public record UserResponse(
            Long id,
            String username,
            String displayName,
            String role,
            boolean enabled) {

        static UserResponse from(AppUser u) {
            return new UserResponse(
                    u.getId(),
                    u.getUsername(),
                    u.getDisplayName(),
                    u.getRole(),
                    u.isEnabled());
        }
    }
}
