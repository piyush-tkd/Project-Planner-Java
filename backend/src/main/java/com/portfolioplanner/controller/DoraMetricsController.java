package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.ReleaseCalendar;
import com.portfolioplanner.domain.model.Sprint;
import com.portfolioplanner.domain.repository.ReleaseCalendarRepository;
import com.portfolioplanner.domain.repository.SprintRepository;
import com.portfolioplanner.service.jira.DoraJiraService;
import com.portfolioplanner.service.jira.JiraCredentialsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * DORA Metrics Controller.
 *
 * <p>Two data sources, picked automatically:
 * <ul>
 *   <li><b>source=jira</b> — Real-time from Jira REST API (requires configured
 *       Jira credentials + at least one enabled POD).</li>
 *   <li><b>source=release_calendar</b> — Fallback from the internal release_calendar
 *       and sprint tables.</li>
 * </ul>
 *
 * <p>Clients can also force a source via the {@code source} query parameter.
 */
@RestController
@RequestMapping("/api/reports/dora")
@RequiredArgsConstructor
@Slf4j
public class DoraMetricsController {

    private final ReleaseCalendarRepository releaseRepo;
    private final SprintRepository sprintRepo;
    private final DoraJiraService doraJiraService;
    private final JiraCredentialsService jiraCreds;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getDoraMetrics(
            @RequestParam(required = false) Integer months,
            @RequestParam(required = false) String source) {

        int lookbackMonths = months != null ? months : 6;

        // Decide data source: explicit param → auto-detect (Jira if configured, else DB)
        boolean useJira;
        if ("jira".equalsIgnoreCase(source)) {
            useJira = true;
        } else if ("db".equalsIgnoreCase(source) || "release_calendar".equalsIgnoreCase(source)) {
            useJira = false;
        } else {
            useJira = jiraCreds.isConfigured();
        }

        if (useJira) {
            try {
                Map<String, Object> jiraResult = doraJiraService.computeFromJira(lookbackMonths);
                if (jiraResult.containsKey("error")) {
                    log.warn("Jira DORA failed: {} — falling back to release_calendar", jiraResult.get("error"));
                } else {
                    // Enrich with sprint count from DB
                    LocalDate cutoff = LocalDate.now().minusMonths(lookbackMonths);
                    long sprintCount = sprintRepo.findAllByOrderByStartDateAsc().stream()
                            .filter(s -> !s.getStartDate().isBefore(cutoff) && !s.getEndDate().isAfter(LocalDate.now()))
                            .count();
                    jiraResult.put("totalSprints", (int) sprintCount);
                    return ResponseEntity.ok(jiraResult);
                }
            } catch (Exception e) {
                log.error("Jira DORA failed, falling back to release_calendar: {}", e.getMessage());
            }
        }

        // ── Fallback: release_calendar-based computation ─────────────────
        return ResponseEntity.ok(computeFromReleaseCalendar(lookbackMonths));
    }

    /* ═══════════════════════════════════════════════════════════════════
       Monthly granularity — one DORA scorecard per month (for MBR)
       ═══════════════════════════════════════════════════════════════════ */

    @GetMapping("/monthly")
    public ResponseEntity<Map<String, Object>> getMonthlyDora(
            @RequestParam(required = false) Integer months,
            @RequestParam(required = false) String source) {

        int lookbackMonths = months != null ? months : 6;
        boolean useJira;
        if ("jira".equalsIgnoreCase(source)) useJira = true;
        else if ("db".equalsIgnoreCase(source) || "release_calendar".equalsIgnoreCase(source)) useJira = false;
        else useJira = jiraCreds.isConfigured();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("lookbackMonths", lookbackMonths);

        if (useJira) {
            try {
                List<Map<String, Object>> monthly = doraJiraService.computeMonthlyFromJira(lookbackMonths);
                if (!monthly.isEmpty()) {
                    response.put("source", "jira");
                    response.put("months", monthly);
                    return ResponseEntity.ok(response);
                }
            } catch (Exception e) {
                log.error("Jira monthly DORA failed, falling back: {}", e.getMessage());
            }
        }

        // ── Fallback: release_calendar ───────────────────────────────────
        response.put("source", "release_calendar");
        response.put("months", computeMonthlyFromReleaseCalendar(lookbackMonths));
        return ResponseEntity.ok(response);
    }

    private List<Map<String, Object>> computeMonthlyFromReleaseCalendar(int lookbackMonths) {
        LocalDate now = LocalDate.now();
        LocalDate cutoff = now.minusMonths(lookbackMonths);
        List<ReleaseCalendar> allReleases = releaseRepo.findAllByOrderByReleaseDateAsc().stream()
                .filter(r -> !r.getReleaseDate().isBefore(cutoff) && !r.getReleaseDate().isAfter(now))
                .collect(Collectors.toList());

        // Build month list oldest→newest
        List<String> monthKeys = new ArrayList<>();
        for (int i = lookbackMonths - 1; i >= 0; i--) {
            LocalDate m = now.minusMonths(i).withDayOfMonth(1);
            monthKeys.add(m.getYear() + "-" + String.format("%02d", m.getMonthValue()));
        }

        // Bucket releases by month
        Map<String, List<ReleaseCalendar>> byMonth = new LinkedHashMap<>();
        for (String mk : monthKeys) byMonth.put(mk, new ArrayList<>());
        for (ReleaseCalendar r : allReleases) {
            String mk = r.getReleaseDate().getYear() + "-" +
                    String.format("%02d", r.getReleaseDate().getMonthValue());
            if (byMonth.containsKey(mk)) byMonth.get(mk).add(r);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (String mk : monthKeys) {
            List<ReleaseCalendar> rels = byMonth.get(mk);
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("month", mk);

            // Deployment Frequency
            int count = rels.size();
            String dfLevel = count >= 8 ? "elite" : count >= 4 ? "high" : count >= 1 ? "medium" : "low";
            List<String> names = rels.stream().map(ReleaseCalendar::getName).collect(Collectors.toList());
            card.put("deploymentFrequency", Map.of("value", count, "level", dfLevel, "unit", "releases", "releases", names));

            // Lead Time
            List<Long> lts = rels.stream()
                    .map(r -> ChronoUnit.DAYS.between(r.getCodeFreezeDate(), r.getReleaseDate()))
                    .collect(Collectors.toList());
            double avgLt = lts.stream().mapToLong(Long::longValue).average().orElse(0);
            String ltLevel = avgLt <= 1 ? "elite" : avgLt <= 7 ? "high" : avgLt <= 30 ? "medium" : "low";
            card.put("leadTimeForChanges", Map.of("value", Math.round(avgLt * 10.0) / 10.0, "level", ltLevel, "unit", "days", "sampleSize", lts.size()));

            // CFR
            long special = rels.stream().filter(r -> "SPECIAL".equals(r.getType())).count();
            double cfr = count > 0 ? (double) special / count * 100 : 0;
            String cfrLevel = cfr <= 5 ? "elite" : cfr <= 10 ? "high" : cfr <= 15 ? "medium" : "low";
            card.put("changeFailureRate", Map.of("value", Math.round(cfr * 10.0) / 10.0, "level", cfrLevel, "unit", "%",
                    "bugCount", special, "totalIssues", count));

            // MTTR
            double mttr = 0;
            int rec = 0;
            for (int i = 0; i < rels.size(); i++) {
                if ("SPECIAL".equals(rels.get(i).getType())) {
                    for (int j = i + 1; j < rels.size(); j++) {
                        if ("REGULAR".equals(rels.get(j).getType())) {
                            mttr += ChronoUnit.DAYS.between(rels.get(i).getReleaseDate(), rels.get(j).getReleaseDate());
                            rec++;
                            break;
                        }
                    }
                }
            }
            if (rec > 0) mttr /= rec;
            String mttrLevel = mttr < 1 ? "elite" : mttr <= 1 ? "high" : mttr <= 7 ? "medium" : "low";
            card.put("meanTimeToRecovery", Map.of("value", Math.round(mttr * 10.0) / 10.0, "level", mttrLevel, "unit", "days", "recoveryEvents", rec));

            card.put("totalReleases", count);
            card.put("totalIssues", count);
            result.add(card);
        }
        return result;
    }

    /* ═══════════════════════════════════════════════════════════════════
       Fallback: release_calendar + sprint tables
       ═══════════════════════════════════════════════════════════════════ */

    private Map<String, Object> computeFromReleaseCalendar(int lookbackMonths) {
        LocalDate cutoff = LocalDate.now().minusMonths(lookbackMonths);

        List<ReleaseCalendar> allReleases = releaseRepo.findAllByOrderByReleaseDateAsc();
        List<Sprint> allSprints = sprintRepo.findAllByOrderByStartDateAsc();

        List<ReleaseCalendar> releases = allReleases.stream()
                .filter(r -> !r.getReleaseDate().isBefore(cutoff))
                .collect(Collectors.toList());

        List<ReleaseCalendar> pastReleases = releases.stream()
                .filter(r -> !r.getReleaseDate().isAfter(LocalDate.now()))
                .collect(Collectors.toList());

        // ── 1. Deployment Frequency ──────────────────────────────────────
        double deployFrequencyPerMonth = 0;
        String deployFrequencyLabel = "N/A";
        String deployFrequencyLevel = "low";

        if (pastReleases.size() >= 2) {
            long daySpan = ChronoUnit.DAYS.between(
                    pastReleases.get(0).getReleaseDate(),
                    pastReleases.get(pastReleases.size() - 1).getReleaseDate());
            double monthSpan = Math.max(daySpan / 30.44, 1);
            deployFrequencyPerMonth = pastReleases.size() / monthSpan;

            if (deployFrequencyPerMonth >= 8)      { deployFrequencyLabel = "Daily";     deployFrequencyLevel = "elite";  }
            else if (deployFrequencyPerMonth >= 4)  { deployFrequencyLabel = "Weekly";    deployFrequencyLevel = "high";   }
            else if (deployFrequencyPerMonth >= 1)  { deployFrequencyLabel = "Monthly";   deployFrequencyLevel = "medium"; }
            else                                     { deployFrequencyLabel = "< Monthly"; deployFrequencyLevel = "low";    }
        }

        // ── 2. Lead Time for Changes ─────────────────────────────────────
        double avgLeadTimeDays = 0;
        String leadTimeLevel = "low";
        List<Map<String, Object>> leadTimeDetails = new ArrayList<>();

        if (!pastReleases.isEmpty()) {
            List<Long> leadTimes = new ArrayList<>();
            for (ReleaseCalendar r : pastReleases) {
                long days = ChronoUnit.DAYS.between(r.getCodeFreezeDate(), r.getReleaseDate());
                leadTimes.add(days);
                leadTimeDetails.add(Map.of(
                        "release", r.getName(),
                        "codeFreezeDate", r.getCodeFreezeDate().toString(),
                        "releaseDate", r.getReleaseDate().toString(),
                        "leadTimeDays", days
                ));
            }
            avgLeadTimeDays = leadTimes.stream().mapToLong(Long::longValue).average().orElse(0);

            if (avgLeadTimeDays <= 1)       leadTimeLevel = "elite";
            else if (avgLeadTimeDays <= 7)  leadTimeLevel = "high";
            else if (avgLeadTimeDays <= 30) leadTimeLevel = "medium";
            else                            leadTimeLevel = "low";
        }

        // ── 3. Change Failure Rate ───────────────────────────────────────
        long specialCount = pastReleases.stream().filter(r -> "SPECIAL".equals(r.getType())).count();
        double changeFailureRate = pastReleases.isEmpty() ? 0 :
                (double) specialCount / pastReleases.size() * 100;
        String changeFailureLevel;
        if (changeFailureRate <= 5)        changeFailureLevel = "elite";
        else if (changeFailureRate <= 10)  changeFailureLevel = "high";
        else if (changeFailureRate <= 15)  changeFailureLevel = "medium";
        else                               changeFailureLevel = "low";

        // ── 4. Mean Time to Recovery ─────────────────────────────────────
        double mttrDays = 0;
        String mttrLevel = "low";
        int recoveryCount = 0;

        for (int i = 0; i < pastReleases.size(); i++) {
            if ("SPECIAL".equals(pastReleases.get(i).getType())) {
                for (int j = i + 1; j < pastReleases.size(); j++) {
                    if ("REGULAR".equals(pastReleases.get(j).getType())) {
                        mttrDays += ChronoUnit.DAYS.between(
                                pastReleases.get(i).getReleaseDate(),
                                pastReleases.get(j).getReleaseDate());
                        recoveryCount++;
                        break;
                    }
                }
            }
        }
        if (recoveryCount > 0) mttrDays /= recoveryCount;
        if (mttrDays < 1)       mttrLevel = "elite";
        else if (mttrDays <= 1)  mttrLevel = "high";
        else if (mttrDays <= 7)  mttrLevel = "medium";
        else                     mttrLevel = "low";

        // ── Monthly trend ────────────────────────────────────────────────
        Map<String, Integer> monthlyReleaseCounts = new LinkedHashMap<>();
        Map<String, Integer> monthlyFailures = new LinkedHashMap<>();
        for (ReleaseCalendar r : pastReleases) {
            String monthKey = r.getReleaseDate().getYear() + "-" +
                    String.format("%02d", r.getReleaseDate().getMonthValue());
            monthlyReleaseCounts.merge(monthKey, 1, Integer::sum);
            if ("SPECIAL".equals(r.getType())) {
                monthlyFailures.merge(monthKey, 1, Integer::sum);
            }
        }

        List<Map<String, Object>> trend = new ArrayList<>();
        for (String month : monthlyReleaseCounts.keySet()) {
            trend.add(Map.of(
                    "month", month,
                    "releases", monthlyReleaseCounts.getOrDefault(month, 0),
                    "failures", monthlyFailures.getOrDefault(month, 0)
            ));
        }

        // ── Sprint context ───────────────────────────────────────────────
        List<Sprint> recentSprints = allSprints.stream()
                .filter(s -> !s.getStartDate().isBefore(cutoff) && !s.getEndDate().isAfter(LocalDate.now()))
                .collect(Collectors.toList());

        // ── Build response ───────────────────────────────────────────────
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("lookbackMonths", lookbackMonths);
        response.put("source", "release_calendar");
        response.put("totalReleases", pastReleases.size());
        response.put("totalSprints", recentSprints.size());

        response.put("deploymentFrequency", Map.of(
                "value", Math.round(deployFrequencyPerMonth * 100.0) / 100.0,
                "label", deployFrequencyLabel,
                "level", deployFrequencyLevel,
                "unit", "per month"
        ));

        response.put("leadTimeForChanges", Map.of(
                "value", Math.round(avgLeadTimeDays * 10.0) / 10.0,
                "level", leadTimeLevel,
                "unit", "days",
                "details", leadTimeDetails
        ));

        response.put("changeFailureRate", Map.of(
                "value", Math.round(changeFailureRate * 10.0) / 10.0,
                "level", changeFailureLevel,
                "unit", "%",
                "specialReleases", specialCount,
                "totalReleases", pastReleases.size()
        ));

        response.put("meanTimeToRecovery", Map.of(
                "value", Math.round(mttrDays * 10.0) / 10.0,
                "level", mttrLevel,
                "unit", "days",
                "recoveryEvents", recoveryCount
        ));

        response.put("trend", trend);

        // ── Upcoming releases ────────────────────────────────────────────
        List<Map<String, Object>> upcoming = allReleases.stream()
                .filter(r -> r.getReleaseDate().isAfter(LocalDate.now()))
                .limit(5)
                .map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", r.getName());
                    m.put("releaseDate", r.getReleaseDate().toString());
                    m.put("codeFreezeDate", r.getCodeFreezeDate().toString());
                    m.put("type", r.getType());
                    m.put("daysUntilRelease", ChronoUnit.DAYS.between(LocalDate.now(), r.getReleaseDate()));
                    return m;
                })
                .collect(Collectors.toList());
        response.put("upcoming", upcoming);

        return response;
    }
}
