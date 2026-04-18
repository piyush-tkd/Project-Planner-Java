package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.domain.model.enums.SourceType;
import com.portfolioplanner.domain.repository.ProjectRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Synchronises Jira epics across all configured Agile boards into Portfolio Planner projects.
 *
 * <p>Sync logic:
 * <ol>
 *   <li>Fetch all agile boards via {@link JiraClient#getAllAgileBoards()}.</li>
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

    private final JiraClient              jiraClient;
    private final JiraCredentialsService  jiraCreds;
    private final ProjectRepository       projectRepository;
    private final CacheManager            cacheManager;

    @PersistenceContext
    private EntityManager entityManager;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Runs a full sync across all Jira boards.
     *
     * @return summary with counts of created, updated, failed, and skipped epics
     */
    @Transactional
    public SyncResult syncAllBoards() {
        log.info("JiraEpicSyncService: starting full board scan");

        // Evict the epic board cache so we always fetch fresh data from Jira
        var epicCache = cacheManager.getCache("jira-epics-from-board");
        if (epicCache != null) epicCache.clear();

        List<Map<String, Object>> boards;
        try {
            boards = jiraClient.getAllAgileBoards();
        } catch (Exception e) {
            log.error("JiraEpicSyncService: failed to fetch agile boards — {}", e.getMessage(), e);
            return SyncResult.boardFetchFailed(e.getMessage());
        }

        log.info("JiraEpicSyncService: found {} agile boards", boards.size());

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
        log.info("JiraEpicSyncService: syncing board {} ({})", boardId, boardName);

        List<Map<String, Object>> epics;
        try {
            epics = jiraClient.getEpicsFromBoard(boardId);
        } catch (Exception e) {
            log.warn("JiraEpicSyncService: board {} epic fetch failed — {}", boardId, e.getMessage());
            return BoardSyncResult.failed(e.getMessage());
        }

        log.info("JiraEpicSyncService: board {} — found {} epics from agile endpoint", boardId, epics.size());

        // The agile board /epic endpoint returns minimal data (key, name, done only).
        // Batch-fetch full issue details (priority + status) via JQL so we can map them correctly.
        Map<String, Map<String, Object>> enrichedByKey = Map.of();
        if (!epics.isEmpty()) {
            List<String> keys = epics.stream()
                    .map(this::epicKey)
                    .filter(k -> k != null)
                    .collect(java.util.stream.Collectors.toList());
            log.info("JiraEpicSyncService: board {} — enriching keys: {}", boardId, keys);
            try {
                enrichedByKey = jiraClient.getIssueFieldsByKeys(keys);
                log.info("JiraEpicSyncService: board {} — enriched {}/{} epics",
                        boardId, enrichedByKey.size(), keys.size());
                // Log first 3 enriched entries so we can see the raw Jira data
                enrichedByKey.entrySet().stream().limit(3).forEach(entry -> {
                    Object fields = entry.getValue().get("fields");
                    log.info("JiraEpicSyncService: raw fields for {} → {}", entry.getKey(), fields);
                });
            } catch (Exception e) {
                log.warn("JiraEpicSyncService: batch field enrichment FAILED for board {} — {}",
                        boardId, e.getMessage(), e);
            }
        }

        int created = 0, updated = 0, failed = 0, skipped = 0;
        List<String> errors = new ArrayList<>();

        for (Map<String, Object> epic : epics) {
            try {
                // Merge full issue fields into the minimal epic object
                String key = epicKey(epic);
                Map<String, Object> enriched = key != null ? enrichedByKey.get(key) : null;
                Map<String, Object> mergedEpic = mergeEpicWithFields(epic, enriched);

                UpsertResult r = upsertEpic(mergedEpic, boardId);
                switch (r) {
                    case CREATED -> created++;
                    case UPDATED -> updated++;
                    case SKIPPED -> skipped++;
                }
            } catch (Exception e) {
                log.warn("JiraEpicSyncService: epic upsert failed — {}", e.getMessage());
                // Clear the Hibernate session to prevent AssertionFailure("null id") on
                // subsequent epics — when an exception occurs mid-flush the session state
                // becomes corrupted and must be reset before any further operations.
                entityManager.clear();
                failed++;
                errors.add(epicKey(epic) + ": " + e.getMessage());
            }
        }

        return new BoardSyncResult(created, updated, failed, skipped, errors);
    }

    /**
     * Merges the minimal agile-board epic object with the full issue fields
     * (priority, status, summary) fetched via the REST API.
     * The agile-board object is kept as the base; fields from the full issue
     * are merged in under the "fields" key so existing helper methods work.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> mergeEpicWithFields(Map<String, Object> epic,
                                                     Map<String, Object> fullIssue) {
        if (fullIssue == null) return epic;
        Map<String, Object> merged = new LinkedHashMap<>(epic);
        Object fields = fullIssue.get("fields");
        if (fields instanceof Map) {
            merged.put("fields", fields);
        }
        // Also expose summary at top-level as "name" if not already present
        if (fields instanceof Map<?,?> f) {
            if (!merged.containsKey("name") || ((String) merged.getOrDefault("name", "")).isBlank()) {
                Object summary = f.get("summary");
                if (summary instanceof String s) merged.put("name", s);
            }
        }
        return merged;
    }

    /**
     * Returns a lightweight status map per board — for the admin settings panel.
     */
    public List<Map<String, Object>> getBoardSyncStatus() {
        List<Map<String, Object>> boards;
        try {
            boards = jiraClient.getAllAgileBoards();
        } catch (Exception e) {
            log.warn("JiraEpicSyncService: cannot fetch agile boards for status — {}", e.getMessage());
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

    /**
     * Syncs a single Jira epic by key (e.g. "PMO-45").
     * Fetches fresh status/priority from Jira and updates the linked PP project.
     * Much cheaper than a full sync — safe to call from a project detail page.
     *
     * @return a brief result map with keys: epicKey, result ("updated"|"skipped"|"not_found"), message
     */
    @Transactional
    public Map<String, Object> syncOneEpic(String epicKey) {
        Map<String, Object> out = new HashMap<>();
        out.put("epicKey", epicKey);

        // Check Jira is configured before attempting any network call
        if (!jiraCreds.isConfigured()) {
            out.put("result",  "error");
            out.put("message", "Jira credentials not configured — go to Settings → Integrations");
            return out;
        }

        // Look up the existing PP project so we can preserve its boardId
        Optional<Project> existing = projectRepository.findByJiraEpicKey(epicKey);
        long boardId = existing.map(p -> p.getJiraBoardId() != null ? p.getJiraBoardId() : 0L).orElse(0L);

        try {
            // Fetch fresh fields from Jira (one JQL query — much cheaper than a full sync)
            Map<String, Map<String, Object>> fetched = jiraClient.getIssueFieldsByKeys(List.of(epicKey));
            if (fetched == null || !fetched.containsKey(epicKey)) {
                out.put("result",  "not_found");
                out.put("message", "Epic " + epicKey + " not found in Jira");
                existing.ifPresent(p -> { p.setJiraSyncError(true); projectRepository.save(p); });
                return out;
            }

            Map<String, Object> issue = fetched.get(epicKey);
            UpsertResult r = upsertEpic(issue, boardId);
            out.put("result",  r == UpsertResult.UPDATED ? "updated" : "skipped");
            out.put("message", "Epic " + epicKey + " — " + r.name().toLowerCase());
            return out;

        } catch (Exception e) {
            log.error("JiraEpicSyncService.syncOneEpic failed for {}: {}", epicKey, e.getMessage(), e);
            // Mark the PP project as errored so the UI can show a sync-error badge
            existing.ifPresent(p -> { p.setJiraSyncError(true); projectRepository.save(p); });
            out.put("result",  "error");
            out.put("message", e.getMessage());
            return out;
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private UpsertResult upsertEpic(Map<String, Object> epic, long boardId) {
        String key      = epicKey(epic);
        String name           = epicName(epic);
        String status         = epicStatus(epic);
        String statusCategory = epicStatusCategory(epic);
        Priority priority     = epicPriority(epic);

        if (key == null || name == null || name.isBlank()) {
            log.debug("JiraEpicSyncService: skipping epic with missing key/name");
            return UpsertResult.SKIPPED;
        }

        log.info("JiraEpicSyncService: epic {} → status='{}' category='{}' | priority={}",
                key, status, statusCategory, priority);

        Optional<Project> existing = projectRepository.findByJiraEpicKey(key);

        if (existing.isPresent()) {
            Project p = existing.get();

            // Never overwrite MANUAL or the user-controlled parts of PUSHED_TO_JIRA
            if (p.getSourceType() == SourceType.MANUAL) {
                return UpsertResult.SKIPPED;
            }

            // Update mutable Jira-owned fields — store raw Jira status name as-is
            p.setName(name);
            p.setStatus(status != null ? status : "");
            p.setJiraStatusCategory(statusCategory);
            p.setPriority(priority);
            p.setJiraBoardId(boardId);
            p.setJiraLastSyncedAt(OffsetDateTime.now());
            p.setJiraSyncError(false);
            projectRepository.save(p);
            log.debug("JiraEpicSyncService: updated project {} ← epic {}", p.getId(), key);
            return UpsertResult.UPDATED;
        }

        // Auto-create a new PP project from the Jira epic — store raw Jira status as-is
        Project p = new Project();
        p.setName(name);
        p.setPriority(priority);
        p.setStatus(status != null ? status : "");
        p.setJiraStatusCategory(statusCategory);
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

    /**
     * Maps a Jira status to a PP well-known status value using a two-pass strategy:
     *
     * Pass 1 — exact status NAME lookup.
     *   Status names are matched first because some names (BLOCKED, ON HOLD) belong to
     *   Jira's "indeterminate" category but should map to ON_HOLD, not ACTIVE.
     *
     * Pass 2 — statusCategory.key fallback for any unknown custom status names.
     *   Jira guarantees category is always one of: "new" / "indeterminate" / "done".
     *   This handles any custom workflow statuses we haven't explicitly listed.
     */
    private String mapJiraStatusToPP(String statusName, String categoryKey) {
        if (statusName != null) {
            String s = statusName.trim().toUpperCase();
            switch (s) {
                // ── Their specific Jira workflow statuses (from screenshot) ──
                case "BACKLOG", "FUNNEL", "READY"                       -> { return "NOT_STARTED"; }
                case "IN PROGRESS", "IN-PROGRESS", "REVIEW"             -> { return "ACTIVE"; }
                case "BLOCKED", "ON HOLD", "ON-HOLD"                    -> { return "ON_HOLD"; }
                case "CANCELLED", "CANCELED"                            -> { return "CANCELLED"; }
                case "DONE"                                             -> { return "COMPLETED"; }

                // ── Additional common Jira status names ──
                case "TO DO", "TODO", "OPEN", "SELECTED FOR DEVELOPMENT",
                     "READY FOR DEV", "READY FOR DEVELOPMENT", "READY TO START",
                     "PLANNING", "PROPOSED", "DISCOVERY", "IDEATION"    -> { return "NOT_STARTED"; }

                case "IN DEVELOPMENT", "IN REVIEW", "IN-REVIEW", "CODE REVIEW",
                     "TESTING", "IN TESTING", "QA", "IN QA", "UAT",
                     "ACTIVE", "DEVELOPMENT", "IMPLEMENTATION",
                     "READY FOR QA", "READY FOR REVIEW",
                     // ── Review / approval states seen in this org's Jira ──
                     "UNDER REVIEW", "PEER REVIEW", "TECH REVIEW",
                     "STEERING COMMITTEE REVIEW", "TECHNOLOGY REVIEW",
                     "COMPLIANCE REVIEW", "ONGOING"                     -> { return "ACTIVE"; }

                case "CLOSED", "RESOLVED", "COMPLETED",
                     "RELEASED", "DEPLOYED", "MERGED", "FINISHED"       -> { return "COMPLETED"; }

                case "HOLD", "BLOCKED BY", "WAITING", "WAITING FOR INPUT",
                     "DEFERRED", "PARKED", "SUSPENDED", "PENDING",
                     "HOLD/PAUSED", "ON PAUSE", "PAUSED"                -> { return "ON_HOLD"; }

                case "REJECTED", "WONT DO", "WON'T DO",
                     "WONT FIX", "ABANDONED", "WITHDRAWN"               -> { return "CANCELLED"; }
            }
        }

        // Pass 2 — fall back to statusCategory.key for unknown custom statuses
        if (categoryKey != null) {
            return switch (categoryKey.trim().toLowerCase()) {
                case "new"  -> "NOT_STARTED";
                case "done" -> "COMPLETED";
                default     -> "ACTIVE"; // "indeterminate" = any in-progress state
            };
        }

        return "ACTIVE"; // safe default
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
        Object fields = epic.get("fields");
        if (fields instanceof Map<?,?> f) {
            Object statusObj = f.get("status");
            if (statusObj instanceof Map<?,?> s) {
                // Return the exact status name — used as primary lookup in mapJiraStatusToPP
                Object name = s.get("name");
                if (name instanceof String str && !str.isBlank()) return str;
            }
        }
        // Agile board fallback when enrichment was unavailable
        Object done = epic.get("done");
        if (done instanceof Boolean b) return b ? "DONE" : "IN PROGRESS";
        return null;
    }

    @SuppressWarnings("unchecked")
    private String epicStatusCategory(Map<String, Object> epic) {
        Object fields = epic.get("fields");
        if (fields instanceof Map<?,?> f) {
            Object statusObj = f.get("status");
            if (statusObj instanceof Map<?,?> s) {
                Object catObj = s.get("statusCategory");
                if (catObj instanceof Map<?,?> cat) {
                    Object catKey = cat.get("key");
                    if (catKey instanceof String ck && !ck.isBlank()) return ck;
                }
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private Priority epicPriority(Map<String, Object> epic) {
        // Jira REST API v3: fields.priority.name → e.g. "Highest", "High", "Medium", "Low", "Lowest"
        Object fields = epic.get("fields");
        if (fields instanceof Map<?,?> f) {
            Object priorityObj = f.get("priority");
            if (priorityObj instanceof Map<?,?> pri) {
                Object nameObj = pri.get("name");
                if (nameObj instanceof String name) {
                    return mapJiraPriorityToPP(name);
                }
            }
        }
        // Agile board epic endpoint may not include priority — default to MEDIUM
        return Priority.MEDIUM;
    }

    private Priority mapJiraPriorityToPP(String jiraPriority) {
        return switch (jiraPriority.trim().toUpperCase()) {
            case "HIGHEST", "CRITICAL", "BLOCKER"   -> Priority.HIGHEST;
            case "HIGH"                              -> Priority.HIGH;
            case "LOW"                               -> Priority.LOW;
            case "LOWEST", "TRIVIAL"                 -> Priority.LOWEST;
            default                                  -> Priority.MEDIUM; // "Medium" + anything else
        };
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
