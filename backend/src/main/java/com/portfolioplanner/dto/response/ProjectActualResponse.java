package com.portfolioplanner.dto.response;

import java.math.BigDecimal;

public record ProjectActualResponse(
        Long id,
        Long projectId,
        String projectName,
        Integer monthKey,
        BigDecimal actualHours
) {}
