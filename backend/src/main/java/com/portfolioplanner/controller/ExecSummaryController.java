package com.portfolioplanner.controller;

import com.portfolioplanner.service.ExecSummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.Map;

@RestController
@RequestMapping("/api/reports/exec-dashboard")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ExecSummaryController {

    private final ExecSummaryService execSummaryService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getExecDashboard() {
        return ResponseEntity.ok(execSummaryService.getExecDashboard());
    }
}
