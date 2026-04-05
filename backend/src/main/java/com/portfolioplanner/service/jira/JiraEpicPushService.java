package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.enums.SourceType;
import com.portfolioplanner.domain.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Pushes a Portfolio Planner MANUAL project to Jira as a new Epic.
 *
 * <p>After a successful push:
 * <ul>
 *   <li>{@code source_type} is updated to {@code PUSHED_TO_JIRA}</li>
 *   <li>{@code jira_epic_key} is set to the newly created Jira issue key</li>
 *   <li>{@code jira_last_synced_at} is set to now</li>
 *   <li>{@code jira_sync_error} is cleared</li>
 * </ul>
 *
 * <p>Only MANUAL projects may be pushed.  JIRA_SYNCED projects are already
 * linked; PUSHED_TO_JIRA projects have already been pushed — repeat calls are
 * rejected with an {@link IllegalStateException}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class JiraEpicPushService {

    private final JiraClient        jiraClient;
    private final ProjectRepository projectRepository;

    /**
     * Result returned to the controller after a push.
     *
     * @param epicKey  the Jira issue key that was created (e.g. "PMO-124")
     * @param projectId the PP project that was updated
     */
    public record PushResult(String epicKey, Long projectId) {}

    /**
     * Pushes a MANUAL project to Jira as an Epic, then updates the PP project record.
     *
     * @param projectId  the PP project to push
     * @param jiraProjectKey the Jira project key to create the epic under (e.g. "PMO")
     * @return the created epic key + updated project ID
     * @throws IllegalArgumentException if the project does not exist
     * @throws IllegalStateException    if the project is not MANUAL (already linked/pushed)
     */
    @Transactional
    public PushResult pushToJira(Long projectId, String jiraProjectKey) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));

        if (project.getSourceType() != SourceType.MANUAL) {
            throw new IllegalStateException(
                    "Project " + projectId + " has source_type=" + project.getSourceType()
                    + ". Only MANUAL projects can be pushed to Jira.");
        }

        log.info("JiraEpicPushService: pushing project {} ('{}') to Jira project {}",
                projectId, project.getName(), jiraProjectKey);

        String epicKey;
        try {
            epicKey = jiraClient.createEpic(jiraProjectKey, project.getName(), project.getNotes());
        } catch (Exception e) {
            project.setJiraSyncError(true);
            projectRepository.save(project);
            log.error("JiraEpicPushService: push failed for project {} — {}", projectId, e.getMessage(), e);
            throw new RuntimeException("Jira push failed: " + e.getMessage(), e);
        }

        project.setSourceType(SourceType.PUSHED_TO_JIRA);
        project.setJiraEpicKey(epicKey);
        project.setJiraLastSyncedAt(OffsetDateTime.now());
        project.setJiraSyncError(false);
        projectRepository.save(project);

        log.info("JiraEpicPushService: project {} pushed successfully → epic {}", projectId, epicKey);
        return new PushResult(epicKey, projectId);
    }
}
