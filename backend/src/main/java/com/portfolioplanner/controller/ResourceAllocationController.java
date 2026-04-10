package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AllocationType;
import com.portfolioplanner.domain.model.ResourceAllocation;
import com.portfolioplanner.domain.model.TeamType;
import com.portfolioplanner.domain.repository.AllocationTypeRepository;
import com.portfolioplanner.domain.repository.ResourceAllocationRepository;
import com.portfolioplanner.domain.repository.TeamTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/allocations")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ResourceAllocationController {

    private final ResourceAllocationRepository allocationRepo;
    private final AllocationTypeRepository allocationTypeRepo;
    private final TeamTypeRepository teamTypeRepo;

    /** GET /api/allocations/resource/{resourceId} — all allocations for a resource */
    @GetMapping("/resource/{resourceId}")
    public List<ResourceAllocation> getByResource(@PathVariable Long resourceId) {
        return allocationRepo.findByResourceId(resourceId);
    }

    /** GET /api/allocations/resource/{resourceId}/active — active allocations only */
    @GetMapping("/resource/{resourceId}/active")
    public List<ResourceAllocation> getActiveByResource(@PathVariable Long resourceId) {
        return allocationRepo.findActiveByResourceId(resourceId);
    }

    /** GET /api/allocations/team/{teamId} — all allocations for a team */
    @GetMapping("/team/{teamId}")
    public List<ResourceAllocation> getByTeam(@PathVariable Long teamId) {
        return allocationRepo.findByTeamId(teamId);
    }

    /** GET /api/allocations/team/{teamId}/active */
    @GetMapping("/team/{teamId}/active")
    public List<ResourceAllocation> getActiveByTeam(@PathVariable Long teamId) {
        return allocationRepo.findActiveByTeamId(teamId);
    }

    /** GET /api/allocations/resource/{resourceId}/total — total allocated % */
    @GetMapping("/resource/{resourceId}/total")
    public ResponseEntity<Map<String, Integer>> getTotalAllocation(@PathVariable Long resourceId) {
        int total = allocationRepo.calculateTotalAllocationForResource(resourceId);
        return ResponseEntity.ok(Map.of("totalPercentage", total, "available", 100 - total));
    }

    /** POST /api/allocations — create new allocation with validation */
    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody ResourceAllocation allocation) {
        allocation.setId(null);
        if (allocation.getStartDate() == null) allocation.setStartDate(LocalDate.now());
        
        // Check total allocation won't exceed 100%
        int currentTotal = allocationRepo.calculateTotalAllocation(allocation.getResourceId(), -1L);
        if (currentTotal + allocation.getPercentage() > 100) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Total allocation would exceed 100%",
                "current", currentTotal,
                "requested", allocation.getPercentage(),
                "available", 100 - currentTotal
            ));
        }
        return ResponseEntity.ok(allocationRepo.save(allocation));
    }

    /** PUT /api/allocations/{id} — update allocation */
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @Valid @RequestBody ResourceAllocation updated) {
        return allocationRepo.findById(id).map(existing -> {
            int currentTotal = allocationRepo.calculateTotalAllocation(existing.getResourceId(), id);
            if (currentTotal + updated.getPercentage() > 100) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Total allocation would exceed 100%",
                    "current", currentTotal,
                    "requested", updated.getPercentage(),
                    "available", 100 - currentTotal
                ));
            }
            existing.setPercentage(updated.getPercentage());
            existing.setEndDate(updated.getEndDate());
            existing.setAllocationTypeId(updated.getAllocationTypeId());
            existing.setIsPrimary(updated.getIsPrimary());
            existing.setNotes(updated.getNotes());
            return ResponseEntity.ok(allocationRepo.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** DELETE /api/allocations/{id} */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!allocationRepo.existsById(id)) return ResponseEntity.notFound().build();
        allocationRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /** GET /api/allocations/types — list allocation types */
    @GetMapping("/types")
    public List<AllocationType> getAllocationTypes() {
        return allocationTypeRepo.findAll();
    }

    /** GET /api/allocations/team-types — list team types */
    @GetMapping("/team-types")
    public List<TeamType> getTeamTypes() {
        return teamTypeRepo.findAll();
    }
}
