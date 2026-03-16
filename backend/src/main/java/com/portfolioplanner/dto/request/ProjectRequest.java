package com.portfolioplanner.dto.request;

import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.domain.model.enums.ProjectStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record ProjectRequest(
        @NotBlank String name,
        @NotNull Priority priority,
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
