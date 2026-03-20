package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_tour_state")
@Data
@NoArgsConstructor
public class UserTourState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String username;

    @Column(name = "seen_count", nullable = false)
    private Integer seenCount = 0;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;
}
