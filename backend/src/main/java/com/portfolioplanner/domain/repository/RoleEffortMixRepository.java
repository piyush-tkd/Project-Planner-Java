package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.RoleEffortMix;
import com.portfolioplanner.domain.model.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoleEffortMixRepository extends JpaRepository<RoleEffortMix, Long> {

    Optional<RoleEffortMix> findByRole(Role role);
}
