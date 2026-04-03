package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.repository.ResourceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class JiraBufferService {

    private final ResourceRepository resourceRepository;
    private final JdbcTemplate jdbcTemplate;
    private final JiraClient jiraClient;

    // ── DTOs ──────────────────────────────────────────────────────────────────

    /** Lightweight info about a Jira display name — used for the dropdown and buffer list */
    public record JiraUserInfo(String displayName, String accountId, long issueCount, double hoursLogged) {}

    /** A buffer entry: Jira user who logged hours in configured PODs but has no resource mapped */
    public record BufferEntry(
        String jiraDisplayName,
        String jiraAccountId,
        long issueCount,
        double hoursLogged,
        List<String> projectKeys  // which configured projects they worked on
    ) {}

    /** Stats for the buffer page */
    public record BufferStats(
        long totalResources,
        long mappedResources,
        long unmappedResources,
        long bufferCount
    ) {}

    // ── Jira user scanning (for the dropdown) ─────────────────────────────────

    /**
     * Get all unique Jira users from three sources:
     * 1) Local DB: assignees + reporters from jira_issue
     * 2) Local DB: worklog authors from jira_issue_worklog
     * 3) Live Jira API: assignable project members for all configured project keys
     *
     * This ensures users like Paul and Srujana who exist in Jira but may not yet
     * have synced issues/worklogs still appear in the dropdown.
     */
    public List<JiraUserInfo> scanJiraUsers() {
        // Collect assignees + reporters from issues
        String issueNamesSql = """
            SELECT display_name, account_id, COUNT(*) as cnt
            FROM (
                SELECT assignee_display_name AS display_name, assignee_account_id AS account_id
                FROM jira_issue WHERE assignee_display_name IS NOT NULL AND assignee_display_name != ''
                UNION ALL
                SELECT reporter_display_name, reporter_account_id
                FROM jira_issue WHERE reporter_display_name IS NOT NULL AND reporter_display_name != ''
            ) sub
            GROUP BY display_name, account_id
            """;

        // Collect worklog authors with hours
        String worklogSql = """
            SELECT author_display_name AS display_name, author_account_id AS account_id,
                   COUNT(*) AS cnt, COALESCE(SUM(time_spent_seconds), 0) / 3600.0 AS hours
            FROM jira_issue_worklog
            WHERE author_display_name IS NOT NULL AND author_display_name != ''
            GROUP BY author_display_name, author_account_id
            """;

        Map<String, JiraUserInfo> nameMap = new LinkedHashMap<>();

        // From issues
        jdbcTemplate.query(issueNamesSql, rs -> {
            String name = rs.getString("display_name");
            String accountId = rs.getString("account_id");
            long cnt = rs.getLong("cnt");
            nameMap.merge(name, new JiraUserInfo(name, accountId, cnt, 0),
                (a, b) -> new JiraUserInfo(a.displayName, a.accountId != null ? a.accountId : b.accountId,
                    a.issueCount + b.issueCount, a.hoursLogged));
        });

        // From worklogs
        jdbcTemplate.query(worklogSql, rs -> {
            String name = rs.getString("display_name");
            String accountId = rs.getString("account_id");
            long cnt = rs.getLong("cnt");
            double hours = rs.getDouble("hours");
            nameMap.merge(name, new JiraUserInfo(name, accountId, cnt, hours),
                (a, b) -> new JiraUserInfo(a.displayName, a.accountId != null ? a.accountId : b.accountId,
                    a.issueCount + b.issueCount, a.hoursLogged + b.hoursLogged));
        });

        // From live Jira API: fetch assignable members for ALL known project keys
        // (POD boards + support boards + any previously synced projects)
        try {
            Set<String> projectKeys = getAllKnownProjectKeys();
            for (String projectKey : projectKeys) {
                try {
                    List<Map<String, Object>> members = jiraClient.getProjectMembers(projectKey);
                    for (Map<String, Object> member : members) {
                        String displayName = (String) member.get("displayName");
                        String accountId = (String) member.get("accountId");
                        if (displayName != null && !displayName.isBlank()) {
                            // Only add if not already in the map (don't overwrite local stats)
                            nameMap.putIfAbsent(displayName, new JiraUserInfo(displayName, accountId, 0, 0));
                        }
                    }
                } catch (Exception e) {
                    log.warn("Failed to fetch project members for {}: {}", projectKey, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch live Jira users: {}", e.getMessage());
        }

        List<JiraUserInfo> result = new ArrayList<>(nameMap.values());
        result.sort(Comparator.comparing(JiraUserInfo::displayName, String.CASE_INSENSITIVE_ORDER));
        return result;
    }

    // ── Buffer detection ──────────────────────────────────────────────────────

    /**
     * Get all Jira project keys configured in POD boards.
     */
    private Set<String> getConfiguredProjectKeys() {
        String sql = "SELECT DISTINCT jira_project_key FROM jira_pod_board";
        return new HashSet<>(jdbcTemplate.queryForList(sql, String.class));
    }

    /**
     * Get ALL known project keys: POD boards + support boards + previously synced projects.
     * Used to cast a wide net when fetching Jira users from the API.
     */
    private Set<String> getAllKnownProjectKeys() {
        Set<String> keys = new HashSet<>();
        // POD boards
        keys.addAll(jdbcTemplate.queryForList(
            "SELECT DISTINCT jira_project_key FROM jira_pod_board", String.class));
        // Support boards
        try {
            keys.addAll(jdbcTemplate.queryForList(
                "SELECT DISTINCT project_key FROM jira_support_board WHERE project_key IS NOT NULL", String.class));
        } catch (Exception ignored) {}
        // Previously synced projects (from sync status table)
        try {
            keys.addAll(jdbcTemplate.queryForList(
                "SELECT DISTINCT project_key FROM jira_sync_status", String.class));
        } catch (Exception ignored) {}
        // Any project keys that appear in synced issues
        try {
            keys.addAll(jdbcTemplate.queryForList(
                "SELECT DISTINCT project_key FROM jira_issue", String.class));
        } catch (Exception ignored) {}
        keys.remove(null);
        keys.remove("");
        return keys;
    }

    /**
     * Find all Jira users who have logged hours (worklogs) against any issue
     * in configured board project keys but are NOT mapped to a resource.
     */
    public List<BufferEntry> getBufferUsers() {
        Set<String> configuredKeys = getConfiguredProjectKeys();
        if (configuredKeys.isEmpty()) return Collections.emptyList();

        // Get all Jira display names that are mapped to resources.
        // Source 1: jira_display_name column directly on the Resource entity
        Set<String> mappedJiraNames = resourceRepository.findByJiraDisplayNameIsNotNull().stream()
            .map(Resource::getJiraDisplayName)
            .collect(Collectors.toCollection(HashSet::new));

        // Source 2: jira_resource_mapping table (set via the Resource Mapping settings page).
        // This is the source that was previously missed — causing mapped resources to still
        // appear as buffer users.
        try {
            jdbcTemplate.queryForList(
                "SELECT jira_display_name FROM jira_resource_mapping WHERE jira_display_name IS NOT NULL",
                String.class
            ).forEach(mappedJiraNames::add);
        } catch (Exception ex) {
            log.warn("Could not query jira_resource_mapping for buffer exclusion: {}", ex.getMessage());
        }

        String placeholders = configuredKeys.stream().map(k -> "?").collect(Collectors.joining(","));
        Object[] keys = configuredKeys.toArray();

        // Worklog authors with hours on configured board projects
        String sql = """
            SELECT w.author_display_name AS display_name,
                   w.author_account_id AS account_id,
                   COUNT(DISTINCT w.issue_key) AS issue_count,
                   COALESCE(SUM(w.time_spent_seconds), 0) / 3600.0 AS hours,
                   STRING_AGG(DISTINCT i.project_key, ',') AS project_keys
            FROM jira_issue_worklog w
            JOIN jira_issue i ON w.issue_key = i.issue_key
            WHERE i.project_key IN (%s)
            AND w.author_display_name IS NOT NULL AND w.author_display_name != ''
            GROUP BY w.author_display_name, w.author_account_id
            ORDER BY hours DESC
            """.formatted(placeholders);

        List<BufferEntry> buffers = new ArrayList<>();
        jdbcTemplate.query(sql, rs -> {
            String name = rs.getString("display_name");
            // Only include if NOT mapped to a resource
            if (!mappedJiraNames.contains(name)) {
                String projectKeysStr = rs.getString("project_keys");
                List<String> pkeys = projectKeysStr != null
                    ? Arrays.asList(projectKeysStr.split(","))
                    : List.of();
                buffers.add(new BufferEntry(
                    name,
                    rs.getString("account_id"),
                    rs.getLong("issue_count"),
                    rs.getDouble("hours"),
                    pkeys
                ));
            }
        }, keys);

        return buffers;
    }

    /**
     * Stats for the buffer page header.
     */
    public BufferStats getBufferStats() {
        long totalResources = resourceRepository.count();

        // Count resources mapped via either source
        Set<Long> mappedResourceIds = new HashSet<>();
        resourceRepository.findByJiraDisplayNameIsNotNull()
            .forEach(r -> mappedResourceIds.add(r.getId()));
        try {
            jdbcTemplate.queryForList(
                "SELECT DISTINCT resource_id FROM jira_resource_mapping WHERE jira_display_name IS NOT NULL",
                Long.class
            ).forEach(mappedResourceIds::add);
        } catch (Exception ex) {
            log.warn("Could not query jira_resource_mapping for stats: {}", ex.getMessage());
        }

        long mappedResources   = mappedResourceIds.size();
        long unmappedResources = totalResources - mappedResources;
        long bufferCount       = getBufferUsers().size();
        return new BufferStats(totalResources, mappedResources, unmappedResources, bufferCount);
    }

    // ── Auto-match: suggest Jira user for unmapped resources ──────────────────

    public record AutoMatchSuggestion(
        Long resourceId,
        String resourceName,
        String suggestedJiraName,
        String suggestedJiraAccountId,
        double confidence,
        String matchReason
    ) {}

    /**
     * Run fuzzy matching for all resources that don't yet have a Jira display name.
     * Returns suggestions sorted by confidence descending.
     */
    public List<AutoMatchSuggestion> autoMatchSuggestions() {
        List<JiraUserInfo> jiraUsers = scanJiraUsers();
        List<Resource> unmapped = resourceRepository.findAll().stream()
            .filter(r -> r.getJiraDisplayName() == null || r.getJiraDisplayName().isBlank())
            .toList();

        // Already-taken Jira names (mapped to other resources)
        Set<String> takenJiraNames = resourceRepository.findByJiraDisplayNameIsNotNull().stream()
            .map(Resource::getJiraDisplayName)
            .collect(Collectors.toSet());

        List<AutoMatchSuggestion> suggestions = new ArrayList<>();
        for (Resource res : unmapped) {
            double bestScore = 0;
            JiraUserInfo bestMatch = null;
            String bestReason = "";

            for (JiraUserInfo jira : jiraUsers) {
                if (takenJiraNames.contains(jira.displayName)) continue;

                MatchResult match = computeMatchScore(jira, res);
                if (match.score > bestScore && match.score >= 0.40) {
                    bestScore = match.score;
                    bestMatch = jira;
                    bestReason = match.reason;
                }
            }

            if (bestMatch != null) {
                suggestions.add(new AutoMatchSuggestion(
                    res.getId(), res.getName(),
                    bestMatch.displayName, bestMatch.accountId,
                    bestScore, bestReason
                ));
            }
        }

        suggestions.sort(Comparator.comparingDouble(AutoMatchSuggestion::confidence).reversed());
        return suggestions;
    }

    /**
     * Apply auto-match: set jiraDisplayName on resources based on suggestions.
     * Only applies suggestions above the given confidence threshold.
     */
    @Transactional
    public int applyAutoMatch(double minConfidence) {
        List<AutoMatchSuggestion> suggestions = autoMatchSuggestions();
        int count = 0;
        for (AutoMatchSuggestion s : suggestions) {
            if (s.confidence >= minConfidence) {
                Resource resource = resourceRepository.findById(s.resourceId).orElse(null);
                if (resource != null && (resource.getJiraDisplayName() == null || resource.getJiraDisplayName().isBlank())) {
                    resource.setJiraDisplayName(s.suggestedJiraName);
                    resource.setJiraAccountId(s.suggestedJiraAccountId);
                    resourceRepository.save(resource);
                    count++;
                }
            }
        }
        return count;
    }

    // ── Fuzzy matching (reused from the original JiraResourceMappingService) ──

    private record MatchResult(double score, String reason) {}

    private MatchResult computeMatchScore(JiraUserInfo jira, Resource resource) {
        String jiraName = jira.displayName;
        String resName = resource.getName();
        String resEmail = resource.getEmail();

        // 1. Email match (highest priority)
        if (resEmail != null && !resEmail.isBlank() && jira.accountId != null && !jira.accountId.isBlank()) {
            if (resEmail.equalsIgnoreCase(jira.accountId)) {
                return new MatchResult(1.0, "Email exact match");
            }
        }

        // 2. Exact name match
        if (normalize(jiraName).equals(normalize(resName))) {
            return new MatchResult(0.98, "Exact name match");
        }

        // 3. Case-insensitive match
        if (normalize(jiraName).equalsIgnoreCase(normalize(resName))) {
            return new MatchResult(0.96, "Case-insensitive name match");
        }

        // Tokenize
        String[] jiraTokens = tokenize(jiraName);
        String[] resTokens = tokenize(resName);

        // 4. Token reorder match
        Set<String> jiraSet = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        Set<String> resSet = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        Collections.addAll(jiraSet, jiraTokens);
        Collections.addAll(resSet, resTokens);
        if (!jiraSet.isEmpty() && jiraSet.equals(resSet)) {
            return new MatchResult(0.95, "Token reorder match");
        }

        // 4.5 Middle name / initial stripped match
        // "Paul Q Pham" vs "Paul Pham" — strip middle tokens and compare first+last
        if (jiraTokens.length >= 2 && resTokens.length >= 2) {
            String jFirst = jiraTokens[0].toLowerCase();
            String jLast  = jiraTokens[jiraTokens.length - 1].toLowerCase();
            String rFirst = resTokens[0].toLowerCase();
            String rLast  = resTokens[resTokens.length - 1].toLowerCase();

            // Direct first+last comparison ignoring any middle names/initials
            if (jFirst.equals(rFirst) && jLast.equals(rLast) &&
                (jiraTokens.length != resTokens.length)) {
                return new MatchResult(0.93, "First + Last match (middle name ignored)");
            }
            // Also handle reversed order: "Pham Paul" vs "Paul Q Pham"
            if (jFirst.equals(rLast) && jLast.equals(rFirst) &&
                (jiraTokens.length != resTokens.length)) {
                return new MatchResult(0.90, "First + Last match (reversed, middle ignored)");
            }
        }

        // 5. First/Last name match
        if (jiraTokens.length >= 2 && resTokens.length >= 2) {
            String jiraFirst = jiraTokens[0].replace(".", "");
            String jiraLast = jiraTokens[jiraTokens.length - 1];
            String resFirst = resTokens[0].replace(".", "");
            String resLast = resTokens[resTokens.length - 1];

            if (jiraLast.equalsIgnoreCase(resLast)) {
                if (jiraFirst.equalsIgnoreCase(resFirst)) {
                    return new MatchResult(0.95, "First + Last name match");
                }
                if (jiraFirst.length() == 1 && resFirst.length() > 1 &&
                    jiraFirst.equalsIgnoreCase(resFirst.substring(0, 1))) {
                    return new MatchResult(0.85, "Initial + Last name match");
                }
                if (resFirst.length() == 1 && jiraFirst.length() > 1 &&
                    resFirst.equalsIgnoreCase(jiraFirst.substring(0, 1))) {
                    return new MatchResult(0.85, "Initial + Last name match");
                }
                return new MatchResult(0.40, "Last name match");
            }
        }

        // 6. Levenshtein distance
        String normJira = normalize(jiraName).toLowerCase();
        String normRes = normalize(resName).toLowerCase();
        int dist = levenshtein(normJira, normRes);
        int maxLen = Math.max(normJira.length(), normRes.length());
        if (maxLen > 0 && dist <= 3) {
            double score = 1.0 - ((double) dist / maxLen);
            score = Math.max(0.50, Math.min(0.85, score));
            return new MatchResult(score, "Fuzzy match (edit distance " + dist + ")");
        }

        // 7. Partial token overlap
        long commonTokens = Arrays.stream(jiraTokens)
            .filter(jt -> Arrays.stream(resTokens).anyMatch(rt -> rt.equalsIgnoreCase(jt)))
            .count();
        if (commonTokens > 0 && jiraTokens.length > 0 && resTokens.length > 0) {
            double overlap = (double) commonTokens / Math.max(jiraTokens.length, resTokens.length);
            if (overlap >= 0.5) {
                return new MatchResult(0.50 + (overlap * 0.2), "Partial name overlap");
            }
        }

        // 8. Contains check
        if (normJira.contains(normRes) || normRes.contains(normJira)) {
            return new MatchResult(0.55, "Name contains match");
        }

        return new MatchResult(0, "No match");
    }

    private String normalize(String name) {
        if (name == null) return "";
        return name.replaceAll("[^a-zA-Z0-9\\s]", "").replaceAll("\\s+", " ").trim();
    }

    private String[] tokenize(String name) {
        String normalized = normalize(name);
        if (normalized.isEmpty()) return new String[0];
        return normalized.split("\\s+");
    }

    private int levenshtein(String a, String b) {
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) dp[i][0] = i;
        for (int j = 0; j <= b.length(); j++) dp[0][j] = j;
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(dp[i - 1][j] + 1,
                    Math.min(dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost));
            }
        }
        return dp[a.length()][b.length()];
    }
}
