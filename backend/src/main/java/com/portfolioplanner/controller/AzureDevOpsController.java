package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AzureDevOpsSettings;
import com.portfolioplanner.service.azuredevops.AzureDevOpsClient;
import com.portfolioplanner.service.azuredevops.AzureDevOpsClient.*;
import com.portfolioplanner.service.azuredevops.AzureDevOpsSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/azure-devops")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class AzureDevOpsController {

    private final AzureDevOpsSettingsService settingsService;
    private final AzureDevOpsClient          adoClient;

    // ════════════════════════════════════════════════════════════════════
    // SETTINGS
    // ════════════════════════════════════════════════════════════════════

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/settings")
    public ResponseEntity<SettingsResponse> getSettings() {
        Optional<AzureDevOpsSettings> s = settingsService.get();
        return ResponseEntity.ok(s.map(v -> new SettingsResponse(
                v.getOrgUrl(),
                v.getProjectName(),
                v.getPersonalAccessToken() != null && !v.getPersonalAccessToken().isBlank() ? "••••••••" : "",
                v.getRepositories(),
                v.isConfigured()
        )).orElse(new SettingsResponse("", "", "", "", false)));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/settings")
    public ResponseEntity<Map<String, Object>> saveSettings(@RequestBody SaveSettingsRequest req) {
        settingsService.save(req.orgUrl(), req.projectName(), req.personalAccessToken(), req.repositories());
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/settings/test")
    public ResponseEntity<Map<String, Object>> testConnection() {
        if (!settingsService.isConfigured()) {
            return ResponseEntity.ok(Map.of("ok", false, "error", "Azure DevOps not configured"));
        }
        try {
            String project = adoClient.testConnection();
            return ResponseEntity.ok(Map.of("ok", true, "project", project));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("ok", false, "error", e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // STATUS
    // ════════════════════════════════════════════════════════════════════

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        boolean configured = settingsService.isConfigured();
        List<String> repos = settingsService.get()
                .map(AzureDevOpsSettings::repoList)
                .orElse(List.of());
        return ResponseEntity.ok(Map.of(
                "configured", configured,
                "repos", repos
        ));
    }

    // ════════════════════════════════════════════════════════════════════
    // PULL REQUESTS
    // ════════════════════════════════════════════════════════════════════

    @GetMapping("/prs")
    public ResponseEntity<List<PrResponse>> getPrs(
            @RequestParam(required = false) String repo,
            @RequestParam(defaultValue = "90") int days) {

        OffsetDateTime to   = OffsetDateTime.now();
        OffsetDateTime from = to.minusDays(days);

        List<String> repos = resolveRepos(repo);
        List<PrResponse> results = new ArrayList<>();

        for (String r : repos) {
            try {
                List<AdoPullRequest> prs = adoClient.getPullRequests(r, from, to);
                for (AdoPullRequest pr : prs) {
                    Double cycleHours = AzureDevOpsClient.reviewCycleHours(pr);
                    List<String> reviewerNames = pr.reviewers() == null ? List.of()
                            : pr.reviewers().stream()
                                .map(rv -> rv.displayName())
                                .filter(Objects::nonNull)
                                .toList();
                    results.add(new PrResponse(
                            pr.pullRequestId(),
                            pr.title(),
                            pr.status(),
                            pr.createdBy() != null ? pr.createdBy().displayName() : "Unknown",
                            reviewerNames,
                            pr.creationDate() != null ? pr.creationDate().toLocalDate().toString() : null,
                            pr.closedDate()   != null ? pr.closedDate().toLocalDate().toString()   : null,
                            cycleHours != null ? Math.round(cycleHours * 10.0) / 10.0 : null,
                            r
                    ));
                }
            } catch (Exception e) {
                // Skip repos that fail (e.g. name mismatch) rather than killing the whole call
            }
        }

        // Sort newest first
        results.sort(Comparator.comparing(PrResponse::createdDate,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return ResponseEntity.ok(results);
    }

    // ════════════════════════════════════════════════════════════════════
    // COMMITS
    // ════════════════════════════════════════════════════════════════════

    @GetMapping("/commits")
    public ResponseEntity<CommitSummaryResponse> getCommits(
            @RequestParam(required = false) String repo,
            @RequestParam(defaultValue = "90") int days) {

        OffsetDateTime to   = OffsetDateTime.now();
        OffsetDateTime from = to.minusDays(days);

        List<String> repos = resolveRepos(repo);

        // author → daily buckets
        Map<String, Map<String, Integer>> byAuthorByDay = new LinkedHashMap<>();
        // date → total commits
        Map<String, Integer> byDay = new TreeMap<>();
        int total = 0;
        Set<String> authors = new LinkedHashSet<>();

        for (String r : repos) {
            try {
                List<AdoCommit> commits = adoClient.getCommits(r, from, to);
                for (AdoCommit c : commits) {
                    if (c.author() == null) continue;
                    String author = c.author().name() != null ? c.author().name() : "Unknown";
                    String day    = c.author().date() != null
                            ? c.author().date().toLocalDate().toString() : "unknown";

                    authors.add(author);
                    byAuthorByDay.computeIfAbsent(author, k -> new TreeMap<>())
                                 .merge(day, 1, Integer::sum);
                    byDay.merge(day, 1, Integer::sum);
                    total++;
                }
            } catch (Exception ignored) {}
        }

        // Flatten into per-author daily series
        List<AuthorSeries> series = byAuthorByDay.entrySet().stream()
                .map(e -> new AuthorSeries(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingInt((AuthorSeries a) ->
                        a.byDay().values().stream().mapToInt(Integer::intValue).sum()).reversed())
                .toList();

        // Flatten daily totals
        List<DayCount> dailyTotals = byDay.entrySet().stream()
                .map(e -> new DayCount(e.getKey(), e.getValue()))
                .toList();

        return ResponseEntity.ok(new CommitSummaryResponse(
                total, authors.size(), dailyTotals, series
        ));
    }

    // ════════════════════════════════════════════════════════════════════
    // BRANCHES
    // ════════════════════════════════════════════════════════════════════

    @GetMapping("/branches")
    public ResponseEntity<List<BranchResponse>> getBranches(
            @RequestParam(required = false) String repo) {

        List<String> repos = resolveRepos(repo);
        List<BranchResponse> result = new ArrayList<>();

        for (String r : repos) {
            try {
                List<AdoRef> refs = adoClient.getBranches(r);
                for (AdoRef ref : refs) {
                    // Strip "refs/heads/" prefix for display
                    String name = ref.name() != null
                            ? ref.name().replaceFirst("^refs/heads/", "")
                            : ref.name();
                    result.add(new BranchResponse(
                            name,
                            r,
                            ref.creator() != null ? ref.creator().displayName() : null
                    ));
                }
            } catch (Exception ignored) {}
        }

        result.sort(Comparator.comparing(BranchResponse::name));
        return ResponseEntity.ok(result);
    }

    // ════════════════════════════════════════════════════════════════════
    // SUMMARY (aggregate KPIs across all repos for the date window)
    // ════════════════════════════════════════════════════════════════════

    @GetMapping("/summary")
    public ResponseEntity<SummaryResponse> getSummary(
            @RequestParam(defaultValue = "90") int days) {

        OffsetDateTime to   = OffsetDateTime.now();
        OffsetDateTime from = to.minusDays(days);

        List<String> repos = settingsService.get()
                .map(AzureDevOpsSettings::repoList)
                .orElse(List.of());

        int   totalPrs        = 0;
        int   totalCommits    = 0;
        long  cycleMinuteSum  = 0;
        int   cycleCount      = 0;
        Set<String> contributors = new HashSet<>();
        int   staleBranches   = 0;

        for (String r : repos) {
            try {
                List<AdoPullRequest> prs = adoClient.getPullRequests(r, from, to);
                totalPrs += prs.size();
                for (AdoPullRequest pr : prs) {
                    if (pr.createdBy() != null) contributors.add(pr.createdBy().displayName());
                    Double h = AzureDevOpsClient.reviewCycleHours(pr);
                    if (h != null) { cycleMinuteSum += Math.round(h * 60); cycleCount++; }
                }
            } catch (Exception ignored) {}

            try {
                totalCommits += adoClient.getCommits(r, from, to).size();
            } catch (Exception ignored) {}

            try {
                staleBranches += adoClient.getBranches(r).size(); // all branches (no last-commit timestamp in refs API)
            } catch (Exception ignored) {}
        }

        double avgCycleHours = cycleCount > 0 ? (cycleMinuteSum / 60.0 / cycleCount) : 0;

        return ResponseEntity.ok(new SummaryResponse(
                totalPrs,  // prsMerged
                totalCommits,
                Math.round(avgCycleHours * 10.0) / 10.0,
                contributors.size(),
                repos.size()
        ));
    }

    // ════════════════════════════════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════════════════════════════════

    private List<String> resolveRepos(String repoParam) {
        if (repoParam != null && !repoParam.isBlank() && !"all".equalsIgnoreCase(repoParam)) {
            return List.of(repoParam.trim());
        }
        return settingsService.get()
                .map(AzureDevOpsSettings::repoList)
                .orElse(List.of());
    }

    // ════════════════════════════════════════════════════════════════════
    // RECORD DTOs
    // ════════════════════════════════════════════════════════════════════

    record SettingsResponse(String orgUrl, String projectName, String personalAccessToken,
                            String repositories, boolean configured) {}

    record SaveSettingsRequest(String orgUrl, String projectName,
                               String personalAccessToken, String repositories) {}

    record PrResponse(long id, String title, String status, String author,
                      List<String> reviewers, String createdDate, String closedDate,
                      Double cycleTimeHours, String repo) {}

    record CommitSummaryResponse(int totalCommits, int uniqueAuthors,
                                 List<DayCount> dailyTotals, List<AuthorSeries> byAuthor) {}

    record DayCount(String date, int count) {}

    record AuthorSeries(String author, Map<String, Integer> byDay) {}

    record BranchResponse(String name, String repo, String createdBy) {}

    record SummaryResponse(int prsMerged, int commits, double avgCycleHours,
                           int contributors, int repoCount) {}
}
