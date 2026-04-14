package com.portfolioplanner.controller;

import com.portfolioplanner.service.reports.ResourcePerformanceService;
import com.portfolioplanner.service.reports.ResourcePerformanceService.PerformanceSummary;
import com.portfolioplanner.service.reports.ResourcePerformanceService.ResourceIssue;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/reports/resource-performance")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ResourcePerformanceController {

    private final ResourcePerformanceService performanceService;

    @GetMapping
    public ResponseEntity<PerformanceSummary> getPerformance(
            @RequestParam(defaultValue = "0") int year,
            @RequestParam(defaultValue = "MONTHLY") String period) {
        if (year == 0) year = LocalDate.now().getYear();
        String periodType = period.toUpperCase();
        if (!periodType.equals("MONTHLY") && !periodType.equals("QUARTERLY") && !periodType.equals("YEARLY")) {
            periodType = "MONTHLY";
        }
        return ResponseEntity.ok(performanceService.getPerformance(year, periodType));
    }

    @GetMapping("/{resourceId}/issues")
    public ResponseEntity<List<ResourceIssue>> getResourceIssues(
            @PathVariable Long resourceId,
            @RequestParam int year,
            @RequestParam(defaultValue = "MONTHLY") String period,
            @RequestParam int periodIndex) {
        String periodType = period.toUpperCase();
        if (!periodType.equals("MONTHLY") && !periodType.equals("QUARTERLY") && !periodType.equals("YEARLY")) {
            periodType = "MONTHLY";
        }
        return ResponseEntity.ok(performanceService.getResourceIssues(resourceId, year, periodType, periodIndex));
    }
}
