package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AllocationType;
import com.portfolioplanner.domain.model.ResourceAllocation;
import com.portfolioplanner.domain.model.TeamType;
import com.portfolioplanner.exception.AllocationCapExceededException;
import com.portfolioplanner.service.ResourceAllocationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Thin routing layer for resource allocations.
 * All business logic lives in {@link ResourceAllocationService}.
 */
@RestController
@RequestMapping("/api/allocations")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@PreAuthorize("isAuthenticated()")
public class ResourceAllocationController {

    private final ResourceAllocationService allocationService;

    @GetMapping("/resource/{resourceId}")
    public List<ResourceAllocation> getByResource(@PathVariable Long resourceId) {
        return allocationService.getByResource(resourceId);
    }

    @GetMapping("/resource/{resourceId}/active")
    public List<ResourceAllocation> getActiveByResource(@PathVariable Long resourceId) {
        return allocationService.getActiveByResource(resourceId);
    }

    @GetMapping("/team/{teamId}")
    public List<ResourceAllocation> getByTeam(@PathVariable Long teamId) {
        return allocationService.getByTeam(teamId);
    }

    @GetMapping("/team/{teamId}/active")
    public List<ResourceAllocation> getActiveByTeam(@PathVariable Long teamId) {
        return allocationService.getActiveByTeam(teamId);
    }

    @GetMapping("/resource/{resourceId}/total")
    public ResponseEntity<Map<String, Integer>> getTotalAllocation(@PathVariable Long resourceId) {
        return ResponseEntity.ok(allocationService.getTotalAllocation(resourceId));
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody ResourceAllocation allocation) {
        try {
            return ResponseEntity.ok(allocationService.create(allocation));
        } catch (AllocationCapExceededException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                "error",     ex.getMessage(),
                "current",   ex.getCurrent(),
                "requested", ex.getRequested(),
                "available", ex.getAvailable()
            ));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @Valid @RequestBody ResourceAllocation updated) {
        try {
            return allocationService.update(id, updated)
                    .map(ResponseEntity::ok)
                    .<ResponseEntity<?>>map(r -> r)
                    .orElse(ResponseEntity.notFound().build());
        } catch (AllocationCapExceededException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                "error",     ex.getMessage(),
                "current",   ex.getCurrent(),
                "requested", ex.getRequested(),
                "available", ex.getAvailable()
            ));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return allocationService.delete(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    @GetMapping("/types")
    public List<AllocationType> getAllocationTypes() {
        return allocationService.getAllocationTypes();
    }

    @GetMapping("/team-types")
    public List<TeamType> getTeamTypes() {
        return allocationService.getTeamTypes();
    }
}
