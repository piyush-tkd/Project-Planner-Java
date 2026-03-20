package com.portfolioplanner.domain.model;

import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Role;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "resource")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Resource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Location location;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "counts_in_capacity", nullable = false)
    private Boolean countsInCapacity = true;

    /** Individual hourly rate override — takes precedence over the role+location CostRate when set. */
    @Column(name = "actual_rate", precision = 10, scale = 2)
    private BigDecimal actualRate;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
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
