package com.portfolioplanner.dto.response;

import java.time.LocalDate;

public record ReleaseCalendarResponse(
        Long id,
        String name,
        LocalDate releaseDate,
        LocalDate codeFreezeDate,
        String type,
        String notes
) {}
