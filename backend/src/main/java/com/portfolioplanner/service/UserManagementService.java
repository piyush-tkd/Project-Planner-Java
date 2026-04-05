package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.AppUser;
import com.portfolioplanner.domain.model.PagePermission;
import com.portfolioplanner.domain.model.RolePrivilege;
import com.portfolioplanner.domain.repository.AppUserRepository;
import com.portfolioplanner.domain.repository.PagePermissionRepository;
import com.portfolioplanner.domain.repository.RolePrivilegeRepository;
import com.portfolioplanner.exception.ResourceNotFoundException;
import com.portfolioplanner.exception.ValidationException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserManagementService {

    private static final String ADMIN       = "ADMIN";
    private static final String SUPER_ADMIN = "SUPER_ADMIN";
    private static final Set<String> UNRESTRICTED_ROLES = Set.of(ADMIN, SUPER_ADMIN);

    private final AppUserRepository userRepo;
    private final PagePermissionRepository permRepo;
    private final RolePrivilegeRepository privilegeRepo;
    private final PasswordEncoder passwordEncoder;

    // ── User CRUD ──────────────────────────────────────────────────────────────

    public List<AppUser> listUsers() {
        return userRepo.findAll();
    }

    public AppUser getUser(Long id) {
        return userRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }

    @Transactional
    public AppUser createUser(CreateUserRequest req) {
        if (userRepo.findByUsername(req.username()).isPresent()) {
            throw new ValidationException("Username already exists: " + req.username());
        }
        var user = new AppUser();
        user.setUsername(req.username());
        user.setPassword(passwordEncoder.encode(req.password()));
        user.setRole(req.role().toUpperCase());
        user.setEnabled(true);
        user.setDisplayName(req.displayName());
        return userRepo.save(user);
    }

    @Transactional
    public AppUser updateUser(Long id, UpdateUserRequest req) {
        var user = getUser(id);

        if (req.displayName() != null) {
            user.setDisplayName(req.displayName());
        }
        if (req.role() != null) {
            user.setRole(req.role().toUpperCase());
        }
        if (req.enabled() != null) {
            user.setEnabled(req.enabled());
        }
        if (req.password() != null && !req.password().isBlank()) {
            user.setPassword(passwordEncoder.encode(req.password()));
        }

        return userRepo.save(user);
    }

    @Transactional
    public void deleteUser(Long id) {
        var user = getUser(id);
        // Prevent deleting the last privileged admin
        if (UNRESTRICTED_ROLES.contains(user.getRole())) {
            long adminCount = userRepo.findAll().stream()
                    .filter(u -> UNRESTRICTED_ROLES.contains(u.getRole()) && u.isEnabled())
                    .count();
            if (adminCount <= 1) {
                throw new ValidationException("Cannot delete the last admin/super-admin user.");
            }
        }
        userRepo.delete(user);
    }

    // ── Page permissions (legacy — coarse boolean, kept for backward compatibility) ──

    /**
     * Returns the page permissions for a role as a map of pageKey → allowed.
     * ADMIN/SUPER_ADMIN always gets null (all pages allowed — no restrictions).
     */
    public Map<String, Boolean> getPermissions(String role) {
        if (UNRESTRICTED_ROLES.contains(role.toUpperCase())) return null;
        return permRepo.findByRole(role.toUpperCase())
                .stream()
                .collect(Collectors.toMap(PagePermission::getPageKey, PagePermission::isAllowed));
    }

    /**
     * Returns the list of allowed page keys for a role.
     * ADMIN/SUPER_ADMIN always returns null (= unrestricted).
     */
    public List<String> getAllowedPages(String role) {
        if (UNRESTRICTED_ROLES.contains(role.toUpperCase())) return null;
        return permRepo.findByRoleAndAllowedTrue(role.toUpperCase())
                .stream()
                .map(PagePermission::getPageKey)
                .toList();
    }

    /**
     * Upserts a single page permission for the given role.
     * ADMIN/SUPER_ADMIN permissions cannot be modified.
     */
    @Transactional
    public void setPermission(String role, String pageKey, boolean allowed) {
        if (UNRESTRICTED_ROLES.contains(role.toUpperCase())) {
            throw new ValidationException("ADMIN/SUPER_ADMIN always has full access — permissions cannot be restricted.");
        }
        var existing = permRepo.findByRoleAndPageKey(role.toUpperCase(), pageKey);
        if (existing.isPresent()) {
            existing.get().setAllowed(allowed);
            permRepo.save(existing.get());
        } else {
            permRepo.save(new PagePermission(null, role.toUpperCase(), pageKey, allowed));
        }
    }

    /**
     * Bulk update of all permissions for a role.
     */
    @Transactional
    public void setPermissions(String role, Map<String, Boolean> permissions) {
        permissions.forEach((pageKey, allowed) -> setPermission(role, pageKey, allowed));
    }

    // ── Granular privileges (V75+) ────────────────────────────────────────────

    /**
     * Returns the full privilege list for a role.
     * ADMIN/SUPER_ADMIN always gets an empty list — the caller should treat absence as WRITE.
     */
    public List<RolePrivilege> getPrivileges(String role) {
        if (UNRESTRICTED_ROLES.contains(role.toUpperCase())) return List.of();
        return privilegeRepo.findByRole(role.toUpperCase());
    }

    /**
     * Upserts a single privilege row for the given role/section/page/tab.
     */
    @Transactional
    public RolePrivilege setPrivilege(String role, String sectionKey, String pageKey,
                                      String tabKey, String accessType) {
        if (UNRESTRICTED_ROLES.contains(role.toUpperCase())) {
            throw new ValidationException("ADMIN/SUPER_ADMIN always has full access — privileges cannot be restricted.");
        }
        var existing = privilegeRepo.findByRoleAndSectionKeyAndPageKeyAndTabKey(
                role.toUpperCase(), sectionKey, pageKey, tabKey);
        RolePrivilege priv = existing.orElseGet(RolePrivilege::new);
        priv.setRole(role.toUpperCase());
        priv.setSectionKey(sectionKey);
        priv.setPageKey(pageKey);
        priv.setTabKey(tabKey);
        priv.setAccessType(accessType.toUpperCase());
        return privilegeRepo.save(priv);
    }

    // ── Request records ────────────────────────────────────────────────────────

    public record CreateUserRequest(
            String username,
            String password,
            String role,
            String displayName) {}

    public record UpdateUserRequest(
            String displayName,
            String role,
            Boolean enabled,
            String password) {}
}
