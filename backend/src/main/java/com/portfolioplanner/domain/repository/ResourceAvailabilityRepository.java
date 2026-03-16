package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ResourceAvailability;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResourceAvailabilityRepository extends JpaRepository<ResourceAvailability, Long> {

    List<ResourceAvailability> findByResourceId(Long resourceId);

    List<ResourceAvailability> findByResourceIdIn(List<Long> resourceIds);
}
