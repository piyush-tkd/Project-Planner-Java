package com.portfolioplanner.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ProjectPodPlanningResponse(
        Long id,
        Long podId,
        String podName,
        BigDecimal devHours,
        BigDecimal qaHours,
        BigDecimal bsaHours,
        BigDecimal techLeadHours,
        BigDecimal contingencyPct,
        BigDecimal totalHours,
        BigDecimal totalHoursWithContingency,
        Long targetReleaseId,
        String targetReleaseName,
        String effortPattern,
        Integer podStartMonth,
        Integer durationOverride,
        // Phase scheduling fields
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
