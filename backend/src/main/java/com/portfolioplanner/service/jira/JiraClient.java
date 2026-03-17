package com.portfolioplanner.service.jira;

import com.portfolioplanner.config.JiraProperties;
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

    private final JiraProperties props;
    private final RestTemplate restTemplate;

    // ── Projects ──────────────────────────────────────────────────────

    /** Returns all Jira projects visible to the configured account. */
    @SuppressWarnings("unchecked")
    @Cacheable("jira-projects")
    public List<Map<String, Object>> getProjects() {
        String url = UriComponentsBuilder
                .fromHttpUrl(props.getBaseUrl() + "/rest/api/3/project/search")
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
            List<Map<String, Object>> issues = searchIssues(jql, "summary,status,labels,assignee,customfield_10014", 200);
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
                    .fromHttpUrl(props.getBaseUrl() + "/rest/agile/1.0/board/" + boardId + "/epic")
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
                .fromHttpUrl(props.getBaseUrl() + "/rest/api/3/label")
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
        return searchIssues(jql, "summary,assignee,timespent,timeoriginalestimate,"
                + "story_points,customfield_10016,status,created,resolutiondate,labels", 500);
    }

    public List<Map<String, Object>> getIssuesByLabel(String projectKey, String label) {
        String jql = "project = \"" + projectKey + "\""
                + " AND issuetype != Epic"
                + " AND labels = \"" + label.replace("\"", "\\\"") + "\""
                + " ORDER BY updated DESC";
        return searchIssues(jql, "summary,assignee,timespent,timeoriginalestimate,"
                + "story_points,customfield_10016,status,created,resolutiondate,labels", 500);
    }

    public List<Map<String, Object>> getIssuesByEpicLink(String projectKey, String epicKey) {
        // Jira Cloud: parent = epicKey for sub-tasks/stories linked to an epic
        String jql = "project = \"" + projectKey + "\""
                + " AND issuetype != Epic"
                + " AND (\"Epic Link\" = \"" + epicKey + "\" OR parent = \"" + epicKey + "\")"
                + " ORDER BY updated DESC";
        return searchIssues(jql, "summary,assignee,timespent,timeoriginalestimate,"
                + "story_points,customfield_10016,status,created,resolutiondate,labels,parent", 500);
    }

    /**
     * Fetches all worklogs for an issue (actual time entries per person).
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getWorklogs(String issueKey) {
        String url = props.getBaseUrl() + "/rest/api/3/issue/" + issueKey + "/worklog";
        Map<String, Object> resp = get(url, Map.class);
        if (resp == null) return List.of();
        Object worklogs = resp.get("worklogs");
        return worklogs instanceof List ? (List<Map<String, Object>>) worklogs : List.of();
    }

    // ── Resources / Members ───────────────────────────────────────────

    /** Returns all members of a Jira project (for name matching against PP resources). */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getProjectMembers(String projectKey) {
        String url = UriComponentsBuilder
                .fromHttpUrl(props.getBaseUrl() + "/rest/api/3/user/assignable/multiProjectSearch")
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
                    .fromHttpUrl(props.getBaseUrl() + "/rest/api/3/issue/search")
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

    // ── Agile (Scrum/Kanban) API ──────────────────────────────────────

    /**
     * Returns all Scrum/Kanban boards for a Jira project.
     * Uses the Agile REST API at /rest/agile/1.0/
     */
    @SuppressWarnings("unchecked")
    @Cacheable(value = "jira-boards", key = "#projectKey")
    public List<Map<String, Object>> getBoards(String projectKey) {
        String url = UriComponentsBuilder
                .fromHttpUrl(props.getBaseUrl() + "/rest/agile/1.0/board")
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
                .fromHttpUrl(props.getBaseUrl() + "/rest/agile/1.0/board/" + boardId + "/sprint")
                .queryParam("state", "active")
                .toUriString();
        Map<String, Object> resp = get(url, Map.class);
        if (resp == null) return List.of();
        Object values = resp.get("values");
        return values instanceof List ? (List<Map<String, Object>>) values : List.of();
    }

    /** Returns recent closed sprints for a board (for velocity calculation). */
    @SuppressWarnings("unchecked")
    @Cacheable(value = "jira-closed-sprints", key = "#boardId + '-' + #count")
    public List<Map<String, Object>> getClosedSprints(long boardId, int count) {
        String url = UriComponentsBuilder
                .fromHttpUrl(props.getBaseUrl() + "/rest/agile/1.0/board/" + boardId + "/sprint")
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
                    .fromHttpUrl(props.getBaseUrl()
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
        String url = props.getBaseUrl() + "/rest/agile/1.0/board/" + boardId + "/configuration";
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
     * Returns issues in a board backlog (sprint = null) — used for backlog sizing.
     */
    @SuppressWarnings("unchecked")
    @Cacheable(value = "jira-backlog", key = "#boardId")
    public List<Map<String, Object>> getBacklogIssues(long boardId) {
        String url = UriComponentsBuilder
                .fromHttpUrl(props.getBaseUrl() + "/rest/agile/1.0/board/" + boardId + "/backlog")
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
        @CacheEvict(value = "jira-sprint-issues",    allEntries = true),
        @CacheEvict(value = "jira-backlog",          allEntries = true),
        @CacheEvict(value = "jira-board-config",     allEntries = true),
    })
    public void evictAllCaches() {
        log.info("All Jira caches evicted");
    }

    // ── Connection test ───────────────────────────────────────────────

    /**
     * Quick connectivity check — returns the raw response body as a String,
     * or throws a RuntimeException describing what went wrong.
     */
    public String testConnection() {
        String url = props.getBaseUrl() + "/rest/api/3/myself";
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(props.getEmail(), props.getApiToken(), StandardCharsets.UTF_8);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        ResponseEntity<String> resp = restTemplate.exchange(
                url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
        return resp.getBody();
    }

    // ── HTTP ──────────────────────────────────────────────────────────

    private <T> T get(String url, Class<T> responseType) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBasicAuth(props.getEmail(), props.getApiToken(), StandardCharsets.UTF_8);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));

            ResponseEntity<T> resp = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), responseType);
            return resp.getBody();
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("Jira API HTTP {} [{}]: {}", e.getStatusCode(), url, e.getResponseBodyAsString());
            throw new RuntimeException("Jira API error " + e.getStatusCode() + ": " + e.getResponseBodyAsString(), e);
        } catch (org.springframework.web.client.ResourceAccessException e) {
            log.error("Jira API connection failed [{}]: {}", url, e.getMessage());
            throw new RuntimeException("Cannot reach Jira at " + props.getBaseUrl() + ": " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Jira API call failed [{}]: {}", url, e.getMessage(), e);
            throw new RuntimeException("Jira API call failed: " + e.getMessage(), e);
        }
    }
}
