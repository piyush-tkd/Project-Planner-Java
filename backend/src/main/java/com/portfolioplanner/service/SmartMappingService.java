package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.SmartMappingSuggestion;
import com.portfolioplanner.domain.model.enums.SourceType;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.domain.repository.SmartMappingSuggestionRepository;
import com.portfolioplanner.service.jira.JiraClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Compares Portfolio Planner MANUAL projects against Jira epics and produces
 * scored {@link SmartMappingSuggestion} records for admin review.
 *
 * <h3>Scoring model</h3>
 * <table>
 *   <tr><th>Signal</th><th>Weight</th><th>Algorithm</th></tr>
 *   <tr><td>Name</td><td>40%</td><td>Jaro-Winkler similarity</td></tr>
 *   <tr><td>Owner</td><td>25%</td><td>Exact-match after normalisation</td></tr>
 *   <tr><td>Date</td><td>20%</td><td>Proximity of start/target dates</td></tr>
 *   <tr><td>Status</td><td>10%</td><td>Equivalent status mapping</td></tr>
 *   <tr><td>Epic key</td><td>5%</td><td>Bonus if PP project notes contain the Jira key</td></tr>
 * </table>
 *
 * <p>Thresholds:
 * <ul>
 *   <li>&ge; 85 → DUPLICATE_RISK suggestion</li>
 *   <li>55–84 → POSSIBLE_MATCH suggestion</li>
 *   <li>&lt; 55 → ignored</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SmartMappingService {

    /** Minimum composite score to persist a suggestion. */
    private static final double THRESHOLD_POSSIBLE = 55.0;

    private final ProjectRepository                projectRepository;
    private final SmartMappingSuggestionRepository suggestionRepository;
    private final JiraClient                       jiraClient;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Runs the full smart-mapping analysis.  MANUAL PP projects are compared
     * against all Jira epics discovered across every configured board.
     *
     * @return count of new suggestions persisted
     */
    @Transactional(readOnly = false)
    public int runAnalysis() {
        List<Project> manualProjects = projectRepository.findBySourceType(SourceType.MANUAL);
        if (manualProjects.isEmpty()) {
            log.info("SmartMappingService: no MANUAL projects — skipping analysis");
            return 0;
        }

        List<Map<String, Object>> boards;
        try {
            boards = jiraClient.getAllBoards();
        } catch (Exception e) {
            log.warn("SmartMappingService: cannot fetch boards — {}", e.getMessage());
            return 0;
        }

        int saved = 0;
        for (Map<String, Object> board : boards) {
            long boardId = toLong(board.get("id"));
            List<Map<String, Object>> epics;
            try {
                epics = jiraClient.getEpicsFromBoard(boardId);
            } catch (Exception e) {
                log.warn("SmartMappingService: board {} epic fetch failed — {}", boardId, e.getMessage());
                continue;
            }

            for (Map<String, Object> epic : epics) {
                String epicKey  = epicKey(epic);
                String epicName = epicName(epic);
                if (epicKey == null || epicName == null || epicName.isBlank()) continue;

                for (Project pp : manualProjects) {
                    // Skip if already linked or already has a suggestion
                    if (epicKey.equalsIgnoreCase(pp.getJiraEpicKey())) continue;
                    if (suggestionRepository.existsByPpProjectIdAndJiraEpicKey(pp.getId(), epicKey)) continue;

                    ScoreBreakdown bd = score(pp, epic, epicKey, epicName);
                    if (bd.composite() < THRESHOLD_POSSIBLE) continue;

                    SmartMappingSuggestion s = new SmartMappingSuggestion();
                    s.setPpProject(pp);
                    s.setJiraEpicKey(epicKey);
                    s.setScore(bd(bd.composite()));
                    s.setNameScore(bd(bd.name()));
                    s.setOwnerScore(bd(bd.owner()));
                    s.setDateScore(bd(bd.date()));
                    s.setStatusScore(bd(bd.status()));
                    s.setEpicKeyBonus(bd(bd.epicKeyBonus()));
                    s.setResolution("PENDING");
                    s.setCreatedAt(OffsetDateTime.now());
                    suggestionRepository.save(s);
                    saved++;

                    log.debug("SmartMappingService: suggestion PP#{} ↔ {} score={}", pp.getId(), epicKey, bd.composite());
                }
            }
        }

        log.info("SmartMappingService: analysis complete — {} new suggestions", saved);
        return saved;
    }

    /** Returns all suggestions (any resolution), ordered by descending score. */
    public List<SmartMappingSuggestion> getAllSuggestions() {
        return suggestionRepository.findAllOrderByScoreDesc();
    }

    /** Returns only PENDING suggestions, ordered by descending score. */
    public List<SmartMappingSuggestion> getPendingSuggestions() {
        return suggestionRepository.findByResolutionOrderByScoreDesc("PENDING");
    }

    /**
     * Resolves a suggestion.
     *
     * <p>If {@code resolution} is {@code "LINKED"}, the PP project's {@code jiraEpicKey}
     * is set to the suggestion's epic key and its sourceType promoted to PUSHED_TO_JIRA.
     *
     * @param id         suggestion id
     * @param resolution "LINKED" | "IGNORED"
     */
    @Transactional(readOnly = false)
    public SmartMappingSuggestion resolve(Long id, String resolution) {
        SmartMappingSuggestion s = suggestionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Suggestion not found: " + id));

        if (!"LINKED".equals(resolution) && !"IGNORED".equals(resolution)) {
            throw new IllegalArgumentException("Invalid resolution: " + resolution);
        }

        s.setResolution(resolution);
        s.setResolvedAt(OffsetDateTime.now());

        if ("LINKED".equals(resolution)) {
            Project pp = s.getPpProject();
            pp.setJiraEpicKey(s.getJiraEpicKey());
            pp.setSourceType(SourceType.PUSHED_TO_JIRA);
            pp.setJiraLastSyncedAt(OffsetDateTime.now());
            projectRepository.save(pp);
            log.info("SmartMappingService: linked PP#{} to Jira epic {}", pp.getId(), s.getJiraEpicKey());
        }

        return suggestionRepository.save(s);
    }

    // ── Scoring ───────────────────────────────────────────────────────────────

    private ScoreBreakdown score(Project pp, Map<String, Object> epic, String epicKey, String epicName) {
        double name        = nameSimilarity(pp.getName(), epicName) * 100.0;
        double owner       = ownerScore(pp.getOwner(), epic);
        double date        = dateScore(pp);
        double status      = statusScore(pp, epic);
        double epicKeyBonus = epicKeyBonus(pp, epicKey);

        double composite = name * 0.40
                         + owner * 0.25
                         + date  * 0.20
                         + status * 0.10
                         + epicKeyBonus * 0.05;

        return new ScoreBreakdown(composite, name, owner, date, status, epicKeyBonus);
    }

    // ── Name similarity: Jaro-Winkler ─────────────────────────────────────────

    private double nameSimilarity(String a, String b) {
        if (a == null || b == null) return 0.0;
        String na = normalise(a);
        String nb = normalise(b);
        if (na.equals(nb)) return 1.0;
        if (na.isEmpty() || nb.isEmpty()) return 0.0;
        return jaroWinkler(na, nb);
    }

    private static double jaroWinkler(String s1, String s2) {
        double jaro = jaro(s1, s2);
        int prefix = 0;
        int limit = Math.min(Math.min(s1.length(), s2.length()), 4);
        for (int i = 0; i < limit; i++) {
            if (s1.charAt(i) == s2.charAt(i)) prefix++;
            else break;
        }
        return jaro + (prefix * 0.1 * (1.0 - jaro));
    }

    private static double jaro(String s1, String s2) {
        int len1 = s1.length(), len2 = s2.length();
        if (len1 == 0 && len2 == 0) return 1.0;
        if (len1 == 0 || len2 == 0) return 0.0;

        int matchDist = Math.max(len1, len2) / 2 - 1;
        if (matchDist < 0) matchDist = 0;

        boolean[] s1Matched = new boolean[len1];
        boolean[] s2Matched = new boolean[len2];
        int matches = 0;
        for (int i = 0; i < len1; i++) {
            int lo = Math.max(0, i - matchDist);
            int hi = Math.min(i + matchDist + 1, len2);
            for (int j = lo; j < hi; j++) {
                if (!s2Matched[j] && s1.charAt(i) == s2.charAt(j)) {
                    s1Matched[i] = true;
                    s2Matched[j] = true;
                    matches++;
                    break;
                }
            }
        }
        if (matches == 0) return 0.0;

        double transpositions = 0;
        int k = 0;
        for (int i = 0; i < len1; i++) {
            if (!s1Matched[i]) continue;
            while (!s2Matched[k]) k++;
            if (s1.charAt(i) != s2.charAt(k)) transpositions++;
            k++;
        }
        return (matches / (double) len1 + matches / (double) len2 + (matches - transpositions / 2.0) / matches) / 3.0;
    }

    // ── Owner score ───────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private double ownerScore(String ppOwner, Map<String, Object> epic) {
        if (ppOwner == null || ppOwner.isBlank()) return 0.0;
        // Try fields → assignee → displayName
        Object fields = epic.get("fields");
        if (!(fields instanceof Map)) return 0.0;
        Object assignee = ((Map<String, Object>) fields).get("assignee");
        if (!(assignee instanceof Map)) return 0.0;
        String displayName = (String) ((Map<String, Object>) assignee).get("displayName");
        if (displayName == null) return 0.0;
        return normalise(ppOwner).equals(normalise(displayName)) ? 100.0 : 0.0;
    }

    // ── Date score ────────────────────────────────────────────────────────────

    private double dateScore(Project pp) {
        // Jira epics rarely carry exact dates in the sync payload; award partial credit
        // if the PP project has dates set (i.e. it's not a placeholder-only entry).
        boolean hasDates = pp.getStartDate() != null || pp.getTargetDate() != null;
        return hasDates ? 50.0 : 0.0;
    }

    // ── Status score ──────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private double statusScore(Project pp, Map<String, Object> epic) {
        Object fields = epic.get("fields");
        if (!(fields instanceof Map)) return 0.0;
        Object statusObj = ((Map<String, Object>) fields).get("status");
        if (!(statusObj instanceof Map)) return 0.0;
        String jiraStatus = (String) ((Map<String, Object>) statusObj).get("name");
        if (jiraStatus == null) return 0.0;

        String ppStatus = pp.getStatus() != null ? pp.getStatus().toString() : "";
        String jNorm    = normalise(jiraStatus);
        String pNorm    = normalise(ppStatus);

        if (jNorm.equals(pNorm)) return 100.0;

        // Fuzzy mapping: common Jira ↔ PP status pairings
        boolean match = (jNorm.contains("done") && pNorm.contains("complete"))
                || (jNorm.contains("progress") && pNorm.contains("active"))
                || (jNorm.contains("backlog") && pNorm.contains("inactive"))
                || (jNorm.contains("hold") && pNorm.contains("hold"));
        return match ? 60.0 : 0.0;
    }

    // ── Epic-key bonus ────────────────────────────────────────────────────────

    private double epicKeyBonus(Project pp, String epicKey) {
        String notes = pp.getNotes();
        if (notes == null || notes.isBlank() || epicKey == null) return 0.0;
        return notes.toUpperCase().contains(epicKey.toUpperCase()) ? 100.0 : 0.0;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String normalise(String s) {
        return s == null ? "" : s.trim().toLowerCase().replaceAll("[^a-z0-9 ]", "");
    }

    private static BigDecimal bd(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }

    private static long toLong(Object v) {
        if (v instanceof Number n) return n.longValue();
        if (v instanceof String s) return Long.parseLong(s);
        return 0L;
    }

    @SuppressWarnings("unchecked")
    private static String epicKey(Map<String, Object> epic) {
        Object key = epic.get("key");
        return key instanceof String ? (String) key : null;
    }

    @SuppressWarnings("unchecked")
    private static String epicName(Map<String, Object> epic) {
        Object name = epic.get("name");
        if (name instanceof String s && !s.isBlank()) return s;
        // fallback: fields.summary
        Object fields = epic.get("fields");
        if (fields instanceof Map) {
            Object summary = ((Map<String, Object>) fields).get("summary");
            if (summary instanceof String ss) return ss;
        }
        return null;
    }

    // ── Internal record ───────────────────────────────────────────────────────

    private record ScoreBreakdown(
        double composite,
        double name,
        double owner,
        double date,
        double status,
        double epicKeyBonus
    ) {}
}
