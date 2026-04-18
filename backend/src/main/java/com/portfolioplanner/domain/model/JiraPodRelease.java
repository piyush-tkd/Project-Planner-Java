package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Maps a logical POD to a Jira fix version it wants to track.
 * A POD can track multiple release versions simultaneously.
 */
@Entity
@Table(name = "jira_pod_release",
        uniqueConstraints = @UniqueConstraint(name = "uq_jira_pod_release", columnNames = {"pod_id", "version_name"}))
@Getter
@Setter
@NoArgsConstructor
public class JiraPodRelease {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pod_id", nullable = false)
    private JiraPod pod;

    @Column(name = "version_name", nullable = false, length = 255)
    private String versionName;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public JiraPodRelease(JiraPod pod, String versionName) {
        this.pod = pod;
        this.versionName = versionName;
    }
}
