package com.portfolioplanner.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

/**
 * Computed health scorecard for a single project.
 *
 * <p>Three dimensions are scored 0–100 and combined into an {@code overallScore}.
 * Each dimension also exposes a human-readable {@code label} for display.
 * A {@code null} dimension score means "not enough data to assess" (neutral).
 *
 * <h3>RAG status mapping</h3>
 * <ul>
 *   <li>GREEN  — overallScore ≥ 70</li>
 *   <li>AMBER  — overallScore 40–69</li>
 *   <li>RED    — overallScore &lt; 40</li>
 *   <li>GREY   — project is COMPLETED or CANCELLED</li>
 * </ul>
 */
@Data
@Builder
public class ProjectHealthDto {

    private Long   projectId;
    private String projectName;
    private String projectStatus;

    /** RAG: GREEN | AMBER | RED | GREY */
    private String ragStatus;

    /** Weighted composite, 0–100. Null only if all sub-scores are null. */
    private Integer overallScore;

    // ── Dimension scores (null = N/A) ────────────────────────────────────────

    /** Schedule score 0–100 based on days to/from targetDate. */
    private Integer scheduleScore;
    /** e.g. "12 days remaining", "8 days overdue", "No target date" */
    private String  scheduleLabel;

    /** Budget score 0–100 based on actualCost / estimatedBudget. */
    private Integer budgetScore;
    /** e.g. "82% of budget used", "No budget set" */
    private String  budgetLabel;

    /** Risk score 0–100 based on open CRITICAL/HIGH risk items. */
    private Integer riskScore;
    /** e.g. "2 high risks open", "No open risks" */
    private String  riskLabel;

    /** Open critical risk count (for sorting/filtering). */
    private int criticalRisks;
    /** Open high risk count. */
    private int highRisks;

    /** Project target date (for display in UI). */
    private LocalDate targetDate;
}
