package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.HolidayCalendar;
import com.portfolioplanner.domain.repository.HolidayCalendarRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/holidays")
@RequiredArgsConstructor
public class HolidayCalendarController {

    private final HolidayCalendarRepository repo;

    /** Response DTO */
    public record HolidayResponse(
        Long id,
        String name,
        String holidayDate,   // ISO yyyy-MM-dd
        String location,
        int year,
        String dayOfWeek
    ) {}

    /** Request DTO for create / update */
    public record HolidayRequest(
        @NotBlank String name,
        @NotNull String holidayDate,   // ISO yyyy-MM-dd
        @NotBlank String location      // US | INDIA | ALL
    ) {}

    private HolidayResponse toResponse(HolidayCalendar h) {
        String dow = h.getHolidayDate().getDayOfWeek().name();
        // Capitalise: "MONDAY" → "Monday"
        dow = dow.charAt(0) + dow.substring(1).toLowerCase();
        return new HolidayResponse(
            h.getId(),
            h.getName(),
            h.getHolidayDate().toString(),
            h.getLocation(),
            h.getHolidayDate().getYear(),
            dow
        );
    }

    /** Get all holidays for a given year, optionally filtered by location */
    @GetMapping
    public List<HolidayResponse> getAll(
            @RequestParam(required = false, defaultValue = "0") int year,
            @RequestParam(required = false) String location) {
        int y = year > 0 ? year : LocalDate.now().getYear();
        List<HolidayCalendar> holidays;
        if (location != null && !location.isBlank()) {
            holidays = repo.findByLocationAndYearOrderByHolidayDateAsc(location.toUpperCase(), y);
        } else {
            holidays = repo.findByYearOrderByHolidayDateAsc(y);
        }
        return holidays.stream().map(this::toResponse).toList();
    }

    /** Get all holiday dates for a specific location+year — used by capacity calculations */
    @GetMapping("/dates")
    public List<String> getDates(
            @RequestParam String location,
            @RequestParam int year) {
        List<HolidayCalendar> us   = repo.findByLocationAndYearOrderByHolidayDateAsc(location.toUpperCase(), year);
        List<HolidayCalendar> all  = repo.findByLocationAndYearOrderByHolidayDateAsc("ALL", year);
        return Stream.concat(us.stream(), all.stream())
            .map(h -> h.getHolidayDate().toString())
            .distinct()
            .sorted()
            .toList();
    }

    /**
     * Returns holiday hour deductions per location per month index.
     * Shape: { "US": {1: 8, 7: 16, ...}, "INDIA": {1: 8, ...} }
     * Holidays with location=ALL are merged into both US and INDIA buckets.
     */
    @GetMapping("/deductions")
    public Map<String, Map<Integer, Integer>> getDeductions(@RequestParam int year) {
        List<HolidayCalendar> holidays = repo.findByYearOrderByHolidayDateAsc(year);
        Map<String, Map<Integer, Integer>> result = new HashMap<>();
        for (HolidayCalendar h : holidays) {
            int month = h.getHolidayDate().getMonthValue();
            if ("ALL".equals(h.getLocation())) {
                result.computeIfAbsent("US",    k -> new HashMap<>()).merge(month, 8, Integer::sum);
                result.computeIfAbsent("INDIA", k -> new HashMap<>()).merge(month, 8, Integer::sum);
            } else {
                result.computeIfAbsent(h.getLocation(), k -> new HashMap<>()).merge(month, 8, Integer::sum);
            }
        }
        return result;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<HolidayResponse> create(@Valid @RequestBody HolidayRequest req) {
        LocalDate date = LocalDate.parse(req.holidayDate(), DateTimeFormatter.ISO_DATE);
        String loc = req.location().toUpperCase();
        if (repo.existsByLocationAndHolidayDate(loc, date)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "A holiday for " + loc + " on " + date + " already exists");
        }
        HolidayCalendar entity = new HolidayCalendar();
        entity.setName(req.name());
        entity.setHolidayDate(date);
        entity.setLocation(loc);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(repo.save(entity)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public HolidayResponse update(@PathVariable Long id, @Valid @RequestBody HolidayRequest req) {
        HolidayCalendar entity = repo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Holiday not found"));
        LocalDate date = LocalDate.parse(req.holidayDate(), DateTimeFormatter.ISO_DATE);
        entity.setName(req.name());
        entity.setHolidayDate(date);
        entity.setLocation(req.location().toUpperCase());
        return toResponse(repo.save(entity));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Holiday not found");
        }
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
