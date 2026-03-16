package com.portfolioplanner.dto.response;

import java.util.Map;

public record TimelineConfigResponse(
        Long id,
        Integer startYear,
        Integer startMonth,
        Integer currentMonthIndex,
        Map<String, Integer> workingHours,
        Map<Integer, String> monthLabels
) {
}
