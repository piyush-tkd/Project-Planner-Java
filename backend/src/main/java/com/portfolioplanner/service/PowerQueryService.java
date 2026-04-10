package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import com.portfolioplanner.dto.PowerQueryRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PowerQueryService {

    private final JdbcTemplate jdbcTemplate;
    private final JiraPodRepository podRepo;

    // Field ID → SQL column mapping
    private static final Map<String, String> FIELD_COLUMNS = Map.ofEntries(
        Map.entry("issueType", "ji.issue_type"),
        Map.entry("status", "ji.status_name"),
        Map.entry("statusCategory", "ji.status_category"),
        Map.entry("priority", "ji.priority_name"),
        Map.entry("assignee", "COALESCE(ji.assignee_display_name, 'Unassigned')"),
        Map.entry("reporter", "ji.reporter_display_name"),
        Map.entry("creator", "ji.creator_display_name"),
        Map.entry("resolution", "COALESCE(ji.resolution, 'Unresolved')"),
        Map.entry("sprint", "COALESCE(ji.sprint_name, 'No Sprint')"),
        Map.entry("epic", "COALESCE(ji.epic_name, 'No Epic')"),
        Map.entry("project", "ji.project_key"),
        Map.entry("storyPoints", "COALESCE(ji.story_points, 0)"),
        Map.entry("created", "ji.created_at"),
        Map.entry("resolved", "ji.resolution_date"),
        Map.entry("isSubtask", "ji.subtask"),
        Map.entry("issueKey", "ji.issue_key"),
        Map.entry("summary", "ji.summary")
    );

    /**
     * Execute a structured Power Query against PostgreSQL.
     * Returns a list of result rows (each row is a Map).
     */
    public List<Map<String, Object>> execute(PowerQueryRequest req) {
        List<Object> params = new ArrayList<>();
        StringBuilder sql = new StringBuilder();
        Set<String> joinTables = new HashSet<>(req.getJoins() != null ? req.getJoins() : List.of());

        // Detect custom fields in groupBy/filters
        Set<String> customFields = new HashSet<>();
        if (req.getGroupBy() != null) {
            req.getGroupBy().stream().filter(f -> f.startsWith("customfield_")).forEach(customFields::add);
        }
        if (req.getFilters() != null) {
            req.getFilters().stream().filter(f -> f.getField().startsWith("customfield_")).map(PowerQueryRequest.FilterCondition::getField).forEach(customFields::add);
        }

        // Detect if we need worklog join
        boolean needsWorklogs = joinTables.contains("worklogs") ||
            (req.getMetrics() != null && req.getMetrics().stream().anyMatch(m -> "hours".equals(m.getField())));

        // Detect if we need cycle time calculation
        boolean needsCycleTime = req.getMetrics() != null &&
            req.getMetrics().stream().anyMatch(m -> "cycleTimeDays".equals(m.getField()));

        // ── WITH clause (CTEs) ─────────────────────────────────────
        List<String> ctes = new ArrayList<>();

        if (needsWorklogs) {
            ctes.add("worklog_hours AS (SELECT issue_key, SUM(time_spent_seconds) / 3600.0 AS hours FROM jira_issue_worklog GROUP BY issue_key)");
        }
        if (needsCycleTime) {
            ctes.add("cycle_times AS (SELECT issue_key, EXTRACT(EPOCH FROM (resolution_date - created_at)) / 86400.0 AS cycle_days FROM jira_issue WHERE resolution_date IS NOT NULL)");
        }

        if (!ctes.isEmpty()) {
            sql.append("WITH ").append(String.join(", ", ctes)).append(" ");
        }

        // ── SELECT ─────────────────────────────────────────────────
        sql.append("SELECT ");
        List<String> selectCols = new ArrayList<>();

        // Group by columns
        if (req.getGroupBy() != null && !req.getGroupBy().isEmpty()) {
            for (String field : req.getGroupBy()) {
                String col = resolveSelectColumn(field, req.getGranularity());
                selectCols.add(col + " AS " + sanitizeAlias(field));
            }
        }

        // Metric columns
        if (req.getMetrics() != null && !req.getMetrics().isEmpty()) {
            for (PowerQueryRequest.MetricDef m : req.getMetrics()) {
                String agg = buildAggregation(m, needsWorklogs, needsCycleTime);
                String alias = m.getAlias() != null ? sanitizeAlias(m.getAlias()) : sanitizeAlias(m.getField() + "_" + m.getAggregation());
                selectCols.add(agg + " AS " + alias);
            }
        } else {
            // Default: count
            selectCols.add("COUNT(*) AS count");
        }

        sql.append(String.join(", ", selectCols));

        // ── FROM ───────────────────────────────────────────────────
        sql.append(" FROM jira_issue ji");

        // Joins
        if (needsWorklogs) {
            sql.append(" LEFT JOIN worklog_hours wl ON wl.issue_key = ji.issue_key");
        }
        if (needsCycleTime) {
            sql.append(" LEFT JOIN cycle_times ct ON ct.issue_key = ji.issue_key");
        }
        if (joinTables.contains("labels")) {
            sql.append(" LEFT JOIN jira_issue_label lbl ON lbl.issue_key = ji.issue_key");
        }
        if (joinTables.contains("components")) {
            sql.append(" LEFT JOIN jira_issue_component comp ON comp.issue_key = ji.issue_key");
        }
        if (joinTables.contains("fixVersions")) {
            sql.append(" LEFT JOIN jira_issue_fix_version fv ON fv.issue_key = ji.issue_key");
        }
        // Custom field joins
        int cfIdx = 0;
        for (String cf : customFields) {
            String alias = "cf" + cfIdx++;
            sql.append(" LEFT JOIN jira_issue_custom_field ").append(alias)
               .append(" ON ").append(alias).append(".issue_key = ji.issue_key AND ").append(alias).append(".field_id = ?");
            params.add(cf);
        }

        // ── WHERE ──────────────────────────────────────────────────
        List<String> conditions = new ArrayList<>();

        // Scope to project keys from pods
        List<String> projectKeys = resolveProjectKeys(req.getPods());
        if (!projectKeys.isEmpty()) {
            conditions.add("ji.project_key IN (" + placeholders(projectKeys.size()) + ")");
            params.addAll(projectKeys);
        }

        // Time range
        if (req.getStartDate() != null && !req.getStartDate().isBlank()) {
            String timeCol = "resolved".equals(req.getTimeField()) ? "ji.resolution_date" : "ji.created_at";
            conditions.add(timeCol + " >= ?::timestamp");
            params.add(req.getStartDate());
        }
        if (req.getEndDate() != null && !req.getEndDate().isBlank()) {
            String timeCol = "resolved".equals(req.getTimeField()) ? "ji.resolution_date" : "ji.created_at";
            conditions.add(timeCol + " <= ?::timestamp");
            params.add(req.getEndDate());
        }

        // User filters
        if (req.getFilters() != null) {
            int cfFilterIdx = 0;
            for (PowerQueryRequest.FilterCondition f : req.getFilters()) {
                String cond = buildFilterCondition(f, params, customFields, cfFilterIdx);
                if (cond != null) conditions.add(cond);
                if (f.getField().startsWith("customfield_")) cfFilterIdx++;
            }
        }

        if (!conditions.isEmpty()) {
            sql.append(" WHERE ").append(String.join(" AND ", conditions));
        }

        // ── GROUP BY ───────────────────────────────────────────────
        if (req.getGroupBy() != null && !req.getGroupBy().isEmpty()) {
            List<String> groupCols = new ArrayList<>();
            for (String field : req.getGroupBy()) {
                groupCols.add(resolveSelectColumn(field, req.getGranularity()));
            }
            sql.append(" GROUP BY ").append(String.join(", ", groupCols));
        }

        // ── ORDER BY ───────────────────────────────────────────────
        String orderCol = "count";
        if (req.getOrderBy() != null && !req.getOrderBy().isBlank()) {
            orderCol = sanitizeAlias(req.getOrderBy());
        } else if (req.getMetrics() != null && !req.getMetrics().isEmpty()) {
            PowerQueryRequest.MetricDef first = req.getMetrics().get(0);
            orderCol = first.getAlias() != null ? sanitizeAlias(first.getAlias())
                      : sanitizeAlias(first.getField() + "_" + first.getAggregation());
        }
        String dir = "asc".equalsIgnoreCase(req.getOrderDirection()) ? "ASC" : "DESC";
        sql.append(" ORDER BY ").append(orderCol).append(" ").append(dir);

        // ── LIMIT ──────────────────────────────────────────────────
        int limit = Math.min(req.getLimit() > 0 ? req.getLimit() : 50, 500);
        sql.append(" LIMIT ").append(limit);

        // ── Execute ────────────────────────────────────────────────
        log.info("Power Query SQL: {}", sql);
        log.debug("Power Query params: {}", params);

        try {
            return jdbcTemplate.queryForList(sql.toString(), params.toArray());
        } catch (Exception e) {
            log.error("Power Query execution failed: {}", e.getMessage(), e);
            throw new RuntimeException("Query failed: " + e.getMessage());
        }
    }

    /**
     * Get distinct values for a given field (for autocomplete).
     */
    public List<String> getFieldValues(String field, String pods, int limit) {
        List<Object> params = new ArrayList<>();
        String col = FIELD_COLUMNS.get(field);
        if (col == null) {
            // Custom field
            if (field.startsWith("customfield_")) {
                StringBuilder sql = new StringBuilder("SELECT DISTINCT cf.field_value FROM jira_issue_custom_field cf WHERE cf.field_id = ? AND cf.field_value IS NOT NULL");
                params.add(field);
                // Scope by project
                List<String> keys = resolveProjectKeys(pods);
                if (!keys.isEmpty()) {
                    sql.append(" AND cf.issue_key IN (SELECT issue_key FROM jira_issue WHERE project_key IN (")
                       .append(placeholders(keys.size())).append("))");
                    params.addAll(keys);
                }
                sql.append(" ORDER BY cf.field_value LIMIT ?");
                params.add(Math.min(limit, 200));
                return jdbcTemplate.queryForList(sql.toString(), params.toArray(), String.class);
            }
            // Multi-value fields
            if ("labels".equals(field)) {
                return jdbcTemplate.queryForList("SELECT DISTINCT label FROM jira_issue_label ORDER BY label LIMIT ?", String.class, Math.min(limit, 200));
            }
            if ("components".equals(field)) {
                return jdbcTemplate.queryForList("SELECT DISTINCT component_name FROM jira_issue_component ORDER BY component_name LIMIT ?", String.class, Math.min(limit, 200));
            }
            if ("fixVersions".equals(field)) {
                return jdbcTemplate.queryForList("SELECT DISTINCT version_name FROM jira_issue_fix_version ORDER BY version_name LIMIT ?", String.class, Math.min(limit, 200));
            }
            return List.of();
        }

        // Standard field
        StringBuilder sql = new StringBuilder("SELECT DISTINCT ").append(col).append(" AS val FROM jira_issue ji WHERE ").append(col).append(" IS NOT NULL");
        List<String> keys = resolveProjectKeys(pods);
        if (!keys.isEmpty()) {
            sql.append(" AND ji.project_key IN (").append(placeholders(keys.size())).append(")");
            params.addAll(keys);
        }
        sql.append(" ORDER BY val LIMIT ?");
        params.add(Math.min(limit, 200));
        return jdbcTemplate.queryForList(sql.toString(), params.toArray(), String.class);
    }

    // ── Private helpers ────────────────────────────────────────────

    private String resolveSelectColumn(String field, String granularity) {
        // Time bucketing
        if (("created".equals(field) || "resolved".equals(field)) && granularity != null) {
            String col = "created".equals(field) ? "ji.created_at" : "ji.resolution_date";
            return switch (granularity) {
                case "day"     -> "DATE(" + col + ")";
                case "week"    -> "DATE_TRUNC('week', " + col + ")::date";
                case "month"   -> "TO_CHAR(" + col + ", 'YYYY-MM')";
                case "quarter" -> "TO_CHAR(" + col + ", 'YYYY') || '-Q' || EXTRACT(QUARTER FROM " + col + ")";
                case "year"    -> "TO_CHAR(" + col + ", 'YYYY')";
                default        -> "TO_CHAR(" + col + ", 'YYYY-MM')";
            };
        }
        // Multi-value fields
        if ("labels".equals(field)) return "lbl.label";
        if ("components".equals(field)) return "comp.component_name";
        if ("fixVersions".equals(field)) return "fv.version_name";
        // Custom fields
        if (field.startsWith("customfield_")) {
            // The join alias is based on position — this is simplified
            return "cf0.field_value"; // works for single custom field groupBy
        }
        // Standard
        String col = FIELD_COLUMNS.get(field);
        return col != null ? col : "ji.issue_type";
    }

    private String buildAggregation(PowerQueryRequest.MetricDef m, boolean hasWorklogs, boolean hasCycleTime) {
        String agg = m.getAggregation() != null ? m.getAggregation() : "count";
        String sourceCol = switch (m.getField() != null ? m.getField() : "count") {
            case "storyPoints" -> "COALESCE(ji.story_points, 0)";
            case "hours"       -> hasWorklogs ? "COALESCE(wl.hours, 0)" : "0";
            case "cycleTimeDays" -> hasCycleTime ? "ct.cycle_days" : "0";
            default            -> "1"; // for count
        };
        return switch (agg) {
            case "sum"   -> "SUM(" + sourceCol + ")";
            case "avg"   -> "ROUND(AVG(" + sourceCol + ")::numeric, 2)";
            case "min"   -> "MIN(" + sourceCol + ")";
            case "max"   -> "MAX(" + sourceCol + ")";
            case "p50"   -> "ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY " + sourceCol + ")::numeric, 2)";
            case "p90"   -> "ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY " + sourceCol + ")::numeric, 2)";
            case "p95"   -> "ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY " + sourceCol + ")::numeric, 2)";
            default      -> "COUNT(*)";
        };
    }

    private String buildFilterCondition(PowerQueryRequest.FilterCondition f, List<Object> params,
                                         Set<String> customFields, int cfIdx) {
        String col;
        if (f.getField().startsWith("customfield_")) {
            col = "cf" + cfIdx + ".field_value";
        } else if ("labels".equals(f.getField())) {
            col = "lbl.label";
        } else if ("components".equals(f.getField())) {
            col = "comp.component_name";
        } else if ("fixVersions".equals(f.getField())) {
            col = "fv.version_name";
        } else {
            col = FIELD_COLUMNS.get(f.getField());
            if (col == null) return null;
        }

        List<String> vals = f.getValues() != null ? f.getValues() : List.of();
        return switch (f.getOp()) {
            case "=" -> { params.add(vals.isEmpty() ? "" : vals.get(0)); yield col + " = ?"; }
            case "!=" -> { params.add(vals.isEmpty() ? "" : vals.get(0)); yield col + " != ?"; }
            case ">" -> { params.add(vals.isEmpty() ? "" : vals.get(0)); yield col + " > ?"; }
            case "<" -> { params.add(vals.isEmpty() ? "" : vals.get(0)); yield col + " < ?"; }
            case ">=" -> { params.add(vals.isEmpty() ? "" : vals.get(0)); yield col + " >= ?"; }
            case "<=" -> { params.add(vals.isEmpty() ? "" : vals.get(0)); yield col + " <= ?"; }
            case "in" -> { params.addAll(vals); yield col + " IN (" + placeholders(vals.size()) + ")"; }
            case "not_in" -> { params.addAll(vals); yield col + " NOT IN (" + placeholders(vals.size()) + ")"; }
            case "contains" -> { params.add("%" + (vals.isEmpty() ? "" : vals.get(0)) + "%"); yield col + " ILIKE ?"; }
            case "is_empty" -> col + " IS NULL OR " + col + " = ''";
            case "is_not_empty" -> col + " IS NOT NULL AND " + col + " != ''";
            default -> null;
        };
    }

    private List<String> resolveProjectKeys(String pods) {
        List<JiraPod> allPods = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
        if (pods != null && !pods.isBlank()) {
            try {
                List<Long> ids = Arrays.stream(pods.split(","))
                    .map(String::trim).filter(s -> !s.isEmpty())
                    .map(Long::parseLong).collect(Collectors.toList());
                allPods = allPods.stream().filter(p -> ids.contains(p.getId())).collect(Collectors.toList());
            } catch (NumberFormatException ignored) {}
        }
        return allPods.stream()
            .flatMap(p -> p.getBoards().stream())
            .map(b -> b.getJiraProjectKey())
            .distinct()
            .collect(Collectors.toList());
    }

    private String placeholders(int count) {
        return String.join(", ", Collections.nCopies(count, "?"));
    }

    private String sanitizeAlias(String s) {
        // Only allow alphanumeric + underscore for SQL alias safety
        return s.replaceAll("[^a-zA-Z0-9_]", "_").toLowerCase();
    }
}
