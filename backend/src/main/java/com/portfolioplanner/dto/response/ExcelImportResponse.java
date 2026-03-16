package com.portfolioplanner.dto.response;

import java.util.List;
import java.util.Map;

public record ExcelImportResponse(
        boolean success,
        String message,
        Map<String, Integer> counts,
        List<String> warnings
) {}
