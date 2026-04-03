package com.portfolioplanner.dto.response;

import java.time.LocalDate;

public record PhaseScheduleResponse(
    Long podPlanningId,
    Long podId,
    String podName,
    LocalDate devStartDate,
    LocalDate devEndDate,
    LocalDate qaStartDate,
    LocalDate qaEndDate,
    LocalDate uatStartDate,
    LocalDate uatEndDate,
    Boolean scheduleLocked
) {}
