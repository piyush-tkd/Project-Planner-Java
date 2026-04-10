package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.UserAiConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserAiConfigRepository extends JpaRepository<UserAiConfig, Long> {
    Optional<UserAiConfig> findByUsername(String username);
    void deleteByUsername(String username);
}
