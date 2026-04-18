package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.JiraSupportBoard;
import com.portfolioplanner.domain.model.JiraSupportSnapshot;
import com.portfolioplanner.domain.model.JiraSyncedIssue;
import com.portfolioplanner.domain.repository.JiraSupportBoardRepository;
import com.portfolioplanner.domain.repository.JiraSupportSnapshotRepository;
import com.portfolioplanner.domain.repository.JiraSyncedIssueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Support queue service.
 *
 * <p>Queue-specific endpoints (getSnapshot, getAllTickets, getAvailableBoards)
 * still use the live Jira Service Management API because JSM queues are not
 * part of the standard issue sync. Monthly throughput is served from the
 * locally synced issue table.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JiraSupportService {

    private final JiraSupportBoardRepository   boardRepo;
    private final JiraSupportSnapshotRepository snapshotRepo;
    private final JiraClient                   jiraClient;
    private final JiraSyncedIssueRepository    issueRepo;

    private static final DateTimeFormatter ISO_OUT = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    // ── Live snapshot ──────────────────────────────────────────────────────────

    /** Returns a live snapshot across all enabled support boards, then captures today's metrics. */
    public SupportSnapshot getSnapshot() {
        List<JiraSupportBoard> boards = boardRepo.findByEnabledTrue();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        List<BoardSnapshot> snapshots = boards.stream()
                .map(b -> buildBoardSnapshot(b, today))
                .collect(Collectors.toList());

        // Persist today's snapshot asynchronously (best-effort — errors are swallowed)
        try { persistSnapshots(boards, snapshots, today); }
        catch (Exception e) { log.warn("Failed to persist support snapshot: {}", e.getMessage()); }

        return new SupportSnapshot(snapshots, OffsetDateTime.now().format(ISO_OUT));
    }

    /**
     * Returns ALL tickets (all statuses, last 90 days) for every enabled board.
     * Intended for historical analysis — not for live queue management.
     */
    public SupportSnapshot getAllTickets(int days) {
        List<JiraSupportBoard> boards = boardRepo.findByEnabledTrue();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        List<BoardSnapshot> snapshots = boards.stream()
                .map(b -> buildAllTicketsSnapshot(b, today, days))
                .collect(Collectors.toList());

        return new SupportSnapshot(snapshots, OffsetDateTime.now().format(ISO_OUT));
    }

    @SuppressWarnings("unchecked")
    private BoardSnapshot buildAllTicketsSnapshot(JiraSupportBoard board, LocalDate today, int days) {
        List<Map<String, Object>> rawIssues;
        try {
            rawIssues = jiraClient.getAllSupportBoardIssues(
                    board.getBoardId(), board.getProjectKey(), board.getQueueId(), days);
        } catch (Exception e) {
            log.warn("Failed to fetch all tickets for board {} (key={}): {}",
                    board.getName(), board.getProjectKey(), e.getMessage());
            return new BoardSnapshot(board.getId(), board.getBoardId(), board.getName(), List.of(), e.getMessage());
        }

        List<SupportTicket> tickets = rawIssues.stream()
                .map(issue -> buildTicket(issue, today, board.getStaleThresholdDays()))
                .collect(Collectors.toList());

        return new BoardSnapshot(board.getId(), board.getBoardId(), board.getName(), tickets, null);
    }

    // ── Board config CRUD ──────────────────────────────────────────────────────

    public List<JiraSupportBoard> listBoards() { return boardRepo.findAll(); }
    public JiraSupportBoard saveBoard(JiraSupportBoard b) { return boardRepo.save(b); }
    public void deleteBoard(Long id) { boardRepo.deleteById(id); }

    /**
     * Returns all Jira Service Management service desks for the board picker.
     */
    public List<Map<String, Object>> getAvailableBoards() {
        return jiraClient.getAllBoards().stream()
                .map(sd -> {
                    Map<String, Object> board = new HashMap<>();
                    Object rawId = sd.get("id");
                    long sdId = rawId instanceof Number
                            ? ((Number) rawId).longValue()
                            : Long.parseLong(String.valueOf(rawId));
                    board.put("id", sdId);
                    board.put("name", sd.getOrDefault("projectName", "Unknown Service Desk"));
                    board.put("type", "service_desk");
                    Map<String, Object> location = new HashMap<>();
                    location.put("projectName", sd.get("projectKey"));
                    board.put("location", location);
                    return board;
                })
                .collect(Collectors.toList());
    }

    // ── Snapshot history ───────────────────────────────────────────────────────

    /**
     * Returns trend data for all boards over the last {@code days} days.
     * Each entry covers one board + its daily open/stale/avgAge series.
     */
    public List<BoardHistory> getHistory(int days) {
        LocalDate to   = LocalDate.now(ZoneOffset.UTC);
        LocalDate from = to.minusDays(days - 1);

        List<JiraSupportSnapshot> rows = snapshotRepo.findByDateRange(from, to);

        // Group by board
        Map<Long, List<JiraSupportSnapshot>> byBoard = rows.stream()
                .collect(Collectors.groupingBy(s -> s.getBoard().getId()));

        return byBoard.entrySet().stream()
                .map(e -> {
                    JiraSupportBoard board = e.getValue().get(0).getBoard();
                    List<DayPoint> points = e.getValue().stream()
                            .map(s -> new DayPoint(
                                    s.getSnapshotDate().toString(),
                                    s.getOpenCount(),
                                    s.getStaleCount(),
                                    s.getAvgAgeDays().doubleValue()))
                            .collect(Collectors.toList());
                    return new BoardHistory(board.getId(), board.getName(), points);
                })
                .collect(Collectors.toList());
    }

    /** Manually trigger snapshot capture for all enabled boards. */
    @Transactional
    public void captureNow() {
        List<JiraSupportBoard> boards = boardRepo.findByEnabledTrue();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<BoardSnapshot> snapshots = boards.stream()
                .map(b -> buildBoardSnapshot(b, today))
                .collect(Collectors.toList());
        persistSnapshots(boards, snapshots, today);
    }

    /** Daily cron at midnight UTC — captures a snapshot for every enabled board. */
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void scheduledDailyCapture() {
        log.info("Running daily support queue snapshot capture");
        captureNow();
    }

    // ── Board snapshot builder ─────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private BoardSnapshot buildBoardSnapshot(JiraSupportBoard board, LocalDate today) {
        List<Map<String, Object>> rawIssues;
        try {
            rawIssues = jiraClient.getSupportBoardIssues(
                    board.getBoardId(), board.getProjectKey(), board.getQueueId());
        } catch (Exception e) {
            log.warn("Failed to fetch issues for support board {} (key={} queue={}): {}",
                    board.getName(), board.getProjectKey(), board.getQueueId(), e.getMessage());
            return new BoardSnapshot(board.getId(), board.getBoardId(), board.getName(), List.of(), e.getMessage());
        }

        List<SupportTicket> tickets = rawIssues.stream()
                .map(issue -> buildTicket(issue, today, board.getStaleThresholdDays()))
                .collect(Collectors.toList());

        return new BoardSnapshot(board.getId(), board.getBoardId(), board.getName(), tickets, null);
    }

    @SuppressWarnings("unchecked")
    private SupportTicket buildTicket(Map<String, Object> issue, LocalDate today, int thresholdDays) {
        String key    = str(issue, "key");
        Map<String, Object> fields = fields(issue);

        String summary           = str(fields, "summary");
        String status            = extractStatus(fields);
        String statusCategory    = extractStatusCategory(fields);
        String priority          = extractPriority(fields);
        String priorityIconUrl   = extractPriorityIconUrl(fields);
        String reporter          = extractDisplayName(fields, "reporter");
        String assignee          = extractDisplayName(fields, "assignee");
        String assigneeAvatarUrl = extractAvatarUrl(fields, "assignee");
        List<String> labels      = extractLabels(fields);
        String created           = str(fields, "created");
        String updated           = str(fields, "updated");
        String statusChangedDate = str(fields, "statuscategorychangedate");
        String lastCommentDate   = extractLastCommentDate(fields);
        String lastCommentSnippet = extractLastCommentSnippet(fields);

        boolean stale     = isStale(updated, statusChangedDate, today, thresholdDays);
        String timeWindow = getTimeWindow(created, today);

        return new SupportTicket(
                key, summary, status, statusCategory,
                priority, priorityIconUrl,
                reporter, assignee, assigneeAvatarUrl, labels,
                created, updated,
                lastCommentDate, lastCommentSnippet,
                statusChangedDate,
                stale, timeWindow);
    }

    // ── Snapshot persistence ───────────────────────────────────────────────────

    private void persistSnapshots(List<JiraSupportBoard> boards,
                                  List<BoardSnapshot> snapshots, LocalDate today) {
        for (int i = 0; i < boards.size(); i++) {
            JiraSupportBoard board    = boards.get(i);
            BoardSnapshot    snapshot = snapshots.get(i);
            if (snapshot.errorMessage() != null) continue;

            List<SupportTicket> tickets = snapshot.tickets();
            int  openCount  = tickets.size();
            int  staleCount = (int) tickets.stream().filter(SupportTicket::stale).count();
            double avgAge   = tickets.stream()
                    .mapToLong(t -> ageDays(t.created()))
                    .average().orElse(0);

            JiraSupportSnapshot snap = snapshotRepo
                    .findByBoardIdAndSnapshotDate(board.getId(), today)
                    .orElseGet(() -> {
                        JiraSupportSnapshot s = new JiraSupportSnapshot();
                        s.setBoard(board);
                        s.setSnapshotDate(today);
                        return s;
                    });
            snap.setOpenCount(openCount);
            snap.setStaleCount(staleCount);
            snap.setAvgAgeDays(BigDecimal.valueOf(avgAge).setScale(1, RoundingMode.HALF_UP));
            snapshotRepo.save(snap);
        }
    }

    private long ageDays(String iso) {
        if (iso == null || iso.isBlank()) return 0;
        try { return java.time.temporal.ChronoUnit.DAYS.between(
                OffsetDateTime.parse(iso).toLocalDate(), LocalDate.now(ZoneOffset.UTC)); }
        catch (Exception e) { return 0; }
    }

    // ── Field extractors ───────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> fields(Map<String, Object> issue) {
        Object f = issue.get("fields");
        return f instanceof Map ? (Map<String, Object>) f : Map.of();
    }

    private String str(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v instanceof String ? (String) v : null;
    }

    @SuppressWarnings("unchecked")
    private String extractStatus(Map<String, Object> fields) {
        Object s = fields.get("status");
        if (!(s instanceof Map)) return null;
        Object name = ((Map<?, ?>) s).get("name");
        return name instanceof String ? (String) name : null;
    }

    @SuppressWarnings("unchecked")
    private String extractStatusCategory(Map<String, Object> fields) {
        Object s = fields.get("status");
        if (!(s instanceof Map)) return null;
        Object cat = ((Map<?, ?>) s).get("statusCategory");
        if (!(cat instanceof Map)) return null;
        Object name = ((Map<?, ?>) cat).get("name");
        return name instanceof String ? (String) name : null;
    }

    @SuppressWarnings("unchecked")
    private String extractPriority(Map<String, Object> fields) {
        Object p = fields.get("priority");
        if (!(p instanceof Map)) return null;
        Object name = ((Map<?, ?>) p).get("name");
        return name instanceof String ? (String) name : null;
    }

    @SuppressWarnings("unchecked")
    private String extractPriorityIconUrl(Map<String, Object> fields) {
        Object p = fields.get("priority");
        if (!(p instanceof Map)) return null;
        Object icon = ((Map<?, ?>) p).get("iconUrl");
        return icon instanceof String ? (String) icon : null;
    }

    @SuppressWarnings("unchecked")
    private String extractDisplayName(Map<String, Object> fields, String fieldKey) {
        Object person = fields.get(fieldKey);
        if (!(person instanceof Map)) return null;
        Object dn = ((Map<?, ?>) person).get("displayName");
        return dn instanceof String ? (String) dn : null;
    }

    @SuppressWarnings("unchecked")
    private String extractAvatarUrl(Map<String, Object> fields, String fieldKey) {
        Object person = fields.get(fieldKey);
        if (!(person instanceof Map)) return null;
        Object avatars = ((Map<?, ?>) person).get("avatarUrls");
        if (!(avatars instanceof Map)) return null;
        // prefer 24x24, fall back to 16x16
        Object url = ((Map<?, ?>) avatars).get("24x24");
        if (url instanceof String) return (String) url;
        url = ((Map<?, ?>) avatars).get("16x16");
        return url instanceof String ? (String) url : null;
    }

    @SuppressWarnings("unchecked")
    private List<String> extractLabels(Map<String, Object> fields) {
        Object labelsObj = fields.get("labels");
        if (!(labelsObj instanceof List)) return List.of();
        return ((List<?>) labelsObj).stream()
                .filter(l -> l instanceof String)
                .map(l -> (String) l)
                .collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private String extractLastCommentDate(Map<String, Object> fields) {
        Object commentObj = fields.get("comment");
        if (!(commentObj instanceof Map)) return null;
        Object comments = ((Map<?, ?>) commentObj).get("comments");
        if (!(comments instanceof List) || ((List<?>) comments).isEmpty()) return null;
        List<Map<String, Object>> list = (List<Map<String, Object>>) comments;
        Map<String, Object> last = list.get(list.size() - 1);
        Object created = last.get("created");
        return created instanceof String ? (String) created : null;
    }

    @SuppressWarnings("unchecked")
    private String extractLastCommentSnippet(Map<String, Object> fields) {
        Object commentObj = fields.get("comment");
        if (!(commentObj instanceof Map)) return null;
        Object comments = ((Map<?, ?>) commentObj).get("comments");
        if (!(comments instanceof List) || ((List<?>) comments).isEmpty()) return null;
        List<Map<String, Object>> list = (List<Map<String, Object>>) comments;
        Map<String, Object> last = list.get(list.size() - 1);
        Object body = last.get("body");
        if (body instanceof Map) {
            String text = adfToText((Map<String, Object>) body, 200);
            if (text != null && !text.isBlank()) return text;
        }
        Object bodyStr = last.get("body");
        return bodyStr instanceof String ? truncate((String) bodyStr, 200) : null;
    }

    @SuppressWarnings("unchecked")
    private String adfToText(Map<String, Object> node, int maxLen) {
        StringBuilder sb = new StringBuilder();
        Object content = node.get("content");
        if (content instanceof List) {
            for (Object child : (List<?>) content) {
                if (!(child instanceof Map)) continue;
                Map<String, Object> childNode = (Map<String, Object>) child;
                String type = str(childNode, "type");
                if ("text".equals(type)) {
                    Object text = childNode.get("text");
                    if (text instanceof String) sb.append(text);
                } else {
                    String sub = adfToText(childNode, maxLen);
                    if (sub != null) sb.append(sub);
                }
                if (sb.length() >= maxLen) break;
            }
        }
        return sb.isEmpty() ? null : truncate(sb.toString().trim(), maxLen);
    }

    private String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    // ── Staleness ──────────────────────────────────────────────────────────────

    private boolean isStale(String updatedIso, String statusChangedIso, LocalDate today, int thresholdDays) {
        LocalDate lastUpdated = mostRecent(parseDate(updatedIso), parseDate(statusChangedIso));
        if (lastUpdated == null) return false;
        return businessDaysBetween(lastUpdated, today) > thresholdDays;
    }

    private LocalDate mostRecent(LocalDate a, LocalDate b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isAfter(b) ? a : b;
    }

    private LocalDate parseDate(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try { return OffsetDateTime.parse(iso).toLocalDate(); }
        catch (Exception e) {
            try { return LocalDate.parse(iso.substring(0, 10)); }
            catch (Exception ex) { return null; }
        }
    }

    private long businessDaysBetween(LocalDate from, LocalDate to) {
        if (from == null || to == null || !from.isBefore(to)) return 0;
        long count = 0;
        LocalDate d = from;
        while (d.isBefore(to)) {
            DayOfWeek dow = d.getDayOfWeek();
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) count++;
            d = d.plusDays(1);
        }
        return count;
    }

    // ── Time window ────────────────────────────────────────────────────────────

    private String getTimeWindow(String createdIso, LocalDate today) {
        LocalDate created = parseDate(createdIso);
        if (created == null) return "older";
        long days = today.toEpochDay() - created.toEpochDay();
        if (days == 0)  return "today";
        if (days <= 3)  return "last3";
        if (days <= 7)  return "last7";
        return "older";
    }

    // ── DTOs ───────────────────────────────────────────────────────────────────

    public record SupportTicket(
            String key, String summary, String status, String statusCategory,
            String priority, String priorityIconUrl,
            String reporter, String assignee, String assigneeAvatarUrl, List<String> labels,
            String created, String updated,
            String lastCommentDate, String lastCommentSnippet,
            String lastStatusChangeDate,
            boolean stale,
            /** "today" | "last3" | "last7" | "older" */
            String timeWindow) {}

    public record BoardSnapshot(
            Long configId, Long boardId, String boardName,
            List<SupportTicket> tickets,
            String errorMessage) {}

    public record SupportSnapshot(List<BoardSnapshot> boards, String fetchedAt) {}

    public record DayPoint(String date, int openCount, int staleCount, double avgAgeDays) {}

    public record BoardHistory(Long boardId, String boardName, List<DayPoint> history) {}

    // ── Monthly throughput ─────────────────────────────────────────────────────

    /**
     * Returns tickets created and closed per calendar month for all enabled boards.
     * Queries Jira with maxResults=0 (count-only) — one call per board per month direction.
     *
     * @param months number of complete calendar months to look back (1–12)
     */
    public List<MonthlyThroughput> getMonthlyThroughput(int months) {
        List<JiraSupportBoard> boards = boardRepo.findByEnabledTrue();
        YearMonth now = YearMonth.now(ZoneOffset.UTC);

        return boards.stream()
                .map(board -> buildMonthlyThroughput(board, now, months))
                .collect(Collectors.toList());
    }

    private MonthlyThroughput buildMonthlyThroughput(JiraSupportBoard board, YearMonth now, int months) {
        // Use configured project key; fall back to resolving from service-desk ID
        String projectKey = board.getProjectKey();
        if (projectKey == null || projectKey.isBlank()) {
            try {
                projectKey = board.getBoardId() != null
                        ? jiraClient.resolveServiceDeskProjectKey(board.getBoardId())
                        : null;
            } catch (Exception e) {
                log.warn("Cannot resolve project key for board {} (boardId={}): {}",
                        board.getName(), board.getBoardId(), e.getMessage());
                projectKey = null;
            }
        }

        List<MonthPoint> points = new ArrayList<>();
        if (projectKey == null) {
            // No project key — return empty points
            for (int i = months - 1; i >= 0; i--) {
                points.add(new MonthPoint(now.minusMonths(i).toString(), 0, 0));
            }
            return new MonthlyThroughput(board.getId(), board.getName(), points);
        }

        // Load all issues for this project from DB once
        List<JiraSyncedIssue> allIssues = issueRepo.findByProjectKey(projectKey);

        for (int i = months - 1; i >= 0; i--) {
            YearMonth ym = now.minusMonths(i);
            LocalDateTime monthStart = ym.atDay(1).atStartOfDay();
            LocalDateTime monthEnd   = ym.plusMonths(1).atDay(1).atStartOfDay();

            final LocalDateTime ms = monthStart;
            final LocalDateTime me = monthEnd;

            int created = (int) allIssues.stream()
                    .filter(issue -> issue.getCreatedAt() != null
                            && !issue.getCreatedAt().isBefore(ms)
                            && issue.getCreatedAt().isBefore(me))
                    .count();

            int closed = (int) allIssues.stream()
                    .filter(issue -> "done".equalsIgnoreCase(issue.getStatusCategory())
                            && issue.getResolutionDate() != null
                            && !issue.getResolutionDate().isBefore(ms)
                            && issue.getResolutionDate().isBefore(me))
                    .count();

            points.add(new MonthPoint(ym.toString(), created, closed));
        }

        return new MonthlyThroughput(board.getId(), board.getName(), points);
    }

    public record MonthPoint(
            /** ISO year-month, e.g. "2025-03" */
            String month,
            int created,
            int closed) {}

    public record MonthlyThroughput(
            Long boardId,
            String boardName,
            List<MonthPoint> months) {}
}
