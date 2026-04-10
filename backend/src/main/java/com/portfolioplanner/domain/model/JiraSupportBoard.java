package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "jira_support_board")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JiraSupportBoard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Human-readable label shown in the UI (e.g. "Platform Support"). */
    @Column(nullable = false, length = 100)
    private String name;

    /**
     * Legacy numeric service-desk ID (from /rest/servicedeskapi/servicedesk).
     * Retained for backward-compatibility. Prefer {@link #projectKey} + {@link #queueId}
     * for new boards — these are more stable and visible in the Jira URL.
     */
    @Column(name = "board_id")
    private Long boardId;

    /**
     * Jira project key, e.g. "AC" or "LR".
     * Visible in the JSM URL: /jira/servicedesk/projects/{projectKey}/queues/...
     * When set this takes precedence over {@link #boardId} for issue lookup.
     */
    @Column(name = "project_key", length = 50)
    private String projectKey;

    /**
     * Optional JSM custom-queue ID, e.g. 1649.
     * Visible in the JSM URL: .../queues/custom/{queueId}
     * When set, the queue's own JQL is fetched from Jira and used to filter issues,
     * so the support queue mirrors exactly what the team sees in Jira.
     */
    @Column(name = "queue_id")
    private Long queueId;

    @Column(nullable = false)
    private boolean enabled = true;

    /**
     * Number of business days without activity before a ticket is considered stale.
     * Defaults to 3. Configurable per board so urgent queues can use a tighter threshold.
     */
    @Column(name = "stale_threshold_days", nullable = false)
    private int staleThresholdDays = 3;

    /**
     * Comma-separated list of Jira priority names that trigger inbox alerts for this board.
     * Defaults to "Blocker,Critical,Highest". Configurable per board so different support
     * queues can have different alert sensitivity.
     * Example: "Blocker,Critical" or "Blocker,Critical,Highest,High"
     */
    @Column(name = "alert_priorities", length = 500)
    private String alertPriorities = "Blocker,Critical,Highest";
}
