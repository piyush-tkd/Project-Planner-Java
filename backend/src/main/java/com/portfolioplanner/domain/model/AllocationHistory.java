package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "allocation_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AllocationHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "allocation_id", nullable = false)
    private Long allocationId;

    @Column(name = "resource_id", nullable = false)
    private Long resourceId;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    @Column(nullable = false, length = 10)
    private String action;  // CREATE, UPDATE, DELETE

    @Column(name = "changed_by")
    private Long changedBy;

    @Column(name = "changed_at", nullable = false)
    private LocalDateTime changedAt;

    @Column(name = "old_percentage")
    private Integer oldPercentage;

    @Column(name = "new_percentage")
    private Integer newPercentage;

    @Column(name = "old_end_date")
    private LocalDate oldEndDate;

    @Column(name = "new_end_date")
    private LocalDate newEndDate;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
