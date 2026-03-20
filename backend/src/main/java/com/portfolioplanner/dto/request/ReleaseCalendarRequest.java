package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record ReleaseCalendarRequest(
        @NotBlank String name,
        @NotNull LocalDate releaseDate,
        @NotNull LocalDate codeFreezeDate,
        String type,
        String notes
) {}
