package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.CostRate;
import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CostRateRepository extends JpaRepository<CostRate, Long> {
    Optional<CostRate> findByRoleAndLocation(Role role, Location location);
}
