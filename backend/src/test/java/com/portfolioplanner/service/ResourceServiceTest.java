package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.domain.repository.ResourcePodAssignmentRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import com.portfolioplanner.service.AuditLogService;
import com.portfolioplanner.dto.request.ResourceRequest;
import com.portfolioplanner.dto.response.ResourceResponse;
import com.portfolioplanner.exception.DuplicateNameException;
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
@DisplayName("ResourceService — unit tests")
class ResourceServiceTest {

    @Mock
    private ResourceRepository resourceRepository;

    @Mock
    private ResourcePodAssignmentRepository assignmentRepository;

    @Mock
    private EntityMapper mapper;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private ResourceService resourceService;

    // ── helpers ──────────────────────────────────────────────────────────────

    private static ResourceRequest stubRequest(String name) {
        return new ResourceRequest(name, name.toLowerCase().replace(" ", ".") + "@example.com",
                Role.DEVELOPER, Location.US, true, true, null, null);
    }

    private static ResourceResponse stubResponse(Long id, String name) {
        return new ResourceResponse(id, name, name.toLowerCase().replace(" ", ".") + "@example.com",
                Role.DEVELOPER, Location.US, true, true,
                null, null, null, null, null);
    }

    // ── CREATE ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create()")
    class CreateResource {

        @Test
        @DisplayName("creates resource and calls repository.save()")
        void createResourceSuccess() {
            var request = stubRequest("John Doe");
            var resource = new Resource();
            resource.setId(1L);
            resource.setName("John Doe");
            var response = stubResponse(1L, "John Doe");

            when(resourceRepository.findByNameIgnoreCase("John Doe")).thenReturn(Optional.empty());
            when(mapper.toEntity(request)).thenReturn(resource);
            when(resourceRepository.save(resource)).thenReturn(resource);
            when(mapper.toResourceResponse(resource, null)).thenReturn(response);

            ResourceResponse result = resourceService.create(request);

            assertThat(result.id()).isEqualTo(1L);
            assertThat(result.name()).isEqualTo("John Doe");
            verify(resourceRepository, times(1)).save(resource);
        }

        @Test
        @DisplayName("throws DuplicateNameException if resource with same name exists")
        void createResourceDuplicate() {
            var request = stubRequest("John Doe");
            var existingResource = new Resource();
            existingResource.setName("John Doe");

            when(resourceRepository.findByNameIgnoreCase("John Doe")).thenReturn(Optional.of(existingResource));

            assertThatThrownBy(() -> resourceService.create(request))
                    .isInstanceOf(DuplicateNameException.class)
                    .hasMessageContaining("already exists");

            verify(resourceRepository, never()).save(any());
        }
    }

    // ── DELETE ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("delete()")
    class DeleteResource {

        @Test
        @DisplayName("deletes resource when it exists")
        void deleteResourceSuccess() {
            Long resourceId = 1L;
            var resource = new Resource();
            resource.setId(resourceId);

            when(resourceRepository.findById(resourceId)).thenReturn(Optional.of(resource));

            resourceService.delete(resourceId);

            verify(resourceRepository, times(1)).deleteById(resourceId);
        }

        @Test
        @DisplayName("throws ResourceNotFoundException when resource does not exist")
        void deleteResourceNotFound() {
            Long resourceId = 999L;
            when(resourceRepository.findById(resourceId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> resourceService.delete(resourceId))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Resource");

            verify(resourceRepository, never()).deleteById(anyLong());
        }
    }

    // ── GET BY ID ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getById()")
    class GetResource {

        @Test
        @DisplayName("returns resource response when resource exists")
        void getByIdSuccess() {
            Long resourceId = 1L;
            var resource = new Resource();
            resource.setId(resourceId);
            resource.setName("John Doe");
            var response = stubResponse(resourceId, "John Doe");

            when(resourceRepository.findById(resourceId)).thenReturn(Optional.of(resource));
            when(assignmentRepository.findByResourceId(resourceId)).thenReturn(Optional.empty());
            when(mapper.toResourceResponse(resource, null)).thenReturn(response);

            ResourceResponse result = resourceService.getById(resourceId);

            assertThat(result.id()).isEqualTo(resourceId);
            assertThat(result.name()).isEqualTo("John Doe");
            verify(resourceRepository, times(1)).findById(resourceId);
        }

        @Test
        @DisplayName("throws ResourceNotFoundException when resource does not exist")
        void getByIdNotFound() {
            Long resourceId = 999L;
            when(resourceRepository.findById(resourceId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> resourceService.getById(resourceId))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Resource");

            verify(resourceRepository, times(1)).findById(resourceId);
        }
    }
}
