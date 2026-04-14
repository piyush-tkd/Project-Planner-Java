package com.portfolioplanner.ai.data;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

/**
 * Read-only JDBC repository — queries the main app's public schema.
 * Table/column names confirmed from JPA entity annotations.
 *
 * Verified mappings:
 *   project          → @Table(name="project")
 *   risk_item        → @Table(name="risk_item"),  has project_id
 *   jira_issue       → @Table(name="jira_issue"), linked via project.jira_epic_key
 *   resource         → @Table(name="resource")
 *   resource_allocations → no direct project_id, so team chunk is resource-level
 */
@Repository
@RequiredArgsConstructor
@Slf4j
public class ProjectDataRepository {

    private final JdbcTemplate jdbc;

    // ── Projects ─────────────────────────────────────────────────────────────

    public List<Map<String, Object>> findAllProjects() {
        return jdbc.queryForList("""
                SELECT id, name, status, owner, notes AS description,
                       start_date, e2e_end_date AS end_date,
                       estimated_budget, actual_cost,
                       source_type, jira_status_category,
                       updated_at
                FROM   project
                ORDER  BY id
                """);
    }

    public Map<String, Object> findProjectById(Long id) {
        var rows = jdbc.queryForList("""
                SELECT id, name, status, owner, notes AS description,
                       start_date, e2e_end_date AS end_date,
                       estimated_budget, actual_cost,
                       source_type, jira_status_category,
                       jira_epic_key, updated_at
                FROM   project
                WHERE  id = ?
                """, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    // ── Risks per project ────────────────────────────────────────────────────

    public List<Map<String, Object>> findRisksByProject(Long projectId) {
        return jdbc.queryForList("""
                SELECT id, title, description, severity,
                       probability, status, mitigation_plan, owner
                FROM   risk_item
                WHERE  project_id = ?
                ORDER  BY
                  CASE severity
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'HIGH'     THEN 2
                    WHEN 'MEDIUM'   THEN 3
                    ELSE 4
                  END
                """, projectId);
    }

    // ── Jira issues linked to project (via jira_epic_key) ───────────────────

    public List<Map<String, Object>> findIssuesByProject(Long projectId) {
        // Find the project's jira_epic_key first, then get matching issues
        var rows = jdbc.queryForList(
                "SELECT jira_epic_key FROM project WHERE id = ? AND jira_epic_key IS NOT NULL",
                projectId);
        if (rows.isEmpty() || rows.get(0).get("jira_epic_key") == null) {
            return List.of();
        }
        String epicKey = rows.get(0).get("jira_epic_key").toString();
        // epic_key in jira_issue is stored as parent key or project_key prefix
        String projectKey = epicKey.contains("-") ? epicKey.split("-")[0] : epicKey;

        return jdbc.queryForList("""
                SELECT id, issue_key, summary, issue_type,
                       status_name, status_category, priority_name,
                       assignee_display_name, story_points
                FROM   jira_issue
                WHERE  project_key = ?
                  AND  is_subtask = false
                ORDER  BY priority_name, id
                LIMIT  40
                """, projectKey);
    }

    // ── Resources allocated to a team (project-level proxy via sprint) ───────

    public List<Map<String, Object>> findResourcesForProject(Long projectId) {
        // resource_allocations has no direct project_id.
        // Use project_sprint_allocation to find teams/sprints, then resources.
        return jdbc.queryForList("""
                SELECT DISTINCT r.name, r.role, r.email
                FROM   project_sprint_allocation psa
                JOIN   resource_allocations ra ON ra.team_id = psa.team_id
                JOIN   resource r ON r.id = ra.resource_id
                WHERE  psa.project_id = ?
                  AND  r.active = true
                ORDER  BY r.name
                LIMIT  20
                """, projectId);
    }

    // ── All project IDs (for full re-index) ─────────────────────────────────

    public List<Long> findAllProjectIds() {
        return jdbc.queryForList(
                "SELECT id FROM project ORDER BY id", Long.class);
    }

    // ── Projects updated since a timestamp (incremental sync) ───────────────

    public List<Long> findProjectsUpdatedSince(java.time.Instant since) {
        return jdbc.queryForList(
                "SELECT id FROM project WHERE updated_at > ? ORDER BY id",
                Long.class, java.sql.Timestamp.from(since));
    }
}
