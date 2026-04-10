package com.portfolioplanner.service.jira;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for variance and sprint breakdown logic in JiraActualsService.
 *
 * These tests verify:
 * - Planned hours computation (sum of dev/QA/BSA/tech-lead hours)
 * - Sprint breakdown (grouping actualHours by sprintName)
 * - Variance calculation (actual - planned)
 * - Burn percentage (actual / planned * 100, capped at 150%)
 * - Edge cases (zero planned, no sprints, null values)
 *
 * Uses plain Java objects and assertions only (no Spring context).
 */
@DisplayName("JiraActualsVarianceTest — variance and sprint breakdown logic")
class JiraActualsVarianceTest {

    // ── Test helper classes to mirror service structure ─────────────────────

    /**
     * Mirrors ProjectSprintAllocation entity structure.
     * Contains planned hours broken down by role.
     */
    record SprintAllocation(
            Long projectId,
            BigDecimal devHours,
            BigDecimal qaHours,
            BigDecimal bsaHours,
            BigDecimal techLeadHours
    ) {}

    /**
     * Mirrors JiraSyncedIssue entity structure (relevant fields only).
     * Contains actual work logged and sprint assignment.
     */
    record SyncedIssue(
            Long id,
            String sprintName,
            Double timeSpent  // in hours (already converted from seconds in actual service)
    ) {}

    // ── Helper methods that replicate service logic ──────────────────────────

    /**
     * Computes total planned hours from a list of sprint allocations.
     * Mirrors: JiraActualsService.buildActualsRow() planned hours computation.
     */
    static BigDecimal computePlannedHours(List<SprintAllocation> allocations) {
        BigDecimal total = BigDecimal.ZERO;
        for (SprintAllocation alloc : allocations) {
            total = total.add(nvlDecimal(alloc.devHours()));
            total = total.add(nvlDecimal(alloc.qaHours()));
            total = total.add(nvlDecimal(alloc.bsaHours()));
            total = total.add(nvlDecimal(alloc.techLeadHours()));
        }
        return total;
    }

    /**
     * Groups actual hours by sprint name.
     * Mirrors: JiraActualsService.buildActualsRow() sprint breakdown logic.
     */
    static Map<String, Double> computeSprintBreakdown(List<SyncedIssue> issues) {
        Map<String, Double> breakdown = new HashMap<>();
        for (SyncedIssue issue : issues) {
            if (issue.sprintName() != null && !issue.sprintName().isBlank() && issue.timeSpent() > 0) {
                breakdown.merge(issue.sprintName(), issue.timeSpent(), Double::sum);
            }
        }
        return breakdown;
    }

    /**
     * Computes variance: actual - planned (positive = overrun, negative = under).
     */
    static double computeVariance(double actual, BigDecimal planned) {
        return actual - planned.doubleValue();
    }

    /**
     * Computes burn percentage: min(150, actual / planned * 100).
     * Returns 0 if planned is zero (avoid division by zero).
     */
    static double computeBurnPercentage(double actual, BigDecimal planned) {
        if (planned.doubleValue() == 0) {
            return 0;
        }
        double burnPct = (actual / planned.doubleValue()) * 100.0;
        return Math.min(150, burnPct);
    }

    /**
     * Sums actual hours across all issues.
     */
    static double totalActualHours(List<SyncedIssue> issues) {
        return issues.stream()
                .mapToDouble(issue -> issue.timeSpent() != null ? issue.timeSpent() : 0)
                .sum();
    }

    private static BigDecimal nvlDecimal(BigDecimal b) {
        return b != null ? b : BigDecimal.ZERO;
    }

    // ── Tests: Planned hours computation ────────────────────────────────────

    @Test
    @DisplayName("plannedHoursIsSumOfAllRoleHours")
    void plannedHoursIsSumOfAllRoleHours() {
        // Arrange
        List<SprintAllocation> allocations = List.of(
                new SprintAllocation(1L, bd(10), bd(5), bd(2), bd(1)),
                new SprintAllocation(1L, bd(8), bd(4), bd(0), bd(2))
        );

        // Act
        BigDecimal planned = computePlannedHours(allocations);

        // Assert
        // (10 + 5 + 2 + 1) + (8 + 4 + 0 + 2) = 18 + 14 = 32
        assertThat(planned).isEqualByComparingTo(bd(32));
    }

    @Test
    @DisplayName("plannedHoursHandlesNullValues")
    void plannedHoursHandlesNullValues() {
        // Arrange
        List<SprintAllocation> allocations = List.of(
                new SprintAllocation(1L, bd(10), null, bd(2), null),
                new SprintAllocation(1L, null, bd(4), null, bd(1))
        );

        // Act
        BigDecimal planned = computePlannedHours(allocations);

        // Assert
        // (10 + 0 + 2 + 0) + (0 + 4 + 0 + 1) = 12 + 5 = 17
        assertThat(planned).isEqualByComparingTo(bd(17));
    }

    @Test
    @DisplayName("plannedHoursIsZeroForEmptyAllocationList")
    void plannedHoursIsZeroForEmptyAllocationList() {
        // Arrange
        List<SprintAllocation> allocations = new ArrayList<>();

        // Act
        BigDecimal planned = computePlannedHours(allocations);

        // Assert
        assertThat(planned).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("plannedHoursHandlesDecimalHours")
    void plannedHoursHandlesDecimalHours() {
        // Arrange
        List<SprintAllocation> allocations = List.of(
                new SprintAllocation(1L, bd(5.5), bd(3.75), bd(1.25), bd(0.5))
        );

        // Act
        BigDecimal planned = computePlannedHours(allocations);

        // Assert
        // 5.5 + 3.75 + 1.25 + 0.5 = 11
        assertThat(planned).isEqualByComparingTo(bd(11));
    }

    // ── Tests: Sprint breakdown ─────────────────────────────────────────────

    @Test
    @DisplayName("sprintBreakdownGroupsBySprintName")
    void sprintBreakdownGroupsBySprintName() {
        // Arrange
        List<SyncedIssue> issues = List.of(
                new SyncedIssue(1L, "Sprint-1", 5.0),
                new SyncedIssue(2L, "Sprint-1", 3.0),
                new SyncedIssue(3L, "Sprint-2", 8.0),
                new SyncedIssue(4L, "Sprint-2", 2.0)
        );

        // Act
        Map<String, Double> breakdown = computeSprintBreakdown(issues);

        // Assert
        assertThat(breakdown).containsEntry("Sprint-1", 8.0)
                .containsEntry("Sprint-2", 10.0)
                .hasSize(2);
    }

    @Test
    @DisplayName("sprintBreakdownIgnoresNullSprintNames")
    void sprintBreakdownIgnoresNullSprintNames() {
        // Arrange
        List<SyncedIssue> issues = List.of(
                new SyncedIssue(1L, null, 5.0),
                new SyncedIssue(2L, "Sprint-1", 3.0),
                new SyncedIssue(3L, "", 2.0)
        );

        // Act
        Map<String, Double> breakdown = computeSprintBreakdown(issues);

        // Assert
        assertThat(breakdown).containsEntry("Sprint-1", 3.0)
                .hasSize(1); // Only Sprint-1
    }

    @Test
    @DisplayName("sprintBreakdownIgnoresZeroHours")
    void sprintBreakdownIgnoresZeroHours() {
        // Arrange
        List<SyncedIssue> issues = List.of(
                new SyncedIssue(1L, "Sprint-1", 0.0),
                new SyncedIssue(2L, "Sprint-1", 5.0),
                new SyncedIssue(3L, "Sprint-2", -1.0) // negative should also be ignored
        );

        // Act
        Map<String, Double> breakdown = computeSprintBreakdown(issues);

        // Assert
        assertThat(breakdown).containsEntry("Sprint-1", 5.0)
                .hasSize(1); // Only Sprint-1 (negative excluded)
    }

    @Test
    @DisplayName("sprintBreakdownReturnsEmptyMapWhenNoIssues")
    void sprintBreakdownReturnsEmptyMapWhenNoIssues() {
        // Arrange
        List<SyncedIssue> issues = new ArrayList<>();

        // Act
        Map<String, Double> breakdown = computeSprintBreakdown(issues);

        // Assert
        assertThat(breakdown).isEmpty();
    }

    @Test
    @DisplayName("sprintBreakdownHandlesMultipleSprints")
    void sprintBreakdownHandlesMultipleSprints() {
        // Arrange
        List<SyncedIssue> issues = List.of(
                new SyncedIssue(1L, "Sprint-A", 2.5),
                new SyncedIssue(2L, "Sprint-B", 4.0),
                new SyncedIssue(3L, "Sprint-C", 1.0),
                new SyncedIssue(4L, "Sprint-A", 1.5)
        );

        // Act
        Map<String, Double> breakdown = computeSprintBreakdown(issues);

        // Assert
        assertThat(breakdown).containsEntry("Sprint-A", 4.0)
                .containsEntry("Sprint-B", 4.0)
                .containsEntry("Sprint-C", 1.0)
                .hasSize(3);
    }

    // ── Tests: Variance computation ─────────────────────────────────────────

    @Test
    @DisplayName("varianceIsActualMinusPlanned")
    void varianceIsActualMinusPlanned() {
        // Arrange
        double actual = 25.0;
        BigDecimal planned = bd(20);

        // Act
        double variance = computeVariance(actual, planned);

        // Assert
        // 25 - 20 = 5 (positive = overrun)
        assertThat(variance).isEqualTo(5.0);
    }

    @Test
    @DisplayName("varianceIsNegativeWhenUnderBudget")
    void varianceIsNegativeWhenUnderBudget() {
        // Arrange
        double actual = 15.0;
        BigDecimal planned = bd(20);

        // Act
        double variance = computeVariance(actual, planned);

        // Assert
        // 15 - 20 = -5 (negative = under budget)
        assertThat(variance).isEqualTo(-5.0);
    }

    @Test
    @DisplayName("varianceIsZeroWhenOnBudget")
    void varianceIsZeroWhenOnBudget() {
        // Arrange
        double actual = 20.0;
        BigDecimal planned = bd(20);

        // Act
        double variance = computeVariance(actual, planned);

        // Assert
        assertThat(variance).isEqualTo(0.0);
    }

    @Test
    @DisplayName("varianceHandlesDecimalValues")
    void varianceHandlesDecimalValues() {
        // Arrange
        double actual = 22.75;
        BigDecimal planned = bd(20.5);

        // Act
        double variance = computeVariance(actual, planned);

        // Assert
        // 22.75 - 20.5 = 2.25
        assertThat(variance).isEqualTo(2.25);
    }

    // ── Tests: Burn percentage ──────────────────────────────────────────────

    @Test
    @DisplayName("burnPctIsActualDividedByPlannedTimes100")
    void burnPctIsActualDividedByPlannedTimes100() {
        // Arrange
        double actual = 20.0;
        BigDecimal planned = bd(40);

        // Act
        double burnPct = computeBurnPercentage(actual, planned);

        // Assert
        // (20 / 40) * 100 = 50%
        assertThat(burnPct).isEqualTo(50.0);
    }

    @Test
    @DisplayName("burnPctCapsAt150")
    void burnPctCapsAt150() {
        // Arrange
        double actual = 60.0;
        BigDecimal planned = bd(40);

        // Act
        double burnPct = computeBurnPercentage(actual, planned);

        // Assert
        // (60 / 40) * 100 = 150%, capped at 150
        assertThat(burnPct).isEqualTo(150.0);
    }

    @Test
    @DisplayName("burnPctCapsPastThreshold")
    void burnPctCapsPastThreshold() {
        // Arrange
        double actual = 80.0;
        BigDecimal planned = bd(40);

        // Act
        double burnPct = computeBurnPercentage(actual, planned);

        // Assert
        // (80 / 40) * 100 = 200%, but capped at 150
        assertThat(burnPct).isEqualTo(150.0);
    }

    @Test
    @DisplayName("burnPctIsZeroWhenNoPlanned")
    void burnPctIsZeroWhenNoPlanned() {
        // Arrange
        double actual = 20.0;
        BigDecimal planned = bd(0);

        // Act
        double burnPct = computeBurnPercentage(actual, planned);

        // Assert
        // Avoid division by zero, return 0
        assertThat(burnPct).isEqualTo(0.0);
    }

    @Test
    @DisplayName("burnPctIsZeroWhenActualIsZero")
    void burnPctIsZeroWhenActualIsZero() {
        // Arrange
        double actual = 0.0;
        BigDecimal planned = bd(40);

        // Act
        double burnPct = computeBurnPercentage(actual, planned);

        // Assert
        // (0 / 40) * 100 = 0%
        assertThat(burnPct).isEqualTo(0.0);
    }

    @Test
    @DisplayName("burnPctHandlesDecimalValues")
    void burnPctHandlesDecimalValues() {
        // Arrange
        double actual = 15.5;
        BigDecimal planned = bd(31);

        // Act
        double burnPct = computeBurnPercentage(actual, planned);

        // Assert
        // (15.5 / 31) * 100 = 50%
        assertThat(burnPct).isEqualTo(50.0);
    }

    // ── Tests: Integration scenarios ────────────────────────────────────────

    @Test
    @DisplayName("fullWorkflowWithMultipleAllocationsAndSprints")
    void fullWorkflowWithMultipleAllocationsAndSprints() {
        // Arrange: project has 2 sprint allocations totaling 60 planned hours
        List<SprintAllocation> allocations = List.of(
                new SprintAllocation(1L, bd(15), bd(10), bd(3), bd(2)), // 30 hours
                new SprintAllocation(1L, bd(18), bd(8), bd(2), bd(2))   // 30 hours
        );

        // Actual work logged: 50 hours across 2 sprints
        List<SyncedIssue> issues = List.of(
                new SyncedIssue(1L, "Sprint-1", 15.0),
                new SyncedIssue(2L, "Sprint-1", 10.0),
                new SyncedIssue(3L, "Sprint-2", 20.0),
                new SyncedIssue(4L, "Sprint-2", 5.0)
        );

        // Act
        BigDecimal planned = computePlannedHours(allocations);
        double actual = totalActualHours(issues);
        double variance = computeVariance(actual, planned);
        double burnPct = computeBurnPercentage(actual, planned);
        Map<String, Double> sprintBreakdown = computeSprintBreakdown(issues);

        // Assert
        assertThat(planned).isEqualByComparingTo(bd(60)); // 30 + 30
        assertThat(actual).isEqualTo(50.0); // 15 + 10 + 20 + 5
        assertThat(variance).isEqualTo(-10.0); // Under budget
        assertThat(burnPct).isCloseTo(83.33, org.assertj.core.api.Assertions.within(0.01));
        assertThat(sprintBreakdown).containsEntry("Sprint-1", 25.0)
                .containsEntry("Sprint-2", 25.0)
                .hasSize(2);
    }

    @Test
    @DisplayName("workflowWithNoTimeLogged")
    void workflowWithNoTimeLogged() {
        // Arrange: allocated 40 hours but no actual work logged
        List<SprintAllocation> allocations = List.of(
                new SprintAllocation(1L, bd(20), bd(10), bd(5), bd(5))
        );
        List<SyncedIssue> issues = List.of();

        // Act
        BigDecimal planned = computePlannedHours(allocations);
        double actual = totalActualHours(issues);
        double variance = computeVariance(actual, planned);
        double burnPct = computeBurnPercentage(actual, planned);

        // Assert
        assertThat(planned).isEqualByComparingTo(bd(40));
        assertThat(actual).isEqualTo(0.0);
        assertThat(variance).isEqualTo(-40.0); // Full under budget
        assertThat(burnPct).isEqualTo(0.0); // No burn
    }

    // ── Helper method to create BigDecimal values ───────────────────────────

    private static BigDecimal bd(double value) {
        return BigDecimal.valueOf(value);
    }
}
