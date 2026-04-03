package com.portfolioplanner.dto.response;

public record SchedulingRulesResponse(
    Long id,
    Long projectId,
    Integer qaLagDays,
    Integer uatGapDays,
    Integer uatDurationDays,
    Integer e2eGapDays,
    Integer e2eDurationDays,
    // Parallelization factors
    Integer devParallelPct,
    Integer qaParallelPct,
    Integer uatParallelPct
) {}
