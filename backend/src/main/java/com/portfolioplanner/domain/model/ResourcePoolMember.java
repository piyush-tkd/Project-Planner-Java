package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "resource_pool_members",
       uniqueConstraints = @UniqueConstraint(columnNames = {"pool_id","resource_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResourcePoolMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pool_id", nullable = false)
    private Long poolId;

    @Column(name = "resource_id", nullable = false)
    private Long resourceId;

    @Column(name = "seniority_level")
    private String seniorityLevel;

    @Column(name = "available_from")
    private LocalDate availableFrom;

    @Column(name = "is_available", nullable = false)
    private Boolean isAvailable = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resource_id", insertable = false, updatable = false)
    private Resource resource;
}
