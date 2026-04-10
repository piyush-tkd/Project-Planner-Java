package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ResourcePool;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ResourcePoolRepository extends JpaRepository<ResourcePool, Long> {
    List<ResourcePool> findByRoleType(String roleType);
    List<ResourcePool> findByRoleTypeAndSpecialization(String roleType, String specialization);
}
