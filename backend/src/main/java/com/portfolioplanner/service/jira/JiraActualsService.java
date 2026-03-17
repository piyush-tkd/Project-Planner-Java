package com.portfolioplanner.service.jira;

import com.portfolioplanner.config.JiraProperties;
import com.portfolioplanner.domain.model.JiraProjectMapping;
import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.repository.JiraProjectMappingRepository;
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
import java.util.stream.Collectors;

/**
 * Fetches Jira issues for each mapped project, derives actual hours/story-points
 * per resource per month, and returns a comparison against PP estimates.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraActualsService {

    private final JiraClient jiraClient;
    private final JiraProperties props;
    private final JiraProjectMappingRepository mappingRepo;
    private final ResourceRepository resourceRepo;
    private final TimelineService timelineService;

    // Jira stores time in seconds; 1 FTE-day = 8 h = 28800 s
    private static final double SECONDS_PER_HOUR = 3600.0;

    // ── Public API ────────────────────────────────────────────────────

    /** Delegates to JiraClient for a raw connectivity check. */
    public String testConnection() {
        return jiraClient.testConnection();
    }

    /**
     * Returns all Jira projects with their epics/labels so the UI can build
     * the mapping configuration.
     */
    @Transactional(readOnly = true)
    public List<JiraProjectInfo> getJiraProjects() {
        if (!props.isConfigured()) return List.of();

        List<Map<String, Object>> raw = jiraClient.getProjects();
        log.info("Jira returned {} projects", raw.size());
        List<JiraProjectInfo> result = new ArrayList<>();

        for (Map<String, Object> p : raw) {
            String key  = str(p, "key");
            String name = str(p, "name");
            if (key == null || key.isBlank()) continue;

            // Fetch epics for this project
            List<EpicInfo> epics;
            try {
                epics = jiraClient.getEpics(key).stream()
                        .map(e -> new EpicInfo(
                                str(e, "key"),
                                epicName(e),   // handles Agile vs REST format
                                epicStatus(e)))
                        .filter(ei -> ei.name() != null && !ei.name().isBlank())
                        .collect(Collectors.toList());
                log.info("  Project {}: {} epics", key, epics.size());
            } catch (Exception e) {
                log.warn("Failed to fetch epics for project {}: {}", key, e.getMessage());
                epics = List.of();
            }

            // Fetch labels
            List<String> labels;
            try {
                labels = jiraClient.getLabels(key);
            } catch (Exception e) {
                log.warn("Failed to fetch labels for project {}: {}", key, e.getMessage());
                labels = List.of();
            }

            result.add(new JiraProjectInfo(key, name, epics, labels));
        }
        return result;
    }

    /**
     * For each active mapping, fetches Jira issues and returns actual vs estimated
     * hours per PP project per month.
     */
    @Transactional(readOnly = true)
    public List<ActualsRow> getActuals() {
        if (!props.isConfigured()) return List.of();

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
                List<Map<String, Object>> issues = fetchIssuesForMapping(mapping);
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
        if (!props.isConfigured()) return List.of();

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

    private List<Map<String, Object>> fetchIssuesForMapping(JiraProjectMapping m) {
        return switch (m.getMatchType()) {
            case "EPIC_NAME" -> jiraClient.getIssuesByEpicName(m.getJiraProjectKey(), m.getMatchValue());
            case "LABEL"     -> jiraClient.getIssuesByLabel(m.getJiraProjectKey(), m.getMatchValue());
            case "EPIC_KEY"  -> jiraClient.getIssuesByEpicLink(m.getJiraProjectKey(), m.getMatchValue());
            default          -> jiraClient.getIssuesByEpicName(m.getJiraProjectKey(), m.getMatchValue());
        };
    }

    @SuppressWarnings("unchecked")
    private ActualsRow buildActualsRow(
            JiraProjectMapping mapping,
            List<Map<String, Object>> issues,
            Map<String, Long> resourceByName,
            Map<Integer, String> monthLabels) {

        // monthIndex → resource name → actual hours
        Map<Integer, Map<String, Double>> actualsByMonth = new LinkedHashMap<>();
        for (int m = 1; m <= 12; m++) actualsByMonth.put(m, new LinkedHashMap<>());

        // storyPoints per issue (used when no time logged)
        double totalStoryPoints = 0;
        int issueCount = 0;

        for (Map<String, Object> issue : issues) {
            Map<String, Object> fields = (Map<String, Object>) issue.get("fields");
            if (fields == null) continue;
            issueCount++;

            // Story points (customfield_10016 is the standard Jira SP field)
            Object sp = fields.get("customfield_10016");
            if (sp instanceof Number) totalStoryPoints += ((Number) sp).doubleValue();

            // Assignee → resource name
            Map<String, Object> assignee = (Map<String, Object>) fields.get("assignee");
            String assigneeName = assignee != null
                    ? nvl((String) assignee.get("displayName"), "Unassigned")
                    : "Unassigned";

            // Time spent (seconds → hours)
            Object timespent = fields.get("timespent");
            double hoursLogged = timespent instanceof Number
                    ? ((Number) timespent).doubleValue() / SECONDS_PER_HOUR : 0.0;

            // Determine which PP month this work falls in from issue created date
            String createdStr = (String) fields.get("created");
            int monthIdx = dateToMonthIndex(createdStr, monthLabels);

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

    /** Convert a Jira ISO date string to the PP month index (1-12). */
    private int dateToMonthIndex(String isoDate, Map<Integer, String> monthLabels) {
        if (isoDate == null || isoDate.isBlank()) return 0;
        try {
            // Jira format: "2024-03-15T10:30:00.000+0000"
            LocalDate d = LocalDate.parse(isoDate.substring(0, 10), DateTimeFormatter.ISO_LOCAL_DATE);
            // Find the PP month that matches this calendar month/year
            for (Map.Entry<Integer, String> entry : monthLabels.entrySet()) {
                // monthLabels values are like "Mar-24" — parse them
                String label = entry.getValue(); // e.g. "Mar-24"
                try {
                    LocalDate labelDate = LocalDate.parse("01-" + label,
                            DateTimeFormatter.ofPattern("dd-MMM-yy"));
                    if (labelDate.getYear() == d.getYear() && labelDate.getMonth() == d.getMonth()) {
                        return entry.getKey();
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            log.debug("Could not parse date: {}", isoDate);
        }
        return 0;
    }

    /** Very simple confidence: does the name look like a project name? */
    private double confidenceScore(String name) {
        if (name == null || name.isBlank()) return 0.0;
        // Penalise very short or very generic names
        return Math.min(1.0, name.length() / 30.0);
    }

    // ── Epic field helpers ────────────────────────────────────────────

    /**
     * Extracts the epic display name from either:
     *  - Agile board /epic response: top-level "name" or "summary"
     *  - REST API v3 search: fields.summary
     * The Agile endpoint's "name" is the short epic colour name; "summary" is the
     * full issue title. We prefer "summary" as it matches what users type in Jira.
     */
    private static String epicName(Map<String, Object> epic) {
        // 1. Agile board response: try top-level "summary" first, then "name"
        String summary = str(epic, "summary");
        if (summary != null && !summary.isBlank()) return summary;

        String name = str(epic, "name");
        if (name != null && !name.isBlank()) return name;

        // 2. REST API v3 response: fields.summary
        return fieldStr(epic, "summary");
    }

    private static String epicStatus(Map<String, Object> epic) {
        // Agile board response: "done" boolean → synthesise a status string
        Object done = epic.get("done");
        if (done instanceof Boolean) {
            return Boolean.TRUE.equals(done) ? "Done" : "In Progress";
        }
        // REST API v3: fields.status.name
        return fieldStr(epic, "status", "name");
    }

    // ── Value helpers ─────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private static String fieldStr(Map<String, Object> issue, String... path) {
        Object current = ((Map<String, Object>) issue.getOrDefault("fields", Map.of()));
        for (String key : path) {
            if (!(current instanceof Map)) return null;
            current = ((Map<String, Object>) current).get(key);
        }
        return current instanceof String ? (String) current : null;
    }

    private static String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v instanceof String ? (String) v : null;
    }

    private static String nvl(String s, String def) {
        return (s != null && !s.isBlank()) ? s : def;
    }

    // ── DTOs ──────────────────────────────────────────────────────────

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
