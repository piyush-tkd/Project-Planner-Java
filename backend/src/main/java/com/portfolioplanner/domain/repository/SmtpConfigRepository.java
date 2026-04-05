package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.SmtpConfig;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SmtpConfigRepository extends JpaRepository<SmtpConfig, Long> {
    // Singleton row is always fetched with findById(1L)
}
