package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "resource_skill")
@Data
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

    @Column(name = "years_experience")
    private BigDecimal yearsExperience;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
