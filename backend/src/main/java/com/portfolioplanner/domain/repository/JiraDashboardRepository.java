package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraDashboard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface JiraDashboardRepository extends JpaRepository<JiraDashboard, Long> {

    List<JiraDashboard> findByUsernameOrIsDefaultTrueOrderByUpdatedAtDesc(String username);

    Optional<JiraDashboard> findByIdAndUsername(Long id, String username);

    Optional<JiraDashboard> findByIsDefaultTrue();
}
