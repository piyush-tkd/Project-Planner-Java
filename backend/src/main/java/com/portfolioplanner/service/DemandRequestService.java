package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.DemandFulfillment;
import com.portfolioplanner.domain.model.DemandRequest;
import com.portfolioplanner.domain.repository.DemandFulfillmentRepository;
import com.portfolioplanner.domain.repository.DemandRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DemandRequestService {

    private final DemandRequestRepository demandRepo;
    private final DemandFulfillmentRepository fulfillmentRepo;

    // ── Queries ───────────────────────────────────────────────────────────────

    public List<DemandRequest> listDemands(String status, String roleType) {
        if (status != null && !status.isBlank() && roleType != null && !roleType.isBlank()) {
            return demandRepo.findByStatusAndRoleType(status, roleType);
        }
        if (status != null && !status.isBlank()) {
            return demandRepo.findByStatus(status);
        }
        if (roleType != null && !roleType.isBlank()) {
            return demandRepo.findByRoleType(roleType);
        }
        return demandRepo.findAll();
    }

    public List<DemandRequest> listUnfilled(String roleType) {
        if (roleType != null && !roleType.isBlank()) {
            return demandRepo.findUnfilledByRole(roleType);
        }
        return demandRepo.findUnfilled();
    }

    public Optional<DemandRequest> getDemandById(Long id) {
        return demandRepo.findById(id);
    }

    public List<DemandRequest> getDemandsByProject(Long projectId) {
        return demandRepo.findByProjectId(projectId);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    @Transactional
    public DemandRequest createDemand(DemandRequest demand) {
        return demandRepo.save(demand);
    }

    @Transactional
    public Optional<DemandRequest> updateDemand(Long id, DemandRequest updated) {
        return demandRepo.findById(id).map(existing -> {
            existing.setRoleType(updated.getRoleType());
            existing.setSeniorityLevel(updated.getSeniorityLevel());
            existing.setHeadcountNeeded(updated.getHeadcountNeeded());
            existing.setStartDate(updated.getStartDate());
            existing.setEndDate(updated.getEndDate());
            existing.setPriority(updated.getPriority());
            existing.setStatus(updated.getStatus());
            existing.setJustification(updated.getJustification());
            existing.setProjectId(updated.getProjectId());
            existing.setTeamId(updated.getTeamId());
            return demandRepo.save(existing);
        });
    }

    @Transactional
    public void deleteDemand(Long id) {
        demandRepo.deleteById(id);
    }

    /**
     * Fulfill a demand by assigning a resource. Marks demand as Filled and records fulfillment.
     */
    @Transactional
    public Map<String, Object> fulfillDemand(Long demandId, Long resourceId, Long allocationId) {
        DemandRequest demand = demandRepo.findById(demandId)
            .orElseThrow(() -> new RuntimeException("Demand not found: " + demandId));

        if ("Filled".equals(demand.getStatus())) {
            throw new RuntimeException("Demand is already fulfilled");
        }

        DemandFulfillment fulfillment = DemandFulfillment.builder()
            .demandRequestId(demandId)
            .resourceId(resourceId)
            .allocationId(allocationId)
            .fulfilledAt(LocalDateTime.now())
            .build();
        fulfillmentRepo.save(fulfillment);

        demand.setStatus("Filled");
        demandRepo.save(demand);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("demandId", demandId);
        result.put("resourceId", resourceId);
        result.put("status", "Filled");
        return result;
    }

    /**
     * Gap analysis: supply minus demand aggregated by role and month.
     */
    public List<Map<String, Object>> gapAnalysis() {
        List<DemandRequest> unfilled = demandRepo.findUnfilled();
        Map<String, Integer> demandByRole = new LinkedHashMap<>();
        for (DemandRequest d : unfilled) {
            demandByRole.merge(d.getRoleType(), d.getHeadcountNeeded(), Integer::sum);
        }
        return demandByRole.entrySet().stream().map(e -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("role", e.getKey());
            row.put("demand", e.getValue());
            return row;
        }).collect(Collectors.toList());
    }
}
