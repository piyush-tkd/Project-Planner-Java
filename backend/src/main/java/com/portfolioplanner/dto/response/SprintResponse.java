package com.portfolioplanner.dto.response;

import java.time.LocalDate;

public record SprintResponse(
        Long id,
        String name,
        String type,
        LocalDate startDate,
        LocalDate endDate,
        LocalDate requirementsLockInDate
) {}
