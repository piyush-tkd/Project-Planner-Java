package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ResourcePoolService {

    private final ResourcePoolRepository resourcePoolRepository;
    private final ResourcePoolMemberRepository resourcePoolMemberRepository;

    public List<ResourcePool> listPools(String roleType) {
        if (roleType != null) {
            return resourcePoolRepository.findByRoleType(roleType);
        }
        return resourcePoolRepository.findAll();
    }

    public Optional<ResourcePool> getPool(Long id) {
        return resourcePoolRepository.findById(id);
    }

    @Transactional
    public ResourcePool createPool(ResourcePool pool) {
        pool.setId(null);
        return resourcePoolRepository.save(pool);
    }

    @Transactional
    public Optional<ResourcePool> updatePool(Long id, ResourcePool update) {
        return resourcePoolRepository.findById(id).map(p -> {
            p.setName(update.getName());
            p.setRoleType(update.getRoleType());
            p.setSpecialization(update.getSpecialization());
            p.setTargetHeadcount(update.getTargetHeadcount());
            p.setDescription(update.getDescription());
            return resourcePoolRepository.save(p);
        });
    }

    @Transactional
    public boolean deletePool(Long id) {
        if (!resourcePoolRepository.existsById(id)) {
            return false;
        }
        resourcePoolRepository.deleteById(id);
        return true;
    }

    public List<ResourcePoolMember> getMembers(Long id) {
        return resourcePoolMemberRepository.findByPoolId(id);
    }

    public List<ResourcePoolMember> getAvailableMembers(Long id) {
        return resourcePoolMemberRepository.findByPoolIdAndIsAvailable(id, true);
    }

    @Transactional
    public Optional<ResourcePoolMember> addMember(Long id, ResourcePoolMember member) {
        if (!resourcePoolRepository.existsById(id)) {
            return Optional.empty();
        }
        member.setId(null);
        member.setPoolId(id);
        // Check for duplicate
        if (resourcePoolMemberRepository.findByPoolIdAndResourceId(id, member.getResourceId()).isPresent()) {
            throw new IllegalArgumentException("Resource already in this pool");
        }
        return Optional.of(resourcePoolMemberRepository.save(member));
    }

    @Transactional
    public boolean removeMember(Long id, Long memberId) {
        return resourcePoolMemberRepository.findById(memberId)
            .filter(m -> m.getPoolId().equals(id))
            .map(m -> {
                resourcePoolMemberRepository.delete(m);
                return true;
            })
            .orElse(false);
    }

    public List<Map<String, Object>> getSupplySummary() {
        List<ResourcePool> pools = resourcePoolRepository.findAll();
        List<Map<String, Object>> summary = new ArrayList<>();
        for (ResourcePool pool : pools) {
            List<ResourcePoolMember> all = resourcePoolMemberRepository.findByPoolId(pool.getId());
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
