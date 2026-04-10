package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "demand_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DemandRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id")
    private Long projectId;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "role_type", nullable = false)
    private String roleType;

    @Column(name = "seniority_level")
    private String seniorityLevel;

    @Min(1)
    @Column(name = "headcount_needed", nullable = false)
    private Integer headcountNeeded;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(nullable = false)
    private String priority = "Medium";   // Critical, High, Medium, Low

    @Column(nullable = false)
    private String status = "Open";       // Open, Partially Filled, Filled, Cancelled

    @Column(columnDefinition = "TEXT")
    private String justification;

    @Column(name = "created_by")
    private Long createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
