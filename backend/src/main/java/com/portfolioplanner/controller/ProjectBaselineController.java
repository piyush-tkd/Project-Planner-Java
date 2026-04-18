package com.portfolioplanner.controller;

import com.portfolioplanner.dto.ProjectBaselineDto;
import com.portfolioplanner.service.ProjectBaselineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

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
@PreAuthorize("isAuthenticated()")
public class ProjectBaselineController {

    private final ProjectBaselineService service;

    @GetMapping
    public List<ProjectBaselineDto> list(@PathVariable Long projectId) {
        return service.list(projectId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectBaselineDto snap(
            @PathVariable Long projectId,
            @RequestBody ProjectBaselineDto.SnapRequest req,
            Authentication auth) {
        String username = auth != null ? auth.getName() : "anonymous";
        return service.snap(projectId, req.getLabel(), username);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long projectId, @PathVariable Long id) {
        if (!service.delete(projectId, id).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
    }
}
