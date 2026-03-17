package com.portfolioplanner.service.jira;

import com.portfolioplanner.config.JiraProperties;
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
     * Uses issue search with issuetype=Epic.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getEpics(String projectKey) {
        String jql = "project = \"" + projectKey + "\" AND issuetype = Epic ORDER BY created DESC";
        return searchIssues(jql, "summary,status,labels,assignee", 200);
    }

    // ── Labels ────────────────────────────────────────────────────────

    /** Returns all distinct labels used in a project. */
    @SuppressWarnings("unchecked")
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
     * Returns all issues in a sprint with fields needed for POD metrics.
     * Uses the Agile sprint issues endpoint.
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getSprintIssues(long sprintId) {
        List<Map<String, Object>> all = new ArrayList<>();
        int startAt = 0;
        int pageSize = 100;
        while (true) {
            String url = UriComponentsBuilder
                    .fromHttpUrl(props.getBaseUrl() + "/rest/agile/1.0/sprint/" + sprintId + "/issue")
                    .queryParam("fields",
                            "summary,status,assignee,timespent,timeoriginalestimate," +
                            "customfield_10016,story_points,issuetype,created,resolutiondate")
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
     * Returns issues in a board backlog (sprint = null) — used for backlog sizing.
     */
    @SuppressWarnings("unchecked")
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
