package com.portfolioplanner.controller;

import com.portfolioplanner.service.TeamPulseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pulse")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class TeamPulseController {

    private final TeamPulseService teamPulseService;

    record SubmitRequest(Long resourceId, Integer score, String comment, LocalDate weekStart) {}
    record UpdateRequest(Integer score, String comment) {}

    @PostMapping
    public ResponseEntity<Map<String, Object>> submit(@RequestBody SubmitRequest req) {
        try {
            return ResponseEntity.ok(teamPulseService.toMap(
                    teamPulseService.submit(req.resourceId(), req.score(), req.comment(), req.weekStart())));
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode())
                    .body(Map.of("error", ex.getReason() != null ? ex.getReason() : "Bad request"));
        }
    }

    @GetMapping("/trend")
    public ResponseEntity<List<Map<String, Object>>> trend() {
        return ResponseEntity.ok(teamPulseService.trend());
    }

    @GetMapping("/summary")
    public ResponseEntity<List<Map<String, Object>>> summary() {
        return ResponseEntity.ok(teamPulseService.summary());
    }

    @GetMapping("/week/{weekStart}")
    public ResponseEntity<List<Map<String, Object>>> byWeek(@PathVariable String weekStart) {
        return ResponseEntity.ok(teamPulseService.byWeek(LocalDate.parse(weekStart)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody UpdateRequest req) {
        try {
            return teamPulseService.update(id, req.score(), req.comment())
                    .map(p -> ResponseEntity.ok((Object) teamPulseService.toMap(p)))
                    .orElse(ResponseEntity.notFound().build());
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode())
                    .body(Map.of("error", ex.getReason() != null ? ex.getReason() : "Bad request"));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return teamPulseService.delete(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
