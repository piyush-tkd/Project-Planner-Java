package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/resource-pools")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ResourcePoolController {

    private final ResourcePoolRepository poolRepo;
    private final ResourcePoolMemberRepository memberRepo;
    private final DemandRequestRepository demandRepo;
    private final DemandFulfillmentRepository fulfillmentRepo;

    // ── Pool CRUD ─────────────────────────────────────────────────────

    @GetMapping
    public List<ResourcePool> listPools(@RequestParam(required = false) String roleType) {
        if (roleType != null) return poolRepo.findByRoleType(roleType);
        return poolRepo.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResourcePool> getPool(@PathVariable Long id) {
        return poolRepo.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResourcePool createPool(@Valid @RequestBody ResourcePool pool) {
        pool.setId(null);
        return poolRepo.save(pool);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResourcePool> updatePool(@PathVariable Long id, @RequestBody ResourcePool update) {
        return poolRepo.findById(id).map(p -> {
            p.setName(update.getName());
            p.setRoleType(update.getRoleType());
            p.setSpecialization(update.getSpecialization());
            p.setTargetHeadcount(update.getTargetHeadcount());
            p.setDescription(update.getDescription());
            return ResponseEntity.ok(poolRepo.save(p));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePool(@PathVariable Long id) {
        if (!poolRepo.existsById(id)) return ResponseEntity.notFound().build();
        poolRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── Pool Members ──────────────────────────────────────────────────

    @GetMapping("/{id}/members")
    public List<ResourcePoolMember> getMembers(@PathVariable Long id) {
        return memberRepo.findByPoolId(id);
    }

    @GetMapping("/{id}/available")
    public List<ResourcePoolMember> getAvailableMembers(@PathVariable Long id) {
        return memberRepo.findByPoolIdAndIsAvailable(id, true);
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<?> addMember(@PathVariable Long id, @RequestBody ResourcePoolMember member) {
        if (!poolRepo.existsById(id)) return ResponseEntity.notFound().build();
        member.setId(null);
        member.setPoolId(id);
        // Check for duplicate
        if (memberRepo.findByPoolIdAndResourceId(id, member.getResourceId()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Resource already in this pool"));
        }
        return ResponseEntity.ok(memberRepo.save(member));
    }

    @DeleteMapping("/{id}/members/{memberId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long id, @PathVariable Long memberId) {
        return memberRepo.findById(memberId)
            .filter(m -> m.getPoolId().equals(id))
            .map(m -> { memberRepo.delete(m); return ResponseEntity.noContent().<Void>build(); })
            .orElse(ResponseEntity.notFound().build());
    }

    // ── Supply Summary ────────────────────────────────────────────────

    @GetMapping("/supply-summary")
    public List<Map<String, Object>> getSupplySummary() {
        List<ResourcePool> pools = poolRepo.findAll();
        List<Map<String, Object>> summary = new ArrayList<>();
        for (ResourcePool pool : pools) {
            List<ResourcePoolMember> all       = memberRepo.findByPoolId(pool.getId());
            long available = all.stream().filter(m -> Boolean.TRUE.equals(m.getIsAvailable())).count();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("poolId",           pool.getId());
            row.put("poolName",         pool.getName());
            row.put("roleType",         pool.getRoleType());
            row.put("targetHeadcount",  pool.getTargetHeadcount());
            row.put("totalMembers",     all.size());
            row.put("available",        available);
            row.put("utilization",      all.isEmpty() ? 0 : Math.round((1.0 - (double) available / all.size()) * 100));
            summary.add(row);
        }
        return summary;
    }
}
