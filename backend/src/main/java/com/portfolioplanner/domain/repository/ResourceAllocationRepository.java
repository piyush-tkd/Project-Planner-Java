package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ResourceAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ResourceAllocationRepository extends JpaRepository<ResourceAllocation, Long> {

    List<ResourceAllocation> findByResourceId(Long resourceId);

    List<ResourceAllocation> findByTeamId(Long teamId);

    @Query("SELECT ra FROM ResourceAllocation ra WHERE ra.resourceId = :resourceId AND (ra.endDate IS NULL OR ra.endDate > CURRENT_DATE)")
    List<ResourceAllocation> findActiveByResourceId(@Param("resourceId") Long resourceId);

    @Query("SELECT ra FROM ResourceAllocation ra WHERE ra.teamId = :teamId AND (ra.endDate IS NULL OR ra.endDate > CURRENT_DATE)")
    List<ResourceAllocation> findActiveByTeamId(@Param("teamId") Long teamId);

    @Query("SELECT COALESCE(SUM(ra.percentage), 0) FROM ResourceAllocation ra WHERE ra.resourceId = :resourceId AND (ra.endDate IS NULL OR ra.endDate > CURRENT_DATE) AND ra.id <> :excludeId")
    Integer calculateTotalAllocation(@Param("resourceId") Long resourceId, @Param("excludeId") Long excludeId);

    @Query("SELECT COALESCE(SUM(ra.percentage), 0) FROM ResourceAllocation ra WHERE ra.resourceId = :resourceId AND (ra.endDate IS NULL OR ra.endDate > CURRENT_DATE)")
    Integer calculateTotalAllocationForResource(@Param("resourceId") Long resourceId);
}
