package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.NotificationSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Repository for the singleton {@link NotificationSchedule} row (id = 1).
 */
@Repository
public interface NotificationScheduleRepository extends JpaRepository<NotificationSchedule, Long> {
}
