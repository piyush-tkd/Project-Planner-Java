package com.portfolioplanner.calculation;

import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.service.calculation.HiringForecastCalculator;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot.PodRoleMonthHire;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for HiringForecastCalculator.
 * Pure Java — no Spring context required.
 */
class HiringForecastCalculatorTest {

    private HiringForecastCalculator calculator;

    /** Standard 160h/month working hours across all 12 months */
    private static final Map<Integer, BigDecimal> FLAT_HOURS =
        java.util.stream.IntStream.rangeClosed(1, 12)
            .boxed()
            .collect(java.util.stream.Collectors.toMap(m -> m, m -> BigDecimal.valueOf(160)));

    @BeforeEach
    void setUp() {
        calculator = new HiringForecastCalculator();
    }

    // ── 1. Balanced — no hiring needed ──────────────────────────────────────
    @Nested
    @DisplayName("No hiring needed")
    class BalancedTests {

        @Test
        @DisplayName("When capacity ≥ demand every month, no hires recommended")
        void noHiresWhenCapacityCoversAll() {
            // 1 pod, 1 role, capacity > demand every month
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand = Map.of(
                1L, Map.of(Role.DEVELOPER, monthMap(300))   // 300h/month
            );
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacity = Map.of(
                1L, Map.of(Role.DEVELOPER, monthMap(400))   // 400h/month
            );

            List<PodRoleMonthHire> hires = calculator.calculate(demand, capacity, Map.of(), FLAT_HOURS);
            assertThat(hires).isEmpty();
        }

        @Test
        @DisplayName("Exactly balanced produces no hires")
        void exactBalanceProducesNoHires() {
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand = Map.of(
                1L, Map.of(Role.DEVELOPER, monthMap(160))
            );
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacity = Map.of(
                1L, Map.of(Role.DEVELOPER, monthMap(160))
            );

            assertThat(calculator.calculate(demand, capacity, Map.of(), FLAT_HOURS)).isEmpty();
        }
    }

    // ── 2. Simple deficit in one month ───────────────────────────────────────
    @Nested
    @DisplayName("Single month deficit")
    class SingleMonthDeficitTests {

        @Test
        @DisplayName("160h gap → exactly 1.0 FTE recommended")
        void oneHundredSixtyHourGapIsOneFte() {
            // M1: capacity 0, demand 160h → gap = 160h / 160h = 1.0 FTE
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand = Map.of(
                1L, Map.of(Role.DEVELOPER, Map.of(1, BigDecimal.valueOf(160)))
            );
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacity = Map.of();

            List<PodRoleMonthHire> hires = calculator.calculate(demand, capacity, Map.of(), FLAT_HOURS);

            assertThat(hires).hasSize(1);
            PodRoleMonthHire hire = hires.get(0);
            assertThat(hire.role()).isEqualTo(Role.DEVELOPER);
            assertThat(hire.monthIndex()).isEqualTo(1);
            assertThat(hire.ftesNeeded()).isEqualByComparingTo("1.00");
            assertThat(hire.podName()).isEqualTo("Org-Wide");
        }

        @Test
        @DisplayName("80h gap → 0.50 FTE recommended")
        void eightyHourGapIsHalfFte() {
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand = Map.of(
                1L, Map.of(Role.DEVELOPER, Map.of(1, BigDecimal.valueOf(80)))
            );
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacity = Map.of();

            var hires = calculator.calculate(demand, capacity, Map.of(), FLAT_HOURS);
            assertThat(hires).hasSize(1);
            assertThat(hires.get(0).ftesNeeded()).isEqualByComparingTo("0.50");
        }
    }

    // ── 3. Cumulative incremental logic ──────────────────────────────────────
    @Nested
    @DisplayName("Cumulative incremental logic")
    class CumulativeTests {

        @Test
        @DisplayName("Same 160h gap repeated every month → hire only in M1, not again in M2–M12")
        void persistentGapOnlyHiresOnce() {
            // 160h demand every month, 0 capacity → 1 FTE needed, but once hired it covers all future months
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand = Map.of(
                1L, Map.of(Role.DEVELOPER, monthMap(160))
            );
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacity = Map.of();

            var hires = calculator.calculate(demand, capacity, Map.of(), FLAT_HOURS);

            // Only M1 should result in a hire; M2-M12 are covered by the cumulative committed FTE
            assertThat(hires).hasSize(1);
            assertThat(hires.get(0).monthIndex()).isEqualTo(1);
            assertThat(hires.get(0).ftesNeeded()).isEqualByComparingTo("1.00");
        }

        @Test
        @DisplayName("Growing gap: M1 needs 1 FTE, M3 needs 2 FTE total → only 1 incremental FTE added in M3")
        void growingGapProducesIncrementalHires() {
            // M1: 160h gap → 1 FTE; M3: 320h gap → 2 FTE total, but 1 FTE already committed → 1 more
            Map<Integer, BigDecimal> demandByMonth = Map.of(
                1, BigDecimal.valueOf(160),
                2, BigDecimal.valueOf(160),
                3, BigDecimal.valueOf(320),
                4, BigDecimal.valueOf(320)
            );
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand = Map.of(
                1L, Map.of(Role.DEVELOPER, demandByMonth)
            );
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacity = Map.of();

            var hires = calculator.calculate(demand, capacity, Map.of(), FLAT_HOURS);

            assertThat(hires).hasSize(2);
            PodRoleMonthHire first  = hires.stream().filter(h -> h.monthIndex() == 1).findFirst().orElseThrow();
            PodRoleMonthHire second = hires.stream().filter(h -> h.monthIndex() == 3).findFirst().orElseThrow();

            assertThat(first.ftesNeeded()).isEqualByComparingTo("1.00");
            assertThat(second.ftesNeeded()).isEqualByComparingTo("1.00"); // incremental only
        }

        @Test
        @DisplayName("M4 gap covered by earlier cumulative hiring → no hire in M4")
        void earlierHiringAbsorbsLaterGap() {
            // M1: 320h gap → 2 FTE; M4: 160h gap → 1 FTE, but 2 already committed → no new hire
            Map<Integer, BigDecimal> demandByMonth = Map.of(
                1, BigDecimal.valueOf(320),
                4, BigDecimal.valueOf(160)
            );
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand = Map.of(
                1L, Map.of(Role.DEVELOPER, demandByMonth)
            );
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacity = Map.of();

            var hires = calculator.calculate(demand, capacity, Map.of(), FLAT_HOURS);

            assertThat(hires).hasSize(1); // only M1
            assertThat(hires.get(0).monthIndex()).isEqualTo(1);
        }
    }

    // ── 4. Org-wide aggregation (pod surplus offsets deficit) ────────────────
    @Nested
    @DisplayName("Org-wide aggregation")
    class OrgWideAggregationTests {

        @Test
        @DisplayName("Pod A surplus offsets Pod B deficit → no hire needed org-wide")
        void surplusInOnePodOffsetsByDeficitInAnother() {
            // Pod 1: 200h demand, 400h capacity (+200h surplus)
            // Pod 2: 400h demand, 200h capacity (-200h deficit)
            // Org-wide: balanced → no hire
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand = Map.of(
                1L, Map.of(Role.DEVELOPER, Map.of(1, BigDecimal.valueOf(200))),
                2L, Map.of(Role.DEVELOPER, Map.of(1, BigDecimal.valueOf(400)))
            );
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacity = Map.of(
                1L, Map.of(Role.DEVELOPER, Map.of(1, BigDecimal.valueOf(400))),
                2L, Map.of(Role.DEVELOPER, Map.of(1, BigDecimal.valueOf(200)))
            );

            var hires = calculator.calculate(demand, capacity, Map.of(), FLAT_HOURS);
            assertThat(hires).isEmpty();
        }

        @Test
        @DisplayName("Net org-wide deficit of 240h across 2 pods → 1.5 FTE recommended")
        void partialSurplusLeadsToNetHire() {
            // Pod 1: 160h demand, 0 capacity
            // Pod 2: 80h demand, 0 capacity
            // Org net gap = 240h → 1.5 FTE
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand = Map.of(
                1L, Map.of(Role.QA, Map.of(1, BigDecimal.valueOf(160))),
                2L, Map.of(Role.QA, Map.of(1, BigDecimal.valueOf(80)))
            );
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacity = Map.of();

            var hires = calculator.calculate(demand, capacity, Map.of(), FLAT_HOURS);

            assertThat(hires).hasSize(1);
            assertThat(hires.get(0).role()).isEqualTo(Role.QA);
            assertThat(hires.get(0).ftesNeeded()).isEqualByComparingTo("1.50");
        }

        @Test
        @DisplayName("Hires are always labelled 'Org-Wide' with null podId")
        void hiresAreAlwaysOrgWide() {
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand = Map.of(
                1L, Map.of(Role.BSA, Map.of(1, BigDecimal.valueOf(160)))
            );

            var hires = calculator.calculate(demand, Map.of(), Map.of(), FLAT_HOURS);
            assertThat(hires.get(0).podId()).isNull();
            assertThat(hires.get(0).podName()).isEqualTo("Org-Wide");
        }
    }

    // ── 5. Edge cases ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Edge cases")
    class EdgeCaseTests {

        @Test
        @DisplayName("Empty demand and capacity produces no hires")
        void emptyInputsProduceNoHires() {
            var hires = calculator.calculate(Map.of(), Map.of(), Map.of(), FLAT_HOURS);
            assertThat(hires).isEmpty();
        }

        @Test
        @DisplayName("All four roles can each have independent hire recommendations")
        void allFourRolesGenerateIndependentHires() {
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand = Map.of(
                1L, Map.of(
                    Role.DEVELOPER, Map.of(1, BigDecimal.valueOf(160)),
                    Role.QA,        Map.of(1, BigDecimal.valueOf(160)),
                    Role.BSA,       Map.of(1, BigDecimal.valueOf(160)),
                    Role.TECH_LEAD, Map.of(1, BigDecimal.valueOf(160))
                )
            );

            var hires = calculator.calculate(demand, Map.of(), Map.of(), FLAT_HOURS);
            assertThat(hires).hasSize(4);
            assertThat(hires.stream().map(PodRoleMonthHire::role))
                .containsExactlyInAnyOrder(Role.DEVELOPER, Role.QA, Role.BSA, Role.TECH_LEAD);
        }
    }

    // ── Helper ───────────────────────────────────────────────────────────────
    /** Build a constant-value map for all 12 months */
    private static Map<Integer, BigDecimal> monthMap(long hoursPerMonth) {
        return java.util.stream.IntStream.rangeClosed(1, 12)
            .boxed()
            .collect(java.util.stream.Collectors.toMap(m -> m, m -> BigDecimal.valueOf(hoursPerMonth)));
    }
}
