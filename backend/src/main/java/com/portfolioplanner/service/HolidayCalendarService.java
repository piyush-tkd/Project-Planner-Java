package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.HolidayCalendar;
import com.portfolioplanner.domain.repository.HolidayCalendarRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.*;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HolidayCalendarService {

    private final HolidayCalendarRepository repo;

    /** Inner response record used by the controller. */
    public record HolidayResponse(
        Long id,
        String name,
        String holidayDate,
        String location,
        Integer year,
        String dayOfWeek
    ) {}

    // ── Queries ───────────────────────────────────────────────────────────────

    public List<HolidayResponse> getAll(int year, String location) {
        List<HolidayCalendar> holidays;
        if (year == 0) {
            holidays = repo.findAll();
        } else if (location != null && !location.isBlank()) {
            holidays = repo.findByLocationAndYearOrderByHolidayDateAsc(location, year);
        } else {
            holidays = repo.findByYearOrderByHolidayDateAsc(year);
        }
        return holidays.stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<String> getDates(String location, int year) {
        List<HolidayCalendar> holidays = "ALL".equalsIgnoreCase(location)
            ? repo.findByYearOrderByHolidayDateAsc(year)
            : repo.findByLocationAndYearOrderByHolidayDateAsc(location, year);
        List<HolidayCalendar> allLocation = repo.findByLocationAndYearOrderByHolidayDateAsc("ALL", year);

        Set<String> dates = new TreeSet<>();
        holidays.forEach(h -> dates.add(h.getHolidayDate().toString()));
        allLocation.forEach(h -> dates.add(h.getHolidayDate().toString()));
        return new ArrayList<>(dates);
    }

    /**
     * Returns holiday hour deductions per location per month.
     * Shape: { "US": { 1: 8, 7: 16, ... }, "INDIA": { 1: 8, ... } }
     * Assumes each holiday = 8 hours.
     */
    public Map<String, Map<Integer, Integer>> getDeductions(int year) {
        List<HolidayCalendar> all = repo.findByYearOrderByHolidayDateAsc(year);

        Map<String, Map<Integer, Integer>> result = new LinkedHashMap<>();
        result.put("US", new HashMap<>());
        result.put("INDIA", new HashMap<>());

        for (HolidayCalendar h : all) {
            int month = h.getHolidayDate().getMonthValue();
            int hours = 8;
            List<String> targets = new ArrayList<>();
            if ("ALL".equalsIgnoreCase(h.getLocation())) {
                targets.add("US");
                targets.add("INDIA");
            } else {
                targets.add(h.getLocation().toUpperCase());
            }
            for (String loc : targets) {
                result.computeIfAbsent(loc, k -> new HashMap<>())
                      .merge(month, hours, Integer::sum);
            }
        }
        return result;
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    @Transactional
    public HolidayResponse create(String name, String holidayDate, String location) {
        HolidayCalendar h = new HolidayCalendar();
        h.setName(name);
        h.setHolidayDate(LocalDate.parse(holidayDate));
        h.setLocation(location.toUpperCase());
        return toResponse(repo.save(h));
    }

    @Transactional
    public HolidayResponse update(Long id, String name, String holidayDate, String location) {
        HolidayCalendar h = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Holiday not found: " + id));
        h.setName(name);
        h.setHolidayDate(LocalDate.parse(holidayDate));
        h.setLocation(location.toUpperCase());
        return toResponse(repo.save(h));
    }

    @Transactional
    public void delete(Long id) {
        repo.deleteById(id);
    }

    // ── Mapper ────────────────────────────────────────────────────────────────

    private HolidayResponse toResponse(HolidayCalendar h) {
        return new HolidayResponse(
            h.getId(),
            h.getName(),
            h.getHolidayDate().toString(),
            h.getLocation(),
            h.getHolidayDate().getYear(),
            h.getHolidayDate().getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH)
        );
    }
}
