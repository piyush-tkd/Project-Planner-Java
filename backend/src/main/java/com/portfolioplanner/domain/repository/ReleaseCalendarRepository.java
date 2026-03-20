package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ReleaseCalendar;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReleaseCalendarRepository extends JpaRepository<ReleaseCalendar, Long> {
    List<ReleaseCalendar> findAllByOrderByReleaseDateAsc();
}
