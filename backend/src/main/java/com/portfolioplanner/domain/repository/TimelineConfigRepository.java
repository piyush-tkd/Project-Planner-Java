package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.TimelineConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TimelineConfigRepository extends JpaRepository<TimelineConfig, Long> {
}
