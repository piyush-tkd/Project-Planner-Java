package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ProjectPodPlanningRequest(
        @NotNull Long podId,
        BigDecimal devHours,
        BigDecimal qaHours,
        BigDecimal bsaHours,
        BigDecimal techLeadHours,
        BigDecimal contingencyPct,
        Long targetReleaseId,
        // legacy / kept for pattern/month overrides
        String effortPattern,
        Integer podStartMonth,
        Integer durationOverride,
        // Phase scheduling
        LocalDate devStartDate,
        LocalDate devEndDate,
        LocalDate qaStartDate,
        LocalDate qaEndDate,
        LocalDate uatStartDate,
        LocalDate uatEndDate,
        Boolean scheduleLocked,
        // Resource counts
        Integer devCount,
        Integer qaCount
) {}
