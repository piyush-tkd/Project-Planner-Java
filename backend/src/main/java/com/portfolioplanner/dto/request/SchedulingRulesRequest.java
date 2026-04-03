package com.portfolioplanner.dto.request;

public record SchedulingRulesRequest(
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
