package com.portfolioplanner.dto.request;

import com.portfolioplanner.domain.model.enums.Priority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ProjectRequest(
        @NotBlank String name,
        @NotNull Priority priority,
        String owner,
        Integer startMonth,
        Integer targetEndMonth,
        Integer durationMonths,
        String defaultPattern,
        String notes,
        String status,
        Long blockedById,
        LocalDate targetDate,
        LocalDate startDate,
        String capacityNote,
        String client,
        BigDecimal estimatedBudget,
        BigDecimal actualCost,
        /** Optional: "MANUAL" | "JIRA_SYNCED" | "PUSHED_TO_JIRA". Defaults to MANUAL if absent. */
        String sourceType,
        /** Jira issue key (e.g. "PMO-1234") linked to this project. */
        String jiraEpicKey
) {
}
