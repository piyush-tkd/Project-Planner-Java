package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.JiraResourceMapping;
import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.repository.JiraResourceMappingRepository;
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
public class JiraResourceMappingService {

    private final JiraResourceMappingRepository mappingRepository;
    private final ResourceRepository resourceRepository;
    private final JdbcTemplate jdbcTemplate;
    private final JiraClient jiraClient;

    // ── Data structures for API responses ────────────────────────────────────

    public record JiraNameInfo(String displayName, String accountId, long issueCount, double hoursLogged) {}

    public record MappingSuggestion(
        String jiraDisplayName,
        String jiraAccountId,
        Long resourceId,
        String resourceName,
        String resourceRole,
        String resourcePod,
        String resourceEmail,
        double confidence,
        String matchReason
    ) {}

    public record ResourceMappingResponse(
        Long id,
        String jiraDisplayName,
        String jiraAccountId,
        Long resourceId,
        String resourceName,
        String resourceRole,
        String resourceEmail,
        String mappingType,
        Double confidence,
        Boolean confirmed,
        long issueCount,
        double hoursLogged,
        String resourceCategory,  // MAX_BILLING, BUFFER, or EXTERNAL
        String jiraAvatarUrl      // avatar synced from Jira, null if not yet synced
    ) {}

    public record MappingStats(
        long totalJiraNames,
        long autoMatched,
        long manuallyMapped,
        long excluded,
        long unmatched,
        long confirmed,
        long totalBillableResources,
        long maxBillingCount,
        long maxBillingMapped,
        long bufferCount
    ) {}

    // ── POD project key helpers ──────────────────────────────────────────────

    /**
     * Get all Jira project keys configured in POD boards.
     */
    private Set<String> getConfiguredProjectKeys() {
        String sql = "SELECT DISTINCT jira_project_key FROM jira_pod_board";
        return new HashSet<>(jdbcTemplate.queryForList(sql, String.class));
    }

    /**
     * Buffer detail: Jira display name → account id, issue count, hours logged
     * in configured POD projects only.
     */
    public record BufferDetail(String displayName, String accountId, long issueCount, double hoursLogged) {}

    /**
     * Find all Jira display names that have logged hours (worklogs) against
     * any issue in configured board project keys.
     * Buffer = anyone who logged hours in a configured board and is NOT in the Resource pool.
     */
    private Map<String, BufferDetail> getBufferDetails(Set<String> configuredKeys) {
        if (configuredKeys.isEmpty()) return Collections.emptyMap();

        String placeholders = configuredKeys.stream().map(k -> "?").collect(Collectors.joining(","));
        Object[] keys = configuredKeys.toArray();

        // Worklog authors with hours on any issue in configured board projects
        String sql = """
            SELECT w.author_display_name AS display_name,
                   w.author_account_id AS account_id,
                   COUNT(DISTINCT w.issue_key) AS issue_count,
                   COALESCE(SUM(w.time_spent_seconds), 0) / 3600.0 AS hours
            FROM jira_issue_worklog w
            JOIN jira_issue i ON w.issue_key = i.issue_key
            WHERE i.project_key IN (%s)
            AND w.author_display_name IS NOT NULL AND w.author_display_name != ''
            GROUP BY w.author_display_name, w.author_account_id
            """.formatted(placeholders);

        Map<String, BufferDetail> result = new LinkedHashMap<>();
        jdbcTemplate.query(sql, rs -> {
            String name = rs.getString("display_name");
            result.put(name, new BufferDetail(
                name,
                rs.getString("account_id"),
                rs.getLong("issue_count"),
                rs.getDouble("hours")
            ));
        }, keys);
        return result;
    }

    /**
     * Convenience: just the names for quick lookups.
     */
    private Set<String> getBufferJiraNames(Set<String> configuredKeys) {
        return getBufferDetails(configuredKeys).keySet();
    }

    // ── Scan unique Jira names ───────────────────────────────────────────────

    /**
     * Discover unique display names from Jira issues and worklogs,
     * but ONLY from configured POD board projects. This ensures we only
     * consider users who have activity against configured PODs.
     */
    public List<JiraNameInfo> scanJiraNames() {
        Set<String> configuredKeys = getConfiguredProjectKeys();
        if (configuredKeys.isEmpty()) return Collections.emptyList();

        String placeholders = configuredKeys.stream().map(k -> "?").collect(Collectors.joining(","));
        Object[] keys = configuredKeys.toArray();

        // Collect assignees + reporters from issues in configured POD projects only
        String issueNamesSql = """
            SELECT display_name, account_id, COUNT(*) as cnt
            FROM (
                SELECT assignee_display_name AS display_name, assignee_account_id AS account_id
                FROM jira_issue WHERE assignee_display_name IS NOT NULL AND assignee_display_name != ''
                AND project_key IN (%s)
                UNION ALL
                SELECT reporter_display_name, reporter_account_id
                FROM jira_issue WHERE reporter_display_name IS NOT NULL AND reporter_display_name != ''
                AND project_key IN (%s)
            ) sub
            GROUP BY display_name, account_id
            """.formatted(placeholders, placeholders);

        // Collect worklog authors with hours from configured POD projects only
        String worklogSql = """
            SELECT w.author_display_name AS display_name, w.author_account_id AS account_id,
                   COUNT(*) AS cnt, COALESCE(SUM(w.time_spent_seconds), 0) / 3600.0 AS hours
            FROM jira_issue_worklog w
            JOIN jira_issue i ON w.issue_key = i.issue_key
            WHERE w.author_display_name IS NOT NULL AND w.author_display_name != ''
            AND i.project_key IN (%s)
            GROUP BY w.author_display_name, w.author_account_id
            """.formatted(placeholders);

        // Double the keys for issue SQL (two IN clauses)
        Object[] issueKeys = new Object[keys.length * 2];
        System.arraycopy(keys, 0, issueKeys, 0, keys.length);
        System.arraycopy(keys, 0, issueKeys, keys.length, keys.length);

        Map<String, JiraNameInfo> nameMap = new LinkedHashMap<>();

        // From issues
        jdbcTemplate.query(issueNamesSql, rs -> {
            String name = rs.getString("display_name");
            String accountId = rs.getString("account_id");
            long cnt = rs.getLong("cnt");
            nameMap.merge(name, new JiraNameInfo(name, accountId, cnt, 0),
                (a, b) -> new JiraNameInfo(a.displayName, a.accountId != null ? a.accountId : b.accountId,
                    a.issueCount + b.issueCount, a.hoursLogged));
        }, issueKeys);

        // From worklogs
        jdbcTemplate.query(worklogSql, rs -> {
            String name = rs.getString("display_name");
            String accountId = rs.getString("account_id");
            long cnt = rs.getLong("cnt");
            double hours = rs.getDouble("hours");
            nameMap.merge(name, new JiraNameInfo(name, accountId, cnt, hours),
                (a, b) -> new JiraNameInfo(a.displayName, a.accountId != null ? a.accountId : b.accountId,
                    a.issueCount + b.issueCount, a.hoursLogged + b.hoursLogged));
        }, keys);

        return new ArrayList<>(nameMap.values());
    }

    // ── Smart matching algorithm ─────────────────────────────────────────────

    /**
     * Run fuzzy matching for all unmatched Jira names against billable resources.
     * Returns suggestions sorted by confidence descending.
     */
    public List<MappingSuggestion> autoMatch() {
        List<JiraNameInfo> jiraNames = scanJiraNames();
        List<Resource> resources = resourceRepository.findAll();
        List<JiraResourceMapping> existing = mappingRepository.findAllByOrderByJiraDisplayNameAsc();
        Set<String> alreadyMapped = existing.stream()
            .filter(m -> m.getConfirmed() || "MANUAL".equals(m.getMappingType()) || "EXCLUDED".equals(m.getMappingType()))
            .map(JiraResourceMapping::getJiraDisplayName)
            .collect(Collectors.toSet());

        List<MappingSuggestion> suggestions = new ArrayList<>();

        for (JiraNameInfo jira : jiraNames) {
            if (alreadyMapped.contains(jira.displayName)) continue;

            MappingSuggestion best = null;
            double bestScore = 0;

            for (Resource res : resources) {
                MatchResult match = computeMatchScore(jira, res);
                if (match.score > bestScore && match.score >= 0.40) {
                    bestScore = match.score;
                    best = new MappingSuggestion(
                        jira.displayName, jira.accountId,
                        res.getId(), res.getName(),
                        res.getRole().name(), null,
                        res.getEmail(),
                        match.score, match.reason
                    );
                }
            }

            if (best != null) {
                suggestions.add(best);
            } else {
                // Unmatched — add with null resource
                suggestions.add(new MappingSuggestion(
                    jira.displayName, jira.accountId,
                    null, null, null, null, null,
                    0.0, "No match found"
                ));
            }
        }

        suggestions.sort(Comparator.comparingDouble(MappingSuggestion::confidence).reversed());
        return suggestions;
    }

    private record MatchResult(double score, String reason) {}

    private MatchResult computeMatchScore(JiraNameInfo jira, Resource resource) {
        String jiraName = jira.displayName;
        String resName = resource.getName();
        String jiraEmail = jira.accountId; // accountId is often email-like
        String resEmail = resource.getEmail();

        // 1. Email match (highest priority)
        if (resEmail != null && !resEmail.isBlank() && jiraEmail != null && !jiraEmail.isBlank()) {
            if (resEmail.equalsIgnoreCase(jiraEmail)) {
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

        // 4. Token reorder match: "Smith, John" ↔ "John Smith"
        Set<String> jiraSet = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        Set<String> resSet = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        Collections.addAll(jiraSet, jiraTokens);
        Collections.addAll(resSet, resTokens);
        if (!jiraSet.isEmpty() && jiraSet.equals(resSet)) {
            return new MatchResult(0.95, "Token reorder match");
        }

        // 5. First/Last name match: "J. Smith" ↔ "John Smith"
        if (jiraTokens.length >= 2 && resTokens.length >= 2) {
            String jiraFirst = jiraTokens[0].replace(".", "");
            String jiraLast = jiraTokens[jiraTokens.length - 1];
            String resFirst = resTokens[0].replace(".", "");
            String resLast = resTokens[resTokens.length - 1];

            if (jiraLast.equalsIgnoreCase(resLast)) {
                if (jiraFirst.equalsIgnoreCase(resFirst)) {
                    return new MatchResult(0.95, "First + Last name match");
                }
                // Initial match: "J" matches "John"
                if (jiraFirst.length() == 1 && resFirst.length() > 1 &&
                    jiraFirst.equalsIgnoreCase(resFirst.substring(0, 1))) {
                    return new MatchResult(0.85, "Initial + Last name match");
                }
                if (resFirst.length() == 1 && jiraFirst.length() > 1 &&
                    resFirst.equalsIgnoreCase(jiraFirst.substring(0, 1))) {
                    return new MatchResult(0.85, "Initial + Last name match");
                }
                // Just last name matches
                return new MatchResult(0.40, "Last name match");
            }
        }

        // 6. Initials match: "JS" → "John Smith"
        if (jiraTokens.length == 1 && jiraTokens[0].length() <= 3 && resTokens.length >= 2) {
            String initials = Arrays.stream(resTokens).map(t -> t.substring(0, 1)).collect(Collectors.joining());
            if (jiraTokens[0].equalsIgnoreCase(initials)) {
                return new MatchResult(0.65, "Initials match");
            }
        }

        // 7. Levenshtein distance on normalized full name
        String normJira = normalize(jiraName).toLowerCase();
        String normRes = normalize(resName).toLowerCase();
        int dist = levenshtein(normJira, normRes);
        int maxLen = Math.max(normJira.length(), normRes.length());
        if (maxLen > 0 && dist <= 3) {
            double score = 1.0 - ((double) dist / maxLen);
            score = Math.max(0.50, Math.min(0.85, score));
            return new MatchResult(score, "Fuzzy match (edit distance " + dist + ")");
        }

        // 8. Partial token overlap
        long commonTokens = Arrays.stream(jiraTokens)
            .filter(jt -> Arrays.stream(resTokens).anyMatch(rt -> rt.equalsIgnoreCase(jt)))
            .count();
        if (commonTokens > 0 && jiraTokens.length > 0 && resTokens.length > 0) {
            double overlap = (double) commonTokens / Math.max(jiraTokens.length, resTokens.length);
            if (overlap >= 0.5) {
                return new MatchResult(0.50 + (overlap * 0.2), "Partial name overlap");
            }
        }

        // 9. Contains check
        if (normJira.contains(normRes) || normRes.contains(normJira)) {
            return new MatchResult(0.55, "Name contains match");
        }

        return new MatchResult(0, "No match");
    }

    // ── String utilities ─────────────────────────────────────────────────────

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

    // ── CRUD operations ──────────────────────────────────────────────────────

    public List<ResourceMappingResponse> getAllMappings() {
        List<JiraResourceMapping> mappings = mappingRepository.findAllByOrderByJiraDisplayNameAsc();
        Map<String, JiraNameInfo> nameInfoMap = scanJiraNames().stream()
            .collect(Collectors.toMap(n -> n.displayName, n -> n, (a, b) -> a));

        Set<String> configuredKeys = getConfiguredProjectKeys();
        Map<String, BufferDetail> bufferDetails = getBufferDetails(configuredKeys);
        Set<String> mappedNames = mappings.stream()
            .map(JiraResourceMapping::getJiraDisplayName)
            .collect(Collectors.toSet());

        // Build a secondary lookup: jira_display_name set directly on the Resource entity.
        // This covers the case where a resource was linked via the jira_display_name column
        // but the jira_resource_mapping table entry has resource_id = null (or doesn't exist).
        Map<String, Resource> jiraNameToResource = resourceRepository.findByJiraDisplayNameIsNotNull()
            .stream()
            .collect(Collectors.toMap(Resource::getJiraDisplayName, r -> r, (a, b) -> a));

        // Build response from existing mappings
        List<ResourceMappingResponse> result = new ArrayList<>(mappings.stream().map(m -> {
            JiraNameInfo info = nameInfoMap.getOrDefault(m.getJiraDisplayName(),
                new JiraNameInfo(m.getJiraDisplayName(), m.getJiraAccountId(), 0, 0));

            // Prefer the resource linked in the mapping table; fall back to
            // the Resource entity's jira_display_name column.  This prevents a
            // person from appearing as BUFFER when they are in fact a resource.
            Resource effectiveResource = m.getResource() != null
                ? m.getResource()
                : jiraNameToResource.get(m.getJiraDisplayName());

            // Determine resource category
            String category;
            if (effectiveResource != null) {
                category = "MAX_BILLING";
            } else if (bufferDetails.containsKey(m.getJiraDisplayName())) {
                category = "BUFFER";
            } else {
                category = "EXTERNAL";
            }

            return new ResourceMappingResponse(
                m.getId(), m.getJiraDisplayName(), m.getJiraAccountId(),
                effectiveResource != null ? effectiveResource.getId() : null,
                effectiveResource != null ? effectiveResource.getName() : null,
                effectiveResource != null ? effectiveResource.getRole().name() : null,
                effectiveResource != null ? effectiveResource.getEmail() : null,
                m.getMappingType(), m.getConfidence(), m.getConfirmed(),
                info.issueCount, info.hoursLogged, category,
                effectiveResource != null ? effectiveResource.getAvatarUrl() : null
            );
        }).toList());

        // Names known to belong to a resource (via mapping table OR direct column)
        Set<String> allKnownResourceJiraNames = new HashSet<>(mappedNames);
        allKnownResourceJiraNames.addAll(jiraNameToResource.keySet());

        // Add buffer people who are NOT yet in the mapping table AND not already
        // a known resource — these are people who logged hours in configured PODs
        // but haven't been auto-matched or manually mapped yet.
        for (BufferDetail bd : bufferDetails.values()) {
            if (!allKnownResourceJiraNames.contains(bd.displayName)) {
                result.add(new ResourceMappingResponse(
                    null, bd.displayName, bd.accountId,
                    null, null, null, null,
                    "AUTO", 0.0, false,
                    bd.issueCount, bd.hoursLogged, "BUFFER", null
                ));
            }
        }

        // Remove EXTERNAL entries — only show users from configured PODs
        result.removeIf(r -> "EXTERNAL".equals(r.resourceCategory()));

        // Sort: MAX_BILLING first, then BUFFER; within each by name
        result.sort(Comparator
            .comparingInt((ResourceMappingResponse r) -> {
                if ("MAX_BILLING".equals(r.resourceCategory)) return 0;
                if ("BUFFER".equals(r.resourceCategory)) return 1;
                return 2;
            })
            .thenComparing(ResourceMappingResponse::jiraDisplayName, String.CASE_INSENSITIVE_ORDER));

        return result;
    }

    @Transactional
    public JiraResourceMapping saveMapping(String jiraDisplayName, Long resourceId, String mappingType) {
        // When assigning a resource, first clear any OTHER mapping that currently points to this resource.
        // This prevents stale mappings (e.g., old auto-match "Sudhir Patil" → Sneha Patil lingering
        // after manually reassigning Sneha Patil to a different Jira user).
        if (resourceId != null && !"EXCLUDED".equals(mappingType)) {
            List<JiraResourceMapping> existingForResource = mappingRepository.findByResourceId(resourceId);
            for (JiraResourceMapping old : existingForResource) {
                if (!old.getJiraDisplayName().equals(jiraDisplayName)) {
                    log.info("Clearing old mapping: {} → resource {} (replaced by {})",
                        old.getJiraDisplayName(), resourceId, jiraDisplayName);
                    old.setResource(null);
                    old.setConfidence(0.0);
                    old.setMappingType("AUTO");
                    old.setConfirmed(false);
                    mappingRepository.save(old);
                }
            }
        }

        JiraResourceMapping mapping = mappingRepository.findByJiraDisplayName(jiraDisplayName)
            .orElse(new JiraResourceMapping());

        mapping.setJiraDisplayName(jiraDisplayName);
        mapping.setMappingType(mappingType != null ? mappingType : "MANUAL");

        if ("EXCLUDED".equals(mappingType)) {
            mapping.setResource(null);
            mapping.setConfidence(0.0);
        } else if (resourceId != null) {
            Resource resource = resourceRepository.findById(resourceId).orElse(null);
            mapping.setResource(resource);
            mapping.setConfidence(1.0);
        }
        mapping.setConfirmed(true);
        JiraResourceMapping saved = mappingRepository.save(mapping);

        // Best-effort: fetch and store the Jira avatar URL on the resource
        if (saved.getJiraAccountId() != null && saved.getResource() != null) {
            try {
                String avatarUrl = jiraClient.getUserAvatarUrl(saved.getJiraAccountId());
                if (avatarUrl != null) {
                    saved.getResource().setAvatarUrl(avatarUrl);
                    resourceRepository.save(saved.getResource());
                    log.info("Synced Jira avatar for resource {} ({})",
                        saved.getResource().getName(), saved.getJiraAccountId());
                }
            } catch (Exception e) {
                log.warn("Avatar sync skipped for {}: {}", saved.getJiraAccountId(), e.getMessage());
            }
        }

        return saved;
    }

    /**
     * Backfill avatar URLs for all confirmed mappings that have a resource and jiraAccountId
     * but no avatar_url yet. Safe to call at any time.
     */
    @Transactional
    public int syncAllAvatars() {
        List<JiraResourceMapping> confirmed = mappingRepository.findAllByOrderByJiraDisplayNameAsc().stream()
            .filter(m -> m.getConfirmed() != null && m.getConfirmed())
            .filter(m -> m.getResource() != null)
            .filter(m -> m.getJiraAccountId() != null)
            .filter(m -> m.getResource().getAvatarUrl() == null)
            .toList();

        int count = 0;
        for (JiraResourceMapping m : confirmed) {
            try {
                String avatarUrl = jiraClient.getUserAvatarUrl(m.getJiraAccountId());
                if (avatarUrl != null) {
                    m.getResource().setAvatarUrl(avatarUrl);
                    resourceRepository.save(m.getResource());
                    count++;
                }
            } catch (Exception e) {
                log.warn("Avatar sync failed for {}: {}", m.getJiraAccountId(), e.getMessage());
            }
        }
        log.info("syncAllAvatars: updated {} resources", count);
        return count;
    }

    @Transactional
    public void deleteMapping(Long id) {
        mappingRepository.deleteById(id);
    }

    /**
     * Clear all mappings pointing to a specific resource.
     * Used when the user wants to "unmap" a resource — the Jira user entry
     * stays in the mapping table but loses its resource link.
     */
    @Transactional
    public int clearResourceMapping(Long resourceId) {
        List<JiraResourceMapping> mappings = mappingRepository.findByResourceId(resourceId);
        int cleared = 0;
        for (JiraResourceMapping m : mappings) {
            log.info("Clearing mapping: {} → resource {} (user requested unmap)", m.getJiraDisplayName(), resourceId);
            m.setResource(null);
            m.setConfidence(0.0);
            m.setMappingType("AUTO");
            m.setConfirmed(false);
            mappingRepository.save(m);
            cleared++;
        }
        return cleared;
    }

    /**
     * Run auto-match and persist all suggestions into the mapping table.
     * Only creates/updates mappings that aren't already confirmed or manually set.
     */
    @Transactional
    public List<ResourceMappingResponse> scanAndAutoMatch() {
        List<MappingSuggestion> suggestions = autoMatch();

        for (MappingSuggestion s : suggestions) {
            JiraResourceMapping mapping = mappingRepository.findByJiraDisplayName(s.jiraDisplayName)
                .orElse(new JiraResourceMapping());

            // Skip confirmed or manually set mappings
            if (mapping.getId() != null && (mapping.getConfirmed() ||
                "MANUAL".equals(mapping.getMappingType()) || "EXCLUDED".equals(mapping.getMappingType()))) {
                continue;
            }

            // Only persist if we actually found a resource match.
            // Unmatched POD users show up as buffer naturally — no need to clutter the mapping table.
            if (s.resourceId == null && mapping.getId() == null) {
                continue;
            }

            mapping.setJiraDisplayName(s.jiraDisplayName);
            mapping.setJiraAccountId(s.jiraAccountId);
            if (s.resourceId != null) {
                mapping.setResource(resourceRepository.findById(s.resourceId).orElse(null));
                mapping.setMappingType("AUTO");
            } else {
                mapping.setResource(null);
                mapping.setMappingType("AUTO");
            }
            mapping.setConfidence(s.confidence);
            mapping.setConfirmed(false);
            mappingRepository.save(mapping);
        }

        return getAllMappings();
    }

    /**
     * Bulk-accept all auto-matched mappings above a confidence threshold.
     */
    @Transactional
    public int bulkAccept(double minConfidence) {
        List<JiraResourceMapping> unconfirmed = mappingRepository.findByConfirmedFalse();
        int count = 0;
        for (JiraResourceMapping m : unconfirmed) {
            if (m.getConfidence() != null && m.getConfidence() >= minConfidence && m.getResource() != null) {
                m.setConfirmed(true);
                mappingRepository.save(m);
                count++;
            }
        }
        return count;
    }

    /**
     * Resources from the Resource tab that have NO Jira user mapped to them.
     */
    public record UnmappedResource(Long id, String name, String role, String email) {}

    public List<UnmappedResource> getUnmappedResources() {
        List<Resource> allResources = resourceRepository.findAll();
        List<JiraResourceMapping> allMappings = mappingRepository.findAllByOrderByJiraDisplayNameAsc();
        Set<Long> mappedResourceIds = allMappings.stream()
            .filter(m -> m.getResource() != null)
            .map(m -> m.getResource().getId())
            .collect(Collectors.toSet());

        return allResources.stream()
            .filter(r -> !mappedResourceIds.contains(r.getId()))
            .map(r -> new UnmappedResource(r.getId(), r.getName(), r.getRole().name(), r.getEmail()))
            .sorted(Comparator.comparing(UnmappedResource::name, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }

    public MappingStats getStats() {
        long total = mappingRepository.count();
        long auto = mappingRepository.countByMappingType("AUTO");
        long manual = mappingRepository.countByMappingType("MANUAL");
        long excluded = mappingRepository.countByMappingType("EXCLUDED");
        long confirmed = mappingRepository.countByConfirmedTrue();
        long resources = resourceRepository.count();

        // Count unmatched: auto with null resource
        long unmatched = mappingRepository.findByMappingType("AUTO").stream()
            .filter(m -> m.getResource() == null)
            .count();

        long autoMatched = auto - unmatched;

        // Count by resource category (includes buffer people not yet in mapping table)
        Set<String> configuredKeys = getConfiguredProjectKeys();
        Set<String> bufferNames = getBufferJiraNames(configuredKeys);
        List<JiraResourceMapping> all = mappingRepository.findAllByOrderByJiraDisplayNameAsc();
        Set<String> mappedNames = all.stream()
            .map(JiraResourceMapping::getJiraDisplayName).collect(Collectors.toSet());
        // Also include names set directly on the Resource entity (jira_display_name column)
        Set<String> resourceDirectNames = resourceRepository.findByJiraDisplayNameIsNotNull().stream()
            .map(Resource::getJiraDisplayName)
            .collect(Collectors.toSet());
        // Max Billing = total resources from the Resource tab
        long maxBillingCount = resources;
        // How many of those resources actually have a Jira user mapped to them
        // (via mapping table OR via direct jira_display_name column)
        Set<Long> mappedResourceIds = all.stream()
            .filter(m -> m.getResource() != null)
            .map(m -> m.getResource().getId())
            .collect(Collectors.toSet());
        resourceRepository.findByJiraDisplayNameIsNotNull()
            .forEach(r -> mappedResourceIds.add(r.getId()));
        long maxBillingMapped = mappedResourceIds.size();
        // Buffer = people in buffer set who are NOT a known resource via either source
        Set<String> allKnownResourceNames = new HashSet<>(mappedNames);
        allKnownResourceNames.addAll(resourceDirectNames);
        long bufferInTable = all.stream()
            .filter(m -> m.getResource() == null
                && !resourceDirectNames.contains(m.getJiraDisplayName())
                && bufferNames.contains(m.getJiraDisplayName()))
            .count();
        long bufferNotInTable = bufferNames.stream()
            .filter(n -> !allKnownResourceNames.contains(n))
            .count();
        long bufferCount = bufferInTable + bufferNotInTable;

        return new MappingStats(total, autoMatched, manual, excluded, unmatched, confirmed, resources,
            maxBillingCount, maxBillingMapped, bufferCount);
    }
}
