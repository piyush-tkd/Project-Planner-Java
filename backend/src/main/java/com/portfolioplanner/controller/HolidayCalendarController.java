package com.portfolioplanner.controller;

import com.portfolioplanner.service.HolidayCalendarService;
import com.portfolioplanner.service.HolidayCalendarService.HolidayResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/holidays")
@RequiredArgsConstructor
public class HolidayCalendarController {

    private final HolidayCalendarService service;

    /** Request DTO for create / update */
    public record HolidayRequest(
        @NotBlank String name,
        @NotNull String holidayDate,   // ISO yyyy-MM-dd
        @NotBlank String location      // US | INDIA | ALL
    ) {}

    /** Get all holidays for a given year, optionally filtered by location */
    @GetMapping
    public List<HolidayResponse> getAll(
            @RequestParam(required = false, defaultValue = "0") int year,
            @RequestParam(required = false) String location) {
        return service.getAll(year, location);
    }

    /** Get all holiday dates for a specific location+year — used by capacity calculations */
    @GetMapping("/dates")
    public List<String> getDates(
            @RequestParam String location,
            @RequestParam int year) {
        return service.getDates(location, year);
    }

    /**
     * Returns holiday hour deductions per location per month index.
     * Shape: { "US": {1: 8, 7: 16, ...}, "INDIA": {1: 8, ...} }
     * Holidays with location=ALL are merged into both US and INDIA buckets.
     */
    @GetMapping("/deductions")
    public Map<String, Map<Integer, Integer>> getDeductions(@RequestParam int year) {
        return service.getDeductions(year);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<HolidayResponse> create(@Valid @RequestBody HolidayRequest req) {
        HolidayResponse response = service.create(req.name(), req.holidayDate(), req.location());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public HolidayResponse update(@PathVariable Long id, @Valid @RequestBody HolidayRequest req) {
        return service.update(id, req.name(), req.holidayDate(), req.location());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
