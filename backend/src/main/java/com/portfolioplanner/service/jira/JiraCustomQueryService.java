package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.JiraIssueCustomField;
import com.portfolioplanner.domain.model.JiraSyncedIssue;
import com.portfolioplanner.domain.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Power-user analytics service: arbitrary groupBy + optional JQL-subset filter.
 * <p>
 * Supports ALL standard Jira fields stored in {@code jira_issue} plus any
 * custom field synced into {@code jira_issue_custom_field}.  A lightweight
 * JQL subset parser handles per-widget filtering without live API calls.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraCustomQueryService {

    private final JiraSyncedIssueRepository        issueRepo;
    private final JiraIssueCustomFieldRepository   customFieldRepo;
    private final JiraIssueLabelRepository         labelRepo;
    private final JiraIssueComponentRepository     componentRepo;
    private final JiraIssueFixVersionRepository    fixVersionRepo;

    // ── Standard field descriptors ─────────────────────────────────────────────

    /** All dimensions that can be chosen for groupBy in the frontend. */
    public List<Map<String, String>> getAvailableFields(List<String> projectKeys) {
        List<Map<String, String>> fields = new ArrayList<>();

        // Standard fields (always available)
        addField(fields, "issueType",       "Issue Type",       "standard", "string");
        addField(fields, "status",          "Status",           "standard", "string");
        addField(fields, "statusCategory",  "Status Category",  "standard", "string");
        addField(fields, "priority",        "Priority",         "standard", "string");
        addField(fields, "assignee",        "Assignee",         "standard", "string");
        addField(fields, "reporter",        "Reporter",         "standard", "string");
        addField(fields, "creator",         "Creator",          "standard", "string");
        addField(fields, "resolution",      "Resolution",       "standard", "string");
        addField(fields, "sprint",          "Sprint",           "standard", "string");
        addField(fields, "epic",            "Epic",             "standard", "string");
        addField(fields, "project",         "Project",          "standard", "string");
        addField(fields, "labels",          "Labels",           "standard", "multi");
        addField(fields, "components",      "Components",       "standard", "multi");
        addField(fields, "fixVersions",     "Fix Versions",     "standard", "multi");
        addField(fields, "createdMonth",    "Created Month",    "standard", "date");
        addField(fields, "resolvedMonth",   "Resolved Month",   "standard", "date");
        addField(fields, "isSubtask",       "Is Subtask",       "standard", "boolean");

        // Custom fields (discovered from synced data)
        if (projectKeys != null && !projectKeys.isEmpty()) {
            List<JiraSyncedIssue> sample = issueRepo.findByProjectKeyIn(projectKeys);
            List<String> keys = sample.stream().map(JiraSyncedIssue::getIssueKey).collect(Collectors.toList());
            if (!keys.isEmpty()) {
                // Distinct custom fields used across these issues
                Map<String, String> seen = new LinkedHashMap<>();
                customFieldRepo.findByIssueKeyIn(keys).forEach(cf -> {
                    if (!seen.containsKey(cf.getFieldId())) {
                        seen.put(cf.getFieldId(), cf.getFieldName() != null ? cf.getFieldName() : cf.getFieldId());
                    }
                });
                seen.forEach((id, name) ->
                        addField(fields, id, name, "custom", "string"));
            }
        }

        return fields;
    }

    private void addField(List<Map<String, String>> list,
                          String id, String name, String category, String type) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("id",       id);
        m.put("name",     name);
        m.put("category", category);
        m.put("type",     type);
        list.add(m);
    }

    // ── Custom query execution ─────────────────────────────────────────────────

    /**
     * Run a custom aggregation query against synced issues.
     *
     * @param projectKeys project scope (already resolved from pod/board filter)
     * @param groupBy     field id to group by (standard or customfield_xxx)
     * @param metric      "count" | "storyPoints" | "hours"
     * @param jql         optional lightweight JQL filter string
     * @param limit       max results (0 = all)
     * @return list of {name, count, value} maps sorted descending by value
     */
    public List<Map<String, Object>> runQuery(
            List<String> projectKeys,
            String groupBy,
            String metric,
            String jql,
            int limit) {

        // Load issues for the given projects
        List<JiraSyncedIssue> issues = issueRepo.findByProjectKeyIn(projectKeys);

        // Apply JQL filter if provided
        if (jql != null && !jql.isBlank()) {
            JqlFilter filter = parseJql(jql);
            issues = issues.stream().filter(filter::matches).collect(Collectors.toList());
        }

        // Determine if groupBy is a custom field
        boolean isCustom = groupBy != null && groupBy.startsWith("customfield_");
        boolean isMulti  = isMultiValueField(groupBy);

        List<Map<String, Object>> result;

        if (isCustom) {
            result = aggregateByCustomField(issues, groupBy, metric);
        } else if (isMulti) {
            result = aggregateByMultiField(issues, groupBy, metric);
        } else {
            result = aggregateByStandardField(issues, groupBy, metric);
        }

        // Sort descending by value
        result.sort((a, b) -> Double.compare(
                ((Number) b.getOrDefault("value", 0)).doubleValue(),
                ((Number) a.getOrDefault("value", 0)).doubleValue()));

        return limit > 0 ? result.subList(0, Math.min(limit, result.size())) : result;
    }

    // ── Standard field aggregation ─────────────────────────────────────────────

    private List<Map<String, Object>> aggregateByStandardField(
            List<JiraSyncedIssue> issues, String groupBy, String metric) {

        Function<JiraSyncedIssue, String> extractor = getExtractor(groupBy);
        Map<String, double[]> acc = new LinkedHashMap<>();

        for (JiraSyncedIssue issue : issues) {
            String key = extractor != null ? extractor.apply(issue) : "Unknown";
            if (key == null || key.isBlank()) key = "(empty)";
            acc.computeIfAbsent(key, k -> new double[]{0, 0}); // [count, storyPoints]
            acc.get(key)[0]++;
            if (issue.getStoryPoints() != null) acc.get(key)[1] += issue.getStoryPoints();
        }

        return toResult(acc, metric);
    }

    private List<Map<String, Object>> aggregateByMultiField(
            List<JiraSyncedIssue> issues, String groupBy, String metric) {

        List<String> issueKeys = issues.stream()
                .map(JiraSyncedIssue::getIssueKey)
                .collect(Collectors.toList());

        // Build multi-value lookup
        Map<String, List<String>> valuesByKey = buildMultiValueMap(issueKeys, groupBy);

        // Build storyPoints lookup
        Map<String, Double> spByKey = issues.stream()
                .collect(Collectors.toMap(
                        JiraSyncedIssue::getIssueKey,
                        i -> i.getStoryPoints() != null ? i.getStoryPoints() : 0.0,
                        (a, b) -> a));

        Map<String, double[]> acc = new LinkedHashMap<>();
        for (JiraSyncedIssue issue : issues) {
            List<String> vals = valuesByKey.getOrDefault(issue.getIssueKey(), List.of("(none)"));
            if (vals.isEmpty()) vals = List.of("(none)");
            double sp = spByKey.getOrDefault(issue.getIssueKey(), 0.0);
            for (String v : vals) {
                acc.computeIfAbsent(v, k -> new double[]{0, 0});
                acc.get(v)[0]++;
                acc.get(v)[1] += sp;
            }
        }
        return toResult(acc, metric);
    }

    private List<Map<String, Object>> aggregateByCustomField(
            List<JiraSyncedIssue> issues, String fieldId, String metric) {

        List<String> issueKeys = issues.stream()
                .map(JiraSyncedIssue::getIssueKey)
                .collect(Collectors.toList());
        if (issueKeys.isEmpty()) return List.of();

        Map<String, String> cfValueByKey = customFieldRepo
                .findByFieldIdAndIssueKeyIn(fieldId, issueKeys)
                .stream()
                .collect(Collectors.toMap(
                        JiraIssueCustomField::getIssueKey,
                        cf -> cf.getFieldValue() != null ? cf.getFieldValue() : "(empty)",
                        (a, b) -> a));

        Map<String, double[]> acc = new LinkedHashMap<>();
        for (JiraSyncedIssue issue : issues) {
            String val = cfValueByKey.getOrDefault(issue.getIssueKey(), "(empty)");
            acc.computeIfAbsent(val, k -> new double[]{0, 0});
            acc.get(val)[0]++;
            if (issue.getStoryPoints() != null) acc.get(val)[1] += issue.getStoryPoints();
        }
        return toResult(acc, metric);
    }

    // ── Field extractors ───────────────────────────────────────────────────────

    private Function<JiraSyncedIssue, String> getExtractor(String field) {
        if (field == null) return i -> "(none)";
        return switch (field) {
            case "issueType"       -> JiraSyncedIssue::getIssueType;
            case "status"          -> JiraSyncedIssue::getStatusName;
            case "statusCategory"  -> JiraSyncedIssue::getStatusCategory;
            case "priority"        -> JiraSyncedIssue::getPriorityName;
            case "assignee"        -> i -> i.getAssigneeDisplayName() != null ? i.getAssigneeDisplayName() : "Unassigned";
            case "reporter"        -> JiraSyncedIssue::getReporterDisplayName;
            case "creator"         -> JiraSyncedIssue::getCreatorDisplayName;
            case "resolution"      -> JiraSyncedIssue::getResolution;
            case "sprint"          -> JiraSyncedIssue::getSprintName;
            case "epic"            -> JiraSyncedIssue::getEpicName;
            case "project"         -> JiraSyncedIssue::getProjectKey;
            case "isSubtask"       -> i -> Boolean.TRUE.equals(i.getSubtask()) ? "Subtask" : "Issue";
            case "createdMonth"    -> i -> i.getCreatedAt() != null
                    ? i.getCreatedAt().getYear() + "-" + String.format("%02d", i.getCreatedAt().getMonthValue())
                    : "(unknown)";
            case "resolvedMonth"   -> i -> i.getResolutionDate() != null
                    ? i.getResolutionDate().getYear() + "-" + String.format("%02d", i.getResolutionDate().getMonthValue())
                    : "(unresolved)";
            default -> i -> "(unknown field)";
        };
    }

    private boolean isMultiValueField(String field) {
        return field != null && (field.equals("labels") || field.equals("components") || field.equals("fixVersions"));
    }

    private Map<String, List<String>> buildMultiValueMap(List<String> issueKeys, String field) {
        return switch (field) {
            case "labels"      -> buildLabelMap(issueKeys);
            case "components"  -> buildComponentMap(issueKeys);
            case "fixVersions" -> buildFixVersionMap(issueKeys);
            default            -> Map.of();
        };
    }

    private Map<String, List<String>> buildLabelMap(List<String> keys) {
        Map<String, List<String>> m = new HashMap<>();
        labelRepo.findByIssueKeyIn(keys)
                .forEach(l -> m.computeIfAbsent(l.getIssueKey(), k -> new ArrayList<>()).add(l.getLabel()));
        return m;
    }

    private Map<String, List<String>> buildComponentMap(List<String> keys) {
        Map<String, List<String>> m = new HashMap<>();
        componentRepo.findByIssueKeyIn(keys)
                .forEach(c -> m.computeIfAbsent(c.getIssueKey(), k -> new ArrayList<>()).add(c.getComponentName()));
        return m;
    }

    private Map<String, List<String>> buildFixVersionMap(List<String> keys) {
        Map<String, List<String>> m = new HashMap<>();
        fixVersionRepo.findByIssueKeyIn(keys)
                .forEach(v -> m.computeIfAbsent(v.getIssueKey(), k -> new ArrayList<>()).add(v.getVersionName()));
        return m;
    }

    private List<Map<String, Object>> toResult(Map<String, double[]> acc, String metric) {
        List<Map<String, Object>> list = new ArrayList<>();
        acc.forEach((name, vals) -> {
            double value = "storyPoints".equals(metric) ? vals[1] : vals[0];
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name",  name);
            m.put("count", (long) vals[0]);
            m.put("value", value);
            list.add(m);
        });
        return list;
    }

    // ── JQL Subset Parser ──────────────────────────────────────────────────────

    /**
     * Parses a lightweight JQL subset string into a {@link JqlFilter}.
     * <p>
     * Supported syntax:
     * <ul>
     *   <li>{@code field = "value"} or {@code field = value}</li>
     *   <li>{@code field != "value"}</li>
     *   <li>{@code field in ("val1","val2")} or {@code field in (val1,val2)}</li>
     *   <li>{@code field not in ("val1","val2")}</li>
     *   <li>Multiple clauses joined by {@code AND} (case-insensitive)</li>
     * </ul>
     */
    JqlFilter parseJql(String jql) {
        List<JqlFilter.Clause> clauses = new ArrayList<>();
        // Split on AND (case-insensitive, not inside parentheses)
        String[] parts = jql.split("(?i)\\bAND\\b");
        for (String part : parts) {
            part = part.trim();
            if (part.isEmpty()) continue;
            try {
                clauses.add(parseClause(part));
            } catch (Exception e) {
                log.warn("Ignoring unparseable JQL clause '{}': {}", part, e.getMessage());
            }
        }
        return new JqlFilter(clauses);
    }

    private JqlFilter.Clause parseClause(String clause) {
        clause = clause.trim();
        // NOT IN
        if (clause.matches("(?i).*\\bnot\\s+in\\b.*")) {
            int ni = clause.toLowerCase().indexOf("not in");
            String field = clause.substring(0, ni).trim();
            String rest  = clause.substring(ni + 6).trim();
            List<String> values = parseValueList(rest);
            return new JqlFilter.Clause(normalizeField(field), "not_in", values);
        }
        // IN
        if (clause.matches("(?i).*\\bin\\b.*")) {
            int ni = clause.toLowerCase().indexOf(" in ");
            if (ni < 0) ni = clause.toLowerCase().indexOf("\tin");
            String field = clause.substring(0, ni).trim();
            String rest  = clause.substring(ni + 3).trim();
            List<String> values = parseValueList(rest);
            return new JqlFilter.Clause(normalizeField(field), "in", values);
        }
        // !=
        if (clause.contains("!=")) {
            String[] p = clause.split("!=", 2);
            return new JqlFilter.Clause(normalizeField(p[0].trim()), "neq",
                    List.of(stripQuotes(p[1].trim())));
        }
        // =
        if (clause.contains("=")) {
            String[] p = clause.split("=", 2);
            return new JqlFilter.Clause(normalizeField(p[0].trim()), "eq",
                    List.of(stripQuotes(p[1].trim())));
        }
        throw new IllegalArgumentException("Cannot parse: " + clause);
    }

    /** Map common JQL field names to the internal standard field ids */
    private String normalizeField(String field) {
        return switch (field.toLowerCase()) {
            case "issuetype", "type"    -> "issueType";
            case "status"               -> "status";
            case "statuscategory"       -> "statusCategory";
            case "priority"             -> "priority";
            case "assignee"             -> "assignee";
            case "reporter"             -> "reporter";
            case "creator"              -> "creator";
            case "resolution"           -> "resolution";
            case "sprint"               -> "sprint";
            case "epic", "epiclink"     -> "epic";
            case "project"              -> "project";
            case "labels", "label"      -> "labels";
            case "component", "components" -> "components";
            case "fixversion", "fixversions" -> "fixVersions";
            default                     -> field; // pass through (handles customfield_xxx)
        };
    }

    private List<String> parseValueList(String s) {
        // Remove surrounding parentheses
        s = s.trim();
        if (s.startsWith("(")) s = s.substring(1);
        if (s.endsWith(")"))   s = s.substring(0, s.length() - 1);
        return Arrays.stream(s.split(","))
                .map(String::trim)
                .map(this::stripQuotes)
                .filter(v -> !v.isEmpty())
                .collect(Collectors.toList());
    }

    private String stripQuotes(String s) {
        s = s.trim();
        if ((s.startsWith("\"") && s.endsWith("\"")) ||
            (s.startsWith("'")  && s.endsWith("'"))) {
            return s.substring(1, s.length() - 1);
        }
        return s;
    }

    // ── JqlFilter inner class ──────────────────────────────────────────────────

    static class JqlFilter {
        record Clause(String field, String op, List<String> values) {}

        private final List<Clause> clauses;

        JqlFilter(List<Clause> clauses) { this.clauses = clauses; }

        boolean matches(JiraSyncedIssue issue) {
            for (Clause c : clauses) {
                if (!matchClause(issue, c)) return false;
            }
            return true;
        }

        private boolean matchClause(JiraSyncedIssue issue, Clause c) {
            String actual = getFieldValue(issue, c.field());
            if (actual == null) actual = "";
            String actualLower = actual.toLowerCase();
            List<String> valuesLower = c.values().stream()
                    .map(String::toLowerCase)
                    .collect(Collectors.toList());

            return switch (c.op()) {
                case "eq"     -> valuesLower.stream().anyMatch(actualLower::equals);
                case "neq"    -> valuesLower.stream().noneMatch(actualLower::equals);
                case "in"     -> valuesLower.stream().anyMatch(actualLower::equals);
                case "not_in" -> valuesLower.stream().noneMatch(actualLower::equals);
                default       -> true;
            };
        }

        private String getFieldValue(JiraSyncedIssue i, String field) {
            return switch (field) {
                case "issueType"      -> i.getIssueType();
                case "status"         -> i.getStatusName();
                case "statusCategory" -> i.getStatusCategory();
                case "priority"       -> i.getPriorityName();
                case "assignee"       -> i.getAssigneeDisplayName();
                case "reporter"       -> i.getReporterDisplayName();
                case "creator"        -> i.getCreatorDisplayName();
                case "resolution"     -> i.getResolution();
                case "sprint"         -> i.getSprintName();
                case "epic"           -> i.getEpicName();
                case "project"        -> i.getProjectKey();
                case "isSubtask"      -> Boolean.TRUE.equals(i.getSubtask()) ? "subtask" : "issue";
                default               -> null; // custom fields not matched here (pre-filtered)
            };
        }
    }
}
