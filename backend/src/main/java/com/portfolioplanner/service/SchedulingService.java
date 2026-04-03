package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.ProjectPodPlanning;
import com.portfolioplanner.domain.model.SchedulingRules;
import com.portfolioplanner.domain.repository.ProjectPodPlanningRepository;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.domain.repository.SchedulingRulesRepository;
import com.portfolioplanner.dto.request.PhaseScheduleRequest;
import com.portfolioplanner.dto.request.ProjectMilestonesRequest;
import com.portfolioplanner.dto.request.SchedulingRulesRequest;
import com.portfolioplanner.dto.response.PhaseScheduleResponse;
import com.portfolioplanner.dto.response.SchedulingRulesResponse;
import com.portfolioplanner.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SchedulingService {

    private final ProjectRepository projectRepository;
    private final ProjectPodPlanningRepository planningRepository;
    private final SchedulingRulesRepository rulesRepository;

    // ── Scheduling Rules ──────────────────────────────────────────────────────

    public SchedulingRulesResponse getRules(Long projectId) {
        SchedulingRules rules = rulesRepository.findByProjectId(projectId)
                .orElse(defaultRules(projectId));
        return toResponse(rules);
    }

    @Transactional
    public SchedulingRulesResponse upsertRules(Long projectId, SchedulingRulesRequest request) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));

        SchedulingRules rules = rulesRepository.findByProjectId(projectId)
                .orElseGet(() -> {
                    SchedulingRules r = new SchedulingRules();
                    r.setProject(project);
                    return r;
                });

        if (request.qaLagDays() != null) rules.setQaLagDays(request.qaLagDays());
        if (request.uatGapDays() != null) rules.setUatGapDays(request.uatGapDays());
        if (request.uatDurationDays() != null) rules.setUatDurationDays(request.uatDurationDays());
        if (request.e2eGapDays() != null) rules.setE2eGapDays(request.e2eGapDays());
        if (request.e2eDurationDays() != null) rules.setE2eDurationDays(request.e2eDurationDays());
        if (request.devParallelPct() != null) rules.setDevParallelPct(request.devParallelPct());
        if (request.qaParallelPct() != null) rules.setQaParallelPct(request.qaParallelPct());
        if (request.uatParallelPct() != null) rules.setUatParallelPct(request.uatParallelPct());

        rules = rulesRepository.save(rules);
        return toResponse(rules);
    }

    // ── Phase Schedules ───────────────────────────────────────────────────────

    public List<PhaseScheduleResponse> getPhaseSchedules(Long projectId) {
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project", projectId);
        }
        List<ProjectPodPlanning> plannings = planningRepository.findByProjectId(projectId);
        return plannings.stream().map(this::toPhaseResponse).toList();
    }

    @Transactional
    public List<PhaseScheduleResponse> updatePhaseSchedules(Long projectId, List<PhaseScheduleRequest> requests) {
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project", projectId);
        }

        for (PhaseScheduleRequest req : requests) {
            ProjectPodPlanning planning = planningRepository.findById(req.podPlanningId())
                    .orElseThrow(() -> new ResourceNotFoundException("PodPlanning", req.podPlanningId()));

            if (req.devStartDate() != null) planning.setDevStartDate(req.devStartDate());
            if (req.devEndDate() != null) planning.setDevEndDate(req.devEndDate());
            if (req.qaStartDate() != null) planning.setQaStartDate(req.qaStartDate());
            if (req.qaEndDate() != null) planning.setQaEndDate(req.qaEndDate());
            if (req.uatStartDate() != null) planning.setUatStartDate(req.uatStartDate());
            if (req.uatEndDate() != null) planning.setUatEndDate(req.uatEndDate());
            if (req.scheduleLocked() != null) planning.setScheduleLocked(req.scheduleLocked());

            planningRepository.save(planning);
        }

        return planningRepository.findByProjectId(projectId).stream()
                .map(this::toPhaseResponse).toList();
    }

    // ── Project Milestones ────────────────────────────────────────────────────

    @Transactional
    public void updateMilestones(Long projectId, ProjectMilestonesRequest request) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));

        project.setE2eStartDate(request.e2eStartDate());
        project.setE2eEndDate(request.e2eEndDate());
        project.setCodeFreezeDateMilestone(request.codeFreezeDateMilestone());
        project.setReleaseDateMilestone(request.releaseDateMilestone());

        projectRepository.save(project);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private SchedulingRules defaultRules(Long projectId) {
        SchedulingRules r = new SchedulingRules();
        r.setQaLagDays(7);
        r.setUatGapDays(1);
        r.setUatDurationDays(5);
        r.setE2eGapDays(2);
        r.setE2eDurationDays(7);
        r.setDevParallelPct(70);
        r.setQaParallelPct(50);
        r.setUatParallelPct(30);
        return r;
    }

    private SchedulingRulesResponse toResponse(SchedulingRules rules) {
        return new SchedulingRulesResponse(
                rules.getId(),
                rules.getProject() != null ? rules.getProject().getId() : null,
                rules.getQaLagDays(),
                rules.getUatGapDays(),
                rules.getUatDurationDays(),
                rules.getE2eGapDays(),
                rules.getE2eDurationDays(),
                rules.getDevParallelPct() != null ? rules.getDevParallelPct() : 70,
                rules.getQaParallelPct() != null ? rules.getQaParallelPct() : 50,
                rules.getUatParallelPct() != null ? rules.getUatParallelPct() : 30
        );
    }

    private PhaseScheduleResponse toPhaseResponse(ProjectPodPlanning planning) {
        return new PhaseScheduleResponse(
                planning.getId(),
                planning.getPod().getId(),
                planning.getPod().getName(),
                planning.getDevStartDate(),
                planning.getDevEndDate(),
                planning.getQaStartDate(),
                planning.getQaEndDate(),
                planning.getUatStartDate(),
                planning.getUatEndDate(),
                planning.getScheduleLocked()
        );
    }
}
