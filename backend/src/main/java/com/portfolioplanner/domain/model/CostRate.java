package com.portfolioplanner.domain.model;

import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Role;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

/**
 * Hourly cost rate for a given Role × Location combination.
 * Table: cost_rate (V5).
 */
@Entity
@Table(name = "cost_rate")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
public class CostRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private Location location;

    @Column(name = "hourly_rate", nullable = false, precision = 10, scale = 2)
    private BigDecimal hourlyRate;
}
