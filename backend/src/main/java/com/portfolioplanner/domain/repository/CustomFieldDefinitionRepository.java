package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.CustomFieldDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CustomFieldDefinitionRepository extends JpaRepository<CustomFieldDefinition, Long> {
    List<CustomFieldDefinition> findByActiveTrueOrderBySortOrderAsc();
    List<CustomFieldDefinition> findAllByOrderBySortOrderAsc();
    boolean existsByFieldName(String fieldName);
}
