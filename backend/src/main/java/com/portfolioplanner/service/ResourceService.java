package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.ResourcePodAssignment;
import com.portfolioplanner.domain.repository.PodRepository;
import java.math.BigDecimal;
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
    private final AuditLogService auditLogService;

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
        auditLogService.log("Resource", resource.getId(), resource.getName(), "CREATE",
                resourceSnapshot(resource));
        return mapper.toResourceResponse(resource, null);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public ResourceResponse update(Long id, ResourceRequest request) {
        Resource resource = resourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource", id));
        String beforeSnap = resourceSnapshot(resource);
        mapper.updateEntity(request, resource);
        resource = resourceRepository.save(resource);
        String afterSnap  = resourceSnapshot(resource);
        auditLogService.log("Resource", resource.getId(), resource.getName(), "UPDATE",
                snapshotDiff(beforeSnap, afterSnap));
        ResourcePodAssignment assignment = assignmentRepository.findByResourceId(id).orElse(null);
        return mapper.toResourceResponse(resource, assignment);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public void delete(Long id) {
        Resource resource = resourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource", id));
        String name = resource.getName();
        String snapshot = resourceSnapshot(resource);
        assignmentRepository.findByResourceId(id).ifPresent(assignmentRepository::delete);
        resourceRepository.deleteById(id);
        auditLogService.log("Resource", id, name, "DELETE", snapshot);
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

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public ResourceResponse updateActualRate(Long id, BigDecimal rate) {
        Resource resource = resourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource", id));
        BigDecimal oldRate = resource.getActualRate();
        resource.setActualRate(rate);
        resource = resourceRepository.save(resource);
        String details = "rate: " + (oldRate != null ? oldRate : "—") + " → " + (rate != null ? rate : "—");
        auditLogService.log("Resource", resource.getId(), resource.getName(), "UPDATE_RATE", details);
        ResourcePodAssignment assignment = assignmentRepository.findByResourceId(id).orElse(null);
        return mapper.toResourceResponse(resource, assignment);
    }

    // ── Audit helpers ──────────────────────────────────────────────────────────

    private String resourceSnapshot(Resource r) {
        StringBuilder sb = new StringBuilder();
        sb.append("role=").append(r.getRole());
        sb.append(", location=").append(r.getLocation());
        sb.append(", active=").append(r.getActive());
        sb.append(", countsInCapacity=").append(r.getCountsInCapacity());
        if (r.getActualRate() != null) sb.append(", rate=").append(r.getActualRate());
        return sb.toString();
    }

    private String snapshotDiff(String before, String after) {
        try {
            java.util.Map<String, String> bMap = parseSnap(before);
            java.util.Map<String, String> aMap = parseSnap(after);
            java.util.List<String> diffs = new java.util.ArrayList<>();
            java.util.Set<String> keys = new java.util.LinkedHashSet<>();
            keys.addAll(bMap.keySet());
            keys.addAll(aMap.keySet());
            for (String key : keys) {
                String bv = bMap.getOrDefault(key, "—");
                String av = aMap.getOrDefault(key, "—");
                if (!bv.equals(av)) diffs.add(key + ": " + bv + " → " + av);
            }
            return diffs.isEmpty() ? "no changes" : String.join(", ", diffs);
        } catch (Exception e) {
            return after;
        }
    }

    private java.util.Map<String, String> parseSnap(String snap) {
        java.util.Map<String, String> map = new java.util.LinkedHashMap<>();
        if (snap == null || snap.isBlank()) return map;
        for (String pair : snap.split(",\\s*")) {
            int eq = pair.indexOf('=');
            if (eq > 0) map.put(pair.substring(0, eq).trim(), pair.substring(eq + 1).trim());
        }
        return map;
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
