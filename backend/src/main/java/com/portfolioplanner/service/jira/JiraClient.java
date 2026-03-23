package com.portfolioplanner.service.jira;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Thin wrapper around the Jira REST API v3.
 * All methods return raw Maps so callers can navigate the JSON freely.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JiraClient {

    private final JiraCredentialsService creds;
    private final RestTemplate restTemplate;

    // ── Projects ──────────────────────────────────────────────────────

    /** Returns all Jira projects visible to the configured account. */
    @SuppressWarnings("unchecked")
    @Cacheable("jira-projects")
    public List<Map<String, Object>> getProjects() {
        String url = UriComponentsBuilder
                .fromHttpUrl(creds.getBaseUrl() + "/rest/api/3/project/search")
                .queryParam("maxResults", 100)
                .queryParam("expand", "description")
                .toUriString();

        Map<String, Object> resp = get(url, Map.class);
        if (resp == null) return List.of();
        Object values = resp.get("values");
        return values instanceof List ? (List<Map<String, Object>>) values : List.of();
    }

    // ── Epics ─────────────────────────────────────────────────────────

    /**
     * Returns all epics in a Jira project.
     * Tries the Agile board /epic endpoint first (most reliable for Cloud),
     * then falls back to REST API v3 JQL search.
     */
    @SuppressWarnings("unchecked")
    @Cacheable(value = "jira-epics", key = "#projectKey")
    public List<Map<String, Object>> getEpics(String projectKey) {
        // 1. Try Agile board epic endpoint
        try {
            List<Map<String, Object>> boards = getBoards(projectKey);
            if (!boards.isEmpty()) {
                long boardId = ((Number) boards.get(0).get("id")).longValue();
                List<Map<String, Object>> agileEpics = getEpicsFromBoard(boardId);
                if (!agileEpics.isEmpty()) {
                    log.info("  {} epics via Agile board {}", agileEpics.size(), boardId);
                    return agileEpics;
                }
            }
        } catch (Exception e) {
            log.debug("Agile epic endpoint failed for {}, falling back to JQL: {}", projectKey, e.getMessage());
        }

        // 2. Fallback: JQL search with quoted type name (works on all Jira Cloud versions)
        String jql = "project = \"" + projectKey + "\" AND issuetype = \"Epic\" ORDER BY created DESC";
        try {
            List<Map<String, Object>> issues = searchIssuesPost(jql,
                    List.of("summary", "status", "labels", "assignee", "customfield_10014"), 200);
            // Wrap in Agile-compatible shape so callers can use same field names
            return issues.stream().map(issue -> {
                Map<String, Object> copy = new LinkedHashMap<>(issue);
                // Expose "name" at top level = summary field for convenience
                Object fields = issue.get("fields");
                if (fields instanceof Map) {
                    Object summary = ((Map<?, ?>) fields).get("summary");
                    if (summary instanceof String) copy.put("name", summary);
                }
                return copy;
            }).collect(java.util.stream.Collectors.toList());
        } catch (Exception e) {
            log.warn("JQL epic search failed for {}: {}", projectKey, e.getMessage());
            return List.of();
        }
    }

    /**
     * Uses the Agile board's dedicated /epic endpoint which is the most reliable
     * way to list epics on Jira Cloud.
     */
    @SuppressWarnings("unchecked")
    @Cacheable(value = "jira-epics-from-board", key = "#boardId")
    public List<Map<String, Object>> getEpicsFromBoard(long boardId) {
        List<Map<String, Object>> all = new ArrayList<>();
        int startAt = 0;
        while (true) {
            String url = UriComponentsBuilder
                    .fromHttpUrl(creds.getBaseUrl() + "/rest/agile/1.0/board/" + boardId + "/epic")
                    .queryParam("maxResults", 100)
                    .queryParam("startAt", startAt)
                    .toUriString();
            Map<String, Object> resp = get(url, Map.class);
            if (resp == null) break;
            Object values = resp.get("values");
            if (!(values instanceof List)) break;
            List<Map<String, Object>> batch = (List<Map<String, Object>>) values;
            all.addAll(batch);
            boolean isLast = Boolean.TRUE.equals(resp.get("isLast"));
            startAt += batch.size();
            if (isLast || batch.isEmpty()) break;
        }
        return all;
    }

    // ── Labels ────────────────────────────────────────────────────────

    /** Returns all distinct labels used in a project. */
    @SuppressWarnings("unchecked")
    @Cacheable(value = "jira-labels", key = "#projectKey")
    public List<String> getLabels(String projectKey) {
        // Use label suggest API
        String url = UriComponentsBuilder
                .fromHttpUrl(creds.getBaseUrl() + "/rest/api/3/label")
                .queryParam("maxResults", 200)
                .toUriString();

        Map<String, Object> resp = get(url, Map.class);
        if (resp == null) return List.of();
        Object values = resp.get("values");
        if (!(values instanceof List)) return List.of();
        List<String> result = new ArrayList<>();
        for (Object v : (List<?>) values) {
            if (v instanceof String) result.add((String) v);
        }
        return result;
    }

    // ── Issues (actuals) ─────────────────────────────────────────────

    /**
     * Fetches all issues (stories, tasks, bugs) for a project that belong to
     * a specific epic name or label. Returns full field set for actuals computation.
     */
    public List<Map<String, Object>> getIssuesByEpicName(String projectKey, String epicName) {
        String jql = "project = \"" + projectKey + "\""
                + " AND issuetype != Epic"
                + " AND \"Epic Name\" = \"" + epicName.replace("\"", "\\\"") + "\""
                + " ORDER BY updated DESC";
        return searchIssuesPost(jql, List.of(
                "summary", "assignee", "timespent", "timeoriginalestimate",
                "story_points", "customfield_10016", "status", "created", "resolutiondate", "labels"), 500);
    }

    public List<Map<String, Object>> getIssuesByLabel(String projectKey, String label) {
        String jql = "project = \"" + projectKey + "\""
                + " AND issuetype != Epic"
                + " AND labels = \"" + label.replace("\"", "\\\"") + "\""
                + " ORDER BY updated DESC";
        return searchIssuesPost(jql, List.of(
                "summary", "assignee", "timespent", "timeoriginalestimate",
                "story_points", "customfield_10016", "status", "created", "resolutiondate", "labels"), 500);
    }

    public List<Map<String, Object>> getIssuesByEpicLink(String projectKey, String epicKey) {
        // Jira Cloud: parent = epicKey for sub-tasks/stories linked to an epic
        String jql = "project = \"" + projectKey + "\""
                + " AND issuetype != Epic"
                + " AND (\"Epic Link\" = \"" + epicKey + "\" OR parent = \"" + epicKey + "\")"
                + " ORDER BY updated DESC";
        return searchIssuesPost(jql, List.of(
                "summary", "assignee", "timespent", "timeoriginalestimate",
                "story_points", "customfield_10016", "status", "created", "resolutiondate", "labels", "parent"), 500);
    }

    /**
     * Fetches ALL worklogs for an issue, paginating until exhausted.
     * Jira's default page size for the worklog endpoint is 20; this method
     * keeps fetching until {@code startAt >= total}.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getWorklogs(String issueKey) {
        List<Map<String, Object>> all = new ArrayList<>();
        int startAt  = 0;
        int pageSize = 100; // Jira Cloud allows up to 5000 but 100 is safe
        while (true) {
            String url = UriComponentsBuilder
                    .fromHttpUrl(creds.getBaseUrl() + "/rest/api/3/issue/" + issueKey + "/worklog")
                    .queryParam("startAt",    startAt)
                    .queryParam("maxResults", pageSize)
                    .toUriString();
            Map<String, Object> resp = get(url, Map.class);
            if (resp == null) break;
            Object wls = resp.get("worklogs");
            if (!(wls instanceof List)) break;
            List<Map<String, Object>> batch = (List<Map<String, Object>>) wls;
            all.addAll(batch);
            int total = resp.get("total") instanceof Number
                    ? ((Number) resp.get("total")).intValue() : 0;
            startAt += batch.size();
            if (startAt >= total || batch.isEmpty()) break;
        }
        return all;
    }

    /**
     * Fetch all comments for a given issue (paginated).
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getComments(String issueKey) {
        List<Map<String, Object>> all = new ArrayList<>();
        int startAt  = 0;
        int pageSize = 100;
        while (true) {
            String url = UriComponentsBuilder
                    .fromHttpUrl(creds.getBaseUrl() + "/rest/api/3/issue/" + issueKey + "/comment")
                    .queryParam("startAt",    startAt)
                    .queryParam("maxResults", pageSize)
                    .queryParam("orderBy",    "created")
                    .toUriString();
            Map<String, Object> resp = get(url, Map.class);
            if (resp == null) break;
            Object comments = resp.get("comments");
            if (!(comments instanceof List)) break;
            List<Map<String, Object>> batch = (List<Map<String, Object>>) comments;
            all.addAll(batch);
            int total = resp.get("total") instanceof Number
                    ? ((Number) resp.get("total")).intValue() : 0;
            startAt += batch.size();
            if (startAt >= total || batch.isEmpty()) break;
        }
        return all;
    }

    // ── Resources / Members ───────────────────────────────────────────

    /** Returns all members of a Jira project (for name matching against PP resources). */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getProjectMembers(String projectKey) {
        String url = UriComponentsBuilder
                .fromHttpUrl(creds.getBaseUrl() + "/rest/api/3/user/assignable/multiProjectSearch")
                .queryParam("projectKeys", projectKey)
                .queryParam("maxResults", 200)
                .toUriString();

        Object resp = get(url, List.class);
        if (resp instanceof List) return (List<Map<String, Object>>) resp;
        return List.of();
    }

    // ── Search helper ─────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> searchIssues(String jql, String fields, int maxResults) {
        List<Map<String, Object>> all = new ArrayList<>();
        int startAt = 0;
        int pageSize = Math.min(maxResults, 100);

        while (true) {
            String url = UriComponentsBuilder
                    .fromHttpUrl(creds.getBaseUrl() + "/rest/api/3/issue/search")
                    .queryParam("jql", jql)
                    .queryParam("fields", fields)
                    .queryParam("maxResults", pageSize)
                    .queryParam("startAt", startAt)
                    .toUriString();

            Map<String, Object> page = get(url, Map.class);
            if (page == null) break;

            Object issues = page.get("issues");
            if (!(issues instanceof List)) break;
            List<Map<String, Object>> batch = (List<Map<String, Object>>) issues;
            all.addAll(batch);

            int total = page.get("total") instanceof Number
                    ? ((Number) page.get("total")).intValue() : 0;
            startAt += batch.size();
            if (startAt >= total || startAt >= maxResults || batch.isEmpty()) break;
        }
        return all;
    }

    /**
     * Same as {@link #searchIssues} but uses POST with a JSON body instead of GET with
     * query parameters. This avoids any URL-encoding / double-encoding issues that can
     * cause Jira Cloud to misinterpret the JQL and return a spurious 404.
     */
    /**
     * Uses POST /rest/api/3/search/jql (Jira Cloud v3 search endpoint).
     * This endpoint uses cursor-based pagination via {@code nextPageToken} —
     * it does NOT accept {@code startAt}. Sending {@code startAt} returns 400.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> searchIssuesPost(String jql, List<String> fieldList, int maxResults) {
        List<Map<String, Object>> all = new ArrayList<>();
        int pageSize = Math.min(maxResults, 100);
        String url = creds.getBaseUrl() + "/rest/api/3/search/jql";
        String nextPageToken = null;

        while (true) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("jql", jql);
            body.put("fields", fieldList);
            body.put("maxResults", pageSize);
            if (nextPageToken != null) {
                body.put("nextPageToken", nextPageToken);
            }

            Map<String, Object> page = post(url, body, Map.class);
            if (page == null) break;

            Object issues = page.get("issues");
            if (!(issues instanceof List)) break;
            List<Map<String, Object>> batch = (List<Map<String, Object>>) issues;
            all.addAll(batch);

            if (all.size() >= maxResults || batch.isEmpty()) break;

            // Cursor-based pagination: use nextPageToken if present
            Object token = page.get("nextPageToken");
            if (token instanceof String && !((String) token).isBlank()) {
                nextPageToken = (String) token;
            } else {
                break;
            }
        }
        return all;
    }

    /**
     * Returns the related issue counts for a fix version — a quick way to verify
     * whether any issues actually reference this version in Jira.
     */
    public Map<String, Object> getVersionRelatedIssueCounts(String versionId) {
        String url = creds.getBaseUrl() + "/rest/api/3/version/" + versionId + "/relatedIssueCounts";
        try {
            Map<String, Object> result = get(url, Map.class);
            return result != null ? result : Map.of();
        } catch (Exception e) {
            return Map.of("error", e.getMessage());
        }
    }

    // ── Agile (Scrum/Kanban) API ──────────────────────────────────────

    /**
     * Returns all Scrum/Kanban boards for a Jira project.
     * Uses the Agile REST API at /rest/agile/1.0/
     */
    @SuppressWarnings("unchecked")
    @Cacheable(value = "jira-boards", key = "#projectKey")
    public List<Map<String, Object>> getBoards(String projectKey) {
        String url = UriComponentsBuilder
                .fromHttpUrl(creds.getBaseUrl() + "/rest/agile/1.0/board")
                .queryParam("projectKeyOrId", projectKey)
                .queryParam("maxResults", 10)
                .toUriString();
        Map<String, Object> resp = get(url, Map.class);
        if (resp == null) return List.of();
        Object values = resp.get("values");
        return values instanceof List ? (List<Map<String, Object>>) values : List.of();
    }

    /** Returns the active sprint(s) for a board, or empty list if none. */
    @SuppressWarnings("unchecked")
    @Cacheable(value = "jira-active-sprints", key = "#boardId")
    public List<Map<String, Object>> getActiveSprints(long boardId) {
        String url = UriComponentsBuilder
                .fromHttpUrl(creds.getBaseUrl() + "/rest/agile/1.0/board/" + boardId + "/sprint")
                .queryParam("state", "active")
                .toUriString();
        Map<String, Object> resp = get(url, Map.class);
        if (resp == null) return List.of();
        Object values = resp.get("values");
        return values instanceof List ? (List<Map<String, Object>>) values : List.of();
    }

    /**
     * Returns ALL sprints for a board (active + closed + future), paginated.
     * Used to find which Jira sprint(s) overlap a given calendar sprint's date range.
     * Results are sorted by sprint start date descending (most recent first).
     */
    @SuppressWarnings("unchecked")
    @Cacheable(value = "jira-all-sprints", key = "#boardId")
    public List<Map<String, Object>> getAllSprints(long boardId) {
        List<Map<String, Object>> all = new ArrayList<>();
        int startAt = 0;
        while (true) {
            String url = UriComponentsBuilder
                    .fromHttpUrl(creds.getBaseUrl() + "/rest/agile/1.0/board/" + boardId + "/sprint")
                    .queryParam("state", "active,closed,future")
                    .queryParam("maxResults", 50)
                    .queryParam("startAt", startAt)
                    .toUriString();
            Map<String, Object> resp = get(url, Map.class);
            if (resp == null) break;
            Object values = resp.get("values");
            if (!(values instanceof List)) break;
            List<Map<String, Object>> page = (List<Map<String, Object>>) values;
            all.addAll(page);
            Object isLast = resp.get("isLast");
            if (Boolean.TRUE.equals(isLast) || page.isEmpty()) break;
            startAt += page.size();
        }
        return all;
    }

    /** Returns recent closed sprints for a board (for velocity calculation). */
    @SuppressWarnings("unchecked")
    @Cacheable(value = "jira-closed-sprints", key = "#boardId + '-' + #count")
    public List<Map<String, Object>> getClosedSprints(long boardId, int count) {
        String url = UriComponentsBuilder
                .fromHttpUrl(creds.getBaseUrl() + "/rest/agile/1.0/board/" + boardId + "/sprint")
                .queryParam("state", "closed")
                .queryParam("maxResults", count)
                .toUriString();
        Map<String, Object> resp = get(url, Map.class);
        if (resp == null) return List.of();
        Object values = resp.get("values");
        if (!(values instanceof List)) return List.of();
        // Jira returns oldest first — reverse so most recent is first
        List<Map<String, Object>> list = new ArrayList<>((List<Map<String, Object>>) values);
        Collections.reverse(list);
        return list;
    }

    /**
     * Returns all issues in a sprint that match the board's filter — using the board-scoped
     * endpoint so results exactly match what Jira's own sprint statistics show.
     *
     * Uses: GET /rest/agile/1.0/board/{boardId}/sprint/{sprintId}/issue
     * (not /sprint/{sprintId}/issue — that returns ALL issues regardless of board filter)
     *
     * @param boardId       the board whose filter should be applied
     * @param sprintId      the Jira sprint ID
     * @param boardSpField  the board's configured estimation field (e.g. "customfield_10062")
     */
    @SuppressWarnings("unchecked")
    @Cacheable(value = "jira-sprint-issues", key = "#boardId + '_' + #sprintId + '_' + #boardSpField")
    public List<Map<String, Object>> getSprintIssues(long boardId, long sprintId, String boardSpField) {
        // Always include the board-specific SP field plus common fallback variants
        String spFields = "customfield_10016,customfield_10028";
        if (boardSpField != null && !boardSpField.isBlank()
                && !boardSpField.equals("customfield_10016")
                && !boardSpField.equals("customfield_10028")) {
            spFields += "," + boardSpField;
        }
        List<Map<String, Object>> all = new ArrayList<>();
        int startAt = 0;
        int pageSize = 100;
        while (true) {
            // Board-scoped endpoint applies the board's saved filter automatically
            String url = UriComponentsBuilder
                    .fromHttpUrl(creds.getBaseUrl()
                            + "/rest/agile/1.0/board/" + boardId + "/sprint/" + sprintId + "/issue")
                    .queryParam("fields",
                            "summary,status,assignee,timespent,timeoriginalestimate,timeestimate," +
                            spFields + "," +
                            "story_points,issuetype,priority,labels,created,resolutiondate," +
                            "customfield_10014,parent," +
                            "fixVersions,components,worklog")
                    .queryParam("maxResults", pageSize)
                    .queryParam("startAt", startAt)
                    .toUriString();
            Map<String, Object> page = get(url, Map.class);
            if (page == null) break;
            Object issues = page.get("issues");
            if (!(issues instanceof List)) break;
            List<Map<String, Object>> batch = (List<Map<String, Object>>) issues;
            all.addAll(batch);
            int total = page.get("total") instanceof Number
                    ? ((Number) page.get("total")).intValue() : 0;
            startAt += batch.size();
            if (startAt >= total || batch.isEmpty()) break;
        }
        return all;
    }

    /**
     * Returns the board configuration, including the estimation field (story points field ID).
     * The path {@code estimation.field.fieldId} holds the custom field Jira uses for SP on this board.
     * Example: "customfield_10016" for classic boards, "customfield_10028" for next-gen.
     */
    @Cacheable(value = "jira-board-config", key = "#boardId")
    public Map<String, Object> getBoardConfiguration(long boardId) {
        String url = creds.getBaseUrl() + "/rest/agile/1.0/board/" + boardId + "/configuration";
        try {
            Map<String, Object> config = get(url, Map.class);
            if (config != null) {
                // Extract and log the estimation field for visibility
                Object est = config.get("estimation");
                if (est instanceof Map) {
                    Object field = ((Map<?,?>) est).get("field");
                    if (field instanceof Map) {
                        Object fieldId = ((Map<?,?>) field).get("fieldId");
                        log.info("Board {} estimation field: {}", boardId, fieldId);
                    }
                }
            }
            return config != null ? config : Map.of();
        } catch (Exception e) {
            log.debug("Could not fetch board configuration for boardId={}: {}", boardId, e.getMessage());
            return Map.of();
        }
    }

    /**
     * Returns the Jira sprint report from the Greenhopper API.
     * This is the authoritative source for sprint story-point totals — it matches
     * exactly what Jira's own board sprint statistics show.
     *
     * <p>Key fields (all under {@code contents}):
     * <ul>
     *   <li>{@code completedIssuesEstimateSum.value}    — done SP</li>
     *   <li>{@code issuesNotCompletedEstimateSum.value} — in-progress SP</li>
     *   <li>{@code puntedIssuesEstimateSum.value}       — SP of issues removed mid-sprint</li>
     *   <li>{@code allIssuesEstimateSum.value}           — all committed SP (including punted)</li>
     * </ul>
     *
     * <p>Formulas:
     * <pre>
     *   totalSP (current scope) = allIssuesEstimateSum   - puntedIssuesEstimateSum
     *   doneSP                  = completedIssuesEstimateSum
     * </pre>
     */
    @Cacheable(value = "jira-sprint-report", key = "#boardId + '_' + #sprintId")
    public Map<String, Object> getSprintReport(long boardId, long sprintId) {
        String url = creds.getBaseUrl()
                + "/rest/greenhopper/1.0/rapid/charts/sprintreport"
                + "?rapidViewId=" + boardId + "&sprintId=" + sprintId;
        // NOTE: intentionally NOT catching exceptions here so that:
        //  (a) Spring @Cacheable does NOT cache a failure (it only caches on success)
        //  (b) callers can decide how to handle failures (log + fallback vs. rethrow)
        Map<String, Object> report = get(url, Map.class);
        if (report == null) {
            // Throw instead of returning Map.of() — a null body should NOT be cached
            // as a successful "empty" sprint report; the caller will retry.
            throw new RuntimeException("Sprint report returned null/empty body for board=" + boardId + " sprint=" + sprintId);
        }
        log.debug("Sprint report fetched for board={}, sprint={}", boardId, sprintId);
        return report;
    }

    /**
     * Returns all fix versions (releases) defined for a Jira project.
     * Used to populate the release version picker in Release Settings.
     */
    @SuppressWarnings("unchecked")
    @Cacheable(value = "jira-fix-versions", key = "#projectKey")
    public List<Map<String, Object>> getFixVersions(String projectKey) {
        String url = creds.getBaseUrl() + "/rest/api/3/project/" + projectKey + "/versions";
        Object resp = get(url, List.class);
        return resp instanceof List ? (List<Map<String, Object>>) resp : List.of();
    }

    /**
     * Returns all non-subtask issues that belong to a given fix version
     * across one or more Jira project keys.
     *
     * <p>The {@code cacheKey} is a pre-built stable String (release DB id)
     * so Spring's {@code @Cacheable} can use a simple String key.
     *
     * <p>When {@code versionId} is supplied (the Jira numeric version ID), the JQL
     * uses {@code fixVersion = id} which Jira resolves without ambiguity and never
     * returns 404. Name-based lookup ({@code fixVersion = "name"}) is used as fallback
     * only when the ID is unknown.
     */
    @Cacheable(value = "jira-release-issues", key = "#cacheKey")
    public List<Map<String, Object>> getReleaseIssues(
            String cacheKey,
            List<String> projectKeys,
            String versionName,
            String versionId,
            String spFieldId) {

        // Include all commonly-used SP field IDs so extractSP() has the best chance of finding one
        java.util.LinkedHashSet<String> spSet = new java.util.LinkedHashSet<>(List.of(
                "customfield_10016", "customfield_10028", "customfield_10034",
                "customfield_10106", "customfield_10162"));
        if (spFieldId != null && !spFieldId.isBlank()) spSet.add(spFieldId);
        String spFields = String.join(",", spSet);
        String fields = "summary,status,assignee,issuetype,priority,fixVersions,timespent," + spFields;

        // Always use the version NAME in JQL (quoted) — Jira Cloud does not reliably
        // accept numeric version IDs in fixVersion JQL clauses. The name-based form
        // (e.g. fixVersion = "FY25 March 24th Release") is what works in the Jira UI.
        String quotedName = "\"" + versionName.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
        String fixVersionClause = "fixVersion = " + quotedName;

        String projectList = projectKeys.stream()
                .map(k -> "\"" + k + "\"")
                .collect(java.util.stream.Collectors.joining(","));

        // Use POST-based search to avoid URL-encoding issues with the version name.
        // Also omit issuetype JQL filters — subTaskIssueTypes() is a JQL function that
        // some Jira Cloud instances reject with 404; sub-tasks are filtered in Java below.
        String jql = "project in (" + projectList + ")"
                + " AND " + fixVersionClause
                + " ORDER BY status ASC";

        log.info("getReleaseIssues: versionName='{}' jql={}", versionName, jql);

        List<String> fieldList = java.util.Arrays.asList(fields.split(","));
        List<Map<String, Object>> issues;
        try {
            issues = searchIssuesPost(jql, fieldList, 500);
        } catch (RuntimeException e) {
            String msg = e.getMessage();
            if (msg != null && (msg.contains("404") || msg.contains("NOT_FOUND")
                    || msg.contains("does not exist"))) {
                // Last-resort fallback: drop project restriction
                log.warn("fixVersion '{}' 404'd in scope {} — trying unscoped", versionName, projectKeys);
                String unscopedJql = fixVersionClause + " ORDER BY status ASC";
                try {
                    issues = searchIssuesPost(unscopedJql, fieldList, 500);
                } catch (RuntimeException e2) {
                    log.warn("fixVersion '{}' not found anywhere: {}", versionName, e2.getMessage());
                    return List.of();
                }
            } else {
                throw e;
            }
        }

        // Filter out sub-tasks in Java (avoids JQL function compatibility issues)
        return issues.stream()
                .filter(issue -> {
                    Object fields2 = issue.get("fields");
                    if (!(fields2 instanceof Map)) return true;
                    Object issueType = ((Map<?, ?>) fields2).get("issuetype");
                    if (!(issueType instanceof Map)) return true;
                    Object subtask = ((Map<?, ?>) issueType).get("subtask");
                    // Keep issue if subtask flag is absent or false
                    return !Boolean.TRUE.equals(subtask);
                })
                .collect(java.util.stream.Collectors.toList());
    }

    /**
     * Returns all Jira Service Management service desks accessible to the configured account.
     * Uses the Service Desk API — the Agile board API does not return JSM boards.
     * Used for the support board configuration picker.
     */
    @SuppressWarnings("unchecked")
    @Cacheable("jira-all-boards")
    public List<Map<String, Object>> getAllBoards() {
        List<Map<String, Object>> all = new ArrayList<>();
        int startAt = 0;
        while (true) {
            String url = UriComponentsBuilder
                    .fromHttpUrl(creds.getBaseUrl() + "/rest/servicedeskapi/servicedesk")
                    .queryParam("limit", 50)
                    .queryParam("start", startAt)
                    .toUriString();
            Map<String, Object> resp = get(url, Map.class);
            if (resp == null) break;
            Object values = resp.get("values");
            if (!(values instanceof List)) break;
            List<Map<String, Object>> batch = (List<Map<String, Object>>) values;
            all.addAll(batch);
            // JSM API uses "isLastPage" (not "isLast")
            boolean isLast = Boolean.TRUE.equals(resp.get("isLastPage"));
            startAt += batch.size();
            if (isLast || batch.isEmpty()) break;
        }
        return all;
    }

    /**
     * Fetches all non-Done issues from a Jira Service Management service desk.
     * The serviceDeskId is the numeric JSM service desk ID.
     * Resolves the project key first, then delegates to {@link #searchIssuesPost}
     * which uses POST with a JSON body — avoiding any URL-encoding / % issues
     * that the GET query-param approach causes with the new /search/jql endpoint.
     */
    /**
     * Fetches open issues for a support board using three strategies in priority order:
     * <ol>
     *   <li><b>Project key + Queue ID</b> — resolves the service-desk ID, fetches the
     *       queue's own JQL from {@code /servicedesk/{sdId}/queue/{queueId}}, and runs
     *       that query. This mirrors exactly what the team sees in the Jira queue.</li>
     *   <li><b>Project key only</b> — queries all non-Done issues for the project:
     *       {@code project = KEY AND statusCategory != Done}.</li>
     *   <li><b>Legacy board ID</b> — resolves the project key from a numeric service-desk
     *       ID (backward-compat for boards created before project-key support).</li>
     * </ol>
     */
    public List<Map<String, Object>> getSupportBoardIssues(Long boardId,
                                                            String projectKey,
                                                            Long queueId) {
        List<String> fields = List.of("summary", "status", "priority", "reporter", "assignee",
                "created", "updated", "statuscategorychangedate", "comment", "labels");

        // ── Strategy 1: project key + queue ID ──────────────────────────────────
        if (projectKey != null && !projectKey.isBlank() && queueId != null) {
            try {
                long sdId = getServiceDeskIdForProject(projectKey);
                String queueJql = getQueueJql(sdId, queueId);
                if (queueJql != null && !queueJql.isBlank()) {
                    log.info("Support board {}/{}: using queue JQL: {}", projectKey, queueId, queueJql);
                    return searchIssuesPost(queueJql, fields, 500);
                }
            } catch (Exception e) {
                log.warn("Queue JQL fetch failed for project={} queue={}: {} — falling back to project JQL",
                        projectKey, queueId, e.getMessage());
            }
            // Queue JQL unavailable — fall through to project-only query
        }

        // ── Strategy 2: project key only ────────────────────────────────────────
        if (projectKey != null && !projectKey.isBlank()) {
            String jql = "project = \"" + projectKey + "\" AND statusCategory != Done ORDER BY created DESC";
            log.info("Support board {}: using project JQL", projectKey);
            return searchIssuesPost(jql, fields, 500);
        }

        // ── Strategy 3: legacy service-desk ID ──────────────────────────────────
        if (boardId != null && boardId > 0) {
            String key = resolveServiceDeskProjectKey(boardId);
            if (key == null || key.isBlank()) {
                throw new RuntimeException(
                        "Could not resolve project key for service desk " + boardId
                        + ". Please reconfigure this board using a Jira project key (e.g. \"AC\").");
            }
            String jql = "project = \"" + key + "\" AND statusCategory != Done ORDER BY created DESC";
            return searchIssuesPost(jql, fields, 500);
        }

        throw new RuntimeException("Support board has no project key or board ID configured.");
    }

    /**
     * Fetches ALL tickets for a support board across all statuses (including Done/Resolved).
     * Used for historical analysis. Limited to issues updated within the last {@code days} days
     * to keep response size manageable (default 90 days).
     * <p>Unlike {@link #getSupportBoardIssues}, this method does NOT filter by statusCategory.
     */
    public List<Map<String, Object>> getAllSupportBoardIssues(Long boardId,
                                                              String projectKey,
                                                              Long queueId,
                                                              int days) {
        List<String> fields = List.of("summary", "status", "priority", "reporter", "assignee",
                "created", "updated", "statuscategorychangedate", "comment", "labels",
                "resolutiondate", "resolution");

        // Resolve project key from boardId if needed
        String key = projectKey;
        if ((key == null || key.isBlank()) && boardId != null && boardId > 0) {
            key = resolveServiceDeskProjectKey(boardId);
        }
        if (key == null || key.isBlank()) {
            throw new RuntimeException("Support board has no project key or board ID configured.");
        }

        // Fetch all statuses, constrained to recent activity to limit data volume
        String jql = "project = \"" + key + "\" AND updated >= \"-" + days + "d\" ORDER BY updated DESC";
        log.info("getAllSupportBoardIssues for project={}, last {} days", key, days);
        return searchIssuesPost(jql, fields, 2000);
    }

    /**
     * Resolves the numeric JSM service-desk ID for a project key by scanning
     * the cached list returned by {@link #getAllBoards()}.
     */
    public long getServiceDeskIdForProject(String projectKey) {
        for (Map<String, Object> sd : getAllBoards()) {
            Object pk = sd.get("projectKey");
            if (projectKey.equalsIgnoreCase(pk instanceof String ? (String) pk : null)) {
                Object idObj = sd.get("id");
                if (idObj instanceof Number) return ((Number) idObj).longValue();
            }
        }
        throw new RuntimeException("No JSM service desk found for project key: " + projectKey);
    }

    /**
     * Fetches the JQL string for a specific JSM queue.
     * {@code GET /rest/servicedeskapi/servicedesk/{sdId}/queue/{queueId}}
     */
    @SuppressWarnings("unchecked")
    public String getQueueJql(long serviceDeskId, long queueId) {
        String url = creds.getBaseUrl()
                + "/rest/servicedeskapi/servicedesk/" + serviceDeskId
                + "/queue/" + queueId;
        try {
            Map<String, Object> resp = get(url, Map.class);
            if (resp == null) return null;
            Object jql = resp.get("jql");
            return jql instanceof String ? (String) jql : null;
        } catch (Exception e) {
            log.warn("getQueueJql failed for sd={} queue={}: {}", serviceDeskId, queueId, e.getMessage());
            return null;
        }
    }

    /**
     * Returns the Jira project key for a given JSM service desk ID.
     * <ol>
     *   <li>Tries the direct {@code /rest/servicedeskapi/servicedesk/{id}} endpoint.</li>
     *   <li>If that fails, scans {@link #getAllBoards()} (which is already cached) for the
     *       matching service desk and reads its {@code projectKey} from there.</li>
     * </ol>
     * This two-step approach handles cases where the direct API is unavailable or returns
     * an unexpected response (e.g., permissions, API deprecation, token scope issues).
     */
    @Cacheable(value = "jira-support-issues", key = "'projectKey-' + #serviceDeskId")
    public String resolveServiceDeskProjectKey(long serviceDeskId) {
        // --- Step 1: direct single-desk API ---
        try {
            String sdUrl = creds.getBaseUrl() + "/rest/servicedeskapi/servicedesk/" + serviceDeskId;
            Map<String, Object> sd = get(sdUrl, Map.class);
            if (sd != null) {
                Object rawKey = sd.get("projectKey");
                if (rawKey instanceof String && !((String) rawKey).isBlank()) return (String) rawKey;
                // Some JSM versions nest it under "project": { "key": "..." }
                Object projectObj = sd.get("project");
                if (projectObj instanceof Map) {
                    Object key = ((Map<?, ?>) projectObj).get("key");
                    if (key instanceof String && !((String) key).isBlank()) return (String) key;
                }
            }
        } catch (Exception e) {
            log.warn("Direct service-desk lookup failed for id={}: {} — trying all-boards fallback.",
                    serviceDeskId, e.getMessage());
        }

        // --- Step 2: scan the full list (cached from settings page load) ---
        try {
            for (Map<String, Object> sd : getAllBoards()) {
                Object idObj = sd.get("id");
                long id = idObj instanceof Number ? ((Number) idObj).longValue() : -1L;
                if (id == serviceDeskId) {
                    Object rawKey = sd.get("projectKey");
                    if (rawKey instanceof String && !((String) rawKey).isBlank()) return (String) rawKey;
                }
            }
        } catch (Exception e) {
            log.warn("getAllBoards fallback also failed: {}", e.getMessage());
        }

        return null;
    }

    /**
     * Returns the number of issues matching the given JQL.
     * Delegates to {@link #searchIssuesPost} — the same POST-based method used to
     * fetch open support tickets — so it uses exactly the same transport that is
     * already known to work.  Only {@code "id"} is requested per issue to keep the
     * payload small.  A cap of 500 is sufficient for any single calendar month's
     * ticket volume on a support board.
     */
    public int countIssues(String jql) {
        try {
            return searchIssuesPost(jql, List.of("id"), 500).size();
        } catch (Exception e) {
            log.warn("countIssues failed for JQL '{}': {}", jql, e.getMessage());
            return 0;
        }
    }

    /**
     * Returns issues in a board backlog (sprint = null) — used for backlog sizing.
     */
    @SuppressWarnings("unchecked")
    @Cacheable(value = "jira-backlog", key = "#boardId")
    public List<Map<String, Object>> getBacklogIssues(long boardId) {
        String url = UriComponentsBuilder
                .fromHttpUrl(creds.getBaseUrl() + "/rest/agile/1.0/board/" + boardId + "/backlog")
                .queryParam("fields", "summary,status,assignee,customfield_10016,issuetype")
                .queryParam("maxResults", 200)
                .toUriString();
        Map<String, Object> resp = get(url, Map.class);
        if (resp == null) return List.of();
        Object issues = resp.get("issues");
        return issues instanceof List ? (List<Map<String, Object>>) issues : List.of();
    }

    // ── Cache management ──────────────────────────────────────────────

    /**
     * Evicts all Jira caches so the next calls re-fetch live data from Jira.
     * Called from POST /api/jira/cache/clear.
     */
    @Caching(evict = {
        @CacheEvict(value = "jira-projects",         allEntries = true),
        @CacheEvict(value = "jira-boards",           allEntries = true),
        @CacheEvict(value = "jira-epics",            allEntries = true),
        @CacheEvict(value = "jira-epics-from-board", allEntries = true),
        @CacheEvict(value = "jira-labels",           allEntries = true),
        @CacheEvict(value = "jira-active-sprints",   allEntries = true),
        @CacheEvict(value = "jira-closed-sprints",   allEntries = true),
        @CacheEvict(value = "jira-all-sprints",      allEntries = true),
        @CacheEvict(value = "jira-sprint-issues",    allEntries = true),
        @CacheEvict(value = "jira-backlog",          allEntries = true),
        @CacheEvict(value = "jira-board-config",     allEntries = true),
        @CacheEvict(value = "jira-sprint-report",    allEntries = true),
        @CacheEvict(value = "jira-fix-versions",      allEntries = true),
        @CacheEvict(value = "jira-release-issues",    allEntries = true),
        @CacheEvict(value = "jira-all-boards",        allEntries = true),
        @CacheEvict(value = "jira-support-issues",    allEntries = true),
    })
    public void evictAllCaches() {
        log.info("All Jira caches evicted");
    }

    // ── Custom fields ─────────────────────────────────────────────────

    /**
     * Returns all Jira fields (system + custom). Used to discover the field ID
     * for IDS/NON-IDS CapEx tagging.
     *
     * <p>Intentionally NOT cached with @Cacheable — the Spring cache has no TTL
     * by default, so a single failed/empty call would poison the cache for the
     * lifetime of the process. React Query on the frontend handles client-side
     * caching instead (fetches fresh each time the settings modal is opened).
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getFields() {
        String url = creds.getBaseUrl() + "/rest/api/3/field";
        Object resp = get(url, List.class);
        if (resp instanceof List) return (List<Map<String, Object>>) resp;
        return List.of();
    }

    // ── Connection test ───────────────────────────────────────────────

    /**
     * Quick connectivity check — returns the raw response body as a String,
     * or throws a RuntimeException describing what went wrong.
     */
    public String testConnection() {
        String url = creds.getBaseUrl() + "/rest/api/3/myself";
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(creds.getEmail(), creds.getApiToken(), StandardCharsets.UTF_8);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        ResponseEntity<String> resp = restTemplate.exchange(
                url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
        return resp.getBody();
    }

    // ── HTTP ──────────────────────────────────────────────────────────

    private <T> T post(String url, Object body, Class<T> responseType) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBasicAuth(creds.getEmail(), creds.getApiToken(), StandardCharsets.UTF_8);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<T> resp = restTemplate.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(body, headers), responseType);
            return resp.getBody();
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("Jira API POST HTTP {} [{}]: {}", e.getStatusCode(), url, e.getResponseBodyAsString());
            throw new RuntimeException("Jira API error " + e.getStatusCode() + ": " + e.getResponseBodyAsString(), e);
        } catch (org.springframework.web.client.ResourceAccessException e) {
            log.error("Jira API POST connection failed [{}]: {}", url, e.getMessage());
            throw new RuntimeException("Cannot reach Jira at " + creds.getBaseUrl() + ": " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Jira API POST call failed [{}]: {}", url, e.getMessage(), e);
            throw new RuntimeException("Jira API call failed: " + e.getMessage(), e);
        }
    }

    private <T> T get(String url, Class<T> responseType) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBasicAuth(creds.getEmail(), creds.getApiToken(), StandardCharsets.UTF_8);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));

            ResponseEntity<T> resp = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), responseType);
            return resp.getBody();
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("Jira API HTTP {} [{}]: {}", e.getStatusCode(), url, e.getResponseBodyAsString());
            throw new RuntimeException("Jira API error " + e.getStatusCode() + ": " + e.getResponseBodyAsString(), e);
        } catch (org.springframework.web.client.ResourceAccessException e) {
            log.error("Jira API connection failed [{}]: {}", url, e.getMessage());
            throw new RuntimeException("Cannot reach Jira at " + creds.getBaseUrl() + ": " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Jira API call failed [{}]: {}", url, e.getMessage(), e);
            throw new RuntimeException("Jira API call failed: " + e.getMessage(), e);
        }
    }
}
