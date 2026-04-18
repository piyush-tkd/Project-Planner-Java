package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.AllocationType;
import com.portfolioplanner.domain.model.ResourceAllocation;
import com.portfolioplanner.domain.model.TeamType;
import com.portfolioplanner.domain.repository.AllocationTypeRepository;
import com.portfolioplanner.domain.repository.ResourceAllocationRepository;
import com.portfolioplanner.domain.repository.TeamTypeRepository;
import com.portfolioplanner.exception.AllocationCapExceededException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Business logic for resource allocation management.
 *
 * <p>The controller {@code ResourceAllocationController} delegates everything here — it is
 * responsible only for routing, @PreAuthorize checks, and HTTP status selection.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResourceAllocationService {

    private final ResourceAllocationRepository allocationRepo;
    private final AllocationTypeRepository allocationTypeRepo;
    private final TeamTypeRepository teamTypeRepo;

    // ── Queries ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ResourceAllocation> getByResource(Long resourceId) {
        return allocationRepo.findByResourceId(resourceId);
    }

    @Transactional(readOnly = true)
    public List<ResourceAllocation> getActiveByResource(Long resourceId) {
        return allocationRepo.findActiveByResourceId(resourceId);
    }

    @Transactional(readOnly = true)
    public List<ResourceAllocation> getByTeam(Long teamId) {
        return allocationRepo.findByTeamId(teamId);
    }

    @Transactional(readOnly = true)
    public List<ResourceAllocation> getActiveByTeam(Long teamId) {
        return allocationRepo.findActiveByTeamId(teamId);
    }

    /**
     * Returns the total active allocation percentage for a resource, plus the available headroom.
     * Keys: {@code totalPercentage}, {@code available}.
     */
    @Transactional(readOnly = true)
    public Map<String, Integer> getTotalAllocation(Long resourceId) {
        int total = allocationRepo.calculateTotalAllocationForResource(resourceId);
        return Map.of("totalPercentage", total, "available", 100 - total);
    }

    @Transactional(readOnly = true)
    public List<AllocationType> getAllocationTypes() {
        return allocationTypeRepo.findAll();
    }

    @Transactional(readOnly = true)
    public List<TeamType> getTeamTypes() {
        return teamTypeRepo.findAll();
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * Creates a new allocation.
     * Defaults {@code startDate} to today if absent.
     *
     * @throws AllocationCapExceededException if the new percentage would push the resource over 100%
     */
    @Transactional
    public ResourceAllocation create(ResourceAllocation allocation) {
        allocation.setId(null);
        if (allocation.getStartDate() == null) allocation.setStartDate(LocalDate.now());

        int current = allocationRepo.calculateTotalAllocation(allocation.getResourceId(), -1L);
        if (current + allocation.getPercentage() > 100) {
            throw new AllocationCapExceededException(current, allocation.getPercentage());
        }

        ResourceAllocation saved = allocationRepo.save(allocation);
        log.debug("ResourceAllocationService: created allocation id={} for resource {}",
                saved.getId(), saved.getResourceId());
        return saved;
    }

    /**
     * Updates an existing allocation.
     * Returns empty if the allocation does not exist (controller maps to 404).
     *
     * @throws AllocationCapExceededException if the updated percentage would push the resource over 100%
     */
    @Transactional
    public Optional<ResourceAllocation> update(Long id, ResourceAllocation updated) {
        return allocationRepo.findById(id).map(existing -> {
            int current = allocationRepo.calculateTotalAllocation(existing.getResourceId(), id);
            if (current + updated.getPercentage() > 100) {
                throw new AllocationCapExceededException(current, updated.getPercentage());
            }
            existing.setPercentage(updated.getPercentage());
            existing.setEndDate(updated.getEndDate());
            existing.setAllocationTypeId(updated.getAllocationTypeId());
            existing.setIsPrimary(updated.getIsPrimary());
            existing.setNotes(updated.getNotes());
            return allocationRepo.save(existing);
        });
    }

    /**
     * Deletes an allocation by id.
     *
     * @return {@code false} if the allocation did not exist (controller maps to 404)
     */
    @Transactional
    public boolean delete(Long id) {
        if (!allocationRepo.existsById(id)) return false;
        allocationRepo.deleteById(id);
        return true;
    }
}
