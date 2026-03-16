package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.TemporaryOverride;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TemporaryOverrideRepository extends JpaRepository<TemporaryOverride, Long> {

    List<TemporaryOverride> findByResourceId(Long resourceId);
}
