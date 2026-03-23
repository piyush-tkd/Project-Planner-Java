package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

/**
 * Periodically syncs all Jira issues (from configured boards + support boards)
 * into local PostgreSQL tables so analytics run entirely from the DB.
 *
 * Sync strategies:
 *   - FULL sync: fetches ALL issues for a project (first-time or manual refresh)
 *   - INCREMENTAL sync: fetches only issues updated since last sync
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraIssueSyncService {

    private final JiraClient jiraClient;
    private final JiraCredentialsService creds;
    private final JiraPodService podService;

    // Repositories
    private final JiraSyncedIssueRepository issueRepo;
    private final JiraIssueLabelRepository labelRepo;
    private final JiraIssueComponentRepository componentRepo;
    private final JiraIssueFixVersionRepository fixVersionRepo;
    private final JiraIssueCustomFieldRepository customFieldRepo;
    private final JiraIssueWorklogRepository worklogRepo;
    private final JiraIssueTransitionRepository transitionRepo;
    private final JiraIssueCommentRepository commentRepo;
    private final JiraSyncedSprintRepository sprintRepo;
    private final JiraSyncStatusRepository syncStatusRepo;
    private final JiraPodRepository podRepo;
    private final JiraSupportBoardRepository supportBoardRepo;
    private final TransactionTemplate txTemplate;

    /** Fields to request from Jira – covers all standard + common custom fields */
    private static final List<String> SYNC_FIELDS = List.of(
            "summary", "issuetype", "status", "priority", "assignee", "reporter", "creator",
            "labels", "components", "fixVersions", "resolution",
            "created", "updated", "resolutiondate", "duedate",
            "timeoriginalestimate", "timeestimate", "timespent",
            "story_points", "customfield_10016", "customfield_10028",
            "customfield_10034", "customfield_10106", "customfield_10162",
            "customfield_10014", // classic epic link
            "parent", "project", "sprint",
            "description", "comment", "worklog"
    );

    private final AtomicBoolean syncing = new AtomicBoolean(false);

    // ── Scheduled sync ──────────────────────────────────────────────────

    /**
     * Runs every 30 minutes. Does incremental sync (only issues updated since last sync).
     */
    @Scheduled(fixedDelayString = "${app.jira-sync.interval-ms:1800000}",
               initialDelayString = "${app.jira-sync.initial-delay-ms:120000}")
    public void scheduledIncrementalSync() {
        if (!creds.isConfigured()) return;
        if (!syncing.compareAndSet(false, true)) {
            log.info("Jira sync already in progress, skipping scheduled run");
            return;
        }
        try {
            log.info("▶ Starting scheduled incremental Jira sync");
            syncAllProjects(false);
            log.info("✓ Scheduled Jira sync complete");
        } catch (Exception e) {
            log.error("Scheduled Jira sync failed", e);
        } finally {
            syncing.set(false);
        }
    }

    /**
     * Manual trigger – full or incremental.
     */
    @Async
    public void triggerSync(boolean fullSync) {
        if (!creds.isConfigured()) return;
        if (!syncing.compareAndSet(false, true)) {
            log.info("Jira sync already in progress");
            return;
        }
        try {
            log.info("▶ Starting manual {} Jira sync", fullSync ? "FULL" : "incremental");
            syncAllProjects(fullSync);
            log.info("✓ Manual Jira sync complete");
        } catch (Exception e) {
            log.error("Manual Jira sync failed", e);
        } finally {
            syncing.set(false);
        }
    }

    public boolean isSyncing() {
        return syncing.get();
    }

    public List<JiraSyncStatus> getSyncStatuses() {
        return syncStatusRepo.findAllByOrderByProjectKeyAsc();
    }

    // ── Core sync logic ─────────────────────────────────────────────────

    private void syncAllProjects(boolean fullSync) {
        // Collect all project keys from configured pods + support boards
        Set<String> projectKeys = new LinkedHashSet<>();

        List<JiraPod> pods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        for (JiraPod pod : pods) {
            for (JiraPodBoard board : pod.getBoards()) {
                projectKeys.add(board.getJiraProjectKey());
            }
        }

        List<JiraSupportBoard> supportBoards = supportBoardRepo.findByEnabledTrue();
        for (JiraSupportBoard sb : supportBoards) {
            if (sb.getProjectKey() != null && !sb.getProjectKey().isBlank()) {
                projectKeys.add(sb.getProjectKey());
            }
        }

        log.info("Syncing {} project keys: {}", projectKeys.size(), projectKeys);

        for (String projectKey : projectKeys) {
            try {
                syncProject(projectKey, fullSync);
            } catch (Exception e) {
                log.error("Failed to sync project {}: {}", projectKey, e.getMessage());
                updateSyncStatus(projectKey, "STANDARD", "FAILED", 0, e.getMessage());
            }
        }
    }

    public void syncProject(String projectKey, boolean fullSync) {
        // Use TransactionTemplate to guarantee a real transaction context.
        // Spring's proxy-based @Transactional is bypassed when called from
        // within the same bean (syncAllProjects → syncProject).
        txTemplate.executeWithoutResult(status -> doSyncProject(projectKey, fullSync));
    }

    private void doSyncProject(String projectKey, boolean fullSync) {
        JiraSyncStatus syncStatus = syncStatusRepo
                .findByProjectKeyAndBoardType(projectKey, "STANDARD")
                .orElseGet(() -> {
                    JiraSyncStatus s = new JiraSyncStatus();
                    s.setProjectKey(projectKey);
                    s.setBoardType("STANDARD");
                    return s;
                });

        syncStatus.setStatus("RUNNING");
        syncStatus.setErrorMessage(null);
        syncStatusRepo.save(syncStatus);

        // Determine JQL: full sync or incremental
        String jql;
        if (fullSync || syncStatus.getLastSyncAt() == null) {
            // Full sync – get ALL issues for this project
            jql = "project = \"" + projectKey + "\" ORDER BY updated DESC";
            log.info("  FULL sync for {}", projectKey);
        } else {
            // Incremental – only updated since last sync (with 5 min overlap for safety)
            LocalDateTime since = syncStatus.getLastSyncAt().minusMinutes(5);
            String sinceStr = since.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
            jql = "project = \"" + projectKey + "\" AND updated >= \"" + sinceStr + "\" ORDER BY updated DESC";
            log.info("  Incremental sync for {} (since {})", projectKey, sinceStr);
        }

        // Fetch issues from Jira (up to 10000)
        List<Map<String, Object>> issues = jiraClient.searchIssuesPost(jql, SYNC_FIELDS, 10000);
        log.info("  Fetched {} issues for {}", issues.size(), projectKey);

        int synced = 0;
        for (Map<String, Object> rawIssue : issues) {
            try {
                upsertIssue(rawIssue, projectKey);
                synced++;
            } catch (Exception e) {
                String key = str(rawIssue, "key");
                log.warn("  Failed to upsert issue {}: {}", key, e.getMessage());
            }
        }

        // Sync worklogs for issues that have them
        syncWorklogs(issues, projectKey);

        // Sync sprints for this project
        syncSprintsForProject(projectKey);

        // Update sync status
        syncStatus.setLastSyncAt(LocalDateTime.now());
        if (fullSync || syncStatus.getLastFullSync() == null) {
            syncStatus.setLastFullSync(LocalDateTime.now());
        }
        syncStatus.setIssuesSynced(synced);
        syncStatus.setStatus("IDLE");
        syncStatus.setErrorMessage(null);
        syncStatusRepo.save(syncStatus);

        log.info("  ✓ Synced {}/{} issues for {}", synced, issues.size(), projectKey);
    }

    // ── Issue upsert ────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private void upsertIssue(Map<String, Object> raw, String projectKey) {
        String issueKey = str(raw, "key");
        String jiraId = str(raw, "id");
        Map<String, Object> fields = asMap(raw, "fields");
        if (fields == null || issueKey == null) return;

        JiraSyncedIssue issue = issueRepo.findByIssueKey(issueKey)
                .orElseGet(JiraSyncedIssue::new);

        issue.setJiraId(jiraId != null ? jiraId : issueKey);
        issue.setIssueKey(issueKey);
        issue.setProjectKey(projectKey);
        issue.setSummary(str(fields, "summary"));

        // Issue type
        Map<String, Object> issueType = asMap(fields, "issuetype");
        if (issueType != null) {
            issue.setIssueType(str(issueType, "name"));
            issue.setIssueTypeIconUrl(str(issueType, "iconUrl"));
            Object sub = issueType.get("subtask");
            issue.setSubtask(Boolean.TRUE.equals(sub));
        }

        // Status
        Map<String, Object> status = asMap(fields, "status");
        if (status != null) {
            issue.setStatusName(str(status, "name"));
            Map<String, Object> cat = asMap(status, "statusCategory");
            if (cat != null) {
                issue.setStatusCategory(str(cat, "key"));
            }
        }

        // Priority
        Map<String, Object> priority = asMap(fields, "priority");
        if (priority != null) {
            issue.setPriorityName(str(priority, "name"));
            issue.setPriorityIconUrl(str(priority, "iconUrl"));
        }

        // Assignee / Reporter / Creator
        Map<String, Object> assignee = asMap(fields, "assignee");
        if (assignee != null) {
            issue.setAssigneeAccountId(str(assignee, "accountId"));
            issue.setAssigneeDisplayName(str(assignee, "displayName"));
        } else {
            issue.setAssigneeAccountId(null);
            issue.setAssigneeDisplayName("Unassigned");
        }

        Map<String, Object> reporter = asMap(fields, "reporter");
        if (reporter != null) {
            issue.setReporterAccountId(str(reporter, "accountId"));
            issue.setReporterDisplayName(str(reporter, "displayName"));
        }

        Map<String, Object> creator = asMap(fields, "creator");
        if (creator != null) {
            issue.setCreatorDisplayName(str(creator, "displayName"));
        }

        // Resolution
        Map<String, Object> resolution = asMap(fields, "resolution");
        if (resolution != null) {
            issue.setResolution(str(resolution, "name"));
        }

        // Time tracking
        issue.setTimeOriginalEstimate(longVal(fields, "timeoriginalestimate"));
        issue.setTimeEstimate(longVal(fields, "timeestimate"));
        issue.setTimeSpent(longVal(fields, "timespent"));

        // Story points (try multiple fields)
        issue.setStoryPoints(extractStoryPoints(fields));

        // Dates
        issue.setCreatedAt(parseDateTime(str(fields, "created")));
        issue.setUpdatedAt(parseDateTime(str(fields, "updated")));
        issue.setResolutionDate(parseDateTime(str(fields, "resolutiondate")));
        issue.setDueDate(parseDate(str(fields, "duedate")));

        // Parent / Epic
        Map<String, Object> parent = asMap(fields, "parent");
        if (parent != null) {
            issue.setParentKey(str(parent, "key"));
            Map<String, Object> parentFields = asMap(parent, "fields");
            if (parentFields != null) {
                issue.setEpicName(str(parentFields, "summary"));
            }
        }
        Object epicLink = fields.get("customfield_10014");
        if (epicLink instanceof String) {
            issue.setEpicKey((String) epicLink);
        }

        // Sprint (take the most recent / active sprint)
        Object sprintRaw = fields.get("sprint");
        if (sprintRaw instanceof Map) {
            Map<String, Object> sprint = (Map<String, Object>) sprintRaw;
            issue.setSprintId(longVal(sprint, "id"));
            issue.setSprintName(str(sprint, "name"));
            issue.setSprintState(str(sprint, "state"));
            issue.setSprintStartDate(parseDateTime(str(sprint, "startDate")));
            issue.setSprintEndDate(parseDateTime(str(sprint, "endDate")));
        }

        // Description — extract and store full text
        Object desc = fields.get("description");
        if (desc != null) {
            String descText = extractTextFromAdf(desc);
            issue.setDescriptionText(descText);
            issue.setDescriptionLength(descText != null ? descText.length() : 0);
        }

        // Comment count
        Map<String, Object> commentField = asMap(fields, "comment");
        if (commentField != null) {
            Object total = commentField.get("total");
            if (total instanceof Number) {
                issue.setCommentCount(((Number) total).intValue());
            }
        }

        issue.setSyncedAt(LocalDateTime.now());
        issueRepo.save(issue);

        // ── Sync multi-value fields ─────────────────────────────────────

        // Labels
        labelRepo.deleteByIssueKey(issueKey);
        Object labelsRaw = fields.get("labels");
        if (labelsRaw instanceof List) {
            for (Object lbl : (List<?>) labelsRaw) {
                if (lbl instanceof String) {
                    labelRepo.save(new JiraIssueLabel(issueKey, (String) lbl));
                }
            }
        }

        // Components
        componentRepo.deleteByIssueKey(issueKey);
        Object compsRaw = fields.get("components");
        if (compsRaw instanceof List) {
            for (Object comp : (List<?>) compsRaw) {
                if (comp instanceof Map) {
                    String name = str((Map<String, Object>) comp, "name");
                    if (name != null) {
                        componentRepo.save(new JiraIssueComponent(issueKey, name));
                    }
                }
            }
        }

        // Fix Versions
        fixVersionRepo.deleteByIssueKey(issueKey);
        Object fvRaw = fields.get("fixVersions");
        if (fvRaw instanceof List) {
            for (Object fv : (List<?>) fvRaw) {
                if (fv instanceof Map) {
                    Map<String, Object> fvMap = (Map<String, Object>) fv;
                    fixVersionRepo.save(new JiraIssueFixVersion(
                            issueKey,
                            str(fvMap, "name"),
                            str(fvMap, "id"),
                            Boolean.TRUE.equals(fvMap.get("released")),
                            parseDate(str(fvMap, "releaseDate"))
                    ));
                }
            }
        }

        // Custom fields – store anything that starts with "customfield_"
        customFieldRepo.deleteByIssueKey(issueKey);
        for (Map.Entry<String, Object> entry : fields.entrySet()) {
            if (entry.getKey().startsWith("customfield_") && entry.getValue() != null) {
                String cfId = entry.getKey();
                // Skip story point fields we already handled
                if (cfId.equals("customfield_10016") || cfId.equals("customfield_10028")
                        || cfId.equals("customfield_10034") || cfId.equals("customfield_10106")
                        || cfId.equals("customfield_10162") || cfId.equals("customfield_10014")) {
                    continue;
                }
                String value = extractCustomFieldValue(entry.getValue());
                if (value != null && !value.isBlank()) {
                    customFieldRepo.save(new JiraIssueCustomField(
                            issueKey, cfId, null, value, detectFieldType(entry.getValue())
                    ));
                }
            }
        }

        // ── Comments ────────────────────────────────────────────────────
        syncIssueComments(issueKey, fields);
    }

    /**
     * Sync comments for a single issue from the comment field data.
     * If more comments exist than returned inline, fetches the full list from API.
     */
    @SuppressWarnings("unchecked")
    private void syncIssueComments(String issueKey, Map<String, Object> fields) {
        Map<String, Object> commentField = asMap(fields, "comment");
        if (commentField == null) return;

        int total = 0;
        Object t = commentField.get("total");
        if (t instanceof Number) total = ((Number) t).intValue();
        if (total == 0) return;

        // Comments may be inline in the search results
        List<Map<String, Object>> comments = new ArrayList<>();
        Object commentsRaw = commentField.get("comments");
        if (commentsRaw instanceof List) {
            comments = (List<Map<String, Object>>) commentsRaw;
        }

        // If inline comments are fewer than total, fetch full list from API
        if (comments.size() < total) {
            try {
                comments = jiraClient.getComments(issueKey);
            } catch (Exception e) {
                log.debug("  Could not fetch full comments for {}: {}", issueKey, e.getMessage());
                // Fall back to whatever we have inline
            }
        }

        commentRepo.deleteByIssueKey(issueKey);
        for (Map<String, Object> c : comments) {
            String commentId = str(c, "id");
            if (commentId == null) continue;

            Map<String, Object> author = asMap(c, "author");
            String body = "";
            Object bodyRaw = c.get("body");
            if (bodyRaw instanceof String) {
                body = (String) bodyRaw;
            } else if (bodyRaw != null) {
                // ADF format
                body = extractTextFromAdf(bodyRaw);
            }
            if (body == null || body.isBlank()) continue;

            // Truncate very long comments to 4000 chars to avoid DB bloat
            if (body.length() > 4000) {
                body = body.substring(0, 4000) + "…";
            }

            JiraIssueComment comment = new JiraIssueComment(
                    commentId,
                    issueKey,
                    author != null ? str(author, "accountId") : null,
                    author != null ? str(author, "displayName") : null,
                    body,
                    parseDateTime(str(c, "created")),
                    parseDateTime(str(c, "updated"))
            );
            commentRepo.save(comment);
        }
    }

    // ── Worklog sync ────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private void syncWorklogs(List<Map<String, Object>> issues, String projectKey) {
        int total = 0;
        for (Map<String, Object> raw : issues) {
            String issueKey = str(raw, "key");
            Map<String, Object> fields = asMap(raw, "fields");
            if (fields == null || issueKey == null) continue;

            // Check if issue has worklogs
            Map<String, Object> worklogMeta = asMap(fields, "worklog");
            int worklogTotal = 0;
            if (worklogMeta != null) {
                Object t = worklogMeta.get("total");
                if (t instanceof Number) worklogTotal = ((Number) t).intValue();
            }

            if (worklogTotal == 0) continue;

            // Fetch full worklogs from Jira
            try {
                List<Map<String, Object>> worklogs = jiraClient.getWorklogs(issueKey);
                worklogRepo.deleteByIssueKey(issueKey);
                for (Map<String, Object> wl : worklogs) {
                    JiraIssueWorklog worklog = new JiraIssueWorklog();
                    worklog.setWorklogJiraId(str(wl, "id"));
                    worklog.setIssueKey(issueKey);

                    Map<String, Object> author = asMap(wl, "author");
                    if (author != null) {
                        worklog.setAuthorAccountId(str(author, "accountId"));
                        worklog.setAuthorDisplayName(str(author, "displayName"));
                    }

                    Object tss = wl.get("timeSpentSeconds");
                    worklog.setTimeSpentSeconds(tss instanceof Number ? ((Number) tss).longValue() : 0L);
                    worklog.setStarted(parseDateTime(str(wl, "started")));
                    worklog.setCreated(parseDateTime(str(wl, "created")));
                    worklog.setUpdated(parseDateTime(str(wl, "updated")));

                    // Comment can be ADF object or string
                    Object commentObj = wl.get("comment");
                    if (commentObj instanceof String) {
                        worklog.setComment((String) commentObj);
                    } else if (commentObj instanceof Map) {
                        // ADF – just store a summary
                        worklog.setComment("[ADF content]");
                    }

                    worklogRepo.save(worklog);
                    total++;
                }
            } catch (Exception e) {
                log.warn("  Failed to sync worklogs for {}: {}", issueKey, e.getMessage());
            }
        }
        if (total > 0) log.info("  Synced {} worklog entries for {}", total, projectKey);
    }

    // ── Sprint sync ─────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private void syncSprintsForProject(String projectKey) {
        try {
            List<Map<String, Object>> boards = jiraClient.getBoards(projectKey);
            for (Map<String, Object> board : boards) {
                long boardId = ((Number) board.get("id")).longValue();
                List<Map<String, Object>> sprints = jiraClient.getAllSprints(boardId);
                for (Map<String, Object> s : sprints) {
                    Long sprintJiraId = longVal(s, "id");
                    if (sprintJiraId == null) continue;

                    JiraSyncedSprint sprint = sprintRepo.findBySprintJiraId(sprintJiraId)
                            .orElseGet(JiraSyncedSprint::new);
                    sprint.setSprintJiraId(sprintJiraId);
                    sprint.setBoardId(boardId);
                    sprint.setName(str(s, "name"));
                    sprint.setState(str(s, "state"));
                    sprint.setStartDate(parseDateTime(str(s, "startDate")));
                    sprint.setEndDate(parseDateTime(str(s, "endDate")));
                    sprint.setCompleteDate(parseDateTime(str(s, "completeDate")));
                    sprint.setGoal(str(s, "goal"));
                    sprint.setProjectKey(projectKey);
                    sprint.setSyncedAt(LocalDateTime.now());
                    sprintRepo.save(sprint);
                }
            }
        } catch (Exception e) {
            log.warn("  Failed to sync sprints for {}: {}", projectKey, e.getMessage());
        }
    }

    // ── Helper: update sync status ──────────────────────────────────────

    private void updateSyncStatus(String projectKey, String boardType, String status,
                                   int issuesSynced, String errorMessage) {
        JiraSyncStatus ss = syncStatusRepo
                .findByProjectKeyAndBoardType(projectKey, boardType)
                .orElseGet(() -> {
                    JiraSyncStatus s = new JiraSyncStatus();
                    s.setProjectKey(projectKey);
                    s.setBoardType(boardType);
                    return s;
                });
        ss.setStatus(status);
        ss.setIssuesSynced(issuesSynced);
        ss.setErrorMessage(errorMessage);
        if ("IDLE".equals(status)) ss.setLastSyncAt(LocalDateTime.now());
        syncStatusRepo.save(ss);
    }

    // ── Value extractors ────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Map<String, Object> parent, String key) {
        Object val = parent.get(key);
        return val instanceof Map ? (Map<String, Object>) val : null;
    }

    private static String str(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }

    private static Long longVal(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val instanceof Number) return ((Number) val).longValue();
        return null;
    }

    @SuppressWarnings("unchecked")
    private static Double extractStoryPoints(Map<String, Object> fields) {
        // Try in order: story_points, customfield_10016, customfield_10028, customfield_10034, etc.
        for (String f : List.of("story_points", "customfield_10016", "customfield_10028",
                                "customfield_10034", "customfield_10106", "customfield_10162")) {
            Object val = fields.get(f);
            if (val instanceof Number) return ((Number) val).doubleValue();
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private static String extractCustomFieldValue(Object value) {
        if (value == null) return null;
        if (value instanceof String) return (String) value;
        if (value instanceof Number) return value.toString();
        if (value instanceof Boolean) return value.toString();
        if (value instanceof Map) {
            Map<?, ?> m = (Map<?, ?>) value;
            // Try common patterns: {value: x}, {name: x}, {displayName: x}
            for (String k : List.of("value", "name", "displayName")) {
                Object v = m.get(k);
                if (v != null) return v.toString();
            }
            return m.toString();
        }
        if (value instanceof List) {
            List<?> list = (List<?>) value;
            return list.stream()
                    .map(item -> {
                        if (item instanceof Map) {
                            Map<?, ?> m = (Map<?, ?>) item;
                            Object v = m.get("value");
                            if (v == null) v = m.get("name");
                            if (v == null) v = m.get("displayName");
                            return v != null ? v.toString() : item.toString();
                        }
                        return item.toString();
                    })
                    .collect(Collectors.joining(", "));
        }
        return value.toString();
    }

    private static String detectFieldType(Object value) {
        if (value instanceof String) return "string";
        if (value instanceof Number) return "number";
        if (value instanceof Boolean) return "boolean";
        if (value instanceof List) return "array";
        if (value instanceof Map) return "option";
        return "unknown";
    }

    private static LocalDateTime parseDateTime(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            // Jira dates come as ISO 8601: "2024-01-15T10:30:00.000+0000"
            return ZonedDateTime.parse(raw, DateTimeFormatter.ISO_OFFSET_DATE_TIME)
                    .withZoneSameInstant(ZoneId.systemDefault())
                    .toLocalDateTime();
        } catch (DateTimeParseException e1) {
            try {
                // Try just date portion
                return LocalDate.parse(raw.substring(0, Math.min(raw.length(), 10)))
                        .atStartOfDay();
            } catch (Exception e2) {
                return null;
            }
        }
    }

    private static LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDate.parse(raw.substring(0, Math.min(raw.length(), 10)));
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Extract plain text from a Jira ADF (Atlassian Document Format) object.
     * ADF is a nested JSON tree: { type: "doc", content: [ { type: "paragraph", content: [ { type: "text", text: "..." } ] } ] }
     * We recursively walk the tree and collect all "text" node values.
     */
    @SuppressWarnings("unchecked")
    private static String extractTextFromAdf(Object adfNode) {
        if (adfNode == null) return null;
        if (adfNode instanceof String) return (String) adfNode;
        if (!(adfNode instanceof Map)) return adfNode.toString();

        Map<String, Object> node = (Map<String, Object>) adfNode;
        String type = str(node, "type");

        // Leaf text node
        if ("text".equals(type) || "emoji".equals(type)) {
            String text = str(node, "text");
            return text != null ? text : "";
        }

        // Recurse into content array
        Object content = node.get("content");
        if (content instanceof List) {
            StringBuilder sb = new StringBuilder();
            for (Object child : (List<?>) content) {
                String childText = extractTextFromAdf(child);
                if (childText != null && !childText.isEmpty()) {
                    sb.append(childText);
                }
            }
            // Add newlines for block-level elements
            if (type != null && (type.equals("paragraph") || type.equals("heading")
                    || type.equals("bulletList") || type.equals("orderedList")
                    || type.equals("listItem") || type.equals("blockquote")
                    || type.equals("codeBlock") || type.equals("rule"))) {
                sb.append("\n");
            }
            return sb.toString();
        }
        return "";
    }
}
