package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.TeamPulse;
import com.portfolioplanner.domain.repository.ResourcePodAssignmentRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import com.portfolioplanner.domain.repository.TeamPulseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TeamPulseService {

    private final TeamPulseRepository              pulseRepo;
    private final ResourceRepository               resourceRepo;
    private final ResourcePodAssignmentRepository  assignmentRepo;

    // ── Submit / upsert ───────────────────────────────────────────────────────

    @Transactional
    public TeamPulse submit(Long resourceId, Integer score, String comment, LocalDate weekStart) {
        if (!resourceRepo.existsById(resourceId))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Resource not found");
        if (score < 1 || score > 5)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Score must be 1–5");

        LocalDate ws = weekStart != null ? weekStart : currentWeekStart();
        TeamPulse pulse = pulseRepo.findByResourceIdAndWeekStart(resourceId, ws)
                .orElseGet(() -> TeamPulse.builder()
                        .resourceId(resourceId)
                        .weekStart(ws)
                        .build());
        pulse.setScore(score.shortValue());
        pulse.setComment(comment);
        return pulseRepo.save(pulse);
    }

    // ── Trend: overall team avg per week for last 12 weeks ────────────────────

    public List<Map<String, Object>> trend() {
        LocalDate to   = currentWeekStart();
        LocalDate from = to.minusWeeks(11);
        List<TeamPulse> rows = pulseRepo.findByWeekStartBetweenOrderByWeekStartDesc(from, to);
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
        return result;
    }

    // ── Summary: per-POD avg for last 8 weeks ────────────────────────────────

    public List<Map<String, Object>> summary() {
        LocalDate to   = currentWeekStart();
        LocalDate from = to.minusWeeks(7);
        List<TeamPulse> rows = pulseRepo.findByWeekStartBetweenOrderByWeekStartDesc(from, to);

        List<Resource> activeResources = resourceRepo.findByActiveTrue();
        Map<Long, String> resourcePodMap = new HashMap<>();
        for (Resource r : activeResources) {
            assignmentRepo.findByResourceId(r.getId()).ifPresent(a -> {
                if (a.getPod() != null) resourcePodMap.put(r.getId(), a.getPod().getName());
            });
        }

        List<LocalDate> weeks = new ArrayList<>();
        LocalDate cursor = from;
        while (!cursor.isAfter(to)) { weeks.add(cursor); cursor = cursor.plusWeeks(1); }

        Set<String> pods = new LinkedHashSet<>(resourcePodMap.values());
        List<Map<String, Object>> result = new ArrayList<>();

        for (String pod : pods) {
            Set<Long> podResourceIds = resourcePodMap.entrySet().stream()
                    .filter(e -> pod.equals(e.getValue())).map(Map.Entry::getKey)
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

            List<TeamPulse> podAllRows = rows.stream()
                    .filter(p -> podResourceIds.contains(p.getResourceId()))
                    .collect(Collectors.toList());
            podEntry.put("overallAvg", podAllRows.isEmpty() ? null
                    : round(podAllRows.stream().mapToInt(p -> p.getScore()).average().orElse(0), 1));
            podEntry.put("resourceCount", podResourceIds.size());
            result.add(podEntry);
        }
        return result;
    }

    // ── By week ───────────────────────────────────────────────────────────────

    public List<Map<String, Object>> byWeek(LocalDate date) {
        List<TeamPulse> pulses = pulseRepo.findByWeekStart(date);
        List<Resource> resources = resourceRepo.findAllById(
                pulses.stream().map(TeamPulse::getResourceId).collect(Collectors.toList()));
        Map<Long, String> nameMap = resources.stream()
                .collect(Collectors.toMap(Resource::getId, Resource::getName));

        return pulses.stream().map(p -> {
            Map<String, Object> m = toMap(p);
            m.put("resourceName", nameMap.getOrDefault(p.getResourceId(), "Unknown"));
            return m;
        }).collect(Collectors.toList());
    }

    // ── Update ────────────────────────────────────────────────────────────────

    @Transactional
    public Optional<TeamPulse> update(Long id, Integer score, String comment) {
        return pulseRepo.findById(id).map(pulse -> {
            if (score != null) {
                if (score < 1 || score > 5)
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Score must be 1–5");
                pulse.setScore(score.shortValue());
            }
            pulse.setComment(comment);
            return pulseRepo.save(pulse);
        });
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @Transactional
    public boolean delete(Long id) {
        if (!pulseRepo.existsById(id)) return false;
        pulseRepo.deleteById(id);
        return true;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public static LocalDate currentWeekStart() {
        return LocalDate.now().with(WeekFields.ISO.dayOfWeek(), 1);
    }

    private static double round(double v, int places) {
        double scale = Math.pow(10, places);
        return Math.round(v * scale) / scale;
    }

    public Map<String, Object> toMap(TeamPulse p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",         p.getId());
        m.put("resourceId", p.getResourceId());
        m.put("weekStart",  p.getWeekStart() != null ? p.getWeekStart().toString() : null);
        m.put("score",      p.getScore());
        m.put("comment",    p.getComment());
        m.put("createdAt",  p.getCreatedAt() != null ? p.getCreatedAt().toString() : null);
        return m;
    }
}
