package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.ResourceBooking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ResourceBookingRepository extends JpaRepository<ResourceBooking, Long> {
    List<ResourceBooking> findByResourceIdOrderByStartDateAsc(Long resourceId);

    /** Bookings that overlap with the given date window */
    @Query("""
        SELECT b FROM ResourceBooking b
        WHERE b.endDate   >= :rangeStart
          AND b.startDate <= :rangeEnd
        ORDER BY b.startDate ASC
    """)
    List<ResourceBooking> findInDateRange(
        @Param("rangeStart") LocalDate rangeStart,
        @Param("rangeEnd")   LocalDate rangeEnd
    );

    @Query("""
        SELECT b FROM ResourceBooking b
        WHERE b.resource.id = :resourceId
          AND b.endDate   >= :rangeStart
          AND b.startDate <= :rangeEnd
        ORDER BY b.startDate ASC
    """)
    List<ResourceBooking> findByResourceIdInDateRange(
        @Param("resourceId")  Long resourceId,
        @Param("rangeStart") LocalDate rangeStart,
        @Param("rangeEnd")   LocalDate rangeEnd
    );
}
