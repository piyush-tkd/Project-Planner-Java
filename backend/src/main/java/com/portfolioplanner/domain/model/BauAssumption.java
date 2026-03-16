package com.portfolioplanner.domain.model;

import com.portfolioplanner.domain.model.enums.Role;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "bau_assumption",
        uniqueConstraints = @UniqueConstraint(columnNames = {"pod_id", "role"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BauAssumption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pod_id", nullable = false)
    private Pod pod;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(name = "bau_pct", precision = 5, scale = 2, nullable = false)
    private BigDecimal bauPct;
}
