package com.portfolioplanner.controller;

import com.portfolioplanner.dto.response.*;
import com.portfolioplanner.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/executive-summary")
    public ResponseEntity<ExecutiveSummaryResponse> getExecutiveSummary() {
        return ResponseEntity.ok(reportService.getExecutiveSummary());
    }

    @GetMapping("/capacity-gap")
    public ResponseEntity<CapacityGapResponse> getCapacityGap(@RequestParam(required = false, defaultValue = "HOURS") String unit) {
        return ResponseEntity.ok(reportService.getCapacityGap(unit));
    }

    @GetMapping("/utilization-heatmap")
    public ResponseEntity<UtilizationHeatmapResponse> getUtilizationHeatmap() {
        return ResponseEntity.ok(reportService.getUtilizationHeatmap());
    }

    @GetMapping("/hiring-forecast")
    public ResponseEntity<HiringForecastResponse> getHiringForecast() {
        return ResponseEntity.ok(reportService.getHiringForecast());
    }

    @GetMapping("/concurrency-risk")
    public ResponseEntity<ConcurrencyRiskResponse> getConcurrencyRisk() {
        return ResponseEntity.ok(reportService.getConcurrencyRisk());
    }

    @GetMapping("/resource-allocation")
    public ResponseEntity<ResourceAllocationResponse> getResourceAllocation() {
        return ResponseEntity.ok(reportService.getResourceAllocation());
    }

    @GetMapping("/capacity-demand-summary")
    public ResponseEntity<CapacityDemandSummaryResponse> getCapacityDemandSummary() {
        return ResponseEntity.ok(reportService.getCapacityDemandSummary());
    }

    @GetMapping("/pod-resource-summary")
    public ResponseEntity<PodResourceSummaryResponse> getPodResourceSummary() {
        return ResponseEntity.ok(reportService.getPodResourceSummary());
    }

    @GetMapping("/export/reconciliation")
    public ResponseEntity<byte[]> exportReconciliation() throws IOException {
        byte[] bytes = reportService.exportReconciliation();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"capacity-reconciliation.xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(bytes.length)
                .body(bytes);
    }
}
