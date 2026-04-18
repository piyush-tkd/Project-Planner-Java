package com.portfolioplanner.service;

import com.portfolioplanner.domain.repository.ProjectActualRepository;
import com.portfolioplanner.dto.response.ProjectActualResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectActualService {

    private final ProjectActualRepository projectActualRepository;

    public List<ProjectActualResponse> getAll() {
        return projectActualRepository.findAll().stream()
                .map(a -> new ProjectActualResponse(
                        a.getId(),
                        a.getProject().getId(),
                        a.getProject().getName(),
                        a.getMonthKey(),
                        a.getActualHours()))
                .sorted(Comparator
                        .comparing(ProjectActualResponse::projectName)
                        .thenComparing(ProjectActualResponse::monthKey))
                .toList();
    }

    public List<ProjectActualResponse> getByProject(Long projectId) {
        return projectActualRepository.findByProjectId(projectId).stream()
                .map(a -> new ProjectActualResponse(
                        a.getId(),
                        a.getProject().getId(),
                        a.getProject().getName(),
                        a.getMonthKey(),
                        a.getActualHours()))
                .sorted(Comparator.comparing(ProjectActualResponse::monthKey))
                .toList();
    }
}
