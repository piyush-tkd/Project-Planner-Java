package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.RoleDefinition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoleDefinitionRepository extends JpaRepository<RoleDefinition, Long> {
    Optional<RoleDefinition> findByName(String name);
    boolean existsByName(String name);
    List<RoleDefinition> findAllByOrderBySystemDescNameAsc();
}
