package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ResourceCostRate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ResourceCostRateRepository extends JpaRepository<ResourceCostRate, Long> {

    List<ResourceCostRate> findByResourceId(Long resourceId);

    @Query("SELECT cr FROM ResourceCostRate cr WHERE cr.resource.id = :resourceId " +
           "AND cr.effectiveFrom <= :date " +
           "AND (cr.effectiveTo IS NULL OR cr.effectiveTo >= :date) " +
           "ORDER BY cr.effectiveFrom DESC")
    Optional<ResourceCostRate> findEffectiveRate(@Param("resourceId") Long resourceId,
                                                  @Param("date") LocalDate date);
}
