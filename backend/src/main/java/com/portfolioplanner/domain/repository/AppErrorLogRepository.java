package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.AppErrorLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface AppErrorLogRepository extends JpaRepository<AppErrorLog, Long> {

    List<AppErrorLog> findAllByOrderByCreatedAtDesc();

    List<AppErrorLog> findBySourceOrderByCreatedAtDesc(String source);

    List<AppErrorLog> findBySeverityOrderByCreatedAtDesc(String severity);

    List<AppErrorLog> findByResolvedFalseOrderByCreatedAtDesc();

    List<AppErrorLog> findByCreatedAtAfterOrderByCreatedAtDesc(LocalDateTime since);

    long countByResolvedFalse();

    long countBySource(String source);

    long countBySeverity(String severity);
}
