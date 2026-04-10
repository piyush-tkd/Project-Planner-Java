package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ResourcePoolMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ResourcePoolMemberRepository extends JpaRepository<ResourcePoolMember, Long> {
    List<ResourcePoolMember> findByPoolId(Long poolId);
    List<ResourcePoolMember> findByResourceId(Long resourceId);
    List<ResourcePoolMember> findByPoolIdAndIsAvailable(Long poolId, Boolean isAvailable);
    Optional<ResourcePoolMember> findByPoolIdAndResourceId(Long poolId, Long resourceId);

    @Query("SELECT m FROM ResourcePoolMember m WHERE m.isAvailable = true ORDER BY m.seniorityLevel")
    List<ResourcePoolMember> findAllAvailable();

    @Query("SELECT m FROM ResourcePoolMember m JOIN ResourcePool p ON m.poolId = p.id WHERE p.roleType = :roleType AND m.isAvailable = true")
    List<ResourcePoolMember> findAvailableByRoleType(@Param("roleType") String roleType);
}
