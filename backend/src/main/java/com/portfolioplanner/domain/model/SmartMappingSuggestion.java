package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * A candidate pairing produced by the SmartMapping engine that indicates
 * a Portfolio-Planner (PP) project may be the same work item as a Jira epic.
 *
 * <p>Resolution states:
 * <ul>
 *   <li>{@code PENDING}  — awaiting admin review</li>
 *   <li>{@code LINKED}   — admin confirmed they are the same; pp_project now has the jiraEpicKey</li>
 *   <li>{@code IGNORED}  — admin dismissed the suggestion</li>
 * </ul>
 */
@Entity
@Table(
    name = "smart_mapping_suggestion",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_sms_project_epic",
        columnNames = {"pp_project_id", "jira_epic_key"}
    )
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SmartMappingSuggestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pp_project_id", nullable = false)
    private Project ppProject;

    @Column(name = "jira_epic_key", nullable = false, length = 50)
    private String jiraEpicKey;

    /** Composite score 0–100. */
    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal score;

    @Column(name = "name_score",     nullable = false, precision = 5, scale = 2)
    private BigDecimal nameScore     = BigDecimal.ZERO;

    @Column(name = "owner_score",    nullable = false, precision = 5, scale = 2)
    private BigDecimal ownerScore    = BigDecimal.ZERO;

    @Column(name = "date_score",     nullable = false, precision = 5, scale = 2)
    private BigDecimal dateScore     = BigDecimal.ZERO;

    @Column(name = "status_score",   nullable = false, precision = 5, scale = 2)
    private BigDecimal statusScore   = BigDecimal.ZERO;

    @Column(name = "epic_key_bonus", nullable = false, precision = 5, scale = 2)
    private BigDecimal epicKeyBonus  = BigDecimal.ZERO;

    @Column(nullable = false, length = 20)
    private String resolution = "PENDING";

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
