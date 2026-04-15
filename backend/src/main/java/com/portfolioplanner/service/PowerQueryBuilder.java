package com.portfolioplanner.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Safe dynamic SQL builder for Power Dashboard widgets.
 *
 * ALL field names are validated against a strict allowlist before interpolation.
 * User-supplied VALUES are always bound via JDBC parameters (never interpolated).
 * This prevents SQL injection while enabling fully dynamic queries.
 */
@Service
@Slf4j
public class PowerQueryBuilder {

    // ── Allowlisted dimensions per source ──────────────────────────────────────

    /** Maps frontend field key → SQL expression for jira_issue source */
    public static final Map<String, String> ISSUE_DIMENSIONS = new LinkedHashMap<>();
    /** Maps frontend field key → SQL expression for worklog source */
    public static final Map<String, String> WORKLOG_DIMENSIONS = new LinkedHashMap<>();
    /** Maps frontend field key → SQL expression for sprint source */
    public static final Map<String, String> SPRINT_DIMENSIONS = new LinkedHashMap<>();
    /** Maps frontend field key → SQL expression for transition source */
    public static final Map<String, String> TRANSITION_DIMENSIONS = new LinkedHashMap<>();

    /** Maps metric key → SQL aggregate expression */
    public static final Map<String, String> METRICS = new LinkedHashMap<>();

    static {
        // ── Issue dimensions ────────────────────────────────────────────────
        ISSUE_DIMENSIONS.put("assignee_display_name",   "i.assignee_display_name");
        ISSUE_DIMENSIONS.put("reporter_display_name",   "i.reporter_display_name");
        ISSUE_DIMENSIONS.put("issue_type",              "i.issue_type");
        ISSUE_DIMENSIONS.put("status_name",             "i.status_name");
        ISSUE_DIMENSIONS.put("status_category",         "i.status_category");
        ISSUE_DIMENSIONS.put("priority_name",           "i.priority_name");
        ISSUE_DIMENSIONS.put("project_key",             "i.project_key");
        ISSUE_DIMENSIONS.put("epic_key",                "COALESCE(i.epic_key, i.parent_key)");
        // label = individual label value from jira_issue_label (requires JOIN — handled in build())
        ISSUE_DIMENSIONS.put("label",                   "lbl.label");
        ISSUE_DIMENSIONS.put("sprint_name",             "js.name");
        ISSUE_DIMENSIONS.put("week",                    "DATE_TRUNC('week', i.created_at)::date");
        ISSUE_DIMENSIONS.put("month",                   "DATE_TRUNC('month', i.created_at)::date");
        ISSUE_DIMENSIONS.put("quarter",                 "DATE_TRUNC('quarter', i.created_at)::date");
        ISSUE_DIMENSIONS.put("resolution_week",         "DATE_TRUNC('week', COALESCE(i.resolution_date, i.updated_at))::date");
        ISSUE_DIMENSIONS.put("resolution_month",        "DATE_TRUNC('month', COALESCE(i.resolution_date, i.updated_at))::date");
        ISSUE_DIMENSIONS.put("board",                   "js.project_key");

        // ── Worklog dimensions ──────────────────────────────────────────────
        WORKLOG_DIMENSIONS.put("author_display_name",   "w.author_display_name");
        WORKLOG_DIMENSIONS.put("project_key",           "i.project_key");
        WORKLOG_DIMENSIONS.put("issue_type",            "i.issue_type");
        WORKLOG_DIMENSIONS.put("week",                  "DATE_TRUNC('week', w.started)::date");
        WORKLOG_DIMENSIONS.put("month",                 "DATE_TRUNC('month', w.started)::date");
        WORKLOG_DIMENSIONS.put("epic_key",              "COALESCE(i.epic_key, i.parent_key)");
        WORKLOG_DIMENSIONS.put("sprint_name",           "js.name");

        // ── Sprint dimensions ───────────────────────────────────────────────
        SPRINT_DIMENSIONS.put("sprint_name",    "js.name");
        SPRINT_DIMENSIONS.put("project_key",    "js.project_key");
        SPRINT_DIMENSIONS.put("state",          "js.state");
        SPRINT_DIMENSIONS.put("month",          "DATE_TRUNC('month', js.complete_date)::date");

        // ── Transition dimensions ───────────────────────────────────────────
        TRANSITION_DIMENSIONS.put("to_status",              "t.to_status");
        TRANSITION_DIMENSIONS.put("from_status",            "t.from_status");
        TRANSITION_DIMENSIONS.put("assignee_display_name",  "i.assignee_display_name");
        TRANSITION_DIMENSIONS.put("project_key",            "i.project_key");
        TRANSITION_DIMENSIONS.put("week",                   "DATE_TRUNC('week', t.transitioned_at)::date");
        TRANSITION_DIMENSIONS.put("month",                  "DATE_TRUNC('month', t.transitioned_at)::date");

        // ── Metrics ─────────────────────────────────────────────────────────
        METRICS.put("count",                "COUNT(*)");
        METRICS.put("count_distinct_issue", "COUNT(DISTINCT i.issue_key)");
        METRICS.put("count_distinct_assignee", "COUNT(DISTINCT i.assignee_display_name)");
        METRICS.put("sum_sp",               "COALESCE(SUM(i.story_points), 0)");
        METRICS.put("avg_sp",               "ROUND(AVG(i.story_points)::numeric, 1)");
        METRICS.put("median_sp",            "ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY i.story_points)::numeric, 1)");
        METRICS.put("sum_hours_logged",     "ROUND(COALESCE(SUM(w.time_spent_seconds), 0) / 3600.0, 1)");
        METRICS.put("avg_hours_logged",     "ROUND(COALESCE(AVG(w.time_spent_seconds), 0) / 3600.0, 1)");
        METRICS.put("avg_lead_time_days",   "ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(i.resolution_date, i.updated_at) - i.created_at)) / 86400.0)::numeric, 1)");
        METRICS.put("avg_cycle_time_days",  "ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(i.resolution_date, i.updated_at) - i.updated_at)) / 86400.0)::numeric, 1)");
        METRICS.put("sum_estimate_hours",   "ROUND(COALESCE(SUM(i.time_original_estimate), 0) / 3600.0, 1)");
        METRICS.put("sum_spent_hours",      "ROUND(COALESCE(SUM(i.time_spent), 0) / 3600.0, 1)");
        METRICS.put("velocity_sp",          "COALESCE(SUM(CASE WHEN i.status_category = 'done' THEN i.story_points ELSE 0 END), 0)");
        METRICS.put("completion_rate_pct",  "ROUND(100.0 * COUNT(*) FILTER (WHERE i.status_category = 'done') / NULLIF(COUNT(*), 0), 1)");
        METRICS.put("transition_count",     "COUNT(*)");
        METRICS.put("avg_time_in_status_hrs", "ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(lead_time.next_at, NOW()) - t.transitioned_at)) / 3600.0)::numeric, 1)");
        // Percentile metrics (for box plot, control chart)
        METRICS.put("p50_lead_time_days",   "ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (COALESCE(i.resolution_date, i.updated_at) - i.created_at)) / 86400.0)::numeric, 1)");
        METRICS.put("p75_lead_time_days",   "ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (COALESCE(i.resolution_date, i.updated_at) - i.created_at)) / 86400.0)::numeric, 1)");
        METRICS.put("p90_lead_time_days",   "ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (COALESCE(i.resolution_date, i.updated_at) - i.created_at)) / 86400.0)::numeric, 1)");
        METRICS.put("count_open",           "COUNT(*) FILTER (WHERE i.status_category != 'done')");
        METRICS.put("count_done",           "COUNT(*) FILTER (WHERE i.status_category = 'done')");
    }

    // ── Filter operators allowlist ─────────────────────────────────────────────

    private static final Set<String> VALID_OPS = Set.of(
        "eq", "neq", "in", "not_in", "gt", "gte", "lt", "lte", "like", "is_null", "is_not_null"
    );

    // ── Public API ─────────────────────────────────────────────────────────────

    public record QueryResult(String sql, List<Object> params, List<String> columns) {}

    /**
     * Builds a safe parameterized SQL query from the widget config map.
     *
     * @param config  parsed widget config JSON (from frontend)
     * @return        QueryResult with sql string, parameter list, and column names
     */
    @SuppressWarnings("unchecked")
    public QueryResult build(Map<String, Object> config) {
        String source      = str(config, "source", "issues");
        String metricKey   = str(config, "metric", "count");
        String xMetricKey  = str(config, "x_metric", null); // scatter mode: x axis metric
        String groupByKey  = str(config, "groupBy", null);
        String groupBy2Key = str(config, "groupBy2", null);
        List<Map<String, Object>> filters = (List<Map<String, Object>>) config.getOrDefault("filters", List.of());
        Map<String, Object> dateRange = (Map<String, Object>) config.getOrDefault("dateRange", Map.of());
        int limit  = ((Number) config.getOrDefault("limit",  50)).intValue();
        int limit2 = Math.min(limit, 500); // hard cap
        String sortBy = str(config, "sortBy", "metric_desc");

        // Validate metric
        String metricSql = METRICS.get(metricKey);
        if (metricSql == null) throw new IllegalArgumentException("Unknown metric: " + metricKey);

        // Resolve dimension map for this source
        Map<String, String> dimMap = getDimMap(source);

        // Validate groupBy fields
        String groupBySql  = groupByKey  != null ? requireDim(dimMap, groupByKey)  : null;
        String groupBy2Sql = groupBy2Key != null ? requireDim(dimMap, groupBy2Key) : null;

        // Build FROM + JOIN clause
        StringBuilder from = new StringBuilder();
        List<Object> params = new ArrayList<>();

        // Collect custom field IDs needed for JOINs (cf_<field_id> dimensions)
        Set<String> cfFieldIds = new java.util.LinkedHashSet<>();
        boolean needsLabelJoin = false;
        for (String key : new String[]{groupByKey, groupBy2Key}) {
            if (key == null) continue;
            if (key.startsWith("cf_")) cfFieldIds.add(key.substring(3));
            if ("label".equals(key)) needsLabelJoin = true;
        }
        // Note: label/cf filters use EXISTS subqueries (no JOIN needed — avoids row multiplication)

        switch (source) {
            case "issues" -> {
                from.append("FROM jira_issue i");
                // Sprint join for sprint_name / board dimensions
                if (needsSprintJoin(groupByKey, groupBy2Key, filters)) {
                    from.append(" LEFT JOIN jira_sprint_issue si ON si.issue_key = i.issue_key")
                       .append(" LEFT JOIN jira_sprint js ON js.sprint_jira_id = si.sprint_jira_id");
                }
                // Label join (only for groupBy — filters use EXISTS)
                if (needsLabelJoin) {
                    from.append(" JOIN jira_issue_label lbl ON lbl.issue_key = i.issue_key");
                }
                // Custom field JOINs (only for groupBy dimensions, not filters)
                for (String fieldId : cfFieldIds) {
                    String alias = cfAlias(fieldId);
                    from.append(" LEFT JOIN jira_issue_custom_field ").append(alias)
                        .append(" ON ").append(alias).append(".issue_key = i.issue_key")
                        .append(" AND ").append(alias).append(".field_id = '")
                        .append(fieldId.replace("'", "''")).append("'");
                }
                // Worklog metric join
                if (metricKey.contains("hours_logged")) {
                    from.append(" LEFT JOIN jira_issue_worklog w ON w.issue_key = i.issue_key");
                }
            }
            case "worklogs" -> {
                from.append("""
                    FROM jira_issue_worklog w
                    JOIN jira_issue i ON i.issue_key = w.issue_key
                    LEFT JOIN jira_sprint_issue si ON si.issue_key = i.issue_key
                    LEFT JOIN jira_sprint js ON js.sprint_jira_id = si.sprint_jira_id
                    """);
            }
            case "sprints" -> {
                from.append("""
                    FROM jira_sprint js
                    LEFT JOIN jira_sprint_issue si ON si.sprint_jira_id = js.sprint_jira_id
                    LEFT JOIN jira_issue i ON i.issue_key = si.issue_key
                    """);
            }
            case "transitions" -> {
                from.append("""
                    FROM jira_issue_transition t
                    JOIN jira_issue i ON i.issue_key = t.issue_key
                    """);
            }
            default -> throw new IllegalArgumentException("Unknown source: " + source);
        }

        // Build WHERE clause
        StringBuilder where = new StringBuilder("WHERE 1=1");
        buildDateRange(where, params, dateRange, source);
        buildFilters(where, params, filters, dimMap);

        // Build SELECT
        StringBuilder select = new StringBuilder("SELECT ");
        List<String> columns = new ArrayList<>();
        if (xMetricKey != null && groupBySql != null) {
            // Scatter mode: {label, x, y}
            String xMetricSql = METRICS.get(xMetricKey);
            if (xMetricSql == null) throw new IllegalArgumentException("Unknown x_metric: " + xMetricKey);
            select.append(groupBySql).append(" AS label, ")
                  .append(xMetricSql).append(" AS x, ")
                  .append(metricSql).append(" AS y");
            columns.add("label"); columns.add("x"); columns.add("y");
        } else if (groupBySql != null) {
            select.append(groupBySql).append(" AS label");
            columns.add("label");
            if (groupBy2Sql != null) {
                select.append(", ").append(groupBy2Sql).append(" AS label2");
                columns.add("label2");
            }
            select.append(", ").append(metricSql).append(" AS value");
            columns.add("value");
        } else {
            select.append(metricSql).append(" AS value");
            columns.add("value");
        }

        // Build GROUP BY
        StringBuilder groupByClause = new StringBuilder();
        if (groupBySql != null) {
            groupByClause.append(" GROUP BY ").append(groupBySql);
            if (groupBy2Sql != null) groupByClause.append(", ").append(groupBy2Sql);
        }

        // In scatter mode columns are {label, x, y} — ORDER BY uses "y" not "value"
        String valueAlias = (xMetricKey != null) ? "y" : "value";
        // Build ORDER BY
        String orderBy = switch (sortBy) {
            case "metric_asc"  -> " ORDER BY " + valueAlias + " ASC NULLS LAST";
            case "label_asc"   -> groupBySql != null ? " ORDER BY label ASC" : " ORDER BY " + valueAlias + " DESC";
            case "label_desc"  -> groupBySql != null ? " ORDER BY label DESC" : " ORDER BY " + valueAlias + " DESC";
            default            -> " ORDER BY " + valueAlias + " DESC NULLS LAST";
        };

        String sql = select + "\n" + from + "\n" + where + groupByClause + orderBy + " LIMIT " + limit2;
        return new QueryResult(sql, params, columns);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private Map<String, String> getDimMap(String source) {
        return switch (source) {
            case "worklogs"    -> WORKLOG_DIMENSIONS;
            case "sprints"     -> SPRINT_DIMENSIONS;
            case "transitions" -> TRANSITION_DIMENSIONS;
            default            -> ISSUE_DIMENSIONS;
        };
    }

    private String requireDim(Map<String, String> map, String key) {
        // Custom field: cf_<field_id> → alias.field_value (JOIN added in build())
        if (key.startsWith("cf_")) return cfAlias(key.substring(3)) + ".field_value";
        String sql = map.get(key);
        if (sql == null) throw new IllegalArgumentException("Unknown dimension: " + key);
        return sql;
    }

    /** Converts a Jira field_id to a safe SQL alias: cf_customfield_10001 */
    private static String cfAlias(String fieldId) {
        return "cf_" + fieldId.replaceAll("[^a-zA-Z0-9]", "_");
    }

    private boolean needsSprintJoin(String g1, String g2, List<Map<String, Object>> filters) {
        Set<String> sprintFields = Set.of("sprint_name", "board");
        // Use null-safe contains — Set.of() throws NPE on contains(null)
        return (g1 != null && sprintFields.contains(g1)) ||
               (g2 != null && sprintFields.contains(g2)) ||
               filters.stream().anyMatch(f -> {
                   String field = str(f, "field", "");
                   return field != null && sprintFields.contains(field);
               });
    }

    @SuppressWarnings("unchecked")
    private void buildDateRange(StringBuilder where, List<Object> params,
                                Map<String, Object> dateRange, String source) {
        String dateCol = switch (source) {
            case "worklogs"    -> "w.started";
            case "sprints"     -> "js.complete_date";
            case "transitions" -> "t.transitioned_at";
            default            -> "i.created_at";
        };

        String preset = str(dateRange, "preset", null);
        if (preset != null) {
            String interval = switch (preset) {
                case "last_7d"   -> "7 days";
                case "last_30d"  -> "30 days";
                case "last_90d"  -> "90 days";
                case "last_6m"   -> "6 months";
                case "last_12m"  -> "12 months";
                case "last_2y"   -> "2 years";
                default          -> "90 days";
            };
            where.append(" AND ").append(dateCol).append(" >= NOW() - INTERVAL '").append(interval).append("'");
            return;
        }

        String from = str(dateRange, "from", null);
        String to   = str(dateRange, "to",   null);
        if (from != null) { where.append(" AND ").append(dateCol).append(" >= ?"); params.add(LocalDate.parse(from)); }
        if (to   != null) { where.append(" AND ").append(dateCol).append(" <= ?"); params.add(LocalDate.parse(to));   }
    }

    /**
     * Date dimension expressions (DATE_TRUNC, ::date casts) cannot be compared with a raw
     * JDBC String parameter — PostgreSQL rejects the implicit text→date cast.
     * We cast the field expression to ::text so comparison with a string value always works.
     * For simple column fields (no DATE_TRUNC) we compare directly.
     */
    private static String filterableSql(String fieldSql) {
        if (fieldSql.contains("DATE_TRUNC") || fieldSql.contains("::date")) {
            return "(" + fieldSql + ")::text";
        }
        return fieldSql;
    }

    @SuppressWarnings("unchecked")
    private void buildFilters(StringBuilder where, List<Object> params,
                               List<Map<String, Object>> filters, Map<String, String> dimMap) {
        for (Map<String, Object> f : filters) {
            String fieldKey = str(f, "field", null);
            String op       = str(f, "op",    "eq");
            Object value    = f.get("value");
            if (fieldKey == null || !VALID_OPS.contains(op)) continue;

            // ── Special: label filter via EXISTS (avoids row multiplication from JOIN) ──
            if ("label".equals(fieldKey)) {
                buildLabelFilter(where, params, op, value);
                continue;
            }

            // ── Special: custom field filter via EXISTS ──
            if (fieldKey.startsWith("cf_")) {
                buildCfFilter(where, params, fieldKey.substring(3), op, value);
                continue;
            }

            // Resolve field to SQL expression (must be allowlisted)
            String fieldSql;
            try { fieldSql = requireDim(dimMap, fieldKey); }
            catch (IllegalArgumentException e) { continue; } // skip unknown fields silently

            // For date expressions use ::text cast to allow string comparison
            String cmpSql = filterableSql(fieldSql);

            switch (op) {
                case "eq"  -> { where.append(" AND ").append(cmpSql).append(" = ?");   params.add(value); }
                case "neq" -> { where.append(" AND ").append(cmpSql).append(" != ?");  params.add(value); }
                case "gt"  -> { where.append(" AND ").append(cmpSql).append(" > ?");   params.add(value); }
                case "gte" -> { where.append(" AND ").append(cmpSql).append(" >= ?");  params.add(value); }
                case "lt"  -> { where.append(" AND ").append(cmpSql).append(" < ?");   params.add(value); }
                case "lte" -> { where.append(" AND ").append(cmpSql).append(" <= ?");  params.add(value); }
                case "like"-> { where.append(" AND ").append(cmpSql).append(" ILIKE ?"); params.add("%" + value + "%"); }
                case "is_null"     -> where.append(" AND ").append(fieldSql).append(" IS NULL");
                case "is_not_null" -> where.append(" AND ").append(fieldSql).append(" IS NOT NULL");
                case "in", "not_in" -> {
                    List<Object> vals = value instanceof List ? (List<Object>) value : List.of(value);
                    if (vals.isEmpty()) continue;
                    String placeholders = String.join(",", Collections.nCopies(vals.size(), "?"));
                    String clause = "in".equals(op) ? " IN (" : " NOT IN (";
                    where.append(" AND ").append(cmpSql).append(clause).append(placeholders).append(")");
                    params.addAll(vals);
                }
            }
        }
    }

    // ── Label / Custom field EXISTS filters ───────────────────────────────────

    @SuppressWarnings("unchecked")
    private void buildLabelFilter(StringBuilder where, List<Object> params, String op, Object value) {
        switch (op) {
            case "eq"  -> { where.append(" AND EXISTS (SELECT 1 FROM jira_issue_label WHERE issue_key = i.issue_key AND label = ?)"); params.add(value); }
            case "neq" -> { where.append(" AND NOT EXISTS (SELECT 1 FROM jira_issue_label WHERE issue_key = i.issue_key AND label = ?)"); params.add(value); }
            case "like"-> { where.append(" AND EXISTS (SELECT 1 FROM jira_issue_label WHERE issue_key = i.issue_key AND label ILIKE ?)"); params.add("%" + value + "%"); }
            case "is_null"     -> where.append(" AND NOT EXISTS (SELECT 1 FROM jira_issue_label WHERE issue_key = i.issue_key)");
            case "is_not_null" -> where.append(" AND EXISTS (SELECT 1 FROM jira_issue_label WHERE issue_key = i.issue_key)");
            case "in" -> {
                List<Object> vals = value instanceof List ? (List<Object>) value : List.of(value);
                if (vals.isEmpty()) return;
                String ph = String.join(",", java.util.Collections.nCopies(vals.size(), "?"));
                where.append(" AND EXISTS (SELECT 1 FROM jira_issue_label WHERE issue_key = i.issue_key AND label IN (").append(ph).append("))");
                params.addAll(vals);
            }
            case "not_in" -> {
                List<Object> vals = value instanceof List ? (List<Object>) value : List.of(value);
                if (vals.isEmpty()) return;
                String ph = String.join(",", java.util.Collections.nCopies(vals.size(), "?"));
                where.append(" AND NOT EXISTS (SELECT 1 FROM jira_issue_label WHERE issue_key = i.issue_key AND label IN (").append(ph).append("))");
                params.addAll(vals);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void buildCfFilter(StringBuilder where, List<Object> params, String fieldId, String op, Object value) {
        String safeId = fieldId.replace("'", "''");
        String base = " AND EXISTS (SELECT 1 FROM jira_issue_custom_field WHERE issue_key = i.issue_key AND field_id = '" + safeId + "'";
        switch (op) {
            case "eq"  -> { where.append(base).append(" AND field_value = ?)"); params.add(value); }
            case "neq" -> { where.append(" AND NOT EXISTS (SELECT 1 FROM jira_issue_custom_field WHERE issue_key = i.issue_key AND field_id = '").append(safeId).append("' AND field_value = ?)"); params.add(value); }
            case "like"-> { where.append(base).append(" AND field_value ILIKE ?)"); params.add("%" + value + "%"); }
            case "is_null"     -> where.append(" AND NOT EXISTS (SELECT 1 FROM jira_issue_custom_field WHERE issue_key = i.issue_key AND field_id = '").append(safeId).append("' AND field_value IS NOT NULL)");
            case "is_not_null" -> where.append(base).append(" AND field_value IS NOT NULL)");
            case "in" -> {
                List<Object> vals = value instanceof List ? (List<Object>) value : List.of(value);
                if (vals.isEmpty()) return;
                String ph = String.join(",", java.util.Collections.nCopies(vals.size(), "?"));
                where.append(base).append(" AND field_value IN (").append(ph).append("))");
                params.addAll(vals);
            }
        }
    }

    // ── Field metadata for frontend dropdowns ──────────────────────────────────

    public Map<String, Object> getFieldMetadata() {
        return Map.of(
            "issues", Map.of(
                "dimensions", buildDimMeta(ISSUE_DIMENSIONS),
                "metrics",    buildMetricMeta()
            ),
            "worklogs", Map.of(
                "dimensions", buildDimMeta(WORKLOG_DIMENSIONS),
                "metrics",    buildMetricMeta()
            ),
            "sprints", Map.of(
                "dimensions", buildDimMeta(SPRINT_DIMENSIONS),
                "metrics",    buildMetricMeta()
            ),
            "transitions", Map.of(
                "dimensions", buildDimMeta(TRANSITION_DIMENSIONS),
                "metrics",    buildMetricMeta()
            )
        );
    }

    private List<Map<String, Object>> buildDimMeta(Map<String, String> dims) {
        return dims.entrySet().stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key",   e.getKey());
            m.put("label", toLabel(e.getKey()));
            m.put("type",  inferType(e.getKey()));
            return m;
        }).toList();
    }

    private List<Map<String, Object>> buildMetricMeta() {
        return METRICS.entrySet().stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key",   e.getKey());
            m.put("label", toLabel(e.getKey()));
            return m;
        }).toList();
    }

    private String inferType(String key) {
        if (key.contains("week") || key.contains("month") || key.contains("quarter")) return "date";
        if (key.contains("_at") || key.contains("date")) return "date";
        return "string";
    }

    private String toLabel(String key) {
        return Arrays.stream(key.split("_"))
            .map(w -> w.isEmpty() ? w : Character.toUpperCase(w.charAt(0)) + w.substring(1))
            .reduce("", (a, b) -> a.isEmpty() ? b : a + " " + b);
    }

    private static String str(Map<String, Object> m, String key, String def) {
        Object v = m.get(key);
        return v != null ? v.toString() : def;
    }
}
