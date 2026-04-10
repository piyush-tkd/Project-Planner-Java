package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.TeamType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface TeamTypeRepository extends JpaRepository<TeamType, Long> {
    Optional<TeamType> findByName(String name);
}
