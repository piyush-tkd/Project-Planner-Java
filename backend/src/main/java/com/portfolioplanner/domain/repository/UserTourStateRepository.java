package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.UserTourState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserTourStateRepository extends JpaRepository<UserTourState, Long> {
    Optional<UserTourState> findByUsername(String username);
}
