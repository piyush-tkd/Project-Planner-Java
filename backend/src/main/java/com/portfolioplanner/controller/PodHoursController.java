package com.portfolioplanner.controller;

import com.portfolioplanner.service.reports.PodHoursService;
import com.portfolioplanner.service.reports.PodHoursService.PodHoursSummary;
import com.portfolioplanner.service.reports.PodHoursService.PeriodType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/reports/pod-hours")
@RequiredArgsConstructor
public class PodHoursController {

    private final PodHoursService podHoursService;

    /**
     * GET /api/reports/pod-hours?year=2026&period=MONTHLY&periodIndex=3
     *
     * period      : MONTHLY | QUARTERLY | YEARLY  (default MONTHLY)
     * periodIndex : month 1-12 for MONTHLY, quarter 1-4 for QUARTERLY, ignored for YEARLY
     */
    @GetMapping
    public ResponseEntity<PodHoursSummary> getPodHours(
            @RequestParam(defaultValue = "0")        int    year,
            @RequestParam(defaultValue = "MONTHLY")  String period,
            @RequestParam(defaultValue = "0")        int    periodIndex) {

        int resolvedYear = year <= 0 ? LocalDate.now().getYear() : year;

        PeriodType periodType;
        try {
            periodType = PeriodType.valueOf(period.toUpperCase());
        } catch (IllegalArgumentException e) {
            periodType = PeriodType.MONTHLY;
        }

        // Default periodIndex for each type if not supplied
        int resolvedIndex = periodIndex;
        if (resolvedIndex <= 0) {
            resolvedIndex = switch (periodType) {
                case MONTHLY    -> LocalDate.now().getMonthValue();
                case QUARTERLY  -> (LocalDate.now().getMonthValue() - 1) / 3 + 1;
                case YEARLY     -> 0;
            };
        }

        return ResponseEntity.ok(podHoursService.getSummary(resolvedYear, periodType, resolvedIndex));
    }
}
