package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ResourcePodAssignmentRequest(
        @NotNull Long podId,
        BigDecimal capacityFte
) {
}
