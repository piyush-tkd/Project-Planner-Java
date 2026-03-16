package com.portfolioplanner.service.calculation.dto;

import java.math.BigDecimal;

public record MonthlyCapacity(Long podId, String podName, String role, int monthIndex, BigDecimal hours) {
}
