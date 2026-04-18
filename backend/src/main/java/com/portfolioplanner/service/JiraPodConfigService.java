package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import com.portfolioplanner.service.jira.JiraClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class JiraPodConfigService {

    private final JiraPodRepository podRepo;
    private final JiraClient jiraClient;
    private final JdbcTemplate jdbc;

    @Transactional
    public void saveConfig(List<PodConfigRequest> requests) {
        // Capture project keys BEFORE saving
        Set<String> oldKeys = podRepo.findAll().stream()
            .flatMap(p -> p.getBoards().stream())
            .map(b -> b.getJiraProjectKey().toUpperCase())
            .collect(Collectors.toSet());

        Set<String> newKeys = requests.stream()
            .filter(r -> r.boardKeys() != null)
            .flatMap(r -> r.boardKeys().stream())
            .filter(k -> k != null && !k.isBlank())
            .map(k -> k.trim().toUpperCase())
            .collect(Collectors.toSet());

        Set<String> removedKeys = oldKeys.stream()
            .filter(k -> !newKeys.contains(k))
            .collect(Collectors.toSet());

        // Delete all existing PODs
        podRepo.deleteAll();
        podRepo.flush();

        // Full cascade cleanup for removed project keys
        if (!removedKeys.isEmpty()) {
            log.info("POD config change: full data cleanup for removed project keys: {}", removedKeys);
            for (String key : removedKeys) {
                try {
                    jdbc.update("DELETE FROM jira_issue_transition WHERE issue_key IN (SELECT issue_key FROM jira_issue WHERE project_key = ?)", key);
                    jdbc.update("DELETE FROM jira_issue_worklog    WHERE issue_key IN (SELECT issue_key FROM jira_issue WHERE project_key = ?)", key);
                    jdbc.update("DELETE FROM jira_issue_comment    WHERE issue_key IN (SELECT issue_key FROM jira_issue WHERE project_key = ?)", key);
                    jdbc.update("DELETE FROM jira_issue_custom_field WHERE issue_key IN (SELECT issue_key FROM jira_issue WHERE project_key = ?)", key);
                    jdbc.update("DELETE FROM jira_issue_fix_version  WHERE issue_key IN (SELECT issue_key FROM jira_issue WHERE project_key = ?)", key);
                    jdbc.update("DELETE FROM jira_sprint_issue WHERE sprint_jira_id IN (SELECT sprint_jira_id FROM jira_sprint WHERE project_key = ?)", key);

                    int issues  = jdbc.update("DELETE FROM jira_issue WHERE project_key = ?", key);
                    int sprints = jdbc.update("DELETE FROM jira_sprint WHERE project_key = ?", key);

                    jdbc.update("DELETE FROM jira_sync_status WHERE project_key = ?", key);

                    log.info("  Removed project key '{}': deleted {} issues, {} sprints", key, issues, sprints);
                } catch (Exception e) {
                    log.warn("  Cleanup failed for project key '{}': {}", key, e.getMessage());
                }
            }
        }

        for (int i = 0; i < requests.size(); i++) {
            PodConfigRequest req = requests.get(i);
            JiraPod pod = new JiraPod();
            pod.setPodDisplayName(req.podDisplayName() != null && !req.podDisplayName().isBlank()
                    ? req.podDisplayName() : "POD " + (i + 1));
            pod.setEnabled(Boolean.TRUE.equals(req.enabled()));
            pod.setSortOrder(i);

            if (req.boards() != null && !req.boards().isEmpty()) {
                for (BoardEntry entry : req.boards()) {
                    if (entry.projectKey() != null && !entry.projectKey().isBlank()) {
                        JiraPodBoard board = new JiraPodBoard(pod, entry.projectKey().trim().toUpperCase());
                        board.setSprintBoardId(entry.sprintBoardId());
                        pod.getBoards().add(board);
                    }
                }
            } else if (req.boardKeys() != null) {
                for (String key : req.boardKeys()) {
                    if (key != null && !key.isBlank()) {
                        pod.getBoards().add(new JiraPodBoard(pod, key.trim().toUpperCase()));
                    }
                }
            }
            podRepo.save(pod);
        }

        jiraClient.evictAllCaches();
    }

    @Transactional
    public void patchPod(Long id, Boolean enabled, String podDisplayName) {
        podRepo.findById(id).ifPresent(pod -> {
            if (enabled != null) pod.setEnabled(enabled);
            if (podDisplayName != null) pod.setPodDisplayName(podDisplayName);
            podRepo.save(pod);
        });
    }

    public List<JiraPod> getEnabledPods() {
        return podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
    }

    public List<JiraPod> getAllPodsSorted() {
        return podRepo.findAllByOrderBySortOrderAscPodDisplayNameAsc();
    }

    public Optional<JiraPod> getPodById(Long id) {
        return podRepo.findById(id);
    }

    public record PodConfigRequest(
            String podDisplayName,
            Boolean enabled,
            List<String> boardKeys,
            List<BoardEntry> boards) {}

    public record BoardEntry(String projectKey, Long sprintBoardId) {}
}
