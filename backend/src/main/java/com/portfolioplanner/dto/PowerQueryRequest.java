package com.portfolioplanner.dto;

import lombok.Data;
import java.util.List;

@Data
public class PowerQueryRequest {
    private List<FilterCondition> filters;    // WHERE conditions
    private List<String> groupBy;             // GROUP BY fields
    private List<MetricDef> metrics;          // Aggregation metrics
    private String timeField;                 // "created" | "resolved"
    private String startDate;                 // ISO date
    private String endDate;                   // ISO date
    private String granularity;               // "day"|"week"|"month"|"quarter"|"year"
    private String comparisonType;            // "period_over_period"|"yoy"|null
    private int comparisonPeriods = 2;
    private String orderBy;
    private String orderDirection = "desc";
    private int limit = 50;
    private String pods;                      // comma-separated pod IDs
    private List<String> joins;               // ["worklogs","labels","components","fixVersions"]

    @Data
    public static class FilterCondition {
        private String field;
        private String op;           // "=","!=","in","not_in",">","<",">=","<=","contains","is_empty","is_not_empty"
        private List<String> values;
        private String logicOp;      // "AND"|"OR" — how this connects to previous
    }

    @Data
    public static class MetricDef {
        private String field;        // "count","storyPoints","hours","cycleTimeDays"
        private String aggregation;  // "count","sum","avg","min","max","p50","p90","p95"
        private String alias;        // display name
    }
}
