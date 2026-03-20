package com.portfolioplanner.dto.response;

import java.math.BigDecimal;

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
        Integer durationOverride
) {}
