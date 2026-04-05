package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.TeamPulse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TeamPulseRepository extends JpaRepository<TeamPulse, Long> {

    List<TeamPulse> findByWeekStart(LocalDate weekStart);

    List<TeamPulse> findByResourceId(Long resourceId);

    Optional<TeamPulse> findByResourceIdAndWeekStart(Long resourceId, LocalDate weekStart);

    /** Return distinct week_start values ordered descending — used for trend. */
    @Query("SELECT DISTINCT tp.weekStart FROM TeamPulse tp ORDER BY tp.weekStart DESC")
    List<LocalDate> findDistinctWeekStarts();

    /** All pulses for weeks within the given range. */
    List<TeamPulse> findByWeekStartBetweenOrderByWeekStartDesc(LocalDate from, LocalDate to);
}
