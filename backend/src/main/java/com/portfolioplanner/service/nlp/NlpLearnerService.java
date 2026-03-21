package com.portfolioplanner.service.nlp;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolioplanner.domain.model.NlpLearnedPattern;
import com.portfolioplanner.domain.model.NlpLearnerRun;
import com.portfolioplanner.domain.model.NlpQueryLog;
import com.portfolioplanner.domain.repository.NlpLearnedPatternRepository;
import com.portfolioplanner.domain.repository.NlpLearnerRunRepository;
import com.portfolioplanner.domain.repository.NlpQueryLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Self-learning NLP service — analyzes query logs, mines patterns, applies
 * corrective learning from negative feedback, and decays stale patterns.
 *
 * Learning happens in three ways:
 * 1. SCHEDULED — auto-runs every 6 hours to mine patterns from logs
 * 2. REAL-TIME — immediately learns when a user gives positive or negative feedback
 * 3. MANUAL — admin clicks "Run Learner" on the Optimizer page
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NlpLearnerService {

    private final NlpQueryLogRepository queryLogRepo;
    private final NlpLearnedPatternRepository patternRepo;
    private final NlpLearnerRunRepository learnerRunRepo;
    private final ObjectMapper objectMapper;

    // Stop words to filter out when extracting keywords
    private static final Set<String> STOP_WORDS = Set.of(
            "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
            "have", "has", "had", "do", "does", "did", "will", "would", "shall",
            "should", "may", "might", "must", "can", "could", "to", "of", "in",
            "for", "on", "with", "at", "by", "from", "up", "about", "into",
            "through", "during", "before", "after", "above", "below", "between",
            "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
            "neither", "each", "every", "all", "any", "few", "more", "most",
            "other", "some", "such", "no", "only", "own", "same", "than",
            "too", "very", "just", "because", "as", "until", "while",
            "that", "which", "who", "whom", "this", "these", "those",
            "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
            "she", "her", "it", "its", "they", "them", "their", "what", "how",
            "show", "tell", "give", "get", "find", "look", "see", "know",
            "many", "much", "there", "here", "when", "where", "why",
            "please", "want", "need", "like", "also"
    );

    // Known intent keywords — map common words to their probable intent
    private static final Map<String, String> INTENT_KEYWORD_MAP = Map.ofEntries(
            Map.entry("pod", "POD_LOOKUP"),
            Map.entry("team", "POD_LOOKUP"),
            Map.entry("resource", "RESOURCE_LOOKUP"),
            Map.entry("person", "RESOURCE_LOOKUP"),
            Map.entry("member", "RESOURCE_LOOKUP"),
            Map.entry("project", "PROJECT_LOOKUP"),
            Map.entry("sprint", "SPRINT_LOOKUP"),
            Map.entry("release", "RELEASE_LOOKUP"),
            Map.entry("capacity", "AGGREGATION"),
            Map.entry("gap", "AGGREGATION"),
            Map.entry("cost", "RESOURCE_ANALYTICS"),
            Map.entry("rate", "RESOURCE_ANALYTICS"),
            Map.entry("billing", "RESOURCE_ANALYTICS"),
            Map.entry("navigate", "NAVIGATE"),
            Map.entry("go", "NAVIGATE"),
            Map.entry("open", "NAVIGATE"),
            Map.entry("create", "FORM_PREFILL"),
            Map.entry("add", "FORM_PREFILL"),
            Map.entry("new", "FORM_PREFILL"),
            Map.entry("status", "STATUS_UPDATE"),
            Map.entry("export", "EXPORT"),
            Map.entry("compare", "COMPARISON"),
            Map.entry("versus", "COMPARISON"),
            Map.entry("estimate", "PROJECT_ESTIMATE")
    );

    // ── Analysis results DTO ─────────────────────────────────────────────────

    public record LearnerStats(
            long totalQueries,
            long unknownQueries,
            long lowConfidenceQueries,
            long positiveRatings,
            long negativeRatings,
            long activePatterns,
            long newPatternsGenerated,
            Map<String, Long> intentDistribution,
            Map<String, Double> strategyAvgConfidence
    ) {}

    // ══════════════════════════════════════════════════════════════════════════
    // ── PILLAR 1: SCHEDULED AUTO-LEARNING ─────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    /** Auto-run the learner — interval and initial delay read from application.yml */
    @Scheduled(
            fixedDelayString = "${app.nlp.learner.interval-ms:21600000}",
            initialDelayString = "${app.nlp.learner.initial-delay-ms:60000}"
    )
    public void scheduledLearnerRun() {
        log.info("NLP Learner: scheduled auto-run starting...");
        try {
            runLearnerInternal("SCHEDULED");
        } catch (Exception e) {
            log.error("NLP Learner: scheduled run failed", e);
        }
    }

    /** Manual run from admin UI */
    @Transactional
    public LearnerStats runLearner() {
        return runLearnerInternal("MANUAL");
    }

    @Transactional
    public LearnerStats runLearnerInternal(String triggeredBy) {
        log.info("NLP Learner: starting analysis run (triggered by {})...", triggeredBy);
        long start = System.currentTimeMillis();

        List<NlpQueryLog> allLogs = queryLogRepo.findAllByOrderByCreatedAtDesc();

        // 1. Gather stats
        long totalQueries = allLogs.size();
        long unknownQueries = allLogs.stream().filter(q -> "UNKNOWN".equals(q.getIntent())).count();
        long lowConfidence = allLogs.stream().filter(q -> q.getConfidence() != null && q.getConfidence() < 0.75).count();
        long positiveRatings = allLogs.stream().filter(q -> q.getUserRating() != null && q.getUserRating() > 0).count();
        long negativeRatings = allLogs.stream().filter(q -> q.getUserRating() != null && q.getUserRating() < 0).count();

        // 2. Intent distribution
        Map<String, Long> intentDist = allLogs.stream()
                .collect(Collectors.groupingBy(
                        q -> q.getIntent() != null ? q.getIntent() : "NULL",
                        Collectors.counting()
                ));

        // 3. Avg confidence per strategy
        Map<String, Double> strategyConf = allLogs.stream()
                .filter(q -> q.getResolvedBy() != null && q.getConfidence() != null)
                .collect(Collectors.groupingBy(
                        NlpQueryLog::getResolvedBy,
                        Collectors.averagingDouble(NlpQueryLog::getConfidence)
                ));

        // 4. Mine patterns from successful queries
        long newPatterns = mineSuccessfulPatterns(allLogs);

        // 5. Learn from negative feedback
        newPatterns += learnFromNegativeFeedback(allLogs);

        // 6. Mine repeated unknowns
        newPatterns += mineRepeatedUnknowns(allLogs);

        // 7. Generate CONTAINS patterns from successful EXACT patterns
        newPatterns += generateKeywordPatterns(allLogs);

        // 8. Decay confidence of stale patterns
        decayStalePatterns();

        long activePatterns = patternRepo.countByActiveTrue();

        long elapsed = System.currentTimeMillis() - start;
        log.info("NLP Learner: completed in {}ms. {} new patterns, {} total active. Triggered by: {}",
                elapsed, newPatterns, activePatterns, triggeredBy);

        // Persist the run history
        saveRunHistory(elapsed, totalQueries, unknownQueries, lowConfidence,
                positiveRatings, negativeRatings, activePatterns, newPatterns,
                strategyConf.size(), intentDist, strategyConf, triggeredBy);

        return new LearnerStats(
                totalQueries, unknownQueries, lowConfidence,
                positiveRatings, negativeRatings, activePatterns, newPatterns,
                intentDist, strategyConf
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── PILLAR 2: REAL-TIME FEEDBACK LEARNING ─────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    /** Submit feedback on a query log — triggers immediate learning */
    @Transactional
    public void submitFeedback(Long queryLogId, short rating, String comment) {
        submitFeedback(queryLogId, rating, comment, null);
    }

    @Transactional
    public void submitFeedback(Long queryLogId, short rating, String comment, String screenshot) {
        var queryLog = queryLogRepo.findById(queryLogId)
                .orElseThrow(() -> new IllegalArgumentException("Query log not found: " + queryLogId));
        queryLog.setUserRating(rating);
        if (comment != null && !comment.isBlank()) {
            queryLog.setFeedbackComment(comment.trim());
        }
        if (screenshot != null && !screenshot.isBlank()) {
            queryLog.setFeedbackScreenshot(screenshot);
        }
        queryLogRepo.save(queryLog);

        if (rating > 0) {
            // ── Positive: Boost or create a pattern immediately ──
            if (queryLog.getConfidence() != null && queryLog.getConfidence() >= 0.7
                    && queryLog.getIntent() != null && !"UNKNOWN".equals(queryLog.getIntent())) {
                upsertPattern(
                        queryLog.getQueryText().toLowerCase().trim(),
                        "EXACT",
                        queryLog.getIntent(),
                        queryLog.getEntityName(),
                        null,
                        Math.min(queryLog.getConfidence() + 0.05, 0.95),
                        "USER_FEEDBACK",
                        1
                );
                log.info("NLP Real-time Learn: positive feedback → boosted pattern for '{}'", queryLog.getQueryText());
            }
        } else {
            // ── Negative: Corrective learning ──
            // 1. Penalize any existing pattern that caused the wrong result
            var existing = patternRepo.findByQueryPatternAndPatternType(
                    queryLog.getQueryText().toLowerCase().trim(), "EXACT");
            if (existing.isPresent()) {
                var pattern = existing.get();
                pattern.setNegativeVotes(pattern.getNegativeVotes() + 1);
                if (pattern.getNegativeVotes() > pattern.getPositiveVotes() + 2) {
                    pattern.setActive(false);
                    log.info("NLP Real-time Learn: deactivated bad pattern '{}'", pattern.getQueryPattern());
                }
                patternRepo.save(pattern);
            }

            // 2. Try to infer the correct intent from the user's explanation
            if (comment != null && !comment.isBlank()) {
                String inferredIntent = inferIntentFromComment(comment.trim());
                if (inferredIntent != null) {
                    queryLog.setExpectedIntent(inferredIntent);
                    queryLogRepo.save(queryLog);

                    // Create a corrective pattern: "this query should have been intent X"
                    createCorrectivePattern(queryLog.getQueryText(), inferredIntent, comment.trim());
                    log.info("NLP Real-time Learn: corrective pattern created for '{}' → {}",
                            queryLog.getQueryText(), inferredIntent);
                }
            }
        }
    }

    /** Undo feedback — resets rating, comment, screenshot, and expectedIntent. */
    @Transactional
    public void undoFeedback(Long queryLogId) {
        var queryLog = queryLogRepo.findById(queryLogId)
                .orElseThrow(() -> new IllegalArgumentException("Query log not found: " + queryLogId));
        queryLog.setUserRating(null);
        queryLog.setFeedbackComment(null);
        queryLog.setFeedbackScreenshot(null);
        queryLog.setExpectedIntent(null);
        queryLogRepo.save(queryLog);
        log.info("NLP Feedback: undone for query log {}", queryLogId);
    }

    /**
     * Infer the intended intent from the user's explanation comment.
     * Example comments → inferred intents:
     * - "I wanted to see the resource profile" → RESOURCE_LOOKUP
     * - "should have shown the pod details" → POD_LOOKUP
     * - "expected navigation to projects page" → NAVIGATE
     * - "wanted to add member to the pod" → ADD_MEMBER
     */
    private String inferIntentFromComment(String comment) {
        String lower = comment.toLowerCase();

        // Direct intent mentions
        if (lower.contains("resource") && (lower.contains("profile") || lower.contains("detail") || lower.contains("lookup") || lower.contains("info")))
            return "RESOURCE_LOOKUP";
        if (lower.contains("pod") && (lower.contains("profile") || lower.contains("detail") || lower.contains("lookup") || lower.contains("info") || lower.contains("member")))
            return "POD_LOOKUP";
        if (lower.contains("project") && (lower.contains("detail") || lower.contains("status") || lower.contains("lookup") || lower.contains("info")))
            return "PROJECT_LOOKUP";
        if (lower.contains("navigate") || lower.contains("go to") || lower.contains("open") || lower.contains("page"))
            return "NAVIGATE";
        if (lower.contains("add member") || lower.contains("assign") || lower.contains("move") && lower.contains("pod"))
            return "ADD_MEMBER";
        if (lower.contains("create") || lower.contains("new") || lower.contains("form"))
            return "FORM_PREFILL";
        if (lower.contains("sprint"))
            return "SPRINT_LOOKUP";
        if (lower.contains("release"))
            return "RELEASE_LOOKUP";
        if (lower.contains("capacity") || lower.contains("gap") || lower.contains("utilization"))
            return "AGGREGATION";
        if (lower.contains("cost") || lower.contains("billing") || lower.contains("rate"))
            return "RESOURCE_ANALYTICS";
        if (lower.contains("compare") || lower.contains("versus") || lower.contains("vs"))
            return "COMPARISON";
        if (lower.contains("export") || lower.contains("download"))
            return "EXPORT";

        return null; // Can't infer — needs manual review
    }

    /** Create a corrective pattern from negative feedback */
    private void createCorrectivePattern(String queryText, String correctIntent, String comment) {
        String normalized = queryText.toLowerCase().trim();
        var existing = patternRepo.findByQueryPatternAndPatternType(normalized, "EXACT");

        if (existing.isPresent()) {
            var pattern = existing.get();
            // Only override if the existing pattern has the WRONG intent
            if (!correctIntent.equals(pattern.getResolvedIntent())) {
                pattern.setResolvedIntent(correctIntent);
                pattern.setConfidence(0.80); // Start corrective patterns at 80%
                pattern.setCorrective(true);
                pattern.setActive(true);
                pattern.setSource("CORRECTIVE");
                patternRepo.save(pattern);
            }
        } else {
            // Create new corrective pattern
            var pattern = new NlpLearnedPattern();
            pattern.setQueryPattern(normalized);
            pattern.setPatternType("EXACT");
            pattern.setResolvedIntent(correctIntent);
            pattern.setConfidence(0.80);
            pattern.setSource("CORRECTIVE");
            pattern.setCorrective(true);
            pattern.setTimesSeen(1);
            pattern.setKeywords(extractKeywords(normalized));
            patternRepo.save(pattern);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── PILLAR 3: PATTERN GENERALIZATION (CONTAINS / Keywords) ───────────────
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Extract meaningful keywords from a query, filtering out stop words.
     * "how many developers in Portal v2 pod" → "developers,portal,v2"
     */
    public String extractKeywords(String query) {
        String[] words = query.toLowerCase().replaceAll("[^a-z0-9\\s]", "").split("\\s+");
        return Arrays.stream(words)
                .filter(w -> w.length() > 1)
                .filter(w -> !STOP_WORDS.contains(w))
                .distinct()
                .collect(Collectors.joining(","));
    }

    /**
     * Generate CONTAINS patterns from successful EXACT patterns.
     * If "how many people in portal v2" is a confirmed good pattern with intent POD_LOOKUP,
     * extract keywords ["people", "portal", "v2"] and create a CONTAINS pattern
     * so "show me portal v2 members" also matches.
     */
    private long generateKeywordPatterns(List<NlpQueryLog> logs) {
        long created = 0;

        // Find high-confidence queries with positive or no-negative ratings, grouped by intent+entity
        var confirmed = logs.stream()
                .filter(q -> q.getConfidence() != null && q.getConfidence() >= 0.85)
                .filter(q -> q.getUserRating() == null || q.getUserRating() > 0)
                .filter(q -> q.getIntent() != null && !"UNKNOWN".equals(q.getIntent()))
                .filter(q -> q.getEntityName() != null)
                .filter(q -> q.getQueryText() != null && q.getQueryText().length() > 5)
                .collect(Collectors.toList());

        // Group by (intent + entityName) to find common keyword patterns
        Map<String, List<NlpQueryLog>> groupedByIntentEntity = confirmed.stream()
                .collect(Collectors.groupingBy(q -> q.getIntent() + "|" + q.getEntityName()));

        for (var entry : groupedByIntentEntity.entrySet()) {
            if (entry.getValue().size() < 2) continue; // Need 2+ queries to generalize

            String[] parts = entry.getKey().split("\\|", 2);
            String intent = parts[0];
            String entityName = parts[1];

            // Extract keywords common across multiple queries for this intent+entity
            List<Set<String>> allKeywordSets = entry.getValue().stream()
                    .map(q -> {
                        String kw = extractKeywords(q.getQueryText());
                        return new HashSet<>(Arrays.asList(kw.split(",")));
                    })
                    .collect(Collectors.toList());

            // Find keywords that appear in at least half the queries
            Map<String, Long> keywordFreq = allKeywordSets.stream()
                    .flatMap(Set::stream)
                    .filter(k -> !k.isEmpty())
                    .collect(Collectors.groupingBy(k -> k, Collectors.counting()));

            long threshold = Math.max(2, entry.getValue().size() / 2);
            String commonKeywords = keywordFreq.entrySet().stream()
                    .filter(e -> e.getValue() >= threshold)
                    .map(Map.Entry::getKey)
                    .sorted()
                    .collect(Collectors.joining(","));

            if (commonKeywords.isEmpty() || commonKeywords.split(",").length < 2) continue;

            // Create a CONTAINS pattern with these common keywords
            String patternKey = "KEYWORDS:" + commonKeywords;
            var existing = patternRepo.findByQueryPatternAndPatternType(patternKey, "CONTAINS");
            if (existing.isEmpty()) {
                var pattern = new NlpLearnedPattern();
                pattern.setQueryPattern(patternKey);
                pattern.setPatternType("CONTAINS");
                pattern.setResolvedIntent(intent);
                pattern.setEntityName(entityName);
                pattern.setConfidence(0.75); // Lower than EXACT since it's a generalization
                pattern.setSource("LOG_MINING");
                pattern.setTimesSeen(entry.getValue().size());
                pattern.setKeywords(commonKeywords);
                patternRepo.save(pattern);
                created++;
                log.info("NLP Learner: created CONTAINS pattern [{}] → {} ({})", commonKeywords, intent, entityName);
            }
        }
        return created;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── CONFIDENCE DECAY ──────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Decay confidence of patterns that haven't been matched recently.
     * Patterns unused for 30+ days lose 5% confidence per decay cycle.
     * If confidence drops below 0.3, the pattern is deactivated.
     */
    private void decayStalePatterns() {
        LocalDateTime staleThreshold = LocalDateTime.now().minusDays(30);
        List<NlpLearnedPattern> allActive = patternRepo.findByActiveTrueOrderByTimesSeenDesc();
        int decayed = 0;

        for (var pattern : allActive) {
            // Skip patterns that were recently created
            if (pattern.getCreatedAt() != null && pattern.getCreatedAt().isAfter(staleThreshold)) continue;

            // Skip manually-created or corrective patterns (admin curated)
            if ("MANUAL".equals(pattern.getSource())) continue;

            // Check if pattern was last matched before the threshold
            LocalDateTime lastUsed = pattern.getLastMatchedAt() != null
                    ? pattern.getLastMatchedAt()
                    : pattern.getUpdatedAt();

            if (lastUsed != null && lastUsed.isBefore(staleThreshold)) {
                double newConfidence = Math.max(0.0, pattern.getConfidence() - 0.05);
                pattern.setConfidence(newConfidence);

                if (newConfidence < 0.3) {
                    pattern.setActive(false);
                    log.info("NLP Decay: deactivated stale pattern '{}' (conf: {})", pattern.getQueryPattern(), newConfidence);
                }
                patternRepo.save(pattern);
                decayed++;
            }
        }
        if (decayed > 0) {
            log.info("NLP Decay: adjusted {} stale patterns", decayed);
        }
    }

    /** Called by RuleBasedStrategy when a learned pattern matches — keeps it alive */
    @Transactional
    public void recordPatternMatch(Long patternId) {
        patternRepo.findById(patternId).ifPresent(p -> {
            p.setLastMatchedAt(LocalDateTime.now());
            p.setTimesSeen(p.getTimesSeen() + 1);
            patternRepo.save(p);
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── EXISTING MINING STRATEGIES ────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    private long mineSuccessfulPatterns(List<NlpQueryLog> logs) {
        long created = 0;
        var successfulQueries = logs.stream()
                .filter(q -> q.getConfidence() != null && q.getConfidence() >= 0.85)
                .filter(q -> q.getUserRating() == null || q.getUserRating() > 0)
                .filter(q -> q.getIntent() != null && !"UNKNOWN".equals(q.getIntent()))
                .filter(q -> q.getQueryText() != null && q.getQueryText().length() > 3)
                .collect(Collectors.toList());

        Map<String, List<NlpQueryLog>> grouped = successfulQueries.stream()
                .collect(Collectors.groupingBy(q -> q.getQueryText().toLowerCase().trim()));

        for (var entry : grouped.entrySet()) {
            if (entry.getValue().size() >= 2) {
                NlpQueryLog representative = entry.getValue().get(0);
                created += upsertPattern(
                        entry.getKey(), "EXACT",
                        representative.getIntent(), representative.getEntityName(), null,
                        Math.min(representative.getConfidence() + 0.05, 0.95),
                        "LOG_MINING", entry.getValue().size()
                );
            }
        }
        return created;
    }

    private long learnFromNegativeFeedback(List<NlpQueryLog> logs) {
        long created = 0;
        var negativeQueries = logs.stream()
                .filter(q -> q.getUserRating() != null && q.getUserRating() < 0)
                .filter(q -> q.getQueryText() != null)
                .collect(Collectors.toList());

        for (var q : negativeQueries) {
            var existing = patternRepo.findByQueryPatternAndPatternType(
                    q.getQueryText().toLowerCase().trim(), "EXACT");
            if (existing.isPresent()) {
                var pattern = existing.get();
                pattern.setNegativeVotes(pattern.getNegativeVotes() + 1);
                if (pattern.getNegativeVotes() > pattern.getPositiveVotes() + 2) {
                    pattern.setActive(false);
                    log.info("NLP Learner: deactivated pattern '{}' due to negative feedback", pattern.getQueryPattern());
                }
                patternRepo.save(pattern);
                created++;
            }
        }
        return created;
    }

    private long mineRepeatedUnknowns(List<NlpQueryLog> logs) {
        long created = 0;
        var unknowns = logs.stream()
                .filter(q -> "UNKNOWN".equals(q.getIntent()) || (q.getConfidence() != null && q.getConfidence() == 0.0))
                .filter(q -> q.getQueryText() != null && q.getQueryText().length() > 3)
                .collect(Collectors.groupingBy(q -> q.getQueryText().toLowerCase().trim()));

        for (var entry : unknowns.entrySet()) {
            if (entry.getValue().size() >= 2) {
                created += upsertPattern(
                        entry.getKey(), "EXACT", "UNKNOWN", null, null,
                        0.0, "LOG_MINING", entry.getValue().size()
                );
            }
        }
        return created;
    }

    // ── Upsert a pattern ────────────────────────────────────────────────────

    private long upsertPattern(String query, String type, String intent,
                               String entityName, String route, double confidence,
                               String source, int timesSeen) {
        var existing = patternRepo.findByQueryPatternAndPatternType(query, type);
        if (existing.isPresent()) {
            var pattern = existing.get();
            pattern.setTimesSeen(pattern.getTimesSeen() + timesSeen);
            if (confidence > pattern.getConfidence()) {
                pattern.setConfidence(confidence);
            }
            patternRepo.save(pattern);
            return 0;
        }

        var pattern = new NlpLearnedPattern();
        pattern.setQueryPattern(query);
        pattern.setPatternType(type);
        pattern.setResolvedIntent(intent);
        pattern.setEntityName(entityName);
        pattern.setRoute(route);
        pattern.setConfidence(confidence);
        pattern.setSource(source);
        pattern.setTimesSeen(timesSeen);
        pattern.setKeywords(extractKeywords(query));
        patternRepo.save(pattern);
        return 1;
    }

    // ── Admin / View methods ─────────────────────────────────────────────────

    public List<NlpLearnedPattern> getAllPatterns() {
        return patternRepo.findAllByOrderByUpdatedAtDesc();
    }

    public List<NlpQueryLog> getLowConfidenceLogs() {
        return queryLogRepo.findLowConfidenceQueries();
    }

    public List<NlpQueryLog> getNegativelyRatedLogs() {
        return queryLogRepo.findByUserRatingOrderByCreatedAtDesc((short) -1);
    }

    @Transactional
    public NlpLearnedPattern togglePattern(Long patternId) {
        var pattern = patternRepo.findById(patternId)
                .orElseThrow(() -> new IllegalArgumentException("Pattern not found: " + patternId));
        pattern.setActive(!pattern.getActive());
        return patternRepo.save(pattern);
    }

    @Transactional
    public void deletePattern(Long patternId) {
        patternRepo.deleteById(patternId);
    }

    public List<NlpLearnedPattern> getActivePatterns() {
        return patternRepo.findByActiveTrueOrderByTimesSeenDesc();
    }

    // ── Run history ──────────────────────────────────────────────────────────

    public List<NlpLearnerRun> getRunHistory() {
        return learnerRunRepo.findAllByOrderByRunAtDesc();
    }

    private void saveRunHistory(long durationMs, long totalQueries, long unknownQueries,
                                long lowConfidence, long positiveRatings, long negativeRatings,
                                long activePatterns, long newPatterns, int strategyCount,
                                Map<String, Long> intentDist, Map<String, Double> strategyConf,
                                String triggeredBy) {
        try {
            var run = new NlpLearnerRun();
            run.setDurationMs((int) durationMs);
            run.setTotalQueries(totalQueries);
            run.setUnknownQueries(unknownQueries);
            run.setLowConfidence(lowConfidence);
            run.setPositiveRatings(positiveRatings);
            run.setNegativeRatings(negativeRatings);
            run.setActivePatterns(activePatterns);
            run.setNewPatterns(newPatterns);
            run.setStrategyCount(strategyCount);
            run.setIntentDistribution(objectMapper.writeValueAsString(intentDist));
            run.setStrategyConfidence(objectMapper.writeValueAsString(strategyConf));
            run.setTriggeredBy(triggeredBy);
            learnerRunRepo.save(run);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize learner run stats", e);
        }
    }
}
