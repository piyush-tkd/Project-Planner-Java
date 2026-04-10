package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.RiskItem;
import com.portfolioplanner.domain.model.Sprint;
import com.portfolioplanner.domain.repository.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Generic data query engine for dashboard widgets.
 *
 * <p>Supports queries across multiple entities (PROJECTS, RESOURCES, PODS, SPRINTS, RISKS)
 * with dimension aggregation and filtering.
 *
 * <p>Endpoint: {@code POST /api/dashboards/query}
 */
@RestController
@RequestMapping("/api/dashboards")
@RequiredArgsConstructor
@Slf4j
public class DashboardQueryController {

    private final ProjectRepository projectRepo;
    private final ResourceRepository resourceRepo;
    private final PodRepository podRepo;
    private final SprintRepository sprintRepo;
    private final RiskItemRepository riskRepo;

    @PostMapping("/query")
    public ResponseEntity<DashboardQueryResponse> query(
            @RequestBody DashboardQueryRequest req) {
        try {
            DashboardQueryResponse resp = executeQuery(req);
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("Query failed: entity={}, metric={}, dimension={}",
                    req.entity, req.metric, req.dimension, e);
            return ResponseEntity.badRequest().build();
        }
    }

    private DashboardQueryResponse executeQuery(DashboardQueryRequest req) {
        return switch (req.entity.toUpperCase()) {
            case "PROJECTS" -> queryProjects(req);
            case "RESOURCES" -> queryResources(req);
            case "PODS" -> queryPods(req);
            case "SPRINTS" -> querySprints(req);
            case "RISKS" -> queryRisks(req);
            default -> throw new IllegalArgumentException("Unknown entity: " + req.entity);
        };
    }

    // ── PROJECTS Queries ─────────────────────────────────────────────────────

    private DashboardQueryResponse queryProjects(DashboardQueryRequest req) {
        List<Project> all = projectRepo.findAll();

        return switch (req.dimension.toUpperCase()) {
            case "STATUS" ->
                    aggregateByStringField(all, p -> p.getStatus(), req);

            case "PRIORITY" ->
                    aggregateByStringField(all, p -> p.getPriority().name(), req);

            case "POD" ->
                    aggregateByStringField(all, p -> {
                        // Placeholder: Projects don't directly have pods in base model
                        // This would require a join in a real scenario
                        return p.getOwner() != null ? p.getOwner() : "UNASSIGNED";
                    }, req);

            case "NONE" -> {
                // Simple count
                int count = all.size();
                DashboardQueryResponse resp = new DashboardQueryResponse();
                resp.labels = List.of("Total");
                resp.values = List.of((double) count);
                resp.rawData = List.of(Map.of("label", "Total", "value", count));
                yield resp;
            }

            default -> throw new IllegalArgumentException("Unknown dimension: " + req.dimension);
        };
    }

    // ── RESOURCES Queries ────────────────────────────────────────────────────

    private DashboardQueryResponse queryResources(DashboardQueryRequest req) {
        List<Resource> all = resourceRepo.findAll();

        return switch (req.dimension.toUpperCase()) {
            case "ROLE" ->
                    aggregateByStringField(all, r -> r.getRole().name(), req);

            case "LOCATION" ->
                    aggregateByStringField(all, r -> r.getLocation().name(), req);

            case "POD" -> {
                // Placeholder: Resources can be assigned to pods via ResourcePodAssignment
                // For now, return empty grouping
                DashboardQueryResponse resp = new DashboardQueryResponse();
                resp.labels = List.of();
                resp.values = List.of();
                resp.rawData = List.of();
                yield resp;
            }

            case "NONE" -> {
                // Simple count
                int count = all.size();
                DashboardQueryResponse resp = new DashboardQueryResponse();
                resp.labels = List.of("Total");
                resp.values = List.of((double) count);
                resp.rawData = List.of(Map.of("label", "Total", "value", count));
                yield resp;
            }

            default -> throw new IllegalArgumentException("Unknown dimension: " + req.dimension);
        };
    }

    // ── PODS Queries ─────────────────────────────────────────────────────────

    private DashboardQueryResponse queryPods(DashboardQueryRequest req) {
        List<com.portfolioplanner.domain.model.Pod> all = podRepo.findAll();

        if ("COUNT".equalsIgnoreCase(req.aggregation)) {
            int count = all.size();
            DashboardQueryResponse resp = new DashboardQueryResponse();
            resp.labels = List.of("Total Pods");
            resp.values = List.of((double) count);
            resp.rawData = List.of(Map.of("label", "Total Pods", "value", count));
            return resp;
        }

        // For other aggregations on pods, return basic structure
        DashboardQueryResponse resp = new DashboardQueryResponse();
        resp.labels = List.of();
        resp.values = List.of();
        resp.rawData = List.of();
        return resp;
    }

    // ── SPRINTS Queries ──────────────────────────────────────────────────────

    private DashboardQueryResponse querySprints(DashboardQueryRequest req) {
        List<Sprint> all = sprintRepo.findAll();

        if ("NAME".equalsIgnoreCase(req.dimension) && "SUM".equalsIgnoreCase(req.aggregation)) {
            // Story points by sprint (velocity)
            // Note: Sprint doesn't have storyPoints field in base model
            // This is a placeholder; real implementation would join with issues
            List<String> labels = all.stream()
                    .map(Sprint::getName)
                    .collect(Collectors.toList());

            DashboardQueryResponse resp = new DashboardQueryResponse();
            resp.labels = labels;
            resp.values = new ArrayList<>(Collections.nCopies(labels.size(), 0.0));
            resp.rawData = labels.stream()
                    .map(name -> {
                        Map<String, Object> row = new java.util.HashMap<>();
                        row.put("sprint", name);
                        row.put("storyPoints", 0);
                        return row;
                    })
                    .collect(Collectors.toList());
            return resp;
        }

        // Default
        DashboardQueryResponse resp = new DashboardQueryResponse();
        resp.labels = List.of();
        resp.values = List.of();
        resp.rawData = List.of();
        return resp;
    }

    // ── RISKS Queries ────────────────────────────────────────────────────────

    private DashboardQueryResponse queryRisks(DashboardQueryRequest req) {
        List<RiskItem> all = riskRepo.findAll();

        return switch (req.dimension.toUpperCase()) {
            case "SEVERITY" ->
                    aggregateByStringField(all, r -> r.getSeverity(), req);

            case "STATUS" ->
                    aggregateByStringField(all, r -> r.getStatus(), req);

            case "NONE" -> {
                // Simple count
                int count = all.size();
                DashboardQueryResponse resp = new DashboardQueryResponse();
                resp.labels = List.of("Total Risks");
                resp.values = List.of((double) count);
                resp.rawData = List.of(Map.of("label", "Total Risks", "value", count));
                yield resp;
            }

            default -> throw new IllegalArgumentException("Unknown dimension: " + req.dimension);
        };
    }

    // ── Helper Methods ───────────────────────────────────────────────────────

    /**
     * Generic aggregation by a string field (dimension).
     */
    private <T> DashboardQueryResponse aggregateByStringField(
            List<T> items,
            java.util.function.Function<T, String> fieldExtractor,
            DashboardQueryRequest req) {

        Map<String, Integer> counts = new TreeMap<>();
        for (T item : items) {
            String key = fieldExtractor.apply(item);
            if (key == null) key = "UNKNOWN";
            counts.put(key, counts.getOrDefault(key, 0) + 1);
        }

        DashboardQueryResponse resp = new DashboardQueryResponse();
        resp.labels = new ArrayList<>(counts.keySet());
        resp.values = counts.values().stream()
                .map(Integer::doubleValue)
                .collect(Collectors.toList());
        resp.rawData = resp.labels.stream()
                .map(label -> Map.of("label", (Object) label, "value", (Object) counts.get(label)))
                .collect(Collectors.toList());

        return resp;
    }

    // ── Request / Response DTOs ──────────────────────────────────────────────

    @Data
    public static class DashboardQueryRequest {
        public String entity;           // PROJECTS, RESOURCES, PODS, SPRINTS, RISKS
        public String metric;           // count, sum, avg, etc.
        public String dimension;        // status, priority, pod, role, severity, etc.
        public String aggregation;      // COUNT, SUM, AVG, etc.
        public Map<String, Object> filters;  // Optional: { "status": "ACTIVE", ... }

        public DashboardQueryRequest() {
            filters = new HashMap<>();
        }
    }

    @Data
    public static class DashboardQueryResponse {
        public List<String> labels;         // e.g., ["ACTIVE", "ON_HOLD", "COMPLETED"]
        public List<Double> values;         // e.g., [15, 3, 8]
        public List<Map<String, Object>> rawData;  // Full data for advanced rendering
    }
}
