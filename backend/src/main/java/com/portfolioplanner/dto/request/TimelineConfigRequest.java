package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record TimelineConfigRequest(
        @NotNull Integer startYear,
        @NotNull Integer startMonth,
        @NotNull Integer currentMonthIndex,
        Map<String, Integer> workingHours
) {
}
