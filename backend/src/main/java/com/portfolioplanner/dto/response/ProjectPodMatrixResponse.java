package com.portfolioplanner.dto.response;

import java.math.BigDecimal;

public record ProjectPodMatrixResponse(
        Long planningId,
        Long projectId,
        String projectName,
        String priority,
        String owner,
        String status,
        Integer projectStartMonth,
        Integer projectDurationMonths,
        String defaultPattern,
        Long podId,
        String podName,
        String tshirtSize,
        BigDecimal complexityOverride,
        String effortPattern,
        Integer podStartMonth,
        Integer durationOverride
) {
}
