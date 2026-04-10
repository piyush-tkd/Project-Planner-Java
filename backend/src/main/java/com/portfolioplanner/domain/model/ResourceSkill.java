package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Skill tag for a resource with proficiency level.
 * Table: resource_skill (V91).
 */
@Entity
@Table(name = "resource_skill",
       uniqueConstraints = @UniqueConstraint(columnNames = {"resource_id", "skill_name"}))
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
public class ResourceSkill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "resource_id", nullable = false)
    private Long resourceId;

    @Column(name = "skill_name", nullable = false, length = 100)
    private String skillName;

    /** 1=Beginner, 2=Intermediate, 3=Advanced, 4=Expert */
    @Column(nullable = false)
    private Short proficiency = 2;

    @Column(name = "years_experience", precision = 4, scale = 1)
    private BigDecimal yearsExperience;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { createdAt = LocalDateTime.now(); }
}
