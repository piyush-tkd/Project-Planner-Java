package com.portfolioplanner.dto.response;

import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.domain.model.enums.SourceType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

public record ProjectResponse(
        Long id,
        String name,
        Priority priority,
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
        LocalDateTime createdAt,
        // ── Jira source-of-truth fields ──────────────────────────────────────
        SourceType sourceType,
        String jiraEpicKey,
        Long jiraBoardId,
        OffsetDateTime jiraLastSyncedAt,
        boolean jiraSyncError,
        /** Raw Jira statusCategory.key: "new" / "indeterminate" / "done". Null for non-Jira projects. */
        String jiraStatusCategory,
        boolean archived,
        // ── Budget tracking ───────────────────────────────────────────────────
        BigDecimal estimatedBudget,
        BigDecimal actualCost
) {
}
