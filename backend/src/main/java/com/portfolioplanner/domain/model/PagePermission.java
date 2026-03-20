package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "page_permission",
       uniqueConstraints = @UniqueConstraint(name = "uq_page_permission", columnNames = {"role", "page_key"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PagePermission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Role name: READ_WRITE or READ_ONLY (ADMIN always has all access, never stored here). */
    @Column(nullable = false, length = 50)
    private String role;

    /** Page key: dashboard, resources, projects, pods, availability, overrides,
     *  reports, jira_pods, jira_releases, jira_capex, jira_actuals, simulators, settings */
    @Column(name = "page_key", nullable = false, length = 100)
    private String pageKey;

    @Column(nullable = false)
    private boolean allowed = true;
}
