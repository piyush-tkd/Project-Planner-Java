package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.AllocationType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AllocationTypeRepository extends JpaRepository<AllocationType, Long> {
    Optional<AllocationType> findByName(String name);
}
