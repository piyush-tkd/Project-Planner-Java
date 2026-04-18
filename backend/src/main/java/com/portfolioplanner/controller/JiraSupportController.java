package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.JiraSupportBoard;
import com.portfolioplanner.service.jira.JiraSupportService;
import com.portfolioplanner.service.jira.JiraSupportService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/jira/support")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class JiraSupportController {

    private final JiraSupportService svc;

    // ── Live snapshot ──────────────────────────────────────────────────────────

    @GetMapping("/snapshot")
    public SupportSnapshot getSnapshot() {
        return svc.getSnapshot();
    }

    // ── Snapshot history (trend chart) ─────────────────────────────────────────

    @GetMapping("/history")
    public List<BoardHistory> getHistory(@RequestParam(defaultValue = "30") int days) {
        return svc.getHistory(Math.min(days, 90));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/snapshot/capture")
    public ResponseEntity<Void> captureNow() {
        svc.captureNow();
        return ResponseEntity.ok().build();
    }

    // ── Board config CRUD ──────────────────────────────────────────────────────

    @GetMapping("/boards")
    public List<JiraSupportBoard> listBoards() {
        return svc.listBoards();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/boards")
    public ResponseEntity<JiraSupportBoard> createBoard(@RequestBody BoardRequest req) {
        JiraSupportBoard board = new JiraSupportBoard();
        board.setName(req.name());
        board.setBoardId(req.boardId());
        board.setProjectKey(req.projectKey() != null ? req.projectKey().trim().toUpperCase() : null);
        board.setQueueId(req.queueId());
        board.setEnabled(true);
        board.setStaleThresholdDays(req.staleThresholdDays() != null ? req.staleThresholdDays() : 3);
        if (req.alertPriorities() != null && !req.alertPriorities().isBlank()) {
            board.setAlertPriorities(req.alertPriorities().trim());
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(svc.saveBoard(board));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/boards/{id}")
    public JiraSupportBoard updateBoard(@PathVariable Long id, @RequestBody BoardRequest req) {
        JiraSupportBoard board = svc.listBoards().stream()
                .filter(b -> b.getId().equals(id))
                .findFirst()
                .orElseThrow(() -> new com.portfolioplanner.exception.ResourceNotFoundException("Board not found: " + id));
        board.setName(req.name());
        board.setBoardId(req.boardId());
        board.setProjectKey(req.projectKey() != null ? req.projectKey().trim().toUpperCase() : null);
        board.setQueueId(req.queueId());
        if (req.enabled() != null) board.setEnabled(req.enabled());
        if (req.staleThresholdDays() != null) board.setStaleThresholdDays(req.staleThresholdDays());
        if (req.alertPriorities() != null && !req.alertPriorities().isBlank()) {
            board.setAlertPriorities(req.alertPriorities().trim());
        }
        return svc.saveBoard(board);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/boards/{id}")
    public ResponseEntity<Void> deleteBoard(@PathVariable Long id) {
        svc.deleteBoard(id);
        return ResponseEntity.noContent().build();
    }

    // ── Monthly throughput (created vs closed) ────────────────────────────────

    @GetMapping("/monthly-throughput")
    public List<JiraSupportService.MonthlyThroughput> getMonthlyThroughput(
            @RequestParam(defaultValue = "6") int months) {
        return svc.getMonthlyThroughput(Math.min(Math.max(months, 1), 12));
    }

    // ── All tickets (all statuses, for analysis) ──────────────────────────────

    @GetMapping("/all-tickets")
    public JiraSupportService.SupportSnapshot getAllTickets(
            @RequestParam(defaultValue = "90") int days) {
        return svc.getAllTickets(Math.min(Math.max(days, 7), 365));
    }

    // ── Available boards picker ────────────────────────────────────────────────

    @GetMapping("/available-boards")
    public List<Map<String, Object>> getAvailableBoards() {
        return svc.getAvailableBoards();
    }

    // ── Request DTO ────────────────────────────────────────────────────────────

    public record BoardRequest(
            String name,
            Long boardId,
            /** Jira project key, e.g. "AC" or "LR". Preferred over boardId. */
            String projectKey,
            /** JSM custom-queue ID from the queue URL (e.g. 1649). */
            Long queueId,
            Boolean enabled,
            Integer staleThresholdDays,
            /** Comma-separated Jira priority names that trigger inbox alerts, e.g. "Blocker,Critical,Highest". */
            String alertPriorities) {}
}
