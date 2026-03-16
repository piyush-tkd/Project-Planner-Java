package com.portfolioplanner.dto.response;

import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Role;

import java.math.BigDecimal;

public record CostRateResponse(
        Long id,
        Role role,
        Location location,
        BigDecimal hourlyRate
) {}
