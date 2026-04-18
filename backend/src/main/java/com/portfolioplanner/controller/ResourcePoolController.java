package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.service.ResourcePoolService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/resource-pools")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@PreAuthorize("isAuthenticated()")
public class ResourcePoolController {

    private final ResourcePoolService resourcePoolService;

    // ── Pool CRUD ─────────────────────────────────────────────────────

    @GetMapping
    public List<ResourcePool> listPools(@RequestParam(required = false) String roleType) {
        return resourcePoolService.listPools(roleType);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResourcePool> getPool(@PathVariable Long id) {
        return resourcePoolService.getPool(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResourcePool createPool(@Valid @RequestBody ResourcePool pool) {
        return resourcePoolService.createPool(pool);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResourcePool> updatePool(@PathVariable Long id, @RequestBody ResourcePool update) {
        return resourcePoolService.updatePool(id, update).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePool(@PathVariable Long id) {
        if (!resourcePoolService.deletePool(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/members")
    public List<ResourcePoolMember> getMembers(@PathVariable Long id) {
        return resourcePoolService.getMembers(id);
    }

    @GetMapping("/{id}/available")
    public List<ResourcePoolMember> getAvailableMembers(@PathVariable Long id) {
        return resourcePoolService.getAvailableMembers(id);
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<?> addMember(@PathVariable Long id, @RequestBody ResourcePoolMember member) {
        try {
            return resourcePoolService.addMember(id, member).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}/members/{memberId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long id, @PathVariable Long memberId) {
        if (!resourcePoolService.removeMember(id, memberId)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/supply-summary")
    public List<Map<String, Object>> getSupplySummary() {
        return resourcePoolService.getSupplySummary();
    }
}
