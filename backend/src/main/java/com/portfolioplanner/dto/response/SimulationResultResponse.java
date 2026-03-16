package com.portfolioplanner.dto.response;

public record SimulationResultResponse(
        CapacityGapResponse baseline,
        CapacityGapResponse simulated,
        CapacityGapResponse deltas
) {
}
