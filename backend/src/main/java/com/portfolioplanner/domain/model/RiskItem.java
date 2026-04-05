package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "risk_item")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RiskItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** RISK | ISSUE | DECISION */
    @Column(name = "item_type", nullable = false, length = 20)
    private String itemType = "RISK";

    /** CRITICAL | HIGH | MEDIUM | LOW */
    @Column(nullable = false, length = 20)
    private String severity = "MEDIUM";

    /** HIGH | MEDIUM | LOW (relevant for RISK type) */
    @Column(length = 20)
    private String probability = "MEDIUM";

    /** OPEN | IN_PROGRESS | MITIGATED | CLOSED */
    @Column(nullable = false, length = 30)
    private String status = "OPEN";

    @Column(length = 120)
    private String owner;

    /** Optional: link to a specific project */
    @Column(name = "project_id")
    private Long projectId;

    @Column(name = "mitigation_plan", columnDefinition = "TEXT")
    private String mitigationPlan;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
