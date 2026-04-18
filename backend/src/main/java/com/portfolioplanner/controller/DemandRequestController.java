package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.DemandRequest;
import com.portfolioplanner.service.DemandRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/demands")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@PreAuthorize("isAuthenticated()")
public class DemandRequestController {

    private final DemandRequestService service;

    @GetMapping
    public List<DemandRequest> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String roleType) {
        return service.listDemands(status, roleType);
    }

    @GetMapping("/unfilled")
    public List<DemandRequest> listUnfilled(@RequestParam(required = false) String roleType) {
        return service.listUnfilled(roleType);
    }

    @GetMapping("/{id}")
    public ResponseEntity<DemandRequest> get(@PathVariable Long id) {
        return service.getDemandById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/project/{projectId}")
    public List<DemandRequest> getByProject(@PathVariable Long projectId) {
        return service.getDemandsByProject(projectId);
    }

    @PostMapping
    public DemandRequest create(@Valid @RequestBody DemandRequest demand) {
        return service.createDemand(demand);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DemandRequest> update(@PathVariable Long id, @RequestBody DemandRequest updated) {
        return service.updateDemand(id, updated).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteDemand(id);
        return ResponseEntity.noContent().build();
    }

    /** POST /api/demands/{id}/fulfill — fulfill demand by assigning a pool member */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/fulfill")
    public ResponseEntity<?> fulfill(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        Long resourceId = body.get("resourceId");
        if (resourceId == null) return ResponseEntity.badRequest().body(Map.of("error", "resourceId required"));

        try {
            Map<String, Object> result = service.fulfillDemand(id, resourceId, body.get("allocationId"));
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            if (e.getMessage().startsWith("Demand is already")) {
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
            return ResponseEntity.notFound().build();
        }
    }

    /** GET /api/demands/gap-analysis — supply minus demand by role and month */
    @GetMapping("/gap-analysis")
    public List<Map<String, Object>> gapAnalysis() {
        return service.gapAnalysis();
    }
}
