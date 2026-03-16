package com.portfolioplanner.domain.model;

import com.portfolioplanner.domain.model.enums.Role;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "role_effort_mix")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoleEffortMix {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, unique = true)
    private Role role;

    @Column(name = "mix_pct", precision = 5, scale = 2, nullable = false)
    private BigDecimal mixPct;
}
