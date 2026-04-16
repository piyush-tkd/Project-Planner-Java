package com.portfolioplanner.controller;

import com.portfolioplanner.service.DashboardQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

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
@PreAuthorize("isAuthenticated()")
public class DashboardQueryController {

    private final DashboardQueryService queryService;

    @PostMapping("/query")
    public ResponseEntity<DashboardQueryService.DashboardQueryResponse> query(
            @RequestBody DashboardQueryService.DashboardQueryRequest req) {
        return ResponseEntity.ok(queryService.query(req));
    }
}
