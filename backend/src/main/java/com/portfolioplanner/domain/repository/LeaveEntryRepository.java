package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.LeaveEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LeaveEntryRepository extends JpaRepository<LeaveEntry, Long> {

    /** Fetch with resource eagerly to avoid lazy-load issues */
    @Query("SELECT le FROM LeaveEntry le JOIN FETCH le.resource WHERE le.leaveYear = :year ORDER BY le.monthIndex ASC, le.resource.name ASC")
    List<LeaveEntry> findByLeaveYearWithResource(@Param("year") int year);

    @Query("SELECT le FROM LeaveEntry le JOIN FETCH le.resource WHERE le.leaveYear = :year AND le.resource.id = :resourceId")
    List<LeaveEntry> findByYearAndResourceId(@Param("year") int year, @Param("resourceId") Long resourceId);

    /** Used by CalculationEngine: resourceId -> monthIndex -> total hours */
    @Query("SELECT le.resource.id, le.monthIndex, SUM(le.leaveHours) " +
           "FROM LeaveEntry le " +
           "WHERE le.leaveYear = :year " +
           "GROUP BY le.resource.id, le.monthIndex")
    List<Object[]> sumLeaveHoursByResourceAndMonth(@Param("year") int year);

    void deleteByLeaveYear(int leaveYear);
}
