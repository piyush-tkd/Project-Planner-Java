package com.portfolioplanner.domain.model;

import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Role;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Hourly cost rate per role per location.
 * Imported from the "Cost Rates" sheet.
 * Used for project cost estimation: estimatedCost = demandHours × rate.
 */
@Entity
@Table(name = "cost_rate",
       uniqueConstraints = @UniqueConstraint(columnNames = {"role", "location"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CostRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Location location;

    /** Hourly rate in USD */
    @Column(name = "hourly_rate", nullable = false, precision = 10, scale = 2)
    private BigDecimal hourlyRate;
}
