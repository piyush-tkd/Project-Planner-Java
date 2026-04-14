package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/demands")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@PreAuthorize("isAuthenticated()")
public class DemandRequestController {

    private final DemandRequestRepository demandRepo;
    private final DemandFulfillmentRepository fulfillmentRepo;
    private final ResourcePoolMemberRepository memberRepo;

    @GetMapping
    public List<DemandRequest> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String roleType) {
        if (status != null && roleType != null) return demandRepo.findByStatusAndRoleType(status, roleType);
        if (status != null)   return demandRepo.findByStatus(status);
        if (roleType != null) return demandRepo.findByRoleType(roleType);
        return demandRepo.findAll();
    }

    @GetMapping("/unfilled")
    public List<DemandRequest> listUnfilled(@RequestParam(required = false) String roleType) {
        if (roleType != null) return demandRepo.findUnfilledByRole(roleType);
        return demandRepo.findUnfilled();
    }

    @GetMapping("/{id}")
    public ResponseEntity<DemandRequest> get(@PathVariable Long id) {
        return demandRepo.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/project/{projectId}")
    public List<DemandRequest> getByProject(@PathVariable Long projectId) {
        return demandRepo.findByProjectId(projectId);
    }

    @PostMapping
    public DemandRequest create(@Valid @RequestBody DemandRequest demand) {
        demand.setId(null);
        demand.setStatus("Open");
        return demandRepo.save(demand);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DemandRequest> update(@PathVariable Long id, @RequestBody DemandRequest updated) {
        return demandRepo.findById(id).map(d -> {
            d.setRoleType(updated.getRoleType());
            d.setSeniorityLevel(updated.getSeniorityLevel());
            d.setHeadcountNeeded(updated.getHeadcountNeeded());
            d.setStartDate(updated.getStartDate());
            d.setEndDate(updated.getEndDate());
            d.setPriority(updated.getPriority());
            d.setStatus(updated.getStatus());
            d.setJustification(updated.getJustification());
            return ResponseEntity.ok(demandRepo.save(d));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        demandRepo.findById(id).ifPresent(d -> { d.setStatus("Cancelled"); demandRepo.save(d); });
        return ResponseEntity.noContent().build();
    }

    /** POST /api/demands/{id}/fulfill — fulfill demand by assigning a pool member */
    @PostMapping("/{id}/fulfill")
    public ResponseEntity<?> fulfill(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        Long resourceId = body.get("resourceId");
        if (resourceId == null) return ResponseEntity.badRequest().body(Map.of("error", "resourceId required"));

        return demandRepo.findById(id).map(demand -> {
            if ("Filled".equals(demand.getStatus()) || "Cancelled".equals(demand.getStatus())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Demand is already " + demand.getStatus()));
            }

            DemandFulfillment fulfillment = DemandFulfillment.builder()
                .demandRequestId(id)
                .resourceId(resourceId)
                .allocationId(body.get("allocationId"))
                .fulfilledAt(LocalDateTime.now())
                .build();
            fulfillmentRepo.save(fulfillment);

            // Count fulfillments vs. needed
            long filled = fulfillmentRepo.findByDemandRequestId(id).size();
            demand.setStatus(filled >= demand.getHeadcountNeeded() ? "Filled" : "Partially Filled");
            demandRepo.save(demand);

            // Mark pool member as unavailable
            memberRepo.findByResourceId(resourceId).forEach(m -> {
                m.setIsAvailable(false);
                memberRepo.save(m);
            });

            return ResponseEntity.ok(Map.of("status", demand.getStatus(), "fulfillmentsCount", filled));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** GET /api/demands/gap-analysis — supply minus demand by role and month */
    @GetMapping("/gap-analysis")
    public List<Map<String, Object>> gapAnalysis() {
        List<DemandRequest> unfilled = demandRepo.findUnfilled();
        List<ResourcePoolMember> available = memberRepo.findAllAvailable();

        Map<String, Long> demandByRole  = new LinkedHashMap<>();
        Map<String, Long> supplyByRole  = new LinkedHashMap<>();

        for (DemandRequest d : unfilled) {
            demandByRole.merge(d.getRoleType(), (long) d.getHeadcountNeeded(), Long::sum);
        }
        for (ResourcePoolMember m : available) {
            // need to get pool role type — simplified: iterate pools for each member
            supplyByRole.merge("available", 1L, Long::sum);
        }

        Set<String> roles = new LinkedHashSet<>(demandByRole.keySet());
        List<Map<String, Object>> result = new ArrayList<>();
        for (String role : roles) {
            long demand = demandByRole.getOrDefault(role, 0L);
            long supply = supplyByRole.getOrDefault(role, 0L);
            result.add(Map.of(
                "roleType", role,
                "demand",   demand,
                "supply",   supply,
                "gap",      supply - demand
            ));
        }
        return result;
    }
}
