package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.DemandFulfillment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DemandFulfillmentRepository extends JpaRepository<DemandFulfillment, Long> {
    List<DemandFulfillment> findByDemandRequestId(Long demandRequestId);
    List<DemandFulfillment> findByResourceId(Long resourceId);
}
