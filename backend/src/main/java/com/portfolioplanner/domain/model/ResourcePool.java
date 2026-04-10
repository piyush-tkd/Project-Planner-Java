package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "resource_pools")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResourcePool {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "role_type", nullable = false)
    private String roleType;

    @Column
    private String specialization;

    @Column(name = "target_headcount")
    private Integer targetHeadcount;

    @Column(columnDefinition = "TEXT")
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
