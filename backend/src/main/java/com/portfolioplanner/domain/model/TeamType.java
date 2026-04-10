package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "team_types")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeamType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_permanent", nullable = false)
    private Boolean isPermanent = true;
}
