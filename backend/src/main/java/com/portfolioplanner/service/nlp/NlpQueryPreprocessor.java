package com.portfolioplanner.service.nlp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Normalizes and preprocesses user NLP queries before they hit the strategy chain.
 *
 * Responsibilities:
 * - Normalize whitespace and casing
 * - Remove filler words from query start
 * - Expand common abbreviations
 * - Normalize synonyms
 * - Handle question variations
 * - Provide typo tolerance via Levenshtein distance for entity matching
 */
@Component
public class NlpQueryPreprocessor {

    private static final Logger log = LoggerFactory.getLogger(NlpQueryPreprocessor.class);

    // Filler words to strip from the beginning of queries
    private static final Set<String> FILLER_WORDS = Set.of(
            "please", "can you", "could you", "i want to", "i'd like to",
            "i need to", "just", "quickly", "actually"
    );

    // Common abbreviation mappings
    private static final Map<String, String> ABBREVIATIONS = Map.ofEntries(
            Map.entry("proj", "project"),
            Map.entry("res", "resource"),
            Map.entry("devs", "developers"),
            Map.entry("qas", "qa"),
            Map.entry("mgr", "manager"),
            Map.entry("alloc", "allocation"),
            Map.entry("avail", "availability"),
            Map.entry("util", "utilization"),
            Map.entry("dept", "department"),
            Map.entry("hrs", "hours"),
            Map.entry("mo", "months"),
            Map.entry("wk", "week"),
            Map.entry("yr", "year")
    );

    // Synonym mappings
    // NOTE: "team" is NOT mapped to "pod" here because "India team" / "US team" must be
    // treated as location-based resource queries, not POD lookups. "squad" is mapped since
    // it always means a pod. The rule-based engine handles team→pod when appropriate.
    private static final Map<String, String> SYNONYMS = Map.ofEntries(
            Map.entry("squad", "pod"),
            Map.entry("sprint velocity", "sprint allocations"),
            Map.entry("bandwidth", "capacity"),
            Map.entry("workload", "utilization"),
            // "hire"/"hiring" NOT mapped here — handled contextually by the intent engine
            // to avoid corrupting verb usage like "should I hire more"
            Map.entry("burn", "budget"),
            Map.entry("burn rate", "budget")
    );

    // Question prefixes to strip
    private static final Set<String> QUESTION_PREFIXES = Set.of(
            "what is the", "what's the", "can you show me", "show me the",
            "give me", "get me", "pull up", "bring up"
    );

    /**
     * Main preprocessing method.
     * Normalizes and cleans a raw user query for downstream NLP processing.
     *
     * @param rawQuery The raw user input query
     * @return The cleaned and normalized query
     */
    public String preprocess(String rawQuery) {
        if (rawQuery == null || rawQuery.isBlank()) {
            return "";
        }

        String query = rawQuery.trim();

        // 1. Normalize whitespace and casing
        query = normalizeWhitespace(query);

        // 2. Remove trailing question mark
        if (query.endsWith("?")) {
            query = query.substring(0, query.length() - 1).trim();
        }

        // 3. Strip question prefixes (case-insensitive)
        query = stripQuestionPrefixes(query);

        // 4. Remove filler words from the beginning
        query = stripFillerWords(query);

        // 5. Expand abbreviations
        query = expandAbbreviations(query);

        // 6. Normalize synonyms
        query = normalizeSynonyms(query);

        log.debug("Preprocessed query: '{}' -> '{}'", rawQuery, query);
        return query;
    }

    /**
     * Fuzzy matches an entity fragment against a list of known entity names.
     * Uses Levenshtein distance with a default max distance of 2.
     *
     * @param fragment The partial entity name from the query
     * @param knownEntities The list of known entity names to match against
     * @return The best matching entity name, or null if no match within threshold
     */
    public String fuzzyMatchEntity(String fragment, List<String> knownEntities) {
        if (fragment == null || fragment.isBlank() || knownEntities == null || knownEntities.isEmpty()) {
            return null;
        }
        return findClosestEntity(fragment, knownEntities, 2);
    }

    /**
     * Finds the closest entity name to the input using Levenshtein distance.
     *
     * @param input The input fragment to match
     * @param knownNames The list of known entity names
     * @param maxDistance The maximum allowed Levenshtein distance
     * @return The closest matching name if distance <= maxDistance, otherwise null
     */
    public String findClosestEntity(String input, List<String> knownNames, int maxDistance) {
        if (input == null || input.isBlank() || knownNames == null || knownNames.isEmpty()) {
            return null;
        }

        String inputLower = input.toLowerCase().trim();
        String bestMatch = null;
        int bestDistance = maxDistance + 1;

        for (String known : knownNames) {
            if (known == null || known.isBlank()) {
                continue;
            }
            String knownLower = known.toLowerCase().trim();
            int distance = levenshteinDistance(inputLower, knownLower);

            if (distance < bestDistance && distance <= maxDistance) {
                bestDistance = distance;
                bestMatch = known;
            }
        }

        if (bestMatch != null) {
            log.debug("Fuzzy matched '{}' to '{}' (distance: {})", input, bestMatch, bestDistance);
        }
        return bestMatch;
    }

    /**
     * Calculates the Levenshtein distance between two strings.
     * This is the minimum number of single-character edits (insertions, deletions, substitutions)
     * needed to transform one string into another.
     *
     * @param s1 First string
     * @param s2 Second string
     * @return The Levenshtein distance
     */
    private int levenshteinDistance(String s1, String s2) {
        int len1 = s1.length();
        int len2 = s2.length();

        // Create distance matrix
        int[][] dp = new int[len1 + 1][len2 + 1];

        // Initialize first column and row
        for (int i = 0; i <= len1; i++) {
            dp[i][0] = i;
        }
        for (int j = 0; j <= len2; j++) {
            dp[0][j] = j;
        }

        // Fill the matrix
        for (int i = 1; i <= len1; i++) {
            for (int j = 1; j <= len2; j++) {
                int cost = s1.charAt(i - 1) == s2.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(
                        Math.min(dp[i - 1][j] + 1,      // deletion
                                dp[i][j - 1] + 1),      // insertion
                        dp[i - 1][j - 1] + cost         // substitution
                );
            }
        }

        return dp[len1][len2];
    }

    /**
     * Normalizes whitespace: trims, collapses multiple spaces to single space.
     */
    private String normalizeWhitespace(String query) {
        return query.trim()
                .replaceAll("\\s+", " ")
                .toLowerCase();
    }

    /**
     * Strips question prefixes from the beginning of the query.
     */
    private String stripQuestionPrefixes(String query) {
        String lowerQuery = query.toLowerCase();

        for (String prefix : QUESTION_PREFIXES) {
            if (lowerQuery.startsWith(prefix)) {
                query = query.substring(prefix.length()).trim();
                lowerQuery = query.toLowerCase();
            }
        }

        return query;
    }

    /**
     * Removes filler words from the beginning of the query.
     */
    private String stripFillerWords(String query) {
        String lowerQuery = query.toLowerCase();

        for (String filler : FILLER_WORDS) {
            if (lowerQuery.startsWith(filler)) {
                query = query.substring(filler.length()).trim();
                lowerQuery = query.toLowerCase();
            }
        }

        return query;
    }

    /**
     * Expands common abbreviations in the query.
     * Matches word boundaries to avoid partial replacements.
     */
    private String expandAbbreviations(String query) {
        String result = query;

        for (Map.Entry<String, String> entry : ABBREVIATIONS.entrySet()) {
            String abbrev = entry.getKey();
            String expanded = entry.getValue();

            // Use word boundary regex to match whole words only
            Pattern pattern = Pattern.compile("\\b" + Pattern.quote(abbrev) + "\\b", Pattern.CASE_INSENSITIVE);
            result = pattern.matcher(result).replaceAll(expanded);
        }

        return result;
    }

    /**
     * Normalizes synonyms in the query.
     * Handles multi-word synonyms and maintains word boundaries.
     */
    private String normalizeSynonyms(String query) {
        String result = query;

        // Process multi-word synonyms first (longer phrases before shorter ones)
        List<Map.Entry<String, String>> sortedSynonyms = SYNONYMS.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getKey().length(), a.getKey().length()))
                .toList();

        for (Map.Entry<String, String> entry : sortedSynonyms) {
            String from = entry.getKey();
            String to = entry.getValue();

            // Use word boundary regex for more precise matching
            Pattern pattern = Pattern.compile("\\b" + Pattern.quote(from) + "\\b", Pattern.CASE_INSENSITIVE);
            result = pattern.matcher(result).replaceAll(to);
        }

        return result;
    }
}
