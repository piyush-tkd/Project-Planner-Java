package com.portfolioplanner.dto.request;

import java.time.LocalDate;

public record ProjectMilestonesRequest(
    LocalDate e2eStartDate,
    LocalDate e2eEndDate,
    LocalDate codeFreezeDateMilestone,
    LocalDate releaseDateMilestone
) {}
