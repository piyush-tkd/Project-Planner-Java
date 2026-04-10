package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "allocation_types")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AllocationType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(name = "max_percentage", nullable = false)
    private Integer maxPercentage = 100;

    @Column(columnDefinition = "TEXT")
    private String description;
}
