package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.JiraIssueFixVersion;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.domain.model.JiraSupportBoard;
import com.portfolioplanner.domain.model.JiraSyncedIssue;
import com.portfolioplanner.domain.repository.JiraIssueFixVersionRepository;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import com.portfolioplanner.domain.repository.JiraSupportBoardRepository;
import com.portfolioplanner.domain.repository.JiraSyncedIssueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * DB-backed DORA metrics service.
 * All data is read from locally synced PostgreSQL tables
 * instead of live Jira API calls.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DoraJiraService {

    private final JiraCredentialsService         creds;
    private final JiraPodRepository              podRepo;
    private final JiraSupportBoardRepository     supportBoardRepo;
    private final JiraSyncedIssueRepository      issueRepo;
    private final JiraIssueFixVersionRepository  fixVersionRepo;

    /* ── Public entry point ──────────────────────────────────────────── */

    public Map<String, Object> computeFromJira(int lookbackMonths) {

        List<String> projectKeys = getEnabledProjectKeys();
        if (projectKeys.isEmpty()) {
            return Map.of("error", "No Jira PODs are configured — enable at least one POD in Settings → Jira Boards.");
        }

        LocalDate cutoff = LocalDate.now().minusMonths(lookbackMonths);
        LocalDateTime cutoffDt = cutoff.atStartOfDay();

        // ── 1  Deployment Frequency  (released versions) ────────────────
        Map<String, Object> deployFreq = computeDeploymentFrequency(projectKeys, cutoff, lookbackMonths);

        // ── 2  Lead Time for Changes  (cycle time of resolved issues) ───
        Map<String, Object> leadTime = computeLeadTime(projectKeys, cutoffDt);

        // ── 3  Change Failure Rate  (bug ratio) ─────────────────────────
        Map<String, Object> cfr = computeChangeFailureRate(projectKeys, cutoffDt);

        // ── 4  MTTR  (avg ticket age from support board snapshots; fall back to sprint bugs) ──
        Map<String, Object> mttr = computeMTTRFromSupport(cutoff, lookbackMonths);
        if (mttr == null) mttr = computeMTTR(projectKeys, cutoffDt);

        // ── Monthly trend (issues resolved per month + bugs per month) ──
        List<Map<String, Object>> trend = computeMonthlyTrend(projectKeys, cutoffDt);

        // ── Upcoming releases (unreleased versions with a date) ─────────
        List<Map<String, Object>> upcoming = computeUpcomingReleases(projectKeys);

        // ── Assemble response ───────────────────────────────────────────
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("lookbackMonths", lookbackMonths);
        response.put("source", "jira");
        response.put("projectKeys", projectKeys);
        response.put("deploymentFrequency", deployFreq);
        response.put("leadTimeForChanges", leadTime);
        response.put("changeFailureRate", cfr);
        response.put("meanTimeToRecovery", mttr);
        response.put("trend", trend);
        response.put("upcoming", upcoming);

        int totalReleases = deployFreq.get("totalReleases") instanceof Number
                ? ((Number) deployFreq.get("totalReleases")).intValue() : 0;
        response.put("totalReleases", totalReleases);
        response.put("totalSprints", 0);

        return response;
    }

    /* ═══════════════════════════════════════════════════════════════════
       1  DEPLOYMENT FREQUENCY
       ═══════════════════════════════════════════════════════════════════ */

    private Map<String, Object> computeDeploymentFrequency(
            List<String> projectKeys, LocalDate cutoff, int lookbackMonths) {

        List<Object[]> versionRows = fixVersionRepo.findDistinctVersionsByProjectKeys(projectKeys);

        // De-dup by name, only released versions within lookback window
        Map<String, Object[]> uniqueVersions = new LinkedHashMap<>();
        for (Object[] row : versionRows) {
            String name = (String) row[0];
            Boolean released = (Boolean) row[2];
            LocalDate releaseDate = row[3] != null ? (LocalDate) row[3] : null;

            if (name != null && Boolean.TRUE.equals(released) && releaseDate != null) {
                if (!releaseDate.isBefore(cutoff) && !releaseDate.isAfter(LocalDate.now())) {
                    uniqueVersions.putIfAbsent(name, row);
                }
            }
        }

        int releasedCount = uniqueVersions.size();
        double deploysPerMonth = lookbackMonths > 0 ? (double) releasedCount / lookbackMonths : 0;

        String label;
        String level;
        if (deploysPerMonth >= 8)      { label = "On-Demand"; level = "elite"; }
        else if (deploysPerMonth >= 4) { label = "Weekly";    level = "high";  }
        else if (deploysPerMonth >= 1) { label = "Monthly";   level = "medium";}
        else                            { label = "< Monthly"; level = "low";   }

        List<Map<String, Object>> details = uniqueVersions.values().stream()
                .sorted(Comparator.comparing(v -> ((LocalDate) v[3])))
                .map(v -> {
                    Map<String, Object> d = new LinkedHashMap<>();
                    d.put("release", v[0]);
                    d.put("releaseDate", v[3] != null ? v[3].toString() : null);
                    return d;
                }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("value", Math.round(deploysPerMonth * 100.0) / 100.0);
        result.put("label", label);
        result.put("level", level);
        result.put("unit", "per month");
        result.put("totalReleases", releasedCount);
        result.put("details", details);
        return result;
    }

    /* ═══════════════════════════════════════════════════════════════════
       2  LEAD TIME FOR CHANGES
       ═══════════════════════════════════════════════════════════════════ */

    private Map<String, Object> computeLeadTime(List<String> projectKeys, LocalDateTime since) {
        List<JiraSyncedIssue> issues = issueRepo.findResolvedNonEpicSince(projectKeys, since);

        List<Long> cycleTimes = new ArrayList<>();
        List<Map<String, Object>> details = new ArrayList<>();

        for (JiraSyncedIssue issue : issues) {
            if (issue.getCreatedAt() == null || issue.getResolutionDate() == null) continue;
            long days = ChronoUnit.DAYS.between(issue.getCreatedAt(), issue.getResolutionDate());
            if (days >= 0) {
                cycleTimes.add(days);
                if (details.size() < 30) {
                    details.add(Map.of(
                            "key", issue.getIssueKey(),
                            "summary", truncate(issue.getSummary(), 60),
                            "leadTimeDays", days,
                            "created", issue.getCreatedAt().toLocalDate().toString(),
                            "resolved", issue.getResolutionDate().toLocalDate().toString()
                    ));
                }
            }
        }

        double avgDays = cycleTimes.stream().mapToLong(Long::longValue).average().orElse(0);
        double medianDays = median(cycleTimes);
        String level;
        if (avgDays <= 1)       level = "elite";
        else if (avgDays <= 7)  level = "high";
        else if (avgDays <= 30) level = "medium";
        else                    level = "low";

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("value", Math.round(avgDays * 10.0) / 10.0);
        result.put("level", level);
        result.put("unit", "days");
        result.put("median", Math.round(medianDays * 10.0) / 10.0);
        result.put("sampleSize", cycleTimes.size());
        result.put("details", details);
        return result;
    }

    /* ═══════════════════════════════════════════════════════════════════
       3  CHANGE FAILURE RATE
       ═══════════════════════════════════════════════════════════════════ */

    private Map<String, Object> computeChangeFailureRate(List<String> projectKeys, LocalDateTime since) {
        List<JiraSyncedIssue> allIssues = issueRepo.findResolvedNonEpicSince(projectKeys, since);

        int total = allIssues.size();
        long bugCount = allIssues.stream()
                .filter(i -> isBugType(i.getIssueType()))
                .count();

        double rate = total > 0 ? (double) bugCount / total * 100 : 0;
        String level;
        if (rate <= 5)        level = "elite";
        else if (rate <= 10)  level = "high";
        else if (rate <= 15)  level = "medium";
        else                  level = "low";

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("value", Math.round(rate * 10.0) / 10.0);
        result.put("level", level);
        result.put("unit", "%");
        result.put("bugCount", bugCount);
        result.put("totalIssues", total);
        return result;
    }

    /* ═══════════════════════════════════════════════════════════════════
       4  MTTR
       ═══════════════════════════════════════════════════════════════════ */

    private Map<String, Object> computeMTTR(List<String> projectKeys, LocalDateTime since) {
        List<JiraSyncedIssue> allResolved = issueRepo.findResolvedNonEpicSince(projectKeys, since);

        // Filter to bugs with high priority
        Set<String> highPriorities = Set.of("highest", "high", "critical", "blocker");
        List<JiraSyncedIssue> bugs = allResolved.stream()
                .filter(i -> isBugType(i.getIssueType()))
                .filter(i -> i.getPriorityName() != null &&
                        highPriorities.contains(i.getPriorityName().toLowerCase()))
                .collect(Collectors.toList());

        // If no high-priority bugs, use all bugs as fallback
        if (bugs.isEmpty()) {
            bugs = allResolved.stream()
                    .filter(i -> isBugType(i.getIssueType()))
                    .collect(Collectors.toList());
        }

        List<Long> recoveryTimes = new ArrayList<>();
        List<Map<String, Object>> details = new ArrayList<>();

        for (JiraSyncedIssue issue : bugs) {
            if (issue.getCreatedAt() == null || issue.getResolutionDate() == null) continue;
            long days = ChronoUnit.DAYS.between(issue.getCreatedAt(), issue.getResolutionDate());
            if (days >= 0) {
                recoveryTimes.add(days);
                if (details.size() < 20) {
                    Map<String, Object> d = new LinkedHashMap<>();
                    d.put("key", issue.getIssueKey());
                    d.put("summary", truncate(issue.getSummary(), 60));
                    d.put("recoveryDays", days);
                    d.put("created", issue.getCreatedAt().toLocalDate().toString());
                    d.put("resolved", issue.getResolutionDate().toLocalDate().toString());
                    if (issue.getPriorityName() != null) d.put("priority", issue.getPriorityName());
                    details.add(d);
                }
            }
        }

        double avgDays = recoveryTimes.stream().mapToLong(Long::longValue).average().orElse(0);
        String level;
        if (avgDays < 1)        level = "elite";
        else if (avgDays <= 1)  level = "high";
        else if (avgDays <= 7)  level = "medium";
        else                    level = "low";

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("value", Math.round(avgDays * 10.0) / 10.0);
        result.put("level", level);
        result.put("unit", "days");
        result.put("recoveryEvents", recoveryTimes.size());
        result.put("details", details);
        return result;
    }

    /* ═══════════════════════════════════════════════════════════════════
       4b  MTTR from support board resolved issues (preferred over sprint bugs)
       Uses resolved tickets from JSM/support project keys (synced to
       jira_synced_issue).  Cycle time = created → resolved per ticket.
       Returns null if no support boards are configured or no resolved issues.
       ═══════════════════════════════════════════════════════════════════ */

    private Map<String, Object> computeMTTRFromSupport(LocalDate cutoff, int lookbackMonths) {
        List<String> supportKeys = getSupportProjectKeys();
        if (supportKeys.isEmpty()) return null;

        LocalDateTime since = cutoff.atStartOfDay();
        List<JiraSyncedIssue> resolved = issueRepo.findResolvedNonEpicSince(supportKeys, since);
        if (resolved.isEmpty()) return null;

        List<Long> recoveryTimes = new ArrayList<>();
        List<Map<String, Object>> details = new ArrayList<>();

        for (JiraSyncedIssue issue : resolved) {
            if (issue.getCreatedAt() == null || issue.getResolutionDate() == null) continue;
            long days = ChronoUnit.DAYS.between(issue.getCreatedAt(), issue.getResolutionDate());
            if (days < 0) continue;
            recoveryTimes.add(days);
            if (details.size() < 20) {
                Map<String, Object> d = new LinkedHashMap<>();
                d.put("key", issue.getIssueKey());
                d.put("summary", truncate(issue.getSummary(), 60));
                d.put("recoveryDays", days);
                d.put("created", issue.getCreatedAt().toLocalDate().toString());
                d.put("resolved", issue.getResolutionDate().toLocalDate().toString());
                if (issue.getPriorityName() != null) d.put("priority", issue.getPriorityName());
                details.add(d);
            }
        }

        if (recoveryTimes.isEmpty()) return null;

        double avgDays = recoveryTimes.stream().mapToLong(Long::longValue).average().orElse(0);
        String level;
        if (avgDays < 1)       level = "elite";
        else if (avgDays <= 1) level = "high";
        else if (avgDays <= 7) level = "medium";
        else                   level = "low";

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("value", Math.round(avgDays * 10.0) / 10.0);
        result.put("level", level);
        result.put("unit", "days");
        result.put("recoveryEvents", recoveryTimes.size());
        result.put("source", "support_boards");
        result.put("details", details);
        return result;
    }

    /**
     * Compute per-month MTTR from resolved support issues.
     * Returns a map of monthKey → avg cycle days (or null if no support boards configured).
     */
    private Map<String, Double> computeMonthlyMTTRFromSupport(LocalDate cutoff, List<String> monthKeys) {
        List<String> supportKeys = getSupportProjectKeys();
        if (supportKeys.isEmpty()) return null;

        LocalDateTime since = cutoff.atStartOfDay();
        List<JiraSyncedIssue> resolved = issueRepo.findResolvedNonEpicSince(supportKeys, since);
        if (resolved.isEmpty()) return null;

        Map<String, List<Long>> byMonth = new LinkedHashMap<>();
        for (String mk : monthKeys) byMonth.put(mk, new ArrayList<>());

        for (JiraSyncedIssue issue : resolved) {
            if (issue.getCreatedAt() == null || issue.getResolutionDate() == null) continue;
            long days = ChronoUnit.DAYS.between(issue.getCreatedAt(), issue.getResolutionDate());
            if (days < 0) continue;
            LocalDate rd = issue.getResolutionDate().toLocalDate();
            String mk = rd.getYear() + "-" + String.format("%02d", rd.getMonthValue());
            if (byMonth.containsKey(mk)) byMonth.get(mk).add(days);
        }

        Map<String, Double> result = new LinkedHashMap<>();
        for (String mk : monthKeys) {
            List<Long> vals = byMonth.get(mk);
            result.put(mk, vals.isEmpty() ? 0.0 :
                    vals.stream().mapToLong(Long::longValue).average().orElse(0));
        }
        return result;
    }

    /* ── Monthly trend ────────────────────────────────────────────────── */

    private List<Map<String, Object>> computeMonthlyTrend(List<String> projectKeys, LocalDateTime since) {
        List<JiraSyncedIssue> issues = issueRepo.findResolvedNonEpicSince(projectKeys, since);

        Map<String, Integer> monthlyTotal = new LinkedHashMap<>();
        Map<String, Integer> monthlyBugs  = new LinkedHashMap<>();

        for (JiraSyncedIssue issue : issues) {
            if (issue.getResolutionDate() == null) continue;
            LocalDate d = issue.getResolutionDate().toLocalDate();
            String monthKey = d.getYear() + "-" + String.format("%02d", d.getMonthValue());
            monthlyTotal.merge(monthKey, 1, Integer::sum);
            if (isBugType(issue.getIssueType())) {
                monthlyBugs.merge(monthKey, 1, Integer::sum);
            }
        }

        List<Map<String, Object>> trend = new ArrayList<>();
        for (String month : monthlyTotal.keySet()) {
            trend.add(Map.of(
                    "month", month,
                    "releases", monthlyTotal.getOrDefault(month, 0),
                    "failures", monthlyBugs.getOrDefault(month, 0)
            ));
        }
        return trend;
    }

    /* ── Upcoming releases ───────────────────────────────────────────── */

    private List<Map<String, Object>> computeUpcomingReleases(List<String> projectKeys) {
        List<Object[]> versionRows = fixVersionRepo.findDistinctVersionsByProjectKeys(projectKeys);

        Map<String, Object[]> unique = new LinkedHashMap<>();
        for (Object[] row : versionRows) {
            String name = (String) row[0];
            Boolean released = (Boolean) row[2];
            LocalDate releaseDate = row[3] != null ? (LocalDate) row[3] : null;

            if (name == null || Boolean.TRUE.equals(released) || releaseDate == null) continue;
            if (releaseDate.isAfter(LocalDate.now())) {
                unique.putIfAbsent(name, row);
            }
        }

        return unique.values().stream()
                .sorted(Comparator.comparing(v -> (LocalDate) v[3]))
                .limit(5)
                .map(v -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    LocalDate rd = (LocalDate) v[3];
                    m.put("name", v[0]);
                    m.put("releaseDate", rd.toString());
                    m.put("codeFreezeDate", "N/A");
                    m.put("type", "REGULAR");
                    m.put("daysUntilRelease", ChronoUnit.DAYS.between(LocalDate.now(), rd));
                    return m;
                })
                .collect(Collectors.toList());
    }

    /* ── Monthly granularity DORA scorecard ───────────────────────────── */

    public List<Map<String, Object>> computeMonthlyFromJira(int lookbackMonths) {
        List<String> projectKeys = getEnabledProjectKeys();
        if (projectKeys.isEmpty()) return List.of();

        LocalDate now = LocalDate.now();
        LocalDate cutoff = now.minusMonths(lookbackMonths);
        LocalDateTime cutoffDt = cutoff.atStartOfDay();

        List<JiraSyncedIssue> allIssues = issueRepo.findResolvedNonEpicSince(projectKeys, cutoffDt);
        List<Object[]> allVersionRows = fixVersionRepo.findDistinctVersionsByProjectKeys(projectKeys);

        // Build month list
        List<String> monthKeys = new ArrayList<>();
        for (int i = 0; i < lookbackMonths; i++) {
            LocalDate m = now.minusMonths(i).withDayOfMonth(1);
            monthKeys.add(m.getYear() + "-" + String.format("%02d", m.getMonthValue()));
        }
        Collections.reverse(monthKeys);

        // Monthly MTTR from support board snapshots (preferred)
        Map<String, Double> supportMttrByMonth = computeMonthlyMTTRFromSupport(cutoff, monthKeys);

        // Bucket issues by resolution month
        Map<String, List<JiraSyncedIssue>> issuesByMonth = new LinkedHashMap<>();
        for (String mk : monthKeys) issuesByMonth.put(mk, new ArrayList<>());

        for (JiraSyncedIssue issue : allIssues) {
            if (issue.getResolutionDate() == null) continue;
            LocalDate d = issue.getResolutionDate().toLocalDate();
            String mk = d.getYear() + "-" + String.format("%02d", d.getMonthValue());
            if (issuesByMonth.containsKey(mk)) {
                issuesByMonth.get(mk).add(issue);
            }
        }

        // Bucket versions by release month
        Map<String, List<String>> versionsByMonth = new LinkedHashMap<>();
        for (String mk : monthKeys) versionsByMonth.put(mk, new ArrayList<>());
        Set<String> seenVersions = new HashSet<>();

        for (Object[] row : allVersionRows) {
            String name = (String) row[0];
            Boolean released = (Boolean) row[2];
            LocalDate releaseDate = row[3] != null ? (LocalDate) row[3] : null;

            if (name == null || !Boolean.TRUE.equals(released) || releaseDate == null) continue;
            if (seenVersions.contains(name)) continue;
            if (releaseDate.isBefore(cutoff) || releaseDate.isAfter(now)) continue;

            String mk = releaseDate.getYear() + "-" + String.format("%02d", releaseDate.getMonthValue());
            if (versionsByMonth.containsKey(mk)) {
                versionsByMonth.get(mk).add(name);
                seenVersions.add(name);
            }
        }

        // Build per-month scorecards
        List<Map<String, Object>> result = new ArrayList<>();
        for (String mk : monthKeys) {
            List<JiraSyncedIssue> monthIssues = issuesByMonth.get(mk);
            List<String> monthVersions = versionsByMonth.get(mk);

            Map<String, Object> card = new LinkedHashMap<>();
            card.put("month", mk);

            // 1. Deployment Frequency
            int releaseCount = monthVersions.size();
            String dfLevel = releaseCount >= 8 ? "elite" : releaseCount >= 4 ? "high" :
                    releaseCount >= 1 ? "medium" : "low";
            card.put("deploymentFrequency", Map.of(
                    "value", releaseCount, "level", dfLevel, "unit", "releases",
                    "releases", monthVersions));

            // 2. Lead Time
            List<Long> cycleTimes = new ArrayList<>();
            for (JiraSyncedIssue issue : monthIssues) {
                if (issue.getCreatedAt() == null || issue.getResolutionDate() == null) continue;
                long days = ChronoUnit.DAYS.between(issue.getCreatedAt(), issue.getResolutionDate());
                if (days >= 0) cycleTimes.add(days);
            }
            double avgLt = cycleTimes.stream().mapToLong(Long::longValue).average().orElse(0);
            String ltLevel = avgLt <= 1 ? "elite" : avgLt <= 7 ? "high" : avgLt <= 30 ? "medium" : "low";
            card.put("leadTimeForChanges", Map.of(
                    "value", Math.round(avgLt * 10.0) / 10.0, "level", ltLevel, "unit", "days",
                    "sampleSize", cycleTimes.size()));

            // 3. Change Failure Rate
            int total = monthIssues.size();
            long bugs = monthIssues.stream().filter(i -> isBugType(i.getIssueType())).count();
            double cfrVal = total > 0 ? (double) bugs / total * 100 : 0;
            String cfrLevel = cfrVal <= 5 ? "elite" : cfrVal <= 10 ? "high" : cfrVal <= 15 ? "medium" : "low";
            card.put("changeFailureRate", Map.of(
                    "value", Math.round(cfrVal * 10.0) / 10.0, "level", cfrLevel, "unit", "%",
                    "bugCount", bugs, "totalIssues", total));

            // 4. MTTR — prefer support board snapshots; fall back to sprint bug cycle time
            double avgMttr;
            int recoveryEvents;
            if (supportMttrByMonth != null && supportMttrByMonth.containsKey(mk)) {
                avgMttr = supportMttrByMonth.getOrDefault(mk, 0.0);
                recoveryEvents = avgMttr > 0 ? 1 : 0;
            } else {
                List<Long> mttrTimes = monthIssues.stream()
                        .filter(i -> isBugType(i.getIssueType()))
                        .filter(i -> i.getCreatedAt() != null && i.getResolutionDate() != null)
                        .map(i -> ChronoUnit.DAYS.between(i.getCreatedAt(), i.getResolutionDate()))
                        .filter(d -> d >= 0)
                        .collect(Collectors.toList());
                avgMttr = mttrTimes.stream().mapToLong(Long::longValue).average().orElse(0);
                recoveryEvents = mttrTimes.size();
            }
            String mttrLevel = avgMttr < 1 ? "elite" : avgMttr <= 1 ? "high" : avgMttr <= 7 ? "medium" : "low";
            card.put("meanTimeToRecovery", Map.of(
                    "value", Math.round(avgMttr * 10.0) / 10.0, "level", mttrLevel, "unit", "days",
                    "recoveryEvents", recoveryEvents));

            card.put("totalIssues", total);
            card.put("totalReleases", releaseCount);
            result.add(card);
        }

        return result;
    }

    /* ── Helpers ──────────────────────────────────────────────────────── */

    private List<String> getEnabledProjectKeys() {
        return podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc()
                .stream()
                .flatMap(p -> p.getBoards().stream())
                .map(JiraPodBoard::getJiraProjectKey)
                .distinct()
                .collect(Collectors.toList());
    }

    /**
     * Returns the Jira project keys for enabled support boards (JSM/service-desk).
     * These are used for MTTR — production bugs live here, not in sprint boards.
     * Returns an empty list if no support boards are configured.
     */
    private List<String> getSupportProjectKeys() {
        return supportBoardRepo.findByEnabledTrue().stream()
                .map(JiraSupportBoard::getProjectKey)
                .filter(k -> k != null && !k.isBlank())
                .distinct()
                .collect(Collectors.toList());
    }

    private static boolean isBugType(String typeName) {
        if (typeName == null) return false;
        String lower = typeName.toLowerCase();
        return lower.equals("bug") || lower.equals("incident")
                || lower.equals("hotfix") || lower.equals("defect");
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max) + "…" : s;
    }

    private static double median(List<Long> values) {
        if (values.isEmpty()) return 0;
        List<Long> s = new ArrayList<>(values);
        Collections.sort(s);
        int mid = s.size() / 2;
        return s.size() % 2 == 0 ? (s.get(mid - 1) + s.get(mid)) / 2.0 : s.get(mid);
    }
}
