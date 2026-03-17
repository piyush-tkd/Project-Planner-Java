package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

/**
 * A Jira project board that belongs to a logical POD.
 * A board can only belong to one POD (enforced by UNIQUE constraint on jira_project_key).
 */
@Entity
@Table(name = "jira_pod_board",
        uniqueConstraints = @UniqueConstraint(name = "uq_jira_pod_board_key", columnNames = "jira_project_key"))
@Getter
@Setter
@NoArgsConstructor
public class JiraPodBoard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pod_id", nullable = false)
    private JiraPod pod;

    @Column(name = "jira_project_key", nullable = false, length = 64)
    private String jiraProjectKey;

    public JiraPodBoard(JiraPod pod, String jiraProjectKey) {
        this.pod = pod;
        this.jiraProjectKey = jiraProjectKey;
    }
}
