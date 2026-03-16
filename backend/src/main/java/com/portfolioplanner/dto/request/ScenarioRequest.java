package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.NotBlank;

public record ScenarioRequest(
        @NotBlank String name,
        String description
) {
}
