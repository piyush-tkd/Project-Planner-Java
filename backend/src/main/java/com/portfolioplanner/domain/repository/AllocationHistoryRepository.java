package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.AllocationHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AllocationHistoryRepository extends JpaRepository<AllocationHistory, Long> {
    List<AllocationHistory> findByResourceIdOrderByChangedAtDesc(Long resourceId);
    List<AllocationHistory> findByTeamIdOrderByChangedAtDesc(Long teamId);
    List<AllocationHistory> findByAllocationIdOrderByChangedAtDesc(Long allocationId);
}
