package com.portfolioplanner.dto.request;

import java.util.List;

public record SimulationRequest(
        List<ProjectOverride> projectOverrides
) {
    public record ProjectOverride(
            Long projectId,
            Integer newStartMonth,
            Integer newDuration,
            String newPattern
    ) {
    }
}
