package com.portfolioplanner.controller;

import com.portfolioplanner.dto.request.PhaseScheduleRequest;
import com.portfolioplanner.dto.request.ProjectMilestonesRequest;
import com.portfolioplanner.dto.request.SchedulingRulesRequest;
import com.portfolioplanner.dto.response.PhaseScheduleResponse;
import com.portfolioplanner.dto.response.SchedulingRulesResponse;
import com.portfolioplanner.service.SchedulingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/projects/{projectId}/scheduling")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class SchedulingController {

    private final SchedulingService schedulingService;

    @GetMapping("/rules")
    public SchedulingRulesResponse getRules(@PathVariable Long projectId) {
        return schedulingService.getRules(projectId);
    }

    @PutMapping("/rules")
    public SchedulingRulesResponse updateRules(@PathVariable Long projectId,
                                                @RequestBody SchedulingRulesRequest request) {
        return schedulingService.upsertRules(projectId, request);
    }

    @GetMapping("/phases")
    public List<PhaseScheduleResponse> getPhaseSchedules(@PathVariable Long projectId) {
        return schedulingService.getPhaseSchedules(projectId);
    }

    @PutMapping("/phases")
    public List<PhaseScheduleResponse> updatePhaseSchedules(@PathVariable Long projectId,
                                                             @RequestBody List<PhaseScheduleRequest> requests) {
        return schedulingService.updatePhaseSchedules(projectId, requests);
    }

    @PutMapping("/milestones")
    public ResponseEntity<Void> updateMilestones(@PathVariable Long projectId,
                                                  @RequestBody ProjectMilestonesRequest request) {
        schedulingService.updateMilestones(projectId, request);
        return ResponseEntity.ok().build();
    }
}
