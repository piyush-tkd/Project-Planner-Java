package com.portfolioplanner.dto.response;

import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.domain.model.enums.ProjectStatus;

import java.time.LocalDate;

public record ProjectResponse(
        Long id,
        String name,
        Priority priority,
        String owner,
        Integer startMonth,
        Integer targetEndMonth,
        Integer durationMonths,
        String defaultPattern,
        String notes,
        ProjectStatus status,
        Long blockedById,
        LocalDate targetDate,
        LocalDate startDate,
        String capacityNote
) {
}
