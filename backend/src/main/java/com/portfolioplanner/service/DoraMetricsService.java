package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.ReleaseCalendar;
import com.portfolioplanner.domain.model.Sprint;
import com.portfolioplanner.domain.repository.ReleaseCalendarRepository;
import com.portfolioplanner.domain.repository.SprintRepository;
import com.portfolioplanner.service.jira.DoraJiraService;
import com.portfolioplanner.service.jira.JiraCredentialsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class DoraMetricsService {

    private final ReleaseCalendarRepository releaseRepo;
    private final SprintRepository sprintRepo;
    private final DoraJiraService doraJiraService;
    private final JiraCredentialsService jiraCreds;

    public Map<String, Object> getDoraMetrics(Integer months, String source) {
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
                    return jiraResult;
                }
            } catch (Exception e) {
                log.error("Jira DORA failed, falling back to release_calendar: {}", e.getMessage());
            }
        }

        // Fallback: release_calendar-based computation
        return computeFromReleaseCalendar(lookbackMonths);
    }

    public Map<String, Object> getMonthlyDora(Integer months, String source) {
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
                    return response;
                }
            } catch (Exception e) {
                log.error("Jira monthly DORA failed, falling back: {}", e.getMessage());
            }
        }

        response.put("source", "release_calendar");
        response.put("months", computeMonthlyFromReleaseCalendar(lookbackMonths));
        return response;
    }

    private List<Map<String, Object>> computeMonthlyFromReleaseCalendar(int lookbackMonths) {
        LocalDate now = LocalDate.now();
        LocalDate cutoff = now.minusMonths(lookbackMonths);
        List<ReleaseCalendar> allReleases = releaseRepo.findAllByOrderByReleaseDateAsc().stream()
                .filter(r -> !r.getReleaseDate().isBefore(cutoff) && !r.getReleaseDate().isAfter(now))
                .collect(Collectors.collectingAndThen(
                        Collectors.toMap(
                                ReleaseCalendar::getReleaseDate,
                                r -> r,
                                (a, b) -> a,
                                LinkedHashMap::new
                        ),
                        map -> new ArrayList<>(map.values())
                ));

        List<String> monthKeys = new ArrayList<>();
        for (int i = lookbackMonths - 1; i >= 0; i--) {
            LocalDate m = now.minusMonths(i).withDayOfMonth(1);
            monthKeys.add(m.getYear() + "-" + String.format("%02d", m.getMonthValue()));
        }

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

            int count = rels.size();
            String dfLevel = count >= 8 ? "elite" : count >= 4 ? "high" : count >= 1 ? "medium" : "low";
            List<String> names = rels.stream()
                    .map(r -> r.getName() != null ? r.getName() : "(unnamed)")
                    .collect(Collectors.toList());
            Map<String, Object> dfMap = new LinkedHashMap<>();
            dfMap.put("value", count); dfMap.put("level", dfLevel); dfMap.put("unit", "releases"); dfMap.put("releases", names);
            card.put("deploymentFrequency", dfMap);

            List<Long> lts = rels.stream()
                    .filter(r -> r.getCodeFreezeDate() != null && r.getReleaseDate() != null)
                    .map(r -> ChronoUnit.DAYS.between(r.getCodeFreezeDate(), r.getReleaseDate()))
                    .collect(Collectors.toList());
            double avgLt = lts.stream().mapToLong(Long::longValue).average().orElse(0);
            String ltLevel = avgLt <= 1 ? "elite" : avgLt <= 7 ? "high" : avgLt <= 30 ? "medium" : "low";
            Map<String, Object> ltMap = new LinkedHashMap<>();
            ltMap.put("value", Math.round(avgLt * 10.0) / 10.0); ltMap.put("level", ltLevel); ltMap.put("unit", "days"); ltMap.put("sampleSize", lts.size());
            card.put("leadTimeForChanges", ltMap);

            long hotfixes = rels.stream()
                    .filter(r -> r.getName() != null && r.getName().toLowerCase().contains("hotfix"))
                    .count();
            double cfr = count > 0 ? (double) hotfixes / count * 100 : 0;
            String cfrLevel = cfr <= 5 ? "elite" : cfr <= 10 ? "high" : cfr <= 15 ? "medium" : "low";
            Map<String, Object> cfrMonthMap = new LinkedHashMap<>();
            cfrMonthMap.put("value", Math.round(cfr * 10.0) / 10.0); cfrMonthMap.put("level", cfrLevel); cfrMonthMap.put("unit", "%");
            cfrMonthMap.put("bugCount", hotfixes); cfrMonthMap.put("totalIssues", count);
            card.put("changeFailureRate", cfrMonthMap);

            double mttr = 0;
            int rec = 0;
            for (int i = 0; i < rels.size(); i++) {
                boolean isHotfixI = rels.get(i).getName() != null && rels.get(i).getName().toLowerCase().contains("hotfix");
                if (isHotfixI) {
                    for (int j = i + 1; j < rels.size(); j++) {
                        boolean isHotfixJ = rels.get(j).getName() != null && rels.get(j).getName().toLowerCase().contains("hotfix");
                        if (!isHotfixJ) {
                            mttr += ChronoUnit.DAYS.between(rels.get(i).getReleaseDate(), rels.get(j).getReleaseDate());
                            rec++;
                            break;
                        }
                    }
                }
            }
            if (rec > 0) mttr /= rec;
            String mttrLevel = mttr < 1 ? "elite" : mttr <= 1 ? "high" : mttr <= 7 ? "medium" : "low";
            Map<String, Object> mttrMonthMap = new LinkedHashMap<>();
            mttrMonthMap.put("value", Math.round(mttr * 10.0) / 10.0); mttrMonthMap.put("level", mttrLevel);
            mttrMonthMap.put("unit", "days"); mttrMonthMap.put("recoveryEvents", rec);
            card.put("meanTimeToRecovery", mttrMonthMap);

            card.put("totalReleases", count);
            card.put("totalIssues", count);
            result.add(card);
        }
        return result;
    }

    private Map<String, Object> computeFromReleaseCalendar(int lookbackMonths) {
        LocalDate cutoff = LocalDate.now().minusMonths(lookbackMonths);

        List<ReleaseCalendar> allReleases = releaseRepo.findAllByOrderByReleaseDateAsc();
        List<Sprint> allSprints = sprintRepo.findAllByOrderByStartDateAsc();

        List<ReleaseCalendar> releases = allReleases.stream()
                .filter(r -> !r.getReleaseDate().isBefore(cutoff))
                .collect(Collectors.toList());

        List<ReleaseCalendar> pastReleases = releases.stream()
                .filter(r -> !r.getReleaseDate().isAfter(LocalDate.now()))
                .collect(Collectors.collectingAndThen(
                        Collectors.toMap(
                                ReleaseCalendar::getReleaseDate,
                                r -> r,
                                (a, b) -> a,
                                LinkedHashMap::new
                        ),
                        map -> new ArrayList<>(map.values())
                ));

        // Deployment Frequency
        double deployFrequencyPerMonth = 0;
        String deployFrequencyLabel = "N/A";
        String deployFrequencyLevel = "low";
        List<Map<String, Object>> deployDetails = new ArrayList<>();

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

        for (ReleaseCalendar r : pastReleases) {
            if (r.getReleaseDate() == null) continue;
            boolean isHotfix = r.getName() != null && r.getName().toLowerCase().contains("hotfix");
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("release", r.getName() != null ? r.getName() : "(unnamed)");
            d.put("releaseDate", r.getReleaseDate().toString());
            d.put("type", isHotfix ? "HOTFIX" : (r.getType() != null ? r.getType() : "REGULAR"));
            deployDetails.add(d);
        }

        // Lead Time for Changes
        double avgLeadTimeDays = 0;
        String leadTimeLevel = "low";
        List<Map<String, Object>> leadTimeDetails = new ArrayList<>();

        if (!pastReleases.isEmpty()) {
            List<Long> leadTimes = new ArrayList<>();
            for (ReleaseCalendar r : pastReleases) {
                if (r.getCodeFreezeDate() == null || r.getReleaseDate() == null) continue;
                long days = ChronoUnit.DAYS.between(r.getCodeFreezeDate(), r.getReleaseDate());
                leadTimes.add(days);
                boolean isHotfix = r.getName() != null && r.getName().toLowerCase().contains("hotfix");
                Map<String, Object> detail = new LinkedHashMap<>();
                detail.put("release", r.getName() != null ? r.getName() : "(unnamed)");
                detail.put("codeFreezeDate", r.getCodeFreezeDate().toString());
                detail.put("releaseDate", r.getReleaseDate().toString());
                detail.put("leadTimeDays", days);
                detail.put("isHotfix", isHotfix);
                leadTimeDetails.add(detail);
            }
            avgLeadTimeDays = leadTimes.stream().mapToLong(Long::longValue).average().orElse(0);

            if (avgLeadTimeDays <= 1)       leadTimeLevel = "elite";
            else if (avgLeadTimeDays <= 7)  leadTimeLevel = "high";
            else if (avgLeadTimeDays <= 30) leadTimeLevel = "medium";
            else                            leadTimeLevel = "low";
        }

        // Change Failure Rate
        long hotfixCount = pastReleases.stream()
                .filter(r -> r.getName() != null && r.getName().toLowerCase().contains("hotfix"))
                .count();
        double changeFailureRate = pastReleases.isEmpty() ? 0 :
                (double) hotfixCount / pastReleases.size() * 100;
        String changeFailureLevel;
        if (changeFailureRate <= 5)        changeFailureLevel = "elite";
        else if (changeFailureRate <= 10)  changeFailureLevel = "high";
        else if (changeFailureRate <= 15)  changeFailureLevel = "medium";
        else                               changeFailureLevel = "low";

        // Mean Time to Recovery
        double mttrDays = 0;
        String mttrLevel = "low";
        int recoveryCount = 0;

        for (int i = 0; i < pastReleases.size(); i++) {
            ReleaseCalendar ri = pastReleases.get(i);
            boolean isHotfix = ri.getName() != null && ri.getName().toLowerCase().contains("hotfix");
            if (isHotfix) {
                for (int j = i + 1; j < pastReleases.size(); j++) {
                    ReleaseCalendar rj = pastReleases.get(j);
                    boolean nextIsHotfix = rj.getName() != null && rj.getName().toLowerCase().contains("hotfix");
                    if (!nextIsHotfix) {
                        mttrDays += ChronoUnit.DAYS.between(ri.getReleaseDate(), rj.getReleaseDate());
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

        // Monthly trend
        Map<String, Integer> monthlyReleaseCounts = new LinkedHashMap<>();
        Map<String, Integer> monthlyFailures = new LinkedHashMap<>();
        for (ReleaseCalendar r : pastReleases) {
            String monthKey = r.getReleaseDate().getYear() + "-" +
                    String.format("%02d", r.getReleaseDate().getMonthValue());
            monthlyReleaseCounts.merge(monthKey, 1, Integer::sum);
            boolean isHotfixR = r.getName() != null && r.getName().toLowerCase().contains("hotfix");
            if (isHotfixR) {
                monthlyFailures.merge(monthKey, 1, Integer::sum);
            }
        }

        List<Map<String, Object>> trend = new ArrayList<>();
        for (String month : monthlyReleaseCounts.keySet()) {
            Map<String, Object> trendEntry = new LinkedHashMap<>();
            trendEntry.put("month", month);
            trendEntry.put("releases", monthlyReleaseCounts.getOrDefault(month, 0));
            trendEntry.put("failures", monthlyFailures.getOrDefault(month, 0));
            trend.add(trendEntry);
        }

        // Sprint context
        List<Sprint> recentSprints = allSprints.stream()
                .filter(s -> !s.getStartDate().isBefore(cutoff) && !s.getEndDate().isAfter(LocalDate.now()))
                .collect(Collectors.toList());

        // Build response
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("lookbackMonths", lookbackMonths);
        response.put("source", "release_calendar");
        response.put("totalReleases", pastReleases.size());
        response.put("totalSprints", recentSprints.size());

        Map<String, Object> deployFreqMap = new LinkedHashMap<>();
        deployFreqMap.put("value", Math.round(deployFrequencyPerMonth * 100.0) / 100.0);
        deployFreqMap.put("label", deployFrequencyLabel);
        deployFreqMap.put("level", deployFrequencyLevel);
        deployFreqMap.put("unit", "per month");
        deployFreqMap.put("details", deployDetails);
        response.put("deploymentFrequency", deployFreqMap);

        Map<String, Object> leadTimeMap = new LinkedHashMap<>();
        leadTimeMap.put("value", Math.round(avgLeadTimeDays * 10.0) / 10.0);
        leadTimeMap.put("level", leadTimeLevel);
        leadTimeMap.put("unit", "days");
        leadTimeMap.put("details", leadTimeDetails);
        response.put("leadTimeForChanges", leadTimeMap);

        Map<String, Object> cfrMap = new LinkedHashMap<>();
        cfrMap.put("value", Math.round(changeFailureRate * 10.0) / 10.0);
        cfrMap.put("level", changeFailureLevel);
        cfrMap.put("unit", "%");
        cfrMap.put("hotfixes", hotfixCount);
        cfrMap.put("totalReleases", (long) pastReleases.size());
        response.put("changeFailureRate", cfrMap);

        Map<String, Object> mttrMap = new LinkedHashMap<>();
        mttrMap.put("value", Math.round(mttrDays * 10.0) / 10.0);
        mttrMap.put("level", mttrLevel);
        mttrMap.put("unit", "days");
        mttrMap.put("recoveryEvents", recoveryCount);
        response.put("meanTimeToRecovery", mttrMap);

        response.put("trend", trend);

        // Upcoming releases
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
