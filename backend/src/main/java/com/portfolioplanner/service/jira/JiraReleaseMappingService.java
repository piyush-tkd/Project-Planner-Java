package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.JiraReleaseMapping;
import com.portfolioplanner.domain.model.ReleaseCalendar;
import com.portfolioplanner.domain.repository.JiraReleaseMappingRepository;
import com.portfolioplanner.domain.repository.ReleaseCalendarRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class JiraReleaseMappingService {

    private final JiraReleaseMappingRepository mappingRepository;
    private final ReleaseCalendarRepository releaseCalendarRepository;
    private final JdbcTemplate jdbcTemplate;

    // ── Data structures ──────────────────────────────────────────────────────

    public record JiraFixVersionInfo(String versionName, String projectKey, String releaseDate, boolean released, int issueCount) {}

    public record ReleaseMappingResponse(
        Long id,
        Long releaseCalendarId,
        String releaseName,
        String releaseDate,
        String codeFreezeDate,
        String releaseType,
        List<LinkedVersion> linkedVersions,
        String mappingType,
        Double confidence
    ) {}

    public record LinkedVersion(Long mappingId, String versionName, String projectKey, String matchType, Double confidence) {}

    public record ReleaseMappingSaveRequest(Long releaseCalendarId, String jiraVersionName, String jiraProjectKey, String mappingType) {}

    // ── Scan all fix versions from synced data ───────────────────────────────

    public List<JiraFixVersionInfo> scanFixVersions() {
        String sql = """
            SELECT fv.version_name, ji.project_key,
                   COUNT(*) AS issue_count
            FROM jira_issue_fix_version fv
            JOIN jira_issue ji ON ji.issue_key = fv.issue_key
            GROUP BY fv.version_name, ji.project_key
            ORDER BY fv.version_name, ji.project_key
            """;

        return jdbcTemplate.query(sql, (rs, rowNum) -> new JiraFixVersionInfo(
            rs.getString("version_name"),
            rs.getString("project_key"),
            null,
            false,
            rs.getInt("issue_count")
        ));
    }

    // ── Auto-match logic ─────────────────────────────────────────────────────

    @Transactional
    public List<ReleaseMappingResponse> autoMatch() {
        List<ReleaseCalendar> releases = releaseCalendarRepository.findAllByOrderByReleaseDateAsc();
        List<JiraFixVersionInfo> versions = scanFixVersions();

        for (ReleaseCalendar release : releases) {
            // Skip if already has manual mappings
            List<JiraReleaseMapping> existing = mappingRepository.findByReleaseCalendarId(release.getId());
            boolean hasManual = existing.stream().anyMatch(m -> "MANUAL".equals(m.getMappingType()));
            if (hasManual) continue;

            // Clear old auto-suggestions for this release
            existing.stream()
                .filter(m -> "AUTO".equals(m.getMappingType()))
                .forEach(m -> mappingRepository.deleteById(m.getId()));

            for (JiraFixVersionInfo version : versions) {
                double score = computeReleaseMatchScore(release, version);
                if (score >= 0.50) {
                    // Skip if mapping already exists for this combo
                    var existingMapping = mappingRepository.findByReleaseCalendarIdAndJiraVersionNameAndJiraProjectKey(
                        release.getId(), version.versionName, version.projectKey);
                    if (existingMapping.isPresent()) {
                        // Update confidence if auto-match found a better score
                        JiraReleaseMapping m = existingMapping.get();
                        if (score > m.getConfidence()) {
                            m.setConfidence(score);
                            mappingRepository.save(m);
                        }
                        continue;
                    }
                    JiraReleaseMapping mapping = new JiraReleaseMapping();
                    mapping.setReleaseCalendar(release);
                    mapping.setJiraVersionName(version.versionName);
                    mapping.setJiraProjectKey(version.projectKey);
                    mapping.setMappingType("AUTO");
                    mapping.setConfidence(score);
                    mappingRepository.save(mapping);
                }
            }
        }

        return getAllMappings();
    }

    private static final Set<String> MONTH_NAMES = Set.of(
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december",
        "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec");

    /** Generic words that MUST NOT drive matching on their own */
    private static final Set<String> STOP_WORDS = Set.of(
        "release", "hotfix", "hot", "fix", "patch", "version", "deploy", "deployment",
        "build", "sprint", "iteration", "update", "v");

    private double computeReleaseMatchScore(ReleaseCalendar release, JiraFixVersionInfo version) {
        String relNameRaw = release.getName();
        String verNameRaw = version.versionName;

        String relName = normalize(relNameRaw);
        String verName = normalize(verNameRaw);

        // 1. Exact name match
        if (relName.equalsIgnoreCase(verName)) return 1.0;

        // 2. Try to extract embedded ISO dates from version names (e.g. "Release 2025-06-03")
        LocalDate relEmbeddedDate = extractIsoDate(relNameRaw);
        LocalDate verEmbeddedDate = extractIsoDate(verNameRaw);
        LocalDate relReleaseDate = release.getReleaseDate();

        // 3. Extract structured date components from names
        String[] relTokens = tokenize(relNameRaw);
        String[] verTokens = tokenize(verNameRaw);

        String relDay = extractDayNumber(relTokens);
        String verDay = extractDayNumber(verTokens);
        String relMonth = extractMonth(relTokens);
        String verMonth = extractMonth(verTokens);

        // If version has an embedded ISO date (like "Release 2025-06-03"), extract month/day from it
        if (verEmbeddedDate != null && verMonth == null) {
            verMonth = verEmbeddedDate.getMonth().name().toLowerCase();
            verDay = String.valueOf(verEmbeddedDate.getDayOfMonth());
        }
        if (relEmbeddedDate != null && relMonth == null) {
            relMonth = relEmbeddedDate.getMonth().name().toLowerCase();
            relDay = String.valueOf(relEmbeddedDate.getDayOfMonth());
        }

        // Normalize month names to full form for comparison
        relMonth = normalizeMonth(relMonth);
        verMonth = normalizeMonth(verMonth);

        // ── CRITICAL: Day number conflict = hard reject ──
        if (relDay != null && verDay != null && !relDay.equals(verDay)) {
            return 0;
        }

        // ── Month conflict = hard reject ──
        if (relMonth != null && verMonth != null && !relMonth.equals(verMonth)) {
            return 0;
        }

        // ── Both have matching day + matching month → strong match ──
        if (relDay != null && verDay != null && relDay.equals(verDay)
            && relMonth != null && verMonth != null && relMonth.equals(verMonth)) {
            return 0.95;
        }

        // ── Same month, one side missing day → use date proximity to confirm ──
        if (relMonth != null && verMonth != null && relMonth.equals(verMonth)) {
            // Try date proximity (from embedded ISO date or release_date field)
            LocalDate verDate = verEmbeddedDate != null ? verEmbeddedDate :
                (version.releaseDate != null ? parseDate(version.releaseDate) : null);
            LocalDate relDate = relEmbeddedDate != null ? relEmbeddedDate : relReleaseDate;

            if (verDate != null && relDate != null) {
                long daysDiff = Math.abs(ChronoUnit.DAYS.between(relDate, verDate));
                if (daysDiff <= 3) return 0.85;
                if (daysDiff <= 7) return 0.65;
                return 0.25; // Same month name but dates far apart — below threshold
            }
            // No dates to compare but same month — moderate
            return 0.60;
        }

        // ── Contains match — but only if meaningful (not just stop words) ──
        if (relName.toLowerCase().contains(verName.toLowerCase()) ||
            verName.toLowerCase().contains(relName.toLowerCase())) {
            // Make sure the contained part has meaningful content beyond stop words
            Set<String> meaningful = getMeaningfulTokens(relTokens);
            meaningful.retainAll(getMeaningfulTokens(verTokens));
            if (meaningful.size() >= 2) return 0.80;
        }

        // ── No month on at least one side → check meaningful descriptor overlap ──
        Set<String> relMeaningful = getMeaningfulTokens(relTokens);
        Set<String> verMeaningful = getMeaningfulTokens(verTokens);

        if (!relMeaningful.isEmpty() && !verMeaningful.isEmpty()) {
            long common = relMeaningful.stream().filter(verMeaningful::contains).count();
            // Need at least 2 meaningful common tokens to match
            if (common >= 2) {
                double overlap = (double) common / Math.max(relMeaningful.size(), verMeaningful.size());
                if (overlap >= 0.5) return 0.55;
            }
        }

        // ── Last resort: ISO date proximity ──
        LocalDate verDate = verEmbeddedDate != null ? verEmbeddedDate :
            (version.releaseDate != null ? parseDate(version.releaseDate) : null);
        LocalDate relDate = relEmbeddedDate != null ? relEmbeddedDate : relReleaseDate;

        if (verDate != null && relDate != null) {
            long daysDiff = Math.abs(ChronoUnit.DAYS.between(relDate, verDate));
            if (daysDiff == 0) return 0.80;
            if (daysDiff <= 2) return 0.55;
        }

        return 0;
    }

    // ── Helper methods ──────────────────────────────────────────────────────

    /** Extract an embedded ISO date (YYYY-MM-DD) from a raw name string */
    private LocalDate extractIsoDate(String rawName) {
        if (rawName == null) return null;
        var matcher = java.util.regex.Pattern.compile("(\\d{4})-(\\d{2})-(\\d{2})").matcher(rawName);
        if (matcher.find()) {
            try {
                return LocalDate.parse(matcher.group());
            } catch (Exception e) { return null; }
        }
        return null;
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null) return null;
        try { return LocalDate.parse(dateStr); } catch (Exception e) { return null; }
    }

    /** Extract day number from tokens: "29th" → "29", "8" → "8" */
    private String extractDayNumber(String[] tokens) {
        for (String t : tokens) {
            String lower = t.toLowerCase();
            if (lower.matches("\\d+(st|nd|rd|th)")) {
                return lower.replaceAll("[^0-9]", "");
            }
        }
        for (String t : tokens) {
            if (t.matches("\\d+")) {
                int num = Integer.parseInt(t);
                if (num >= 1 && num <= 31) return String.valueOf(num);
            }
        }
        return null;
    }

    /** Extract month name from tokens */
    private String extractMonth(String[] tokens) {
        for (String t : tokens) {
            if (MONTH_NAMES.contains(t.toLowerCase())) {
                return t.toLowerCase();
            }
        }
        return null;
    }

    /** Normalize abbreviated month names to full form */
    private String normalizeMonth(String month) {
        if (month == null) return null;
        return switch (month) {
            case "jan" -> "january"; case "feb" -> "february"; case "mar" -> "march";
            case "apr" -> "april"; case "jun" -> "june"; case "jul" -> "july";
            case "aug" -> "august"; case "sep" -> "september"; case "oct" -> "october";
            case "nov" -> "november"; case "dec" -> "december";
            default -> month;
        };
    }

    /** Get meaningful tokens (strip date tokens + stop words) */
    private Set<String> getMeaningfulTokens(String[] tokens) {
        Set<String> result = new HashSet<>();
        for (String t : tokens) {
            String lower = t.toLowerCase();
            if (lower.matches("\\d+(st|nd|rd|th)")) continue;
            if (lower.matches("\\d+")) continue;
            if (MONTH_NAMES.contains(lower)) continue;
            if (lower.matches("fy\\d+|q[1-4]")) continue;
            if (STOP_WORDS.contains(lower)) continue;
            if (lower.length() <= 1) continue;
            result.add(lower);
        }
        return result;
    }

    private String[] tokenize(String name) {
        // Replace hyphens with spaces so "2025-06-03" becomes "2025 06 03"
        String n = normalize(name).toLowerCase();
        if (n.isEmpty()) return new String[0];
        return n.split("\\s+");
    }

    private String normalize(String name) {
        if (name == null) return "";
        // Replace hyphens with spaces (preserves date components as separate tokens)
        return name.replaceAll("-", " ").replaceAll("[^a-zA-Z0-9\\s]", "").replaceAll("\\s+", " ").trim();
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    public List<ReleaseMappingResponse> getAllMappings() {
        List<ReleaseCalendar> releases = releaseCalendarRepository.findAllByOrderByReleaseDateAsc();
        List<JiraReleaseMapping> allMappings = mappingRepository.findAllByOrderByReleaseCalendarIdAsc();

        Map<Long, List<JiraReleaseMapping>> byRelease = allMappings.stream()
            .collect(Collectors.groupingBy(m -> m.getReleaseCalendar().getId()));

        List<ReleaseMappingResponse> result = new ArrayList<>();
        for (ReleaseCalendar release : releases) {
            List<JiraReleaseMapping> mappings = byRelease.getOrDefault(release.getId(), List.of());
            List<LinkedVersion> linked = mappings.stream()
                .map(m -> new LinkedVersion(m.getId(), m.getJiraVersionName(), m.getJiraProjectKey(),
                    m.getMappingType(), m.getConfidence()))
                .toList();

            String overallType = mappings.isEmpty() ? null :
                mappings.stream().anyMatch(m -> "MANUAL".equals(m.getMappingType())) ? "MANUAL" : "AUTO";
            Double overallConfidence = mappings.isEmpty() ? null :
                mappings.stream().mapToDouble(m -> m.getConfidence() != null ? m.getConfidence() : 0).average().orElse(0);

            result.add(new ReleaseMappingResponse(
                null, release.getId(), release.getName(),
                release.getReleaseDate().toString(), release.getCodeFreezeDate().toString(),
                release.getType(), linked, overallType, overallConfidence
            ));
        }
        return result;
    }

    @Transactional
    public void saveMapping(ReleaseMappingSaveRequest request) {
        ReleaseCalendar release = releaseCalendarRepository.findById(request.releaseCalendarId)
            .orElseThrow(() -> new RuntimeException("Release not found: " + request.releaseCalendarId));

        // Upsert: update if exists, insert if new
        var existing = mappingRepository.findByReleaseCalendarIdAndJiraVersionNameAndJiraProjectKey(
            request.releaseCalendarId, request.jiraVersionName, request.jiraProjectKey);
        JiraReleaseMapping mapping = existing.orElseGet(JiraReleaseMapping::new);
        mapping.setReleaseCalendar(release);
        mapping.setJiraVersionName(request.jiraVersionName);
        mapping.setJiraProjectKey(request.jiraProjectKey);
        mapping.setMappingType(request.mappingType != null ? request.mappingType : "MANUAL");
        mapping.setConfidence(1.0);
        mappingRepository.save(mapping);
    }

    @Transactional
    public void deleteMapping(Long id) {
        mappingRepository.deleteById(id);
    }

    @Transactional
    public void saveBulk(Long releaseCalendarId, List<ReleaseMappingSaveRequest> requests) {
        // Clear existing for this release
        mappingRepository.deleteByReleaseCalendarId(releaseCalendarId);

        ReleaseCalendar release = releaseCalendarRepository.findById(releaseCalendarId)
            .orElseThrow(() -> new RuntimeException("Release not found: " + releaseCalendarId));

        for (ReleaseMappingSaveRequest req : requests) {
            JiraReleaseMapping mapping = new JiraReleaseMapping();
            mapping.setReleaseCalendar(release);
            mapping.setJiraVersionName(req.jiraVersionName);
            mapping.setJiraProjectKey(req.jiraProjectKey);
            mapping.setMappingType(req.mappingType != null ? req.mappingType : "MANUAL");
            mapping.setConfidence(1.0);
            mappingRepository.save(mapping);
        }
    }
}
