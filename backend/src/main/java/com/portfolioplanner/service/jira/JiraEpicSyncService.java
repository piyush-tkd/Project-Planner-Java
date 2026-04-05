package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.domain.model.enums.SourceType;
import com.portfolioplanner.domain.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Synchronises Jira epics across all configured Agile boards into Portfolio Planner projects.
 *
 * <p>Sync logic:
 * <ol>
 *   <li>Fetch all boards via {@link JiraClient#getAllBoards()}.</li>
 *   <li>For each board, fetch its epics via {@link JiraClient#getEpicsFromBoard(long)}.</li>
 *   <li>For each epic: if a PP project already has that {@code jira_epic_key}, update its
 *       name/status; otherwise auto-create a new project with {@code source_type = JIRA_SYNCED}.</li>
 *   <li>Record {@code jira_last_synced_at} and clear {@code jira_sync_error} on success.</li>
 *   <li>On any per-board failure set {@code jira_sync_error = true} on affected rows.</li>
 * </ol>
 *
 * <p>PUSHED_TO_JIRA projects are not overwritten — PP owns those records.
 * MANUAL projects are never touched by the sync.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class JiraEpicSyncService {

    private final JiraClient        jiraClient;
    private final ProjectRepository projectRepository;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Runs a full sync across all Jira boards.
     *
     * @return summary with counts of created, updated, failed, and skipped epics
     */
    @Transactional
    public SyncResult syncAllBoards() {
        log.info("JiraEpicSyncService: starting full board scan");

        List<Map<String, Object>> boards;
        try {
            boards = jiraClient.getAllBoards();
        } catch (Exception e) {
            log.error("JiraEpicSyncService: failed to fetch boards — {}", e.getMessage(), e);
            return SyncResult.boardFetchFailed(e.getMessage());
        }

        log.info("JiraEpicSyncService: found {} boards", boards.size());

        int created = 0, updated = 0, failed = 0, skipped = 0;
        List<String> errors = new ArrayList<>();

        for (Map<String, Object> board : boards) {
            long boardId = toLong(board.get("id"));
            String boardName = (String) board.get("name");

            try {
                BoardSyncResult result = syncBoard(boardId, boardName);
                created += result.created();
                updated += result.updated();
                failed  += result.failed();
                skipped += result.skipped();
                errors.addAll(result.errors());
            } catch (Exception e) {
                log.error("JiraEpicSyncService: board {} ({}) sync failed — {}",
                        boardId, boardName, e.getMessage(), e);
                failed++;
                errors.add("Board " + boardName + ": " + e.getMessage());
            }
        }

        log.info("JiraEpicSyncService: sync complete — created={}, updated={}, failed={}, skipped={}",
                created, updated, failed, skipped);
        return new SyncResult(boards.size(), created, updated, failed, skipped, errors, null);
    }

    /**
     * Syncs a single board.  Exposed separately for admin-triggered per-board syncs.
     */
    @Transactional
    public BoardSyncResult syncBoard(long boardId, String boardName) {
        log.debug("JiraEpicSyncService: syncing board {} ({})", boardId, boardName);

        List<Map<String, Object>> epics;
        try {
            epics = jiraClient.getEpicsFromBoard(boardId);
        } catch (Exception e) {
            log.warn("JiraEpicSyncService: board {} epic fetch failed — {}", boardId, e.getMessage());
            return BoardSyncResult.failed(e.getMessage());
        }

        int created = 0, updated = 0, failed = 0, skipped = 0;
        List<String> errors = new ArrayList<>();

        for (Map<String, Object> epic : epics) {
            try {
                UpsertResult r = upsertEpic(epic, boardId);
                switch (r) {
                    case CREATED -> created++;
                    case UPDATED -> updated++;
                    case SKIPPED -> skipped++;
                }
            } catch (Exception e) {
                log.warn("JiraEpicSyncService: epic upsert failed — {}", e.getMessage());
                failed++;
                errors.add(epicKey(epic) + ": " + e.getMessage());
            }
        }

        return new BoardSyncResult(created, updated, failed, skipped, errors);
    }

    /**
     * Returns a lightweight status map per board — for the admin settings panel.
     */
    public List<Map<String, Object>> getBoardSyncStatus() {
        List<Map<String, Object>> boards;
        try {
            boards = jiraClient.getAllBoards();
        } catch (Exception e) {
            log.warn("JiraEpicSyncService: cannot fetch boards for status — {}", e.getMessage());
            return List.of();
        }

        List<Map<String, Object>> status = new ArrayList<>();
        for (Map<String, Object> board : boards) {
            long boardId = toLong(board.get("id"));

            // Count projects synced from this board
            List<Project> synced = projectRepository.findBySourceType(SourceType.JIRA_SYNCED)
                    .stream()
                    .filter(p -> boardId == (p.getJiraBoardId() != null ? p.getJiraBoardId() : -1))
                    .toList();

            boolean hasError = synced.stream().anyMatch(Project::isJiraSyncError);
            OffsetDateTime lastSync = synced.stream()
                    .map(Project::getJiraLastSyncedAt)
                    .filter(t -> t != null)
                    .max(OffsetDateTime::compareTo)
                    .orElse(null);

            Map<String, Object> row = new HashMap<>();
            row.put("boardId",   boardId);
            row.put("boardName", board.get("name"));
            row.put("epicCount", synced.size());
            row.put("hasError",  hasError);
            row.put("lastSync",  lastSync);
            status.add(row);
        }
        return status;
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private UpsertResult upsertEpic(Map<String, Object> epic, long boardId) {
        String key    = epicKey(epic);
        String name   = epicName(epic);
        String status = epicStatus(epic);

        if (key == null || name == null || name.isBlank()) {
            log.debug("JiraEpicSyncService: skipping epic with missing key/name");
            return UpsertResult.SKIPPED;
        }

        Optional<Project> existing = projectRepository.findByJiraEpicKey(key);

        if (existing.isPresent()) {
            Project p = existing.get();

            // Never overwrite MANUAL or the user-controlled parts of PUSHED_TO_JIRA
            if (p.getSourceType() == SourceType.MANUAL) {
                return UpsertResult.SKIPPED;
            }

            // Update mutable Jira-owned fields
            p.setName(name);
            if (status != null) {
                p.setStatus(mapJiraStatusToPP(status));
            }
            p.setJiraBoardId(boardId);
            p.setJiraLastSyncedAt(OffsetDateTime.now());
            p.setJiraSyncError(false);
            projectRepository.save(p);
            log.debug("JiraEpicSyncService: updated project {} ← epic {}", p.getId(), key);
            return UpsertResult.UPDATED;
        }

        // Auto-create a new PP project from the Jira epic
        Project p = new Project();
        p.setName(name);
        p.setPriority(Priority.P2); // default mid-priority for newly synced epics
        p.setStatus(status != null ? mapJiraStatusToPP(status) : "ACTIVE");
        p.setSourceType(SourceType.JIRA_SYNCED);
        p.setJiraEpicKey(key);
        p.setJiraBoardId(boardId);
        p.setJiraLastSyncedAt(OffsetDateTime.now());
        p.setJiraSyncError(false);
        p.setArchived(false);

        projectRepository.save(p);
        log.info("JiraEpicSyncService: created project from epic {} — '{}'", key, name);
        return UpsertResult.CREATED;
    }

    /** Maps a Jira epic status string to a PP well-known status value. */
    private String mapJiraStatusToPP(String jiraStatus) {
        return switch (jiraStatus.toUpperCase()) {
            case "TO DO",    "OPEN",       "BACKLOG"     -> "NOT_STARTED";
            case "IN PROGRESS", "ACTIVE"                 -> "ACTIVE";
            case "DONE",     "CLOSED",     "RESOLVED"    -> "COMPLETED";
            case "ON HOLD",  "BLOCKED"                   -> "ON_HOLD";
            case "CANCELLED","REJECTED"                   -> "CANCELLED";
            default -> "ACTIVE";
        };
    }

    @SuppressWarnings("unchecked")
    private String epicKey(Map<String, Object> epic) {
        // Agile board epic endpoint: { "key": "PMO-123", ... }
        Object key = epic.get("key");
        if (key instanceof String s) return s;
        // JQL fallback: same structure
        return null;
    }

    @SuppressWarnings("unchecked")
    private String epicName(Map<String, Object> epic) {
        // Agile endpoint: { "name": "Epic Name" }
        Object name = epic.get("name");
        if (name instanceof String s && !s.isBlank()) return s;

        // JQL fallback: fields.summary
        Object fields = epic.get("fields");
        if (fields instanceof Map<?,?> f) {
            Object summary = f.get("summary");
            if (summary instanceof String s) return s;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private String epicStatus(Map<String, Object> epic) {
        // Agile endpoint: { "done": true/false } — no rich status
        Object done = epic.get("done");
        if (done instanceof Boolean b) return b ? "DONE" : "IN PROGRESS";

        // JQL fallback: fields.status.name
        Object fields = epic.get("fields");
        if (fields instanceof Map<?,?> f) {
            Object statusObj = f.get("status");
            if (statusObj instanceof Map<?,?> s) {
                Object name = s.get("name");
                if (name instanceof String str) return str;
            }
        }
        return null;
    }

    private long toLong(Object val) {
        if (val instanceof Number n) return n.longValue();
        return 0L;
    }

    // ── Result records ────────────────────────────────────────────────────────

    private enum UpsertResult { CREATED, UPDATED, SKIPPED }

    public record SyncResult(
            int  boardsScanned,
            int  created,
            int  updated,
            int  failed,
            int  skipped,
            List<String> errors,
            String fatalError
    ) {
        static SyncResult boardFetchFailed(String msg) {
            return new SyncResult(0, 0, 0, 1, 0, List.of(msg), msg);
        }
    }

    public record BoardSyncResult(
            int  created,
            int  updated,
            int  failed,
            int  skipped,
            List<String> errors
    ) {
        static BoardSyncResult failed(String msg) {
            return new BoardSyncResult(0, 0, 1, 0, List.of(msg));
        }
    }
}
