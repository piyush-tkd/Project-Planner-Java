package com.portfolioplanner.calculation;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.service.calculation.CapacityCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for CapacityCalculator.
 * Pure Java — no Spring context required.
 */
class CapacityCalculatorTest {

    private CapacityCalculator calculator;

    // ── Fixture builders ─────────────────────────────────────────────────────
    private static final Long HOME_POD_ID = 1L;
    private static final Long DEST_POD_ID = 2L;

    private static Resource resource(Long id, Role role, boolean active) {
        Resource r = new Resource();
        r.setId(id);
        r.setName("Test Resource " + id);
        r.setRole(role);
        r.setLocation(Location.US);
        r.setActive(active);
        r.setCountsInCapacity(true);
        return r;
    }

    private static Pod pod(Long id) {
        Pod p = new Pod();
        p.setId(id);
        p.setName("POD " + id);
        return p;
    }

    private static ResourcePodAssignment assignment(Resource resource, Pod pod, BigDecimal fte) {
        ResourcePodAssignment a = new ResourcePodAssignment();
        a.setResource(resource);
        a.setPod(pod);
        a.setCapacityFte(fte);
        return a;
    }

    private static ResourceAvailability avail(Resource resource, int month, BigDecimal hours) {
        ResourceAvailability ra = new ResourceAvailability();
        ra.setResource(resource);
        ra.setMonthIndex(month);
        ra.setHours(hours);
        return ra;
    }

    /** Build a 12-month availability list with constant hours for one resource */
    private static List<ResourceAvailability> constAvail(Resource resource, int hoursPerMonth) {
        return java.util.stream.IntStream.rangeClosed(1, 12)
            .mapToObj(m -> avail(resource, m, BigDecimal.valueOf(hoursPerMonth)))
            .toList();
    }

    private static TemporaryOverride override(Resource resource, Pod toPod,
                                               int startM, int endM, BigDecimal pct) {
        TemporaryOverride ov = new TemporaryOverride();
        ov.setResource(resource);
        ov.setToPod(toPod);
        ov.setStartMonth(startM);
        ov.setEndMonth(endM);
        ov.setAllocationPct(pct);
        return ov;
    }

    @BeforeEach
    void setUp() {
        calculator = new CapacityCalculator();
    }

    // ── 1. Basic capacity ────────────────────────────────────────────────────
    @Nested
    @DisplayName("Basic capacity calculation")
    class BasicCapacityTests {

        @Test
        @DisplayName("Full FTE, 20% BAU: capacity = 176 × 1.0 × 0.80 = 140.80 per month")
        void basicCapacityWithBau() {
            Resource res = resource(1L, Role.DEVELOPER, true);
            Pod homePod = pod(HOME_POD_ID);
            ResourcePodAssignment asgn = assignment(res, homePod, BigDecimal.ONE);

            Map<Long, Map<Role, BigDecimal>> bau = Map.of(
                HOME_POD_ID, Map.of(Role.DEVELOPER, BigDecimal.valueOf(20))
            );

            var result = calculator.calculate(
                List.of(res),
                Map.of(1L, asgn),
                constAvail(res, 176),
                List.of(),
                bau
            );

            BigDecimal cap = result.get(HOME_POD_ID).get(Role.DEVELOPER).get(1);
            assertThat(cap).isEqualByComparingTo("140.80");
        }

        @Test
        @DisplayName("0% BAU: full 176h available for project work")
        void zeroBauFullCapacity() {
            Resource res = resource(1L, Role.DEVELOPER, true);
            Pod homePod = pod(HOME_POD_ID);
            ResourcePodAssignment asgn = assignment(res, homePod, BigDecimal.ONE);

            Map<Long, Map<Role, BigDecimal>> bau = Map.of(
                HOME_POD_ID, Map.of(Role.DEVELOPER, BigDecimal.ZERO)
            );

            var result = calculator.calculate(
                List.of(res),
                Map.of(1L, asgn),
                constAvail(res, 176),
                List.of(),
                bau
            );

            assertThat(result.get(HOME_POD_ID).get(Role.DEVELOPER).get(1))
                .isEqualByComparingTo("176.00");
        }

        @Test
        @DisplayName("0.5 FTE, 20% BAU: capacity = 176 × 0.5 × 0.80 = 70.40")
        void halfFteCapacity() {
            Resource res = resource(1L, Role.QA, true);
            Pod homePod = pod(HOME_POD_ID);
            ResourcePodAssignment asgn = assignment(res, homePod, new BigDecimal("0.5"));

            Map<Long, Map<Role, BigDecimal>> bau = Map.of(
                HOME_POD_ID, Map.of(Role.QA, BigDecimal.valueOf(20))
            );

            var result = calculator.calculate(
                List.of(res),
                Map.of(1L, asgn),
                constAvail(res, 176),
                List.of(),
                bau
            );

            assertThat(result.get(HOME_POD_ID).get(Role.QA).get(1))
                .isEqualByComparingTo("70.40");
        }

        @Test
        @DisplayName("Inactive resource contributes zero capacity")
        void inactiveResourceContributesZero() {
            Resource res = resource(1L, Role.DEVELOPER, false); // inactive
            Pod homePod = pod(HOME_POD_ID);
            ResourcePodAssignment asgn = assignment(res, homePod, BigDecimal.ONE);

            var result = calculator.calculate(
                List.of(res),
                Map.of(1L, asgn),
                constAvail(res, 176),
                List.of(),
                Map.of()
            );

            assertThat(result).doesNotContainKey(HOME_POD_ID);
        }

        @Test
        @DisplayName("Resource with zero availability month is skipped")
        void zeroAvailabilityMonthSkipped() {
            Resource res = resource(1L, Role.DEVELOPER, true);
            Pod homePod = pod(HOME_POD_ID);
            ResourcePodAssignment asgn = assignment(res, homePod, BigDecimal.ONE);

            // M1 = 0h (absent), M2 = 176h
            List<ResourceAvailability> avails = List.of(
                avail(res, 1, BigDecimal.ZERO),
                avail(res, 2, BigDecimal.valueOf(176))
            );

            var result = calculator.calculate(
                List.of(res), Map.of(1L, asgn), avails, List.of(),
                Map.of(HOME_POD_ID, Map.of(Role.DEVELOPER, BigDecimal.valueOf(20)))
            );

            assertThat(result.get(HOME_POD_ID).get(Role.DEVELOPER)).doesNotContainKey(1);
            assertThat(result.get(HOME_POD_ID).get(Role.DEVELOPER).get(2))
                .isEqualByComparingTo("140.80");
        }

        @Test
        @DisplayName("Default 20% BAU used when pod has no explicit BAU row")
        void defaultBauAppliedWhenMissing() {
            Resource res = resource(1L, Role.DEVELOPER, true);
            Pod homePod = pod(HOME_POD_ID);
            ResourcePodAssignment asgn = assignment(res, homePod, BigDecimal.ONE);

            // Empty BAU map — should default to 20%
            var result = calculator.calculate(
                List.of(res), Map.of(1L, asgn), constAvail(res, 176), List.of(), Map.of()
            );

            // 176 × 1.0 × (1 - 0.20) = 140.80
            assertThat(result.get(HOME_POD_ID).get(Role.DEVELOPER).get(1))
                .isEqualByComparingTo("140.80");
        }
    }

    // ── 2. POD Splits (Temporary Overrides) ─────────────────────────────────
    @Nested
    @DisplayName("POD splits / temporary overrides")
    class PodSplitTests {

        @Test
        @DisplayName("50% permanent split: home gets 50%, destination gets 50% (each BAU-adjusted)")
        void fiftyFiftySplitAllocatesCorrectly() {
            Resource res = resource(1L, Role.DEVELOPER, true);
            Pod homePod = pod(HOME_POD_ID);
            Pod destPod = pod(DEST_POD_ID);
            ResourcePodAssignment asgn = assignment(res, homePod, BigDecimal.ONE);

            // Both pods: 20% BAU
            Map<Long, Map<Role, BigDecimal>> bau = Map.of(
                HOME_POD_ID, Map.of(Role.DEVELOPER, BigDecimal.valueOf(20)),
                DEST_POD_ID, Map.of(Role.DEVELOPER, BigDecimal.valueOf(20))
            );

            TemporaryOverride split = override(res, destPod, 1, 12, BigDecimal.valueOf(50));

            var result = calculator.calculate(
                List.of(res),
                Map.of(1L, asgn),
                constAvail(res, 176),
                List.of(split),
                bau
            );

            // Base = 176 × 1.0 = 176h
            // Home full = 176 × 0.80 = 140.80
            // Loan raw = 176 × 0.50 = 88h
            // Home deduction = 88 × 0.80 = 70.40
            // Home net = 140.80 - 70.40 = 70.40
            // Dest credit = 88 × 0.80 = 70.40
            BigDecimal homeM1 = result.get(HOME_POD_ID).get(Role.DEVELOPER).get(1);
            BigDecimal destM1 = result.get(DEST_POD_ID).get(Role.DEVELOPER).get(1);

            assertThat(homeM1).isEqualByComparingTo("70.40");
            assertThat(destM1).isEqualByComparingTo("70.40");
        }

        @Test
        @DisplayName("Temporary split only applies during its active months")
        void temporarySplitAppliesOnlyInWindow() {
            Resource res = resource(1L, Role.DEVELOPER, true);
            Pod homePod = pod(HOME_POD_ID);
            Pod destPod = pod(DEST_POD_ID);
            ResourcePodAssignment asgn = assignment(res, homePod, BigDecimal.ONE);

            Map<Long, Map<Role, BigDecimal>> bau = Map.of(
                HOME_POD_ID, Map.of(Role.DEVELOPER, BigDecimal.ZERO),
                DEST_POD_ID, Map.of(Role.DEVELOPER, BigDecimal.ZERO)
            );

            // Override only active M3-M4
            TemporaryOverride split = override(res, destPod, 3, 4, BigDecimal.valueOf(40));

            var result = calculator.calculate(
                List.of(res), Map.of(1L, asgn), constAvail(res, 176), List.of(split), bau
            );

            // M1: no split — all 176 stays home
            assertThat(result.get(HOME_POD_ID).get(Role.DEVELOPER).get(1))
                .isEqualByComparingTo("176.00");
            assertThat(result.containsKey(DEST_POD_ID) &&
                result.get(DEST_POD_ID).containsKey(Role.DEVELOPER) &&
                result.get(DEST_POD_ID).get(Role.DEVELOPER).containsKey(1)).isFalse();

            // M3: split active — 40% goes to dest
            BigDecimal destM3 = result.get(DEST_POD_ID).get(Role.DEVELOPER).get(3);
            assertThat(destM3).isEqualByComparingTo("70.40"); // 176 × 0.4 = 70.40 (0% BAU)
        }

        @Test
        @DisplayName("Split with different BAU rates between pods")
        void splitWithDifferentBauRates() {
            Resource res = resource(1L, Role.BSA, true);
            Pod homePod = pod(HOME_POD_ID);
            Pod destPod = pod(DEST_POD_ID);
            ResourcePodAssignment asgn = assignment(res, homePod, BigDecimal.ONE);

            Map<Long, Map<Role, BigDecimal>> bau = Map.of(
                HOME_POD_ID, Map.of(Role.BSA, BigDecimal.valueOf(15)),   // 15% BAU home
                DEST_POD_ID, Map.of(Role.BSA, BigDecimal.valueOf(25))    // 25% BAU dest
            );

            TemporaryOverride split = override(res, destPod, 1, 1, BigDecimal.valueOf(50));

            var result = calculator.calculate(
                List.of(res), Map.of(1L, asgn), constAvail(res, 176), List.of(split), bau
            );

            // Home full without split = 176 × 0.85 = 149.60
            // Loan raw = 176 × 0.50 = 88
            // Home deduction = 88 × 0.85 = 74.80
            // Home net = 149.60 - 74.80 = 74.80
            // Dest credit = 88 × 0.75 = 66.00
            assertThat(result.get(HOME_POD_ID).get(Role.BSA).get(1)).isEqualByComparingTo("74.80");
            assertThat(result.get(DEST_POD_ID).get(Role.BSA).get(1)).isEqualByComparingTo("66.00");
        }
    }

    // ── 3. Multiple resources ────────────────────────────────────────────────
    @Nested
    @DisplayName("Multiple resources")
    class MultiResourceTests {

        @Test
        @DisplayName("Two resources in same pod, same role, accumulate capacity")
        void twoResourcesAccumulateCapacity() {
            Resource r1 = resource(1L, Role.DEVELOPER, true);
            Resource r2 = resource(2L, Role.DEVELOPER, true);
            Pod homePod = pod(HOME_POD_ID);

            Map<Long, Map<Role, BigDecimal>> bau = Map.of(
                HOME_POD_ID, Map.of(Role.DEVELOPER, BigDecimal.ZERO)
            );

            var avails = new java.util.ArrayList<>(constAvail(r1, 176));
            avails.addAll(constAvail(r2, 160));

            var result = calculator.calculate(
                List.of(r1, r2),
                Map.of(1L, assignment(r1, homePod, BigDecimal.ONE),
                       2L, assignment(r2, homePod, BigDecimal.ONE)),
                avails,
                List.of(),
                bau
            );

            // M1: 176 + 160 = 336
            assertThat(result.get(HOME_POD_ID).get(Role.DEVELOPER).get(1))
                .isEqualByComparingTo("336.00");
        }
    }
}
