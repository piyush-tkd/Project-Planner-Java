package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Granular privilege row: one record per (role, section, page, [tab]) combination.
 * access_type is one of NONE | READ | WRITE (WRITE implies READ).
 */
@Entity
@Table(name = "role_privilege")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RolePrivilege {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String role;

    @Column(name = "section_key", nullable = false, length = 100)
    private String sectionKey;

    @Column(name = "page_key", nullable = false, length = 100)
    private String pageKey;

    /** Null means the privilege applies to the whole page, not a specific tab. */
    @Column(name = "tab_key", length = 100)
    private String tabKey;

    /** NONE | READ | WRITE */
    @Column(name = "access_type", nullable = false, length = 20)
    private String accessType = "READ";
}
