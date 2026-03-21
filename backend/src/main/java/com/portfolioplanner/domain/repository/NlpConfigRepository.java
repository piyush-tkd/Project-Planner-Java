package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.NlpConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NlpConfigRepository extends JpaRepository<NlpConfig, Long> {
    Optional<NlpConfig> findByConfigKey(String configKey);
}
