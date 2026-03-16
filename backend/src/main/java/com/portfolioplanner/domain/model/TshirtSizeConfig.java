package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tshirt_size_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TshirtSizeConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 10)
    private String name;

    @Column(name = "base_hours", nullable = false)
    private Integer baseHours;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;
}
