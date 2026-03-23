package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.JiraProjectMapping;
import com.portfolioplanner.domain.model.JiraSyncedIssue;
import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.repository.JiraIssueLabelRepository;
import com.portfolioplanner.domain.repository.JiraProjectMappingRepository;
import com.portfolioplanner.domain.repository.JiraSyncedIssueRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import com.portfolioplanner.service.TimelineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;
import java.util.Objects;

/**
 * Fetches Jira issues for each mapped project, derives actual hours/story-points
 * per resource per month, and returns a comparison against PP estimates.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraActualsService {

    private final JiraClient jiraClient;
    private final JiraCredentialsService creds;
    private final JiraProjectMappingRepository mappingRepo;
    private final ResourceRepository resourceRepo;
    private final TimelineService timelineService;
    private final JiraSyncedIssueRepository issueRepo;
    private final JiraIssueLabelRepository labelRepo;

    // Jira stores time in seconds; 1 FTE-day = 8 h = 28800 s
    private static final double SECONDS_PER_HOUR = 3600.0;

    // Thread pool for parallel epic/label fetching across projects
    private static final ExecutorService POOL = Executors.newFixedThreadPool(8);

    // ── Public API ────────────────────────────────────────────────────

    /** Delegates to JiraClient for a raw connectivity check. */
    public String testConnection() {
        return jiraClient.testConnection();
    }

    /**
     * Lightweight: returns only key + name for every Jira project.
     * Used by the Settings board-picker — no epic/label data needed there.
     * Queries from synced issues in the database instead of live API.
     */
    @Transactional(readOnly = true)
    public List<SimpleProject> getSimpleProjects() {
        if (!creds.isConfigured()) return List.of();

        // Get distinct project keys from synced issues
        return issueRepo.findAll().stream()
                .map(JiraSyncedIssue::getProjectKey)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .map(key -> new SimpleProject(key, key))
                .collect(Collectors.toList());
    }

    /**
     * Returns all Jira projects with their epics/labels so the UI can build
     * the mapping configuration.
     * Epics and labels are fetched from the database in parallel (8-thread pool)
     * so N projects take roughly 1× the latency of one project instead of N×.
     */
    @Transactional(readOnly = true)
    public List<JiraProjectInfo> getJiraProjects() {
        if (!creds.isConfigured()) return List.of();

        // Get distinct project keys from synced issues
        Set<String> projectKeys = issueRepo.findAll().stream()
                .map(JiraSyncedIssue::getProjectKey)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        log.info("Database contains {} projects — fetching epics/labels in parallel", projectKeys.size());
        long t0 = System.currentTimeMillis();

        List<CompletableFuture<JiraProjectInfo>> futures = projectKeys.stream()
                .map(key -> CompletableFuture.supplyAsync(() -> fetchProjectInfoFromDb(key), POOL))
                .collect(Collectors.toList());

        List<JiraProjectInfo> result = futures.stream()
                .map(f -> { try { return f.join(); } catch (Exception e) { return null; } })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        log.info("Fetched epics/labels for {} projects in {}ms", result.size(), System.currentTimeMillis() - t0);
        return result;
    }

    private JiraProjectInfo fetchProjectInfoFromDb(String key) {
        List<EpicInfo> epics;
        try {
            // Group synced issues by epicKey/epicName where epicKey is not null
            epics = issueRepo.findByProjectKey(key).stream()
                    .filter(issue -> issue.getEpicKey() != null && !issue.getEpicKey().isBlank())
                    .collect(Collectors.groupingByConcurrent(
                            issue -> issue.getEpicKey(),
                            Collectors.mapping(JiraSyncedIssue::getEpicName, Collectors.toList())
                    ))
                    .entrySet().stream()
                    .map(entry -> {
                        String epicKey = entry.getKey();
                        String epicName = entry.getValue().stream()
                                .filter(Objects::nonNull)
                                .findFirst()
                                .orElse(epicKey);
                        return new EpicInfo(epicKey, epicName, null);
                    })
                    .filter(ei -> ei.name() != null && !ei.name().isBlank())
                    .collect(Collectors.toList());
            log.debug("  Project {}: {} epics", key, epics.size());
        } catch (Exception e) {
            log.warn("Failed to fetch epics for project {}: {}", key, e.getMessage());
            epics = List.of();
        }

        List<String> labels;
        try {
            labels = labelRepo.findDistinctLabelsByProjectKey(key);
        } catch (Exception e) {
            log.warn("Failed to fetch labels for project {}: {}", key, e.getMessage());
            labels = List.of();
        }

        return new JiraProjectInfo(key, key, epics, labels);
    }

    /**
     * For each active mapping, fetches Jira issues and returns actual vs estimated
     * hours per PP project per month.
     */
    @Transactional(readOnly = true)
    public List<ActualsRow> getActuals() {
        if (!creds.isConfigured()) return List.of();

        List<JiraProjectMapping> mappings = mappingRepo.findByActiveTrueOrderByJiraProjectKey();
        if (mappings.isEmpty()) return List.of();

        // Build resource name → id lookup (case-insensitive)
        List<Resource> resources = resourceRepo.findAll();
        Map<String, Long> resourceByName = resources.stream()
                .collect(Collectors.toMap(
                        r -> r.getName().toLowerCase().trim(),
                        Resource::getId,
                        (a, b) -> a));

        Map<Integer, String> monthLabels = timelineService.getMonthLabels();
        List<ActualsRow> rows = new ArrayList<>();

        for (JiraProjectMapping mapping : mappings) {
            try {
                List<JiraSyncedIssue> issues = fetchIssuesForMapping(mapping);
                ActualsRow row = buildActualsRow(mapping, issues, resourceByName, monthLabels);
                rows.add(row);
            } catch (Exception e) {
                log.error("Failed to fetch actuals for mapping id={}: {}", mapping.getId(), e.getMessage());
                rows.add(ActualsRow.error(
                        mapping.getProject().getId(),
                        mapping.getProject().getName(),
                        mapping.getJiraProjectKey(),
                        e.getMessage()));
            }
        }
        return rows;
    }

    /**
     * Suggest mappings by fuzzy-matching PP project names against Jira epic names.
     */
    @Transactional(readOnly = true)
    public List<MappingSuggestion> suggestMappings() {
        if (!creds.isConfigured()) return List.of();

        List<JiraProjectInfo> jiraProjects = getJiraProjects();
        List<Resource> resources = resourceRepo.findAll(); // not needed here but kept for future

        // Flatten all epics across all Jira projects
        List<MappingSuggestion> suggestions = new ArrayList<>();
        for (JiraProjectInfo jp : jiraProjects) {
            for (EpicInfo epic : jp.epics()) {
                if (epic.name() == null || epic.name().isBlank()) continue;
                suggestions.add(new MappingSuggestion(
                        jp.key(), jp.name(),
                        "EPIC_NAME", epic.name(), epic.key(),
                        confidenceScore(epic.name())));
            }
            // Also suggest label-based mappings
            for (String label : jp.labels()) {
                suggestions.add(new MappingSuggestion(
                        jp.key(), jp.name(),
                        "LABEL", label, null,
                        confidenceScore(label)));
            }
        }
        return suggestions;
    }

    // ── Internals ─────────────────────────────────────────────────────

    private List<JiraSyncedIssue> fetchIssuesForMapping(JiraProjectMapping m) {
        return switch (m.getMatchType()) {
            case "EPIC_NAME" -> issueRepo.findByProjectKeyAndEpicName(m.getJiraProjectKey(), m.getMatchValue());
            case "LABEL"     -> issueRepo.findByProjectKeyAndLabel(m.getJiraProjectKey(), m.getMatchValue());
            case "EPIC_KEY"  -> issueRepo.findByProjectKeyAndEpicKey(m.getJiraProjectKey(), m.getMatchValue());
            default          -> issueRepo.findByProjectKeyAndEpicName(m.getJiraProjectKey(), m.getMatchValue());
        };
    }

    private ActualsRow buildActualsRow(
            JiraProjectMapping mapping,
            List<JiraSyncedIssue> issues,
            Map<String, Long> resourceByName,
            Map<Integer, String> monthLabels) {

        // monthIndex → resource name → actual hours
        Map<Integer, Map<String, Double>> actualsByMonth = new LinkedHashMap<>();
        for (int m = 1; m <= 12; m++) actualsByMonth.put(m, new LinkedHashMap<>());

        // storyPoints per issue (used when no time logged)
        double totalStoryPoints = 0;
        int issueCount = 0;

        for (JiraSyncedIssue issue : issues) {
            issueCount++;

            // Story points from the entity
            if (issue.getStoryPoints() != null) {
                totalStoryPoints += issue.getStoryPoints().doubleValue();
            }

            // Assignee → resource name
            String assigneeName = nvl(issue.getAssigneeDisplayName(), "Unassigned");

            // Time spent (entity stores seconds, convert to hours)
            double hoursLogged = issue.getTimeSpent() != null
                    ? issue.getTimeSpent() / SECONDS_PER_HOUR : 0.0;

            // Determine which PP month this work falls in from issue created date
            int monthIdx = dateToMonthIndex(
                    issue.getCreatedAt() != null ? issue.getCreatedAt().toLocalDate() : null,
                    monthLabels);

            if (hoursLogged > 0 && monthIdx > 0) {
                actualsByMonth.get(monthIdx)
                        .merge(assigneeName, hoursLogged, Double::sum);
            }
        }

        // If no time logged, distribute story points evenly across active months
        // (1 SP ≈ 4 hours is a common default; user can configure later)
        double spHours = totalStoryPoints * 4.0;
        boolean hasTimeData = actualsByMonth.values().stream()
                .anyMatch(m -> !m.isEmpty());

        // Flatten to per-month totals
        Map<Integer, Double> monthTotals = new LinkedHashMap<>();
        for (int m = 1; m <= 12; m++) {
            double sum = actualsByMonth.get(m).values().stream().mapToDouble(Double::doubleValue).sum();
            monthTotals.put(m, sum);
        }

        // Build per-resource breakdown (across all months)
        Map<String, Double> byResource = new LinkedHashMap<>();
        for (Map<String, Double> monthMap : actualsByMonth.values()) {
            monthMap.forEach((name, h) -> byResource.merge(name, h, Double::sum));
        }

        return new ActualsRow(
                mapping.getProject().getId(),
                mapping.getProject().getName(),
                mapping.getJiraProjectKey(),
                mapping.getMatchType(),
                mapping.getMatchValue(),
                issueCount,
                totalStoryPoints,
                spHours,
                hasTimeData,
                monthTotals,
                byResource,
                monthLabels,
                null);
    }

    /** Convert a date to the PP month index (1-12). */
    private int dateToMonthIndex(LocalDate date, Map<Integer, String> monthLabels) {
        if (date == null) return 0;
        try {
            // Find the PP month that matches this calendar month/year
            for (Map.Entry<Integer, String> entry : monthLabels.entrySet()) {
                // monthLabels values are like "Mar-24" — parse them
                String label = entry.getValue(); // e.g. "Mar-24"
                try {
                    LocalDate labelDate = LocalDate.parse("01-" + label,
                            DateTimeFormatter.ofPattern("dd-MMM-yy"));
                    if (labelDate.getYear() == date.getYear() && labelDate.getMonth() == date.getMonth()) {
                        return entry.getKey();
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            log.debug("Could not match date to PP month: {}", date);
        }
        return 0;
    }

    /** Very simple confidence: does the name look like a project name? */
    private double confidenceScore(String name) {
        if (name == null || name.isBlank()) return 0.0;
        // Penalise very short or very generic names
        return Math.min(1.0, name.length() / 30.0);
    }

    // ── Value helpers ─────────────────────────────────────────────────

    private static String nvl(String s, String def) {
        return (s != null && !s.isBlank()) ? s : def;
    }

    // ── DTOs ──────────────────────────────────────────────────────────

    public record SimpleProject(String key, String name) {}

    public record JiraProjectInfo(
            String key,
            String name,
            List<EpicInfo> epics,
            List<String> labels) {}

    public record EpicInfo(String key, String name, String status) {}

    public record MappingSuggestion(
            String jiraProjectKey,
            String jiraProjectName,
            String matchType,
            String matchValue,
            String epicKey,
            double confidence) {}

    public record ActualsRow(
            Long ppProjectId,
            String ppProjectName,
            String jiraProjectKey,
            String matchType,
            String matchValue,
            int issueCount,
            double totalStoryPoints,
            double storyPointHours,
            boolean hasTimeData,
            Map<Integer, Double> actualHoursByMonth,
            Map<String, Double> actualHoursByResource,
            Map<Integer, String> monthLabels,
            String errorMessage) {

        static ActualsRow error(Long id, String name, String jiraKey, String msg) {
            return new ActualsRow(id, name, jiraKey, null, null,
                    0, 0, 0, false, Map.of(), Map.of(), Map.of(), msg);
        }
    }
}
