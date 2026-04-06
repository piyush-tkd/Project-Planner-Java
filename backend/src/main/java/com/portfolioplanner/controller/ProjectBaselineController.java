package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.ProjectBaseline;
import com.portfolioplanner.domain.repository.ProjectBaselineRepository;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.dto.ProjectBaselineDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

/**
 * REST API for project baseline snapshots (planned-vs-actual timeline).
 *
 * GET    /api/projects/{projectId}/baselines        → list all snapshots
 * POST   /api/projects/{projectId}/baselines        → snap a new baseline
 * DELETE /api/projects/{projectId}/baselines/{id}   → delete snapshot
 */
@RestController
@RequestMapping("/api/projects/{projectId}/baselines")
@RequiredArgsConstructor
public class ProjectBaselineController {

    private final ProjectBaselineRepository baselineRepo;
    private final ProjectRepository         projectRepo;

    @GetMapping
    public List<ProjectBaselineDto> list(@PathVariable Long projectId) {
        return baselineRepo.findByProjectIdOrderBySnappedAtDesc(projectId)
                .stream().map(ProjectBaselineDto::from).collect(Collectors.toList());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectBaselineDto snap(
            @PathVariable Long projectId,
            @RequestBody ProjectBaselineDto.SnapRequest req,
            Authentication auth) {

        Project p = projectRepo.findById(projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));

        ProjectBaseline b = new ProjectBaseline();
        b.setProjectId(projectId);
        b.setLabel(req.getLabel() != null && !req.getLabel().isBlank()
                ? req.getLabel() : "Baseline " + java.time.LocalDate.now());
        b.setSnappedBy(auth != null ? auth.getName() : "anonymous");
        b.setPlannedStart(p.getStartDate());
        b.setPlannedTarget(p.getTargetDate());
        // plannedHours — project may have a totalHours field; use null if not available
        b.setPlannedHours(null);
        return ProjectBaselineDto.from(baselineRepo.save(b));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long projectId, @PathVariable Long id) {
        baselineRepo.findById(id).ifPresent(b -> {
            if (!b.getProjectId().equals(projectId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
            }
            baselineRepo.delete(b);
        });
    }
}
