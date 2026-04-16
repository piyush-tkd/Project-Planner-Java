package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.RiskItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RiskItemRepository extends JpaRepository<RiskItem, Long> {
    List<RiskItem> findAllByOrderByCreatedAtDesc();
    List<RiskItem> findByItemTypeOrderByCreatedAtDesc(String itemType);
    List<RiskItem> findByStatusOrderByCreatedAtDesc(String status);
    List<RiskItem> findByProjectIdOrderByCreatedAtDesc(Long projectId);
    long countByStatusAndItemType(String status, String itemType);

    // Paginated methods
    Page<RiskItem> findByItemType(String itemType, Pageable pageable);
    Page<RiskItem> findByStatus(String status, Pageable pageable);
    Page<RiskItem> findByProjectId(Long projectId, Pageable pageable);
}
