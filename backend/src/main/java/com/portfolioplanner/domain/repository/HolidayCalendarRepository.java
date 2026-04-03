package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.HolidayCalendar;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HolidayCalendarRepository extends JpaRepository<HolidayCalendar, Long> {

    List<HolidayCalendar> findByYearOrderByHolidayDateAsc(int year);

    List<HolidayCalendar> findByLocationAndYearOrderByHolidayDateAsc(String location, int year);

    boolean existsByLocationAndHolidayDate(String location, java.time.LocalDate holidayDate);
}
