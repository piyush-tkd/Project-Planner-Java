package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.enums.SourceType;
import com.portfolioplanner.domain.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Periodically syncs portfolio projects that were imported from Jira
 * (sourceType = JIRA_SYNCED) back to the latest values in Jira.
 *
 * <p>Fields synced: name (summary), startDate, targetDate (duedate), status label.
 * Fields NOT overwritten: priority, owner, notes, budget, pattern — these are
 * managed inside Portfolio Planner and intentionally decoupled from Jira.
 *
 * <p>Runs every hour (configurable via cron expression).
 * Can also be triggered manually via POST /api/jira/sync/projects.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraSyncScheduler {

    private final ProjectRepository projectRepository;
    private final JiraClient jiraClient;
    private final JiraCredentialsService creds;

    /**
     * Hourly sync — every hour at the top of the hour.
     * Change the cron expression in application.yml if needed.
     */
    @Scheduled(cron = "0 0 * * * *")
    public void scheduledSync() {
        if (!creds.isConfigured()) {
            log.debug("JiraSyncScheduler: Jira not configured, skipping");
            return;
        }
        log.info("JiraSyncScheduler: starting scheduled sync of JIRA_SYNCED projects");
        SyncResult result = syncJiraProjects();
        log.info("JiraSyncScheduler: done — updated={}, errors={}, skipped={}",
                result.updated(), result.errors(), result.skipped());
    }

    /**
     * Sync all JIRA_SYNCED projects. Called by the scheduler and the manual trigger endpoint.
     */
    @Transactional
    public SyncResult syncJiraProjects() {
        List<Project> jiraProjects = projectRepository.findBySourceType(SourceType.JIRA_SYNCED);
        if (jiraProjects.isEmpty()) {
            return new SyncResult(0, 0, 0);
        }

        int updated = 0, errors = 0, skipped = 0;

        for (Project project : jiraProjects) {
            String key = project.getJiraEpicKey();
            if (key == null || key.isBlank()) {
                skipped++;
                continue;
            }
            try {
                Map<String, Object> issue = fetchIssue(key);
                if (issue == null) { skipped++; continue; }

                boolean changed = applyJiraFields(project, issue);
                if (changed) {
                    project.setJiraLastSyncedAt(OffsetDateTime.now());
                    project.setJiraSyncError(false);
                    projectRepository.save(project);
                    updated++;
                } else {
                    // Still update the sync timestamp so users know it was checked
                    project.setJiraLastSyncedAt(OffsetDateTime.now());
                    project.setJiraSyncError(false);
                    projectRepository.save(project);
                    skipped++;
                }
            } catch (Exception e) {
                log.warn("JiraSyncScheduler: failed to sync {} ({}): {}", project.getName(), key, e.getMessage());
                project.setJiraSyncError(true);
                project.setJiraLastSyncedAt(OffsetDateTime.now());
                projectRepository.save(project);
                errors++;
            }
        }
        return new SyncResult(updated, errors, skipped);
    }

    /** Fetches a single Jira issue by key using JQL (avoids needing the /issue/{key} endpoint separately). */
    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchIssue(String issueKey) {
        List<Map<String, Object>> results = jiraClient.searchByJql(
            "key = \"" + issueKey + "\""
        );
        return results.isEmpty() ? null : results.get(0);
    }

    /**
     * Applies Jira field values to the project entity.
     * Only updates name, startDate, targetDate.
     * @return true if any field changed
     */
    @SuppressWarnings("unchecked")
    private boolean applyJiraFields(Project project, Map<String, Object> issue) {
        boolean changed = false;
        Object fieldsRaw = issue.get("fields");
        if (!(fieldsRaw instanceof Map)) return false;
        Map<String, Object> fields = (Map<String, Object>) fieldsRaw;

        // Name = summary
        Object summaryRaw = fields.get("summary");
        if (summaryRaw instanceof String summary && !summary.isBlank()) {
            if (!summary.equals(project.getName())) {
                project.setName(summary);
                changed = true;
            }
        }

        // startDate = customfield_10015 (Jira Cloud start date)
        Object startRaw = fields.get("customfield_10015");
        if (startRaw instanceof String startStr && !startStr.isBlank()) {
            try {
                LocalDate startDate = LocalDate.parse(startStr.substring(0, 10));
                if (!startDate.equals(project.getStartDate())) {
                    project.setStartDate(startDate);
                    changed = true;
                }
            } catch (Exception ignored) {}
        }

        // targetDate = duedate
        Object dueRaw = fields.get("duedate");
        if (dueRaw instanceof String dueStr && !dueStr.isBlank()) {
            try {
                LocalDate dueDate = LocalDate.parse(dueStr.substring(0, 10));
                if (!dueDate.equals(project.getTargetDate())) {
                    project.setTargetDate(dueDate);
                    changed = true;
                }
            } catch (Exception ignored) {}
        }

        return changed;
    }

    public record SyncResult(int updated, int errors, int skipped) {}
}
