package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "jira_support_snapshot",
       uniqueConstraints = @UniqueConstraint(columnNames = {"board_id", "snapshot_date"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JiraSupportSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "board_id", nullable = false)
    private JiraSupportBoard board;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "open_count", nullable = false)
    private int openCount;

    @Column(name = "stale_count", nullable = false)
    private int staleCount;

    @Column(name = "avg_age_days", nullable = false, precision = 6, scale = 1)
    private BigDecimal avgAgeDays = BigDecimal.ZERO;
}
