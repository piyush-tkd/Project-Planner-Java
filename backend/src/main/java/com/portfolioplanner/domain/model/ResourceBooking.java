package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "resource_booking")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResourceBooking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resource_id", nullable = false)
    private Resource resource;

    /** Optional hard link to a project record */
    @Column(name = "project_id")
    private Long projectId;

    /** Display label — can differ from the linked project name, or used when no projectId */
    @Column(name = "project_label")
    private String projectLabel;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    /** Percentage allocation 1–100 */
    @Column(name = "allocation_pct", nullable = false)
    private Integer allocationPct = 100;

    /** PROJECT | TRAINING | LEAVE | OTHER */
    @Column(name = "booking_type", nullable = false, length = 30)
    private String bookingType = "PROJECT";

    @Column(columnDefinition = "TEXT")
    private String notes;

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
