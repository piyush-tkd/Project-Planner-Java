package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.ResourcePodAssignment;
import com.portfolioplanner.domain.model.TeamPulse;
import com.portfolioplanner.domain.repository.ResourcePodAssignmentRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import com.portfolioplanner.domain.repository.TeamPulseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/pulse")
@RequiredArgsConstructor
public class TeamPulseController {

    private final TeamPulseRepository              pulseRepo;
    private final ResourceRepository               resourceRepo;
    private final ResourcePodAssignmentRepository  assignmentRepo;

    // ── Submit a pulse entry ──────────────────────────────────────────────────
    @PostMapping
    public ResponseEntity<Map<String, Object>> submit(@RequestBody SubmitRequest req) {
        if (!resourceRepo.existsById(req.resourceId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Resource not found"));
        }
        if (req.score() < 1 || req.score() > 5) {
            return ResponseEntity.badRequest().body(Map.of("error", "Score must be 1–5"));
        }
        LocalDate weekStart = req.weekStart() != null ? req.weekStart() : currentWeekStart();
        // Upsert: if entry exists for this resource+week, update it
        TeamPulse pulse = pulseRepo.findByResourceIdAndWeekStart(req.resourceId(), weekStart)
                .orElseGet(() -> TeamPulse.builder()
                        .resourceId(req.resourceId())
                        .weekStart(weekStart)
                        .build());
        pulse.setScore(req.score().shortValue());
        pulse.setComment(req.comment());
        TeamPulse saved = pulseRepo.save(pulse);
        return ResponseEntity.ok(toMap(saved));
    }

    // ── Trend: overall team avg per week for last 12 weeks ────────────────────
    @GetMapping("/trend")
    public ResponseEntity<List<Map<String, Object>>> trend() {
        LocalDate to   = currentWeekStart();
        LocalDate from = to.minusWeeks(11);
        List<TeamPulse> rows = pulseRepo.findByWeekStartBetweenOrderByWeekStartDesc(from, to);

        // Group by week → avg score
        Map<LocalDate, List<TeamPulse>> byWeek = rows.stream()
                .collect(Collectors.groupingBy(TeamPulse::getWeekStart));

        List<Map<String, Object>> result = new ArrayList<>();
        LocalDate cursor = from;
        while (!cursor.isAfter(to)) {
            List<TeamPulse> week = byWeek.getOrDefault(cursor, List.of());
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("week",  cursor.toString());
            point.put("label", cursor.getMonthValue() + "/" + cursor.getDayOfMonth());
            point.put("avg",   week.isEmpty() ? null
                    : round(week.stream().mapToInt(p -> p.getScore()).average().orElse(0), 1));
            point.put("count", week.size());
            result.add(point);
            cursor = cursor.plusWeeks(1);
        }
        return ResponseEntity.ok(result);
    }

    // ── Summary: per-POD avg for last 8 weeks ────────────────────────────────
    @GetMapping("/summary")
    public ResponseEntity<List<Map<String, Object>>> summary() {
        LocalDate to   = currentWeekStart();
        LocalDate from = to.minusWeeks(7);
        List<TeamPulse> rows = pulseRepo.findByWeekStartBetweenOrderByWeekStartDesc(from, to);

        // Build resource → pod name lookup
        List<Resource> activeResources = resourceRepo.findByActiveTrue();
        Map<Long, String> resourcePodMap = new HashMap<>();
        for (Resource r : activeResources) {
            assignmentRepo.findByResourceId(r.getId()).ifPresent(a -> {
                if (a.getPod() != null) resourcePodMap.put(r.getId(), a.getPod().getName());
            });
        }
        Map<Long, String> resourceNameMap = activeResources.stream()
                .collect(Collectors.toMap(Resource::getId, Resource::getName));

        // Group by POD and week
        List<LocalDate> weeks = new ArrayList<>();
        LocalDate cursor = from;
        while (!cursor.isAfter(to)) { weeks.add(cursor); cursor = cursor.plusWeeks(1); }

        Set<String> pods = new LinkedHashSet<>(resourcePodMap.values());
        List<Map<String, Object>> result = new ArrayList<>();

        for (String pod : pods) {
            Set<Long> podResourceIds = resourcePodMap.entrySet().stream()
                    .filter(e -> pod.equals(e.getValue()))
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toSet());

            Map<String, Object> podEntry = new LinkedHashMap<>();
            podEntry.put("pod", pod);

            List<Map<String, Object>> weeklyAvgs = new ArrayList<>();
            for (LocalDate week : weeks) {
                List<TeamPulse> weekRows = rows.stream()
                        .filter(p -> week.equals(p.getWeekStart()) && podResourceIds.contains(p.getResourceId()))
                        .collect(Collectors.toList());
                Map<String, Object> wm = new LinkedHashMap<>();
                wm.put("week",  week.toString());
                wm.put("label", week.getMonthValue() + "/" + week.getDayOfMonth());
                wm.put("avg",   weekRows.isEmpty() ? null
                        : round(weekRows.stream().mapToInt(p -> p.getScore()).average().orElse(0), 1));
                wm.put("count", weekRows.size());
                weeklyAvgs.add(wm);
            }
            podEntry.put("weeks", weeklyAvgs);

            // Overall pod avg
            List<TeamPulse> podAllRows = rows.stream()
                    .filter(p -> podResourceIds.contains(p.getResourceId()))
                    .collect(Collectors.toList());
            podEntry.put("overallAvg", podAllRows.isEmpty() ? null
                    : round(podAllRows.stream().mapToInt(p -> p.getScore()).average().orElse(0), 1));
            podEntry.put("resourceCount", podResourceIds.size());
            result.add(podEntry);
        }

        return ResponseEntity.ok(result);
    }

    // ── Entries for a specific week ───────────────────────────────────────────
    @GetMapping("/week/{weekStart}")
    public ResponseEntity<List<Map<String, Object>>> byWeek(@PathVariable String weekStart) {
        LocalDate date = LocalDate.parse(weekStart);
        List<TeamPulse> pulses = pulseRepo.findByWeekStart(date);
        List<Resource> resources = resourceRepo.findAllById(
                pulses.stream().map(TeamPulse::getResourceId).collect(Collectors.toList()));
        Map<Long, String> nameMap = resources.stream()
                .collect(Collectors.toMap(Resource::getId, Resource::getName));

        return ResponseEntity.ok(pulses.stream().map(p -> {
            Map<String, Object> m = toMap(p);
            m.put("resourceName", nameMap.getOrDefault(p.getResourceId(), "Unknown"));
            return m;
        }).collect(Collectors.toList()));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private static LocalDate currentWeekStart() {
        return LocalDate.now().with(WeekFields.ISO.dayOfWeek(), 1); // Monday
    }

    private static double round(double v, int places) {
        double scale = Math.pow(10, places);
        return Math.round(v * scale) / scale;
    }

    private Map<String, Object> toMap(TeamPulse p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",         p.getId());
        m.put("resourceId", p.getResourceId());
        m.put("weekStart",  p.getWeekStart() != null ? p.getWeekStart().toString() : null);
        m.put("score",      p.getScore());
        m.put("comment",    p.getComment());
        m.put("createdAt",  p.getCreatedAt() != null ? p.getCreatedAt().toString() : null);
        return m;
    }

    record SubmitRequest(Long resourceId, Integer score, String comment, LocalDate weekStart) {}
}
