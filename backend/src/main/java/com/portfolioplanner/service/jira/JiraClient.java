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
