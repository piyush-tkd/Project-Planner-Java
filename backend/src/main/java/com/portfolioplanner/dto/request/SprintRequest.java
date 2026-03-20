package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record SprintRequest(
        @NotBlank String name,
        String type,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        LocalDate requirementsLockInDate
) {}
