package com.portfolioplanner.service.nlp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Resolves follow-up pronouns in NLP queries by substituting them with
 * entities from the user's most recent query result (held in NlpSessionContextCache).
 *
 * Examples of what this resolves:
 *   "which of those are at risk?"     → "which P0 projects are at risk?"
 *   "show me the worst one"           → "show me the project with lowest confidence"
 *   "tell me more about it"           → "tell me more about [last entity]"
 *   "what about them?"                → "what about P0 projects?"
 *
 * If no session context exists, or no pronoun is detected, the original query is
 * returned unchanged (non-destructive — never breaks a valid query).
 */
@Component
public class FollowUpResolver {

    private static final Logger log = LoggerFactory.getLogger(FollowUpResolver.class);

    // Pronouns that indicate a follow-up referring to the previous result set
    private static final Pattern PRONOUN_PATTERN = Pattern.compile(
            "\\b(those|them|they|these|it|that(?:\\s+(?:project|resource|pod|sprint|release|item))?|" +
            "the(?:\\s+(?:first|last|worst|best|highest|lowest|top|bottom))?\\s+one|" +
            "those\\s+(?:projects?|resources?|pods?|sprints?|releases?)|" +
            "all\\s+of\\s+them|any\\s+of\\s+them|" +
            "the\\s+(?:projects?|resources?|pods?|sprints?|releases?|items?))\\b",
            Pattern.CASE_INSENSITIVE
    );

    // Questions that are almost always follow-ups
    private static final Pattern FOLLOW_UP_STARTERS = Pattern.compile(
            "^\\s*(?:which|what|how|who|when|where|why|are|is|do|does|can|show|tell|give|list)\\s+" +
            "(?:of\\s+)?(?:those|them|they|the(?:se|m)|it|that)\\b",
            Pattern.CASE_INSENSITIVE
    );

    private final NlpSessionContextCache sessionCache;

    public FollowUpResolver(NlpSessionContextCache sessionCache) {
        this.sessionCache = sessionCache;
    }

    /**
     * Attempt to resolve pronouns in the query using the session context.
     *
     * @param query    the raw user query
     * @param userId   the authenticated user ID (null = skip)
     * @return the resolved query, or the original if no resolution was needed/possible
     */
    public String resolve(String query, Long userId) {
        if (userId == null || query == null || query.isBlank()) return query;

        // Quick check: does the query contain pronouns at all?
        boolean hasPronouns = PRONOUN_PATTERN.matcher(query).find()
                || FOLLOW_UP_STARTERS.matcher(query).find();
        if (!hasPronouns) return query;

        Optional<NlpSessionContextCache.SessionContext> ctxOpt = sessionCache.get(userId);
        if (ctxOpt.isEmpty()) return query;

        NlpSessionContextCache.SessionContext ctx = ctxOpt.get();
        String resolved = substitutePronouns(query, ctx);

        if (!resolved.equals(query)) {
            log.debug("FollowUpResolver: '{}' → '{}' (tool={}, entities={})",
                    query, resolved, ctx.toolName(), ctx.entityNames().size());
        }
        return resolved;
    }

    // ── Substitution logic ────────────────────────────────────────────────────

    private String substitutePronouns(String query, NlpSessionContextCache.SessionContext ctx) {
        String entityLabel = buildEntityLabel(ctx);
        if (entityLabel == null) return query;

        String lower = query.toLowerCase().trim();

        // "which of those are at risk?" → "which {entityLabel} are at risk?"
        // "what about those?"          → "what about {entityLabel}?"
        // "show me those"              → "show me {entityLabel}"
        String result = PRONOUN_PATTERN.matcher(query).replaceAll(Matcher.quoteReplacement(entityLabel));

        // Special case: "the worst one" / "the best one" / "the first one"
        // → "the worst [entity type from ctx]"
        result = result.replaceAll(
                "(?i)\\bthe\\s+(worst|best|highest|lowest|top|bottom|first|last)\\s+one\\b",
                "the $1 " + singularOf(ctx.listType())
        );

        // Remove doubled entity labels if substitution created redundancy
        // e.g. "which P0 projects of P0 projects" → "which P0 projects"
        if (!entityLabel.isBlank()) {
            result = result.replaceAll(
                    "(?i)(" + Pattern.quote(entityLabel) + ")\\s+of\\s+" + Pattern.quote(entityLabel),
                    "$1"
            );
        }

        return result.trim();
    }

    /**
     * Build a human-readable label for the last result set.
     * e.g. "P0 projects" or "developers in India" or "active sprints"
     */
    private String buildEntityLabel(NlpSessionContextCache.SessionContext ctx) {
        if (ctx.listType() != null) {
            // Use the params to make it specific
            StringBuilder label = new StringBuilder();
            if (ctx.params() != null) {
                String priority = ctx.params().get("priority");
                String status   = ctx.params().get("status");
                String role     = ctx.params().get("role");
                String pod      = ctx.params().get("pod");

                if (priority != null) label.append(priority).append(" ");
                if (status != null) label.append(status.toLowerCase().replace("_", "-")).append(" ");
                if (role != null) label.append(role.toLowerCase()).append("s");
            }
            String type = pluralOf(ctx.listType());
            if (!type.isEmpty()) {
                if (label.length() > 0 && !label.toString().endsWith("s")) label.append(" ");
                label.append(type);
            }
            return label.toString().trim();
        }

        // Fallback: if there was exactly one entity, use its name
        List<String> names = ctx.entityNames();
        if (names != null && names.size() == 1) {
            return names.get(0);
        }

        return null;
    }

    private String pluralOf(String listType) {
        if (listType == null) return "";
        return switch (listType.toUpperCase()) {
            case "PROJECTS"    -> "projects";
            case "RESOURCES"   -> "resources";
            case "PODS"        -> "pods";
            case "SPRINTS"     -> "sprints";
            case "RELEASES"    -> "releases";
            case "JIRA_ISSUES" -> "Jira issues";
            default            -> listType.toLowerCase();
        };
    }

    private String singularOf(String listType) {
        if (listType == null) return "result";
        return switch (listType.toUpperCase()) {
            case "PROJECTS"    -> "project";
            case "RESOURCES"   -> "resource";
            case "PODS"        -> "pod";
            case "SPRINTS"     -> "sprint";
            case "RELEASES"    -> "release";
            case "JIRA_ISSUES" -> "Jira issue";
            default            -> listType.toLowerCase();
        };
    }
}
