package com.portfolioplanner.dto.request;

import java.time.LocalDate;

public record PhaseScheduleRequest(
    Long podPlanningId,
    LocalDate devStartDate,
    LocalDate devEndDate,
    LocalDate qaStartDate,
    LocalDate qaEndDate,
    LocalDate uatStartDate,
    LocalDate uatEndDate,
    Boolean scheduleLocked
) {}
