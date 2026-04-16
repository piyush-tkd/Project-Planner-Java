package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.domain.model.enums.SourceType;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.dto.request.ProjectRequest;
import com.portfolioplanner.dto.response.ProjectResponse;
import com.portfolioplanner.exception.ResourceNotFoundException;
import com.portfolioplanner.mapper.EntityMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ProjectService — unit tests")
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private EntityMapper mapper;

    @InjectMocks
    private ProjectService projectService;

    // ── helpers ──────────────────────────────────────────────────────────────

    /** Build a minimal but valid ProjectResponse stub. */
    private static ProjectResponse stubResponse(Long id, String name) {
        return new ProjectResponse(
                id, name, Priority.HIGH, "Alice",
                1, 6, 6, "Flat", "Notes", "ACTIVE",
                null, null, null, null, null, null,
                null, null, null, null,
                false, null, false, null, null
        );
    }

    // ── CREATE ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create()")
    class CreateProject {

        @Test
        @DisplayName("calls repository.save() and returns mapped response")
        void createProjectSuccess() {
            var request = new ProjectRequest(
                    "Test Project", Priority.HIGH, "Alice",
                    1, 6, 6, "Flat", "Notes",
                    "ACTIVE", null, null, null, null, null, null, null, null, null
            );

            var project = new Project();
            project.setId(1L);
            project.setName("Test Project");

            var response = stubResponse(1L, "Test Project");

            when(mapper.toEntity(request)).thenReturn(project);
            when(projectRepository.save(project)).thenReturn(project);
            when(mapper.toProjectResponse(project)).thenReturn(response);

            ProjectResponse result = projectService.create(request);

            assertThat(result.id()).isEqualTo(1L);
            assertThat(result.name()).isEqualTo("Test Project");
            verify(projectRepository, times(1)).save(project);
            verify(mapper, times(1)).toEntity(request);
            verify(mapper, times(1)).toProjectResponse(project);
        }
    }

    // ── DELETE ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("delete()")
    class DeleteProject {

        @Test
        @DisplayName("calls repository.deleteById() when project exists")
        void deleteProjectSuccess() {
            Long projectId = 1L;
            var project = new Project();
            project.setId(projectId);

            when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));

            projectService.delete(projectId);

            verify(projectRepository, times(1)).deleteById(projectId);
        }

        @Test
        @DisplayName("throws ResourceNotFoundException when project does not exist")
        void deleteProjectNotFound() {
            Long projectId = 999L;
            when(projectRepository.findById(projectId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> projectService.delete(projectId))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Project");

            verify(projectRepository, never()).deleteById(anyLong());
        }
    }

    // ── GET BY ID ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getById()")
    class GetProject {

        @Test
        @DisplayName("returns project response when project exists")
        void getByIdSuccess() {
            Long projectId = 1L;
            var project = new Project();
            project.setId(projectId);
            project.setName("Test Project");

            var response = stubResponse(projectId, "Test Project");

            when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
            when(mapper.toProjectResponse(project)).thenReturn(response);

            ProjectResponse result = projectService.getById(projectId);

            assertThat(result.id()).isEqualTo(projectId);
            assertThat(result.name()).isEqualTo("Test Project");
            verify(projectRepository, times(1)).findById(projectId);
            verify(mapper, times(1)).toProjectResponse(project);
        }

        @Test
        @DisplayName("throws ResourceNotFoundException when project does not exist")
        void getByIdNotFound() {
            Long projectId = 999L;
            when(projectRepository.findById(projectId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> projectService.getById(projectId))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Project");

            verify(projectRepository, times(1)).findById(projectId);
        }
    }
}
