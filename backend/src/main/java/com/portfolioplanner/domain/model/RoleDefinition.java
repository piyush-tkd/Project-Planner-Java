package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * A named role in the system.  Roles are referenced by name-string in
 * AppUser, PagePermission, and RolePrivilege — this entity adds CRUD
 * discoverability so admins can create and manage custom roles.
 *
 * System roles (is_system=true) cannot be deleted.
 */
@Entity
@Table(name = "role_definition")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoleDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Canonical name used everywhere as the FK-by-convention string: e.g. "READ_WRITE". */
    @Column(nullable = false, unique = true, length = 50)
    private String name;

    /** Human-friendly label shown in the UI: e.g. "Read / Write". */
    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(length = 255)
    private String description;

    /** System roles cannot be deleted via the API. */
    @Column(name = "is_system", nullable = false)
    private boolean system = false;

    /** Mantine color token used for badges: red, orange, blue, gray, teal, etc. */
    @Column(nullable = false, length = 20)
    private String color = "blue";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
