package com.portfolioplanner.service.nlp;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Single normalization layer for domain synonym/alias resolution.
 * Runs BEFORE any strategy — normalizes query terms to canonical domain values.
 *
 * Consolidates scattered alias logic that was previously in NlpQueryPreprocessor,
 * RuleBasedStrategy, and LocalLlmStrategy.
 */
@Component
public class AliasResolver {

    // ── Priority aliases ──
    private static final Map<Pattern, String> PRIORITY_ALIASES = new LinkedHashMap<>();
    static {
        PRIORITY_ALIASES.put(Pattern.compile("(?i)\\b(?:highest\\s+priority|critical|p[\\-\\s_]?zero|p[\\-\\s_]?0|priority\\s*0)\\b"), "P0");
        PRIORITY_ALIASES.put(Pattern.compile("(?i)\\b(?:high\\s+priority|p[\\-\\s_]?one|p[\\-\\s_]?1|priority\\s*1)\\b"), "P1");
        PRIORITY_ALIASES.put(Pattern.compile("(?i)\\b(?:medium\\s+priority|p[\\-\\s_]?two|p[\\-\\s_]?2|priority\\s*2)\\b"), "P2");
        PRIORITY_ALIASES.put(Pattern.compile("(?i)\\b(?:low\\s+priority|p[\\-\\s_]?three|p[\\-\\s_]?3|priority\\s*3)\\b"), "P3");
    }

    // ── Status aliases ──
    private static final Map<Pattern, String> STATUS_ALIASES = new LinkedHashMap<>();
    static {
        STATUS_ALIASES.put(Pattern.compile("(?i)\\b(?:paused|frozen|on[\\s\\-_]?hold|put\\s+on\\s+hold)\\b"), "ON_HOLD");
        STATUS_ALIASES.put(Pattern.compile("(?i)\\b(?:done|finished|completed|complete)\\b"), "COMPLETED");
        STATUS_ALIASES.put(Pattern.compile("(?i)\\b(?:live|running|in[\\s\\-_]?progress|active)\\b"), "ACTIVE");
        STATUS_ALIASES.put(Pattern.compile("(?i)\\b(?:not[\\s\\-_]?started|new|pending|backlog)\\b"), "NOT_STARTED");
        STATUS_ALIASES.put(Pattern.compile("(?i)\\b(?:cancelled|canceled|dropped|killed|scrapped)\\b"), "CANCELLED");
        STATUS_ALIASES.put(Pattern.compile("(?i)\\b(?:in[\\s\\-_]?discovery|discovery|exploring)\\b"), "IN_DISCOVERY");
    }

    // ── Role aliases ──
    private static final Map<Pattern, String> ROLE_ALIASES = new LinkedHashMap<>();
    static {
        ROLE_ALIASES.put(Pattern.compile("(?i)\\b(?:tech[\\s\\-_]?leads?|TL|lead\\s+(?:dev(?:eloper)?|engineer))\\b"), "TECH_LEAD");
        ROLE_ALIASES.put(Pattern.compile("(?i)\\b(?:devs?|developers?|engineers?|programmers?|coders?)\\b"), "DEVELOPER");
        ROLE_ALIASES.put(Pattern.compile("(?i)\\b(?:QA|testers?|quality\\s+assurance|quality\\s+engineers?)\\b"), "QA");
        ROLE_ALIASES.put(Pattern.compile("(?i)\\b(?:BSA|business\\s+(?:systems?\\s+)?analysts?)\\b"), "BSA");
    }

    // ── Entity type aliases ──
    private static final Map<Pattern, String> ENTITY_ALIASES = new LinkedHashMap<>();
    static {
        ENTITY_ALIASES.put(Pattern.compile("(?i)\\b(?:squads?|teams?|groups?)\\b"), "pod");
        ENTITY_ALIASES.put(Pattern.compile("(?i)\\b(?:iterations?|cycles?)\\b"), "sprint");
        ENTITY_ALIASES.put(Pattern.compile("(?i)\\b(?:staff|personnel|members?|employees?|headcount)\\b"), "resources");
        ENTITY_ALIASES.put(Pattern.compile("(?i)\\b(?:bandwidth|availability|free\\s+time)\\b"), "capacity");
    }

    // ── Location aliases (canonical values must match DB enum: US, INDIA) ──
    private static final Map<Pattern, String> LOCATION_ALIASES = new LinkedHashMap<>();
    static {
        LOCATION_ALIASES.put(Pattern.compile("(?i)\\b(?:onshore|domestic|us\\s+based|usa|united\\s+states|houston|america|american)\\b"), "US");
        LOCATION_ALIASES.put(Pattern.compile("(?i)\\b(?:offshore|india\\s+based|indian|hyderabad|bangalore|bengaluru|mumbai|pune|chennai)\\b"), "INDIA");
    }

    /**
     * Resolve all known aliases in the query text and return the normalized form.
     * For example: "high priority" → "P1", "paused" → "ON_HOLD", "squad" → "pod"
     */
    public String resolve(String query) {
        if (query == null || query.isBlank()) return query;

        String result = query;

        // Apply priority aliases
        for (var entry : PRIORITY_ALIASES.entrySet()) {
            result = entry.getKey().matcher(result).replaceAll(entry.getValue());
        }

        // Apply status aliases (only when clearly about status context)
        for (var entry : STATUS_ALIASES.entrySet()) {
            result = entry.getKey().matcher(result).replaceAll(entry.getValue());
        }

        // Apply entity type aliases
        for (var entry : ENTITY_ALIASES.entrySet()) {
            result = entry.getKey().matcher(result).replaceAll(entry.getValue());
        }

        // Apply location aliases
        for (var entry : LOCATION_ALIASES.entrySet()) {
            result = entry.getKey().matcher(result).replaceAll(entry.getValue());
        }

        // Note: Role aliases are NOT applied globally to the query text because they
        // could replace valid entity names. They're used by extractRole() instead.

        return result.trim().replaceAll("\\s+", " ");
    }

    /**
     * Extract canonical priority from query text. Returns null if none found.
     */
    public String extractPriority(String query) {
        for (var entry : PRIORITY_ALIASES.entrySet()) {
            if (entry.getKey().matcher(query).find()) {
                return entry.getValue();
            }
        }
        // Direct P0-P3 match
        Matcher directMatch = Pattern.compile("(?i)\\b(P[0-3])\\b").matcher(query);
        if (directMatch.find()) {
            return directMatch.group(1).toUpperCase();
        }
        return null;
    }

    /**
     * Extract canonical status from query text. Returns null if none found.
     */
    public String extractStatus(String query) {
        for (var entry : STATUS_ALIASES.entrySet()) {
            if (entry.getKey().matcher(query).find()) {
                return entry.getValue();
            }
        }
        return null;
    }

    /**
     * Extract canonical role from query text. Returns null if none found.
     */
    public String extractRole(String query) {
        for (var entry : ROLE_ALIASES.entrySet()) {
            if (entry.getKey().matcher(query).find()) {
                return entry.getValue();
            }
        }
        return null;
    }

    /**
     * Extract canonical location from query text. Returns null if none found.
     * Canonical values: "US", "INDIA" (matching DB enum exactly).
     */
    public String extractLocation(String query) {
        for (var entry : LOCATION_ALIASES.entrySet()) {
            if (entry.getKey().matcher(query).find()) {
                return entry.getValue();
            }
        }
        // Direct match
        if (Pattern.compile("(?i)\\bUS\\b").matcher(query).find()) return "US";
        if (Pattern.compile("(?i)\\bIndia\\b").matcher(query).find()) return "INDIA";
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Smart field matching — single place for all field-value comparisons
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Smart match any field value against a search term.
     * Handles case-insensitivity, separator normalization (- _ space),
     * contains in both directions, and common alias resolution.
     *
     * Use this instead of scattered equalsIgnoreCase/contains calls.
     */
    public static boolean matchesField(String fieldValue, String searchValue) {
        if (fieldValue == null || searchValue == null) return false;
        String f = normalize(fieldValue);
        String s = normalize(searchValue);
        return f.equals(s) || f.contains(s) || s.contains(f);
    }

    /**
     * Smart match specifically for location field.
     * Resolves aliases (e.g., "offshore" → "INDIA") before comparing.
     */
    public boolean matchesLocation(String fieldValue, String searchValue) {
        if (fieldValue == null || searchValue == null) return false;
        // First try direct smart match
        if (matchesField(fieldValue, searchValue)) return true;
        // Then try resolving the search term through aliases
        String resolved = extractLocation(searchValue);
        return resolved != null && matchesField(fieldValue, resolved);
    }

    /**
     * Smart match specifically for role field.
     * Resolves aliases (e.g., "dev" → "DEVELOPER") before comparing.
     */
    public boolean matchesRole(String fieldValue, String searchValue) {
        if (fieldValue == null || searchValue == null) return false;
        if (matchesField(fieldValue, searchValue)) return true;
        String resolved = extractRole(searchValue);
        return resolved != null && matchesField(fieldValue, resolved);
    }

    /**
     * Smart match specifically for status field.
     * Resolves aliases (e.g., "paused" → "ON_HOLD") before comparing.
     */
    public boolean matchesStatus(String fieldValue, String searchValue) {
        if (fieldValue == null || searchValue == null) return false;
        if (matchesField(fieldValue, searchValue)) return true;
        String resolved = extractStatus(searchValue);
        return resolved != null && matchesField(fieldValue, resolved);
    }

    /**
     * Smart match specifically for priority field.
     * Resolves aliases (e.g., "critical" → "P0") before comparing.
     */
    public boolean matchesPriority(String fieldValue, String searchValue) {
        if (fieldValue == null || searchValue == null) return false;
        if (matchesField(fieldValue, searchValue)) return true;
        String resolved = extractPriority(searchValue);
        return resolved != null && matchesField(fieldValue, resolved);
    }

    /**
     * Normalize a string for comparison: lowercase, collapse separators, trim.
     */
    private static String normalize(String value) {
        return value.trim().toLowerCase()
                .replaceAll("[\\s\\-_]+", "")   // collapse all separators
                .replaceAll("[^a-z0-9]", "");   // strip non-alphanumeric
    }
}
