package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record TshirtSizeRequest(
        @NotBlank String name,
        @Positive int baseHours,
        int displayOrder
) {
}
