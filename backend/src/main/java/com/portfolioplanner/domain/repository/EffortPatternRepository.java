package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.EffortPattern;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EffortPatternRepository extends JpaRepository<EffortPattern, Long> {

    Optional<EffortPattern> findByName(String name);
}
