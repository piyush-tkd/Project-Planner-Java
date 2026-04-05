package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.CustomFieldValue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomFieldValueRepository extends JpaRepository<CustomFieldValue, Long> {
    List<CustomFieldValue> findByProjectId(Long projectId);
    Optional<CustomFieldValue> findByFieldDefIdAndProjectId(Long fieldDefId, Long projectId);
    void deleteByProjectId(Long projectId);
}
