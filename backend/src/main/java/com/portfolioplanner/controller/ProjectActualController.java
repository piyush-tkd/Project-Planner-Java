package com.portfolioplanner.controller;

import com.portfolioplanner.domain.repository.ProjectActualRepository;
import com.portfolioplanner.dto.response.ProjectActualResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/actuals")
@RequiredArgsConstructor
public class ProjectActualController {

    private final ProjectActualRepository projectActualRepository;

    /** Returns all actuals across all projects, ordered by project then month. */
    @GetMapping
    public List<ProjectActualResponse> getAll() {
        return projectActualRepository.findAll().stream()
                .map(a -> new ProjectActualResponse(
                        a.getId(),
                        a.getProject().getId(),
                        a.getProject().getName(),
                        a.getMonthKey(),
                        a.getActualHours()))
                .sorted(java.util.Comparator
                        .comparing(ProjectActualResponse::projectName)
                        .thenComparing(ProjectActualResponse::monthKey))
                .toList();
    }

    /** Returns actuals for a single project. */
    @GetMapping("/by-project/{projectId}")
    public List<ProjectActualResponse> getByProject(@PathVariable Long projectId) {
        return projectActualRepository.findByProjectId(projectId).stream()
                .map(a -> new ProjectActualResponse(
                        a.getId(),
                        a.getProject().getId(),
                        a.getProject().getName(),
                        a.getMonthKey(),
                        a.getActualHours()))
                .sorted(java.util.Comparator.comparing(ProjectActualResponse::monthKey))
                .toList();
    }
}
