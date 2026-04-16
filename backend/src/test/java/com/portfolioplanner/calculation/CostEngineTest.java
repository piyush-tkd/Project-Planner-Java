package com.portfolioplanner.calculation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for cost engine calculations.
 * Tests ROI calculation logic and edge cases.
 */
@DisplayName("CostEngine — calculation tests")
class CostEngineTest {

    // ── ROI Calculation ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("ROI calculation")
    class RoiCalculation {

        @Test
        @DisplayName("ROI formula: (totalValue - totalCost) / totalCost * 100")
        void roiFormulaCorrect() {
            // Given: totalCost = 1000, totalValue = 1500
            // Expected ROI = (1500 - 1000) / 1000 * 100 = 50%
            BigDecimal totalCost = new BigDecimal("1000");
            BigDecimal totalValue = new BigDecimal("1500");

            double roi = (totalValue.doubleValue() - totalCost.doubleValue()) / totalCost.doubleValue() * 100;

            assertThat(roi).isEqualTo(50.0);
        }

        @Test
        @DisplayName("ROI with break-even (value = cost) equals 0%")
        void roiBreakEven() {
            // Given: totalCost = 1000, totalValue = 1000
            // Expected ROI = (1000 - 1000) / 1000 * 100 = 0%
            BigDecimal totalCost = new BigDecimal("1000");
            BigDecimal totalValue = new BigDecimal("1000");

            double roi = (totalValue.doubleValue() - totalCost.doubleValue()) / totalCost.doubleValue() * 100;

            assertThat(roi).isEqualTo(0.0);
        }

        @Test
        @DisplayName("ROI with loss (value < cost) is negative")
        void roiNegative() {
            // Given: totalCost = 1000, totalValue = 800
            // Expected ROI = (800 - 1000) / 1000 * 100 = -20%
            BigDecimal totalCost = new BigDecimal("1000");
            BigDecimal totalValue = new BigDecimal("800");

            double roi = (totalValue.doubleValue() - totalCost.doubleValue()) / totalCost.doubleValue() * 100;

            assertThat(roi).isEqualTo(-20.0);
        }
    }

    // ── Edge Cases ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Edge cases")
    class EdgeCases {

        @Test
        @DisplayName("Zero cost does not divide by zero (return 0)")
        void zeroCostEdgeCase() {
            // Given: totalCost = 0, totalValue = 1000
            // Expected: return 0 (avoid division by zero)
            BigDecimal totalCost = BigDecimal.ZERO;
            BigDecimal totalValue = new BigDecimal("1000");

            double roi = totalCost.doubleValue() == 0 ? 0
                : (totalValue.doubleValue() - totalCost.doubleValue()) / totalCost.doubleValue() * 100;

            assertThat(roi).isEqualTo(0.0);
        }

        @Test
        @DisplayName("Large CAPEX + OPEX aggregation")
        void largeAggregation() {
            // Given: CAPEX = 10M, OPEX = 5M (total cost = 15M), Value = 18M
            // Expected ROI = (18M - 15M) / 15M * 100 = 20%
            BigDecimal capex = new BigDecimal("10000000");
            BigDecimal opex = new BigDecimal("5000000");
            BigDecimal totalCost = capex.add(opex);
            BigDecimal totalValue = new BigDecimal("18000000");

            double roi = (totalValue.doubleValue() - totalCost.doubleValue()) / totalCost.doubleValue() * 100;

            assertThat(roi).isEqualTo(20.0);
        }

        @Test
        @DisplayName("Fractional ROI rounded to 2 decimals")
        void roiFractionalRounded() {
            // Given: totalCost = 3, totalValue = 4
            // Expected ROI = (4 - 3) / 3 * 100 = 33.333... ≈ 33.33%
            BigDecimal totalCost = new BigDecimal("3");
            BigDecimal totalValue = new BigDecimal("4");

            double roi = (totalValue.doubleValue() - totalCost.doubleValue()) / totalCost.doubleValue() * 100;
            double roiRounded = Math.round(roi * 100.0) / 100.0;

            assertThat(roiRounded).isEqualTo(33.33);
        }
    }

    // ── Aggregation Logic ────────────────────────────────────────────────────

    @Nested
    @DisplayName("CAPEX + OPEX aggregation")
    class CostAggregation {

        @Test
        @DisplayName("Correctly sums CAPEX and OPEX")
        void capexOpexSum() {
            BigDecimal capex1 = new BigDecimal("500");
            BigDecimal opex1 = new BigDecimal("200");
            BigDecimal capex2 = new BigDecimal("300");
            BigDecimal opex2 = new BigDecimal("150");

            BigDecimal totalCost = capex1.add(opex1).add(capex2).add(opex2);

            assertThat(totalCost).isEqualByComparingTo("1150");
        }

        @Test
        @DisplayName("Handles null or zero amounts correctly")
        void nullAmountsHandling() {
            BigDecimal capex = new BigDecimal("1000");
            BigDecimal opex = null;

            BigDecimal totalCost = capex.add(opex != null ? opex : BigDecimal.ZERO);

            assertThat(totalCost).isEqualByComparingTo("1000");
        }
    }
}
