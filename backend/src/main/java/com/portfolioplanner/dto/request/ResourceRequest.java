package com.portfolioplanner.dto.request;

import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ResourceRequest(
        @NotBlank String name,
        @NotNull Role role,
        @NotNull Location location,
        Boolean active,
        Boolean countsInCapacity
) {
}
