package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.ResourceAvailability;
import com.portfolioplanner.domain.repository.ResourceAvailabilityRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import com.portfolioplanner.dto.request.ResourceAvailabilityRequest;
import com.portfolioplanner.dto.response.AvailabilityResponse;
import com.portfolioplanner.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.portfolioplanner.domain.model.ResourcePodAssignment;
import com.portfolioplanner.domain.repository.ResourcePodAssignmentRepository;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AvailabilityService {

    private final ResourceAvailabilityRepository availabilityRepository;
    private final ResourceRepository resourceRepository;
    private final ResourcePodAssignmentRepository podAssignmentRepository;

    public List<AvailabilityResponse> getAllAvailability() {
        List<Resource> resources = resourceRepository.findAll();
        List<ResourceAvailability> allAvailabilities = availabilityRepository.findAll();
        List<ResourcePodAssignment> allAssignments = podAssignmentRepository.findAll();

        Map<Long, BigDecimal> fteByResource = new HashMap<>();
        for (ResourcePodAssignment a : allAssignments) {
            fteByResource.put(a.getResource().getId(), a.getCapacityFte());
        }

        Map<Long, Map<Integer, BigDecimal>> byResource = new HashMap<>();
        for (ResourceAvailability a : allAvailabilities) {
            byResource.computeIfAbsent(a.getResource().getId(), k -> new HashMap<>())
                    .put(a.getMonthIndex(), a.getHours());
        }

        return resources.stream()
                .map(r -> new AvailabilityResponse(r.getId(), r.getName(),
                        fteByResource.getOrDefault(r.getId(), BigDecimal.ONE),
                        byResource.getOrDefault(r.getId(), new HashMap<>())))
                .toList();
    }

    public AvailabilityResponse getAvailability(Long resourceId) {
        Resource resource = resourceRepository.findById(resourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource", resourceId));

        BigDecimal fte = podAssignmentRepository.findByResourceId(resourceId)
                .map(ResourcePodAssignment::getCapacityFte)
                .orElse(BigDecimal.ONE);

        List<ResourceAvailability> availabilities = availabilityRepository.findByResourceId(resourceId);
        Map<Integer, BigDecimal> months = new HashMap<>();
        for (ResourceAvailability a : availabilities) {
            months.put(a.getMonthIndex(), a.getHours());
        }

        return new AvailabilityResponse(resource.getId(), resource.getName(), fte, months);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public AvailabilityResponse setAvailability(Long resourceId, List<ResourceAvailabilityRequest> requests) {
        Resource resource = resourceRepository.findById(resourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource", resourceId));

        List<ResourceAvailability> existing = availabilityRepository.findByResourceId(resourceId);
        Map<Integer, ResourceAvailability> existingMap = new HashMap<>();
        for (ResourceAvailability a : existing) {
            existingMap.put(a.getMonthIndex(), a);
        }

        Map<Integer, BigDecimal> resultMonths = new HashMap<>();
        for (ResourceAvailabilityRequest req : requests) {
            ResourceAvailability availability = existingMap.getOrDefault(req.monthIndex(), new ResourceAvailability());
            availability.setResource(resource);
            availability.setMonthIndex(req.monthIndex());
            availability.setHours(req.hours());
            availabilityRepository.save(availability);
            resultMonths.put(req.monthIndex(), req.hours());
        }

        BigDecimal fte = podAssignmentRepository.findByResourceId(resourceId)
                .map(ResourcePodAssignment::getCapacityFte)
                .orElse(BigDecimal.ONE);

        return new AvailabilityResponse(resource.getId(), resource.getName(), fte, resultMonths);
    }
}
