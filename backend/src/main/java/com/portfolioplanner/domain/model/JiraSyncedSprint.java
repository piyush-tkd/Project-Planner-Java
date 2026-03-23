package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "jira_sprint")
@Getter @Setter @NoArgsConstructor
public class JiraSyncedSprint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sprint_jira_id", nullable = false, unique = true)
    private Long sprintJiraId;

    @Column(name = "board_id")
    private Long boardId;

    @Column(nullable = false)
    private String name;

    private String state;

    @Column(name = "start_date")
    private LocalDateTime startDate;

    @Column(name = "end_date")
    private LocalDateTime endDate;

    @Column(name = "complete_date")
    private LocalDateTime completeDate;

    @Column(columnDefinition = "TEXT")
    private String goal;

    @Column(name = "project_key")
    private String projectKey;

    @Column(name = "synced_at", nullable = false)
    private LocalDateTime syncedAt;

    @PrePersist
    protected void onCreate() {
        if (syncedAt == null) syncedAt = LocalDateTime.now();
    }
}
