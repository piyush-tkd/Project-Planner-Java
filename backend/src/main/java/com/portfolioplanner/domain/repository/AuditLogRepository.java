package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    /** All entries for a specific entity (e.g. all changes to Resource id=5). */
    List<AuditLog> findByEntityTypeAndEntityIdOrderByChangedAtDesc(String entityType, Long entityId);

    /** All entries by a specific user. */
    Page<AuditLog> findByChangedByOrderByChangedAtDesc(String changedBy, Pageable pageable);

    /** Recent entries across all entity types, paged. */
    Page<AuditLog> findAllByOrderByChangedAtDesc(Pageable pageable);

    /** Entries in a time window (for the digest / export). */
    List<AuditLog> findByChangedAtBetweenOrderByChangedAtDesc(Instant from, Instant to);
}
