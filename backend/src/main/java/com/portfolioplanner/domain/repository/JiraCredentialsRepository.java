package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraCredentials;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JiraCredentialsRepository extends JpaRepository<JiraCredentials, Long> {
}
