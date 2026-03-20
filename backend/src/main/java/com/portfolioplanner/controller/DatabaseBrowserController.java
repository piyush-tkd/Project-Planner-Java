package com.portfolioplanner.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;

/**
 * Admin-only REST endpoint that exposes a read-only view of the database schema and data.
 * Used by the "Tables" settings page so admins can browse table contents without a separate DB tool.
 *
 * All mutations are blocked — only SELECT queries are issued.
 * Table names are validated against information_schema to prevent SQL injection.
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/db")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class DatabaseBrowserController {

    private final JdbcTemplate jdbc;
    private final DataSource   dataSource;

    // ── 1. List all user tables with row counts ──────────────────────────────

    @GetMapping("/tables")
    public List<Map<String, Object>> listTables() {
        String sql = """
                SELECT
                    t.table_name,
                    obj_description(pc.oid, 'pg_class') AS table_comment,
                    (SELECT count(*) FROM information_schema.columns c
                     WHERE c.table_schema = 'public'
                       AND c.table_name = t.table_name) AS column_count
                FROM information_schema.tables t
                LEFT JOIN pg_class pc ON pc.relname = t.table_name
                WHERE t.table_schema = 'public'
                  AND t.table_type  = 'BASE TABLE'
                  AND t.table_name NOT IN ('flyway_schema_history')
                ORDER BY t.table_name
                """;

        List<Map<String, Object>> tables = jdbc.queryForList(sql);

        // Add approximate row count for each table
        for (Map<String, Object> row : tables) {
            String tableName = (String) row.get("table_name");
            try {
                Long count = jdbc.queryForObject(
                        "SELECT count(*) FROM \"" + tableName + "\"", Long.class);
                row.put("row_count", count);
            } catch (Exception e) {
                row.put("row_count", -1L);
            }
        }
        return tables;
    }

    // ── 2. Column schema for one table ───────────────────────────────────────

    @GetMapping("/tables/{tableName}/schema")
    public List<Map<String, Object>> getSchema(@PathVariable String tableName) {
        validateTableName(tableName);
        String sql = """
                SELECT
                    c.column_name,
                    c.data_type,
                    c.character_maximum_length,
                    c.numeric_precision,
                    c.is_nullable,
                    c.column_default,
                    c.ordinal_position,
                    CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
                FROM information_schema.columns c
                LEFT JOIN (
                    SELECT ku.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage ku
                      ON tc.constraint_name = ku.constraint_name
                     AND tc.table_name = ku.table_name
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                      AND tc.table_name = ?
                      AND tc.table_schema = 'public'
                ) pk ON pk.column_name = c.column_name
                WHERE c.table_schema = 'public'
                  AND c.table_name   = ?
                ORDER BY c.ordinal_position
                """;
        return jdbc.queryForList(sql, tableName, tableName);
    }

    // ── 3. Paginated table data with optional search ─────────────────────────

    @GetMapping("/tables/{tableName}/data")
    public Map<String, Object> getData(
            @PathVariable String tableName,
            @RequestParam(defaultValue = "0")   int    page,
            @RequestParam(defaultValue = "50")  int    size,
            @RequestParam(defaultValue = "")    String search,
            @RequestParam(defaultValue = "")    String sortCol,
            @RequestParam(defaultValue = "ASC") String sortDir
    ) {
        validateTableName(tableName);
        if (size > 200) size = 200; // safety cap

        // Collect all column names for this table
        List<String> columns = getColumnNames(tableName);

        // Count query
        long total;
        List<Object> params = new ArrayList<>();
        String whereClause = "";

        if (!search.isBlank() && !columns.isEmpty()) {
            // Cast every column to text and ILIKE search
            String conditions = columns.stream()
                    .map(c -> "\"" + c + "\"::text ILIKE ?")
                    .reduce((a, b) -> a + " OR " + b)
                    .orElse("1=1");
            whereClause = " WHERE " + conditions;
            String likeVal = "%" + search.replace("%", "\\%") + "%";
            for (int i = 0; i < columns.size(); i++) params.add(likeVal);
        }

        total = jdbc.queryForObject(
                "SELECT count(*) FROM \"" + tableName + "\"" + whereClause,
                params.toArray(), Long.class);

        // Validate sort column
        String orderClause = "";
        if (!sortCol.isBlank() && columns.contains(sortCol)) {
            String dir = "DESC".equalsIgnoreCase(sortDir) ? "DESC" : "ASC";
            orderClause = " ORDER BY \"" + sortCol + "\" " + dir;
        } else if (!columns.isEmpty()) {
            // Default: sort by first column
            orderClause = " ORDER BY \"" + columns.get(0) + "\" ASC";
        }

        int offset = page * size;
        List<Object> dataParams = new ArrayList<>(params);
        dataParams.add(size);
        dataParams.add(offset);

        String dataSql = "SELECT * FROM \"" + tableName + "\"" + whereClause
                + orderClause + " LIMIT ? OFFSET ?";

        List<Map<String, Object>> rows = jdbc.queryForList(dataSql, dataParams.toArray());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("columns", columns);
        result.put("rows", rows);
        result.put("total", total);
        result.put("page", page);
        result.put("size", size);
        result.put("totalPages", (int) Math.ceil((double) total / size));
        return result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Validates that the given table name actually exists in information_schema.
     * This prevents SQL injection via the table-name path variable.
     */
    private void validateTableName(String tableName) {
        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM information_schema.tables " +
                "WHERE table_schema='public' AND table_name=? AND table_type='BASE TABLE'",
                Integer.class, tableName);
        if (count == null || count == 0) {
            throw new IllegalArgumentException("Table not found: " + tableName);
        }
    }

    private List<String> getColumnNames(String tableName) {
        return jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns " +
                "WHERE table_schema='public' AND table_name=? ORDER BY ordinal_position",
                String.class, tableName);
    }
}
