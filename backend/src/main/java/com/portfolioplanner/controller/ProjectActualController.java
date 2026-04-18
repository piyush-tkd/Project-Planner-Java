package com.portfolioplanner.controller;

import com.portfolioplanner.dto.response.ProjectActualResponse;
import com.portfolioplanner.service.ProjectActualService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/actuals")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ProjectActualController {

    private final ProjectActualService service;

    @GetMapping
    public List<ProjectActualResponse> getAll() {
        return service.getAll();
    }

    @GetMapping("/by-project/{projectId}")
    public List<ProjectActualResponse> getByProject(@PathVariable Long projectId) {
        return service.getByProject(projectId);
    }
}
