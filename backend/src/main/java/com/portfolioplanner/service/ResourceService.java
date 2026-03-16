package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.ResourcePodAssignment;
import com.portfolioplanner.domain.repository.PodRepository;
import com.portfolioplanner.domain.repository.ResourcePodAssignmentRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import com.portfolioplanner.dto.request.ResourcePodAssignmentRequest;
import com.portfolioplanner.dto.request.ResourceRequest;
import com.portfolioplanner.dto.response.ResourceResponse;
import com.portfolioplanner.exception.ResourceNotFoundException;
import com.portfolioplanner.mapper.EntityMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ResourceService {

    private final ResourceRepository resourceRepository;
    private final ResourcePodAssignmentRepository assignmentRepository;
    private final PodRepository podRepository;
    private final EntityMapper mapper;

    public List<ResourceResponse> getAll() {
        List<Resource> resources = resourceRepository.findAll();
        return resources.stream().map(r -> {
            ResourcePodAssignment assignment = assignmentRepository.findByResourceId(r.getId()).orElse(null);
            return mapper.toResourceResponse(r, assignment);
        }).toList();
    }

    public ResourceResponse getById(Long id) {
        Resource resource = resourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource", id));
        ResourcePodAssignment assignment = assignmentRepository.findByResourceId(id).orElse(null);
        return mapper.toResourceResponse(resource, assignment);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public ResourceResponse create(ResourceRequest request) {
        Resource resource = mapper.toEntity(request);
        if (resource.getActive() == null) resource.setActive(true);
        if (resource.getCountsInCapacity() == null) resource.setCountsInCapacity(true);
        resource = resourceRepository.save(resource);
        return mapper.toResourceResponse(resource, null);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public ResourceResponse update(Long id, ResourceRequest request) {
        Resource resource = resourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource", id));
        mapper.updateEntity(request, resource);
        resource = resourceRepository.save(resource);
        ResourcePodAssignment assignment = assignmentRepository.findByResourceId(id).orElse(null);
        return mapper.toResourceResponse(resource, assignment);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public void delete(Long id) {
        if (!resourceRepository.existsById(id)) {
            throw new ResourceNotFoundException("Resource", id);
        }
        assignmentRepository.findByResourceId(id).ifPresent(assignmentRepository::delete);
        resourceRepository.deleteById(id);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public ResourceResponse setAssignment(Long resourceId, ResourcePodAssignmentRequest request) {
        Resource resource = resourceRepository.findById(resourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource", resourceId));
        Pod pod = podRepository.findById(request.podId())
                .orElseThrow(() -> new ResourceNotFoundException("Pod", request.podId()));

        ResourcePodAssignment assignment = assignmentRepository.findByResourceId(resourceId)
                .orElse(new ResourcePodAssignment());
        assignment.setResource(resource);
        assignment.setPod(pod);
        assignment.setCapacityFte(request.capacityFte());
        assignment = assignmentRepository.save(assignment);

        return mapper.toResourceResponse(resource, assignment);
    }

    public ResourceResponse.PodAssignment getAssignment(Long resourceId) {
        if (!resourceRepository.existsById(resourceId)) {
            throw new ResourceNotFoundException("Resource", resourceId);
        }
        return assignmentRepository.findByResourceId(resourceId)
                .map(a -> new ResourceResponse.PodAssignment(
                        a.getPod().getId(),
                        a.getPod().getName(),
                        a.getCapacityFte()))
                .orElse(null);
    }
}
