package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "tour_config")
@Data
@NoArgsConstructor
public class TourConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Boolean enabled = true;

    /** first_login | every_login | every_n | disabled */
    @Column(nullable = false, length = 20)
    private String frequency = "first_login";

    /** Days between re-showing, used when frequency = 'every_n' */
    @Column(name = "every_n", nullable = false)
    private Integer everyN = 30;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
