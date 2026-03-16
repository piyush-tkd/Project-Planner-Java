package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.TemporaryOverride;
import com.portfolioplanner.domain.repository.PodRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import com.portfolioplanner.domain.repository.TemporaryOverrideRepository;
import com.portfolioplanner.dto.request.TemporaryOverrideRequest;
import com.portfolioplanner.dto.response.TemporaryOverrideResponse;
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
public class TemporaryOverrideService {

    private final TemporaryOverrideRepository overrideRepository;
    private final ResourceRepository resourceRepository;
    private final PodRepository podRepository;
    private final EntityMapper mapper;

    public List<TemporaryOverrideResponse> getAll() {
        return mapper.toOverrideResponseList(overrideRepository.findAll());
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public TemporaryOverrideResponse create(TemporaryOverrideRequest request) {
        Resource resource = resourceRepository.findById(request.resourceId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource", request.resourceId()));
        Pod pod = podRepository.findById(request.toPodId())
                .orElseThrow(() -> new ResourceNotFoundException("Pod", request.toPodId()));

        TemporaryOverride override = new TemporaryOverride();
        override.setResource(resource);
        override.setToPod(pod);
        override.setStartMonth(request.startMonth());
        override.setEndMonth(request.endMonth());
        override.setAllocationPct(request.allocationPct());
        override.setNotes(request.notes());

        override = overrideRepository.save(override);
        return mapper.toOverrideResponse(override);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public TemporaryOverrideResponse update(Long id, TemporaryOverrideRequest request) {
        TemporaryOverride override = overrideRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TemporaryOverride", id));

        Resource resource = resourceRepository.findById(request.resourceId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource", request.resourceId()));
        Pod pod = podRepository.findById(request.toPodId())
                .orElseThrow(() -> new ResourceNotFoundException("Pod", request.toPodId()));

        override.setResource(resource);
        override.setToPod(pod);
        override.setStartMonth(request.startMonth());
        override.setEndMonth(request.endMonth());
        override.setAllocationPct(request.allocationPct());
        override.setNotes(request.notes());

        override = overrideRepository.save(override);
        return mapper.toOverrideResponse(override);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public void delete(Long id) {
        if (!overrideRepository.existsById(id)) {
            throw new ResourceNotFoundException("TemporaryOverride", id);
        }
        overrideRepository.deleteById(id);
    }
}
