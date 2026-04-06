package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.repository.PodRepository;
import com.portfolioplanner.domain.repository.ResourcePodAssignmentRepository;
import com.portfolioplanner.dto.response.PodResponse;
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
public class PodService {

    private final PodRepository podRepository;
    private final ResourcePodAssignmentRepository assignmentRepository;
    private final EntityMapper mapper;

    public List<PodResponse> getAll() {
        return mapper.toPodResponseList(podRepository.findByActiveTrueOrderByDisplayOrderAsc());
    }

    public PodResponse getById(Long id) {
        Pod pod = podRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pod", id));
        return mapper.toPodResponse(pod);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public PodResponse create(Pod pod) {
        if (pod.getActive() == null) pod.setActive(true);
        // Ensure display_order is never null — append after existing pods
        if (pod.getDisplayOrder() == null) {
            pod.setDisplayOrder(podRepository.findMaxDisplayOrder() + 1);
        }
        pod = podRepository.save(pod);
        return mapper.toPodResponse(pod);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public PodResponse update(Long id, Pod updated) {
        Pod pod = podRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pod", id));
        if (updated.getName() != null) pod.setName(updated.getName());
        if (updated.getComplexityMultiplier() != null) pod.setComplexityMultiplier(updated.getComplexityMultiplier());
        if (updated.getDisplayOrder() != null) pod.setDisplayOrder(updated.getDisplayOrder());
        if (updated.getActive() != null) pod.setActive(updated.getActive());
        pod = podRepository.save(pod);
        return mapper.toPodResponse(pod);
    }

    public int getResourceCount(Long podId) {
        return assignmentRepository.findByPodId(podId).size();
    }
}
