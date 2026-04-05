package com.portfolioplanner.service.azuredevops;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.portfolioplanner.domain.model.AzureDevOpsSettings;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.Base64;

/**
 * Thin HTTP client for the Azure DevOps REST API (api-version=7.1).
 *
 * Authentication: Basic auth with an empty username and the configured PAT.
 * Base URL pattern: {orgUrl}/{project}/_apis/{area}
 */
@Service
@RequiredArgsConstructor
public class AzureDevOpsClient {

    private final AzureDevOpsSettingsService settingsService;
    private final RestTemplate              restTemplate;

    // ── Internal DTOs ─────────────────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AdoIdentity(
        @JsonProperty("displayName") String displayName,
        @JsonProperty("uniqueName")  String uniqueName
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AdoPrReviewer(
        @JsonProperty("displayName") String displayName,
        @JsonProperty("vote")        int    vote   // 10=approved, 5=approved-with-suggestions, 0=no vote, -5=waiting, -10=rejected
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AdoPullRequest(
        @JsonProperty("pullRequestId") long   pullRequestId,
        @JsonProperty("title")         String title,
        @JsonProperty("status")        String status,
        @JsonProperty("createdBy")     AdoIdentity createdBy,
        @JsonProperty("reviewers")     List<AdoPrReviewer> reviewers,
        @JsonProperty("creationDate")  OffsetDateTime creationDate,
        @JsonProperty("closedDate")    OffsetDateTime closedDate,
        @JsonProperty("repository")    AdoRepo repository
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AdoRepo(
        @JsonProperty("id")   String id,
        @JsonProperty("name") String name
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AdoCommit(
        @JsonProperty("commitId")  String commitId,
        @JsonProperty("author")    AdoCommitAuthor author,
        @JsonProperty("comment")   String comment,
        @JsonProperty("remoteUrl") String remoteUrl
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AdoCommitAuthor(
        @JsonProperty("name")  String name,
        @JsonProperty("email") String email,
        @JsonProperty("date")  OffsetDateTime date
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AdoRef(
        @JsonProperty("name")          String name,
        @JsonProperty("objectId")      String objectId,
        @JsonProperty("creator")       AdoIdentity creator,
        @JsonProperty("statuses")      List<Object> statuses
    ) {}

    /** Wraps the ADO list response envelope { value: [...], count: N } */
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class AdoList<T> {
        public List<T> value;
        public int     count;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Fetch completed PRs for a single repo within a date window.
     * ADO returns up to $top results; we cap at 200 per repo per call.
     */
    public List<AdoPullRequest> getPullRequests(String repoName,
                                                 OffsetDateTime from,
                                                 OffsetDateTime to) {
        AzureDevOpsSettings s = requireSettings();
        String url = UriComponentsBuilder
                .fromHttpUrl(base(s) + "/git/repositories/{repo}/pullrequests")
                .queryParam("searchCriteria.status", "completed")
                .queryParam("searchCriteria.minTime", from.toString())
                .queryParam("searchCriteria.maxTime", to.toString())
                .queryParam("$top", 200)
                .queryParam("api-version", "7.1")
                .buildAndExpand(repoName)
                .toUriString();

        @SuppressWarnings("unchecked")
        AdoList<AdoPullRequest> resp = get(url, (Class<AdoList<AdoPullRequest>>)(Class<?>)AdoList.class);
        return resp == null || resp.value == null ? List.of() : resp.value;
    }

    /**
     * Fetch commits for a single repo within a date window.
     */
    public List<AdoCommit> getCommits(String repoName,
                                       OffsetDateTime from,
                                       OffsetDateTime to) {
        AzureDevOpsSettings s = requireSettings();
        String url = UriComponentsBuilder
                .fromHttpUrl(base(s) + "/git/repositories/{repo}/commits")
                .queryParam("searchCriteria.fromDate", from.toString())
                .queryParam("searchCriteria.toDate",   to.toString())
                .queryParam("$top", 500)
                .queryParam("api-version", "7.1")
                .buildAndExpand(repoName)
                .toUriString();

        @SuppressWarnings("unchecked")
        AdoList<AdoCommit> resp = get(url, (Class<AdoList<AdoCommit>>)(Class<?>)AdoList.class);
        return resp == null || resp.value == null ? List.of() : resp.value;
    }

    /**
     * List all branches (refs/heads) for a repo.
     */
    public List<AdoRef> getBranches(String repoName) {
        AzureDevOpsSettings s = requireSettings();
        String url = UriComponentsBuilder
                .fromHttpUrl(base(s) + "/git/repositories/{repo}/refs")
                .queryParam("filter", "heads/")
                .queryParam("$top", 300)
                .queryParam("api-version", "7.1")
                .buildAndExpand(repoName)
                .toUriString();

        @SuppressWarnings("unchecked")
        AdoList<AdoRef> resp = get(url, (Class<AdoList<AdoRef>>)(Class<?>)AdoList.class);
        return resp == null || resp.value == null ? List.of() : resp.value;
    }

    /**
     * Test the connection — calls the project endpoint and returns the project name on success.
     * Throws an exception on auth failure / not found.
     */
    public String testConnection() {
        AzureDevOpsSettings s = requireSettings();
        String url = s.getOrgUrl().replaceAll("/+$", "") + "/_apis/projects/"
                + s.getProjectName() + "?api-version=7.1";
        @SuppressWarnings("rawtypes")
        Map resp = get(url, Map.class);
        return resp != null ? String.valueOf(resp.getOrDefault("name", "OK")) : "OK";
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String base(AzureDevOpsSettings s) {
        return s.getOrgUrl().replaceAll("/+$", "") + "/" + s.getProjectName() + "/_apis";
    }

    private HttpHeaders headers() {
        AzureDevOpsSettings s = requireSettings();
        String raw   = ":" + s.getPersonalAccessToken();
        String b64   = Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
        HttpHeaders h = new HttpHeaders();
        h.set(HttpHeaders.AUTHORIZATION, "Basic " + b64);
        h.setAccept(List.of(MediaType.APPLICATION_JSON));
        return h;
    }

    private <T> T get(String url, Class<T> type) {
        ResponseEntity<T> resp = restTemplate.exchange(
                url, HttpMethod.GET, new HttpEntity<>(headers()), type);
        return resp.getBody();
    }

    private AzureDevOpsSettings requireSettings() {
        return settingsService.get()
                .filter(AzureDevOpsSettings::isConfigured)
                .orElseThrow(() -> new IllegalStateException(
                        "Azure DevOps is not configured. Go to Admin → Azure DevOps Settings."));
    }

    // ── Derived metric helpers (reused in controller) ─────────────────────────

    /**
     * Review cycle time in hours: from PR creation to close date.
     * Returns null if closedDate is absent.
     */
    public static Double reviewCycleHours(AdoPullRequest pr) {
        if (pr.closedDate() == null || pr.creationDate() == null) return null;
        return (double) Duration.between(pr.creationDate(), pr.closedDate()).toMinutes() / 60.0;
    }
}
