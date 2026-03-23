package com.portfolioplanner.service.nlp.handler;

import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.service.nlp.NlpJiraToolExecutor;
import com.portfolioplanner.service.nlp.NlpStrategy;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Jira-specific pattern handler.
 * Owns JIRA_ISSUE_KEY_PATTERN, JIRA_TICKET_LOOKUP_PATTERNS, JIRA_SEARCH_PATTERNS,
 * JIRA_CONTRIBUTOR_PATTERNS, JIRA_BUG_PATTERNS, JIRA_SPRINT_HEALTH_PATTERNS.
 * Depends on NlpJiraToolExecutor for issue lookups.
 */
@Component
public class JiraPatternHandler implements NlpPatternHandler {

    private final NlpJiraToolExecutor jiraToolExecutor;

    public JiraPatternHandler(NlpJiraToolExecutor jiraToolExecutor) {
        this.jiraToolExecutor = jiraToolExecutor;
    }

    // ── Jira Issue Key pattern (e.g. PROJ-123, TAT-456) ─────────────────────
    private static final Pattern JIRA_ISSUE_KEY_PATTERN =
            Pattern.compile("(?:^|\\s)([A-Z]{2,10}-\\d{1,6})(?:\\s|$|\\?|\\.|,)");

    private static final List<Pattern> JIRA_TICKET_LOOKUP_PATTERNS = List.of(
            Pattern.compile("(?i)(?:tell me about|summarize|summary of|details? (?:for|of|on)|what is|what's|show me|look up|lookup|describe|status of|info (?:on|about|for))\\s+([A-Z]{2,10}-\\d{1,6})"),
            Pattern.compile("^\\s*([A-Z]{2,10}-\\d{1,6})\\s*\\??\\s*$")
    );

    // ── Jira search / filter patterns ─────────────────────────────────
    private static final List<Pattern> JIRA_SEARCH_PATTERNS = List.of(
            Pattern.compile("(?i)(?:show|find|list|get)\\s+(?:me\\s+)?(?:all\\s+)?(?:open\\s+)?(?:bugs?|defects?|issues?)\\s+(?:in|for|under|on)\\s+([A-Z]{2,10})"),
            Pattern.compile("(?i)(?:tickets?|issues?|stories?|tasks?)\\s+(?:assigned to|for|owned by)\\s+(.+)$"),
            Pattern.compile("(?i)(?:high|highest|critical|blocker|urgent)\\s+(?:priority\\s+)?(?:tickets?|issues?|stories?)(?:\\s+in\\s+([A-Z]{2,10}))?"),
            Pattern.compile("(?i)(?:open|unresolved|pending|in.progress)\\s+(?:tickets?|issues?|stories?|tasks?)(?:\\s+in\\s+([A-Z]{2,10}))?"),
            Pattern.compile("(?i)(?:search|find|look)\\s+(?:for\\s+)?(?:tickets?|issues?)\\s+(?:with|containing|matching|about|labeled?)\\s+(.+)$"),
            Pattern.compile("(?i)(?:jira\\s+)?(?:backlog|todo|to.do)(?:\\s+(?:size|count|items?))?(?:\\s+(?:for|in)\\s+([A-Z]{2,10}))?")
    );

    // ── Jira contributor / worklog patterns ──────────────────────────
    private static final List<Pattern> JIRA_CONTRIBUTOR_PATTERNS = List.of(
            Pattern.compile("(?i)(?:who|which people|what people)\\s+(?:worked on|contributed to|touched|involved in|helped with)\\s+([A-Z]{2,10}-\\d{1,6})"),
            Pattern.compile("(?i)(?:hours?|time)\\s+(?:logged|spent|tracked|booked)\\s+(?:on|for|against)\\s+([A-Z]{2,10}-\\d{1,6})"),
            Pattern.compile("(?i)(?:worklog|work log|work\\s+log)\\s+(?:for|of|on)\\s+([A-Z]{2,10}-\\d{1,6})"),
            Pattern.compile("(?i)(?:contributors?|participants?|collaborators?)\\s+(?:for|of|on)\\s+([A-Z]{2,10}-\\d{1,6})"),
            Pattern.compile("(?i)who\\s+all\\s+(?:worked|contributed|logged)\\s+(?:on|to|for)\\s+([A-Z]{2,10}-\\d{1,6})")
    );

    // ── Jira bug patterns ─────────────────────────────────────────────
    private static final List<Pattern> JIRA_BUG_PATTERNS = List.of(
            Pattern.compile("(?i)(?:how many|total|count of|number of)\\s+(?:open\\s+)?(?:bugs?|defects?)"),
            Pattern.compile("(?i)(?:bug|defect)\\s+(?:summary|count|report|trend|rate|metrics|stats|statistics|overview)"),
            Pattern.compile("(?i)(?:show|give|get)\\s+(?:me\\s+)?(?:the\\s+)?(?:bug|defect)\\s+(?:summary|report|trend|overview|metrics|count)"),
            Pattern.compile("(?i)(?:bugs?|defects?)\\s+(?:by|per)\\s+(?:priority|severity|assignee|status|project)"),
            Pattern.compile("(?i)(?:are we)\\s+(?:creating|making|producing)\\s+(?:bugs?|defects?)\\s+faster"),
            Pattern.compile("(?i)(?:bug|defect)\\s+(?:creation|escape|fix|resolution)\\s+(?:rate|trend|time)"),
            Pattern.compile("(?i)(?:average|avg|mean)\\s+(?:bug|defect)\\s+(?:resolution|fix)\\s+time"),
            Pattern.compile("(?i)(?:oldest|longest)\\s+(?:open\\s+)?(?:bugs?|defects?)")
    );

    // ── Jira sprint health patterns ──────────────────────────────────
    private static final List<Pattern> JIRA_SPRINT_HEALTH_PATTERNS = List.of(
            Pattern.compile("(?i)(?:jira\\s+)?sprint\\s+(?:health|velocity|progress|status|burndown|metrics|performance)"),
            Pattern.compile("(?i)(?:how is|how's)\\s+(?:the\\s+)?(?:current\\s+)?(?:jira\\s+)?sprint\\s+(?:going|doing|progressing)"),
            Pattern.compile("(?i)(?:sprint\\s+)?(?:completion|burn.?down|velocity)\\s+(?:rate|trend|chart|metrics)?"),
            Pattern.compile("(?i)(?:story|stories)\\s+(?:points?\\s+)?(?:completed|done|remaining|left|carried over|carry.?over)(?:\\s+this\\s+sprint)?"),
            Pattern.compile("(?i)(?:blocked|blocking)\\s+(?:stories?|tickets?|issues?)\\s+(?:this|in|current)\\s+sprint"),
            Pattern.compile("(?i)(?:what.s?|how many)\\s+(?:stories?|tickets?)\\s+(?:are\\s+)?(?:in.progress|done|completed|remaining|blocked)\\s+(?:this\\s+sprint|in\\s+the\\s+sprint)?")
    );

    @Override
    public String name() {
        return "JIRA_PATTERNS";
    }

    @Override
    public NlpStrategy.NlpResult tryHandle(String query, NlpCatalogResponse catalog) {
        if (jiraToolExecutor == null) return null;

        // Try Jira ticket lookup (fast-path)
        NlpStrategy.NlpResult ticketLookup = tryJiraTicketLookup(query);
        if (ticketLookup != null) return ticketLookup;

        // Try Jira contributors
        NlpStrategy.NlpResult contributors = tryJiraContributors(query);
        if (contributors != null) return contributors;

        // Try Jira bug summary
        NlpStrategy.NlpResult bugs = tryJiraBugSummary(query);
        if (bugs != null) return bugs;

        // Try Jira sprint health
        NlpStrategy.NlpResult sprint = tryJiraSprintHealth(query);
        if (sprint != null) return sprint;

        return null;
    }

    @Override
    public int order() {
        return 8;
    }

    private NlpStrategy.NlpResult tryJiraTicketLookup(String query) {
        String issueKey = null;

        // Try explicit patterns first
        for (Pattern p : JIRA_TICKET_LOOKUP_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                issueKey = m.group(1).toUpperCase();
                break;
            }
        }

        // If no explicit pattern matched, check for a bare ticket key
        if (issueKey == null) {
            Matcher m = JIRA_ISSUE_KEY_PATTERN.matcher(query);
            if (m.find()) {
                issueKey = m.group(1).toUpperCase();
            }
        }

        if (issueKey == null) return null;

        // Look up the issue from the DB
        Map<String, Object> structured = jiraToolExecutor.lookupIssueStructured(issueKey);
        if (structured == null) {
            return new NlpStrategy.NlpResult(
                    "DATA_QUERY", 0.85,
                    "I couldn't find issue " + issueKey + " in our synced data. "
                            + "It may not have been synced yet, or the key might be incorrect.",
                    null, null, null, "/reports/jira-analytics",
                    List.of("Search for similar issues", "Check Jira sync status", "Show open issues"), null
            );
        }

        String summary = jiraToolExecutor.summarizeIssue(structured);
        String statusEmoji = "Done".equalsIgnoreCase(String.valueOf(structured.get("Status Category")))
                ? "✅ " : "🔷 ";

        return new NlpStrategy.NlpResult(
                "DATA_QUERY", 0.95,
                statusEmoji + structured.get("Key") + " — " + structured.get("Summary"),
                null, null, structured, null,
                List.of("Show worklogs for " + issueKey,
                        "Who else is working on " + structured.get("Project") + "?",
                        "Show open issues for " + structured.get("Assignee")), null
        );
    }

    private NlpStrategy.NlpResult tryJiraContributors(String query) {
        for (Pattern p : JIRA_CONTRIBUTOR_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String issueKey = m.group(1).toUpperCase();
                try {
                    Map<String, Object> result = jiraToolExecutor.getIssueContributors(issueKey);
                    if (result != null) {
                        String summary = jiraToolExecutor.summarizeContributors(result);
                        return new NlpStrategy.NlpResult("DATA_QUERY", 0.92, summary,
                                null, null, result, "/reports/jira-analytics",
                                List.of("Show full details for " + issueKey,
                                        "Show worklog page",
                                        "Show Jira analytics"), null);
                    }
                } catch (Exception e) {
                    return new NlpStrategy.NlpResult("DATA_QUERY", 0.80,
                            "Could not find contributor data for " + issueKey + ". The issue may not be synced yet.",
                            null, null, null, null,
                            List.of("Look up " + issueKey, "Check Jira sync status"), null);
                }
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryJiraBugSummary(String query) {
        for (Pattern p : JIRA_BUG_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Jira Analytics — Bug Summary");
                data.put("route", "/reports/jira-analytics");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                        "Opening Jira Analytics where you can see the bug summary including open bugs by priority, creation trend, and resolution time.",
                        "/reports/jira-analytics", null, data, null,
                        List.of("Show Jira sprint health", "Show support queue", "Show project health"), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryJiraSprintHealth(String query) {
        for (Pattern p : JIRA_SPRINT_HEALTH_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Sprint Planner — Health Check");
                data.put("route", "/sprint-planner");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                        "Opening the Sprint Planning Recommender where you can see sprint health metrics including completion rate, velocity, blocked stories, and burndown.",
                        "/sprint-planner", null, data, null,
                        List.of("Show Jira analytics", "Show bug summary", "Show sprint calendar"), null);
            }
        }
        return null;
    }
}
