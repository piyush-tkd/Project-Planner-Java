package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Sprint;
import com.portfolioplanner.domain.repository.SprintRepository;
import com.portfolioplanner.dto.request.SprintRequest;
import com.portfolioplanner.dto.response.SprintResponse;
import com.portfolioplanner.exception.ResourceNotFoundException;
import com.portfolioplanner.mapper.EntityMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SprintService {

    private final SprintRepository sprintRepository;
    private final EntityMapper mapper;

    public List<SprintResponse> getAll() {
        return mapper.toSprintResponseList(sprintRepository.findAllByOrderByStartDateAsc());
    }

    @Transactional
    public SprintResponse create(SprintRequest request) {
        Sprint sprint = new Sprint();
        sprint.setName(request.name());
        sprint.setType(request.type() != null ? request.type() : "SPRINT");
        sprint.setStartDate(request.startDate());
        sprint.setEndDate(request.endDate());
        sprint.setRequirementsLockInDate(request.requirementsLockInDate());
        return mapper.toSprintResponse(sprintRepository.save(sprint));
    }

    @Transactional
    public SprintResponse update(Long id, SprintRequest request) {
        Sprint sprint = sprintRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sprint", id));
        sprint.setName(request.name());
        if (request.type() != null) sprint.setType(request.type());
        sprint.setStartDate(request.startDate());
        sprint.setEndDate(request.endDate());
        sprint.setRequirementsLockInDate(request.requirementsLockInDate());
        return mapper.toSprintResponse(sprintRepository.save(sprint));
    }

    @Transactional
    public void delete(Long id) {
        if (!sprintRepository.existsById(id)) throw new ResourceNotFoundException("Sprint", id);
        sprintRepository.deleteById(id);
    }
}
