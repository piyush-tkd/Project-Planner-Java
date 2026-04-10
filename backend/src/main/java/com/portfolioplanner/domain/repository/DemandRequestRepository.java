package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.DemandRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface DemandRequestRepository extends JpaRepository<DemandRequest, Long> {
    List<DemandRequest> findByStatus(String status);
    List<DemandRequest> findByProjectId(Long projectId);
    List<DemandRequest> findByRoleType(String roleType);
    List<DemandRequest> findByStatusAndRoleType(String status, String roleType);

    @Query("SELECT d FROM DemandRequest d WHERE d.status IN ('Open','Partially Filled') ORDER BY d.priority, d.startDate")
    List<DemandRequest> findUnfilled();

    @Query("SELECT d FROM DemandRequest d WHERE d.status IN ('Open','Partially Filled') AND d.roleType = :roleType")
    List<DemandRequest> findUnfilledByRole(@Param("roleType") String roleType);
}
