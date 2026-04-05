package com.portfolioplanner.calculation;

import com.portfolioplanner.domain.model.EffortPattern;
import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.ProjectPodPlanning;
import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.service.calculation.DemandCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for DemandCalculator.
 * All tests are pure Java — no Spring context required.
 *
 * The calculator now uses explicit role hours (devHours, qaHours, bsaHours,
 * techLeadHours) with contingencyPct, distributing hours across months
 * using the assigned effort pattern.
 */
class DemandCalculatorTest {

    private DemandCalculator calculator;

    // ── Common fixtures ──────────────────────────────────────────────────────
    private static final Long POD_ID   = 1L;
    private static final Long PROJ_ID  = 10L;
    private static final Long PLAN_ID  = 100L;

    /** Flat pattern: all 12 weights = 1 */
    private static EffortPattern flatPattern() {
        Map<String, BigDecimal> w = new LinkedHashMap<>();
        for (int i = 1; i <= 12; i++) w.put("M" + i, BigDecimal.ONE);
        EffortPattern ep = new EffortPattern();
        ep.setName("Flat");
        ep.setWeights(w);
        return ep;
    }

    /** Ramp-Up pattern: M1=0.5, M2=0.7, M3=0.9, M4=1.1, M5-M12=1 */
    private static EffortPattern rampUpPattern() {
        Map<String, BigDecimal> w = new LinkedHashMap<>();
        w.put("M1", new BigDecimal("0.5"));
        w.put("M2", new BigDecimal("0.7"));
        w.put("M3", new BigDecimal("0.9"));
        w.put("M4", new BigDecimal("1.1"));
        for (int i = 5; i <= 12; i++) w.put("M" + i, BigDecimal.ONE);
        EffortPattern ep = new EffortPattern();
        ep.setName("Ramp Up");
        ep.setWeights(w);
        return ep;
    }

    private static Pod pod(Long id) {
        Pod p = new Pod();
        p.setId(id);
        p.setName("Test POD");
        p.setComplexityMultiplier(BigDecimal.ONE);
        return p;
    }

    private static Project activeProject(Long id, int start, int duration, String pattern) {
        Project p = new Project();
        p.setId(id);
        p.setName("Test Project");
        p.setPriority(Priority.P1);
        p.setStatus("ACTIVE");
        p.setStartMonth(start);
        p.setDurationMonths(duration);
        p.setDefaultPattern(pattern);
        return p;
    }

    private static ProjectPodPlanning planning(Long id, Project project, Pod pod,
                                               BigDecimal devHours, BigDecimal qaHours,
                                               BigDecimal bsaHours, BigDecimal techLeadHours,
                                               BigDecimal contingencyPct,
                                               String patternOverride,
                                               Integer podStart, Integer duration) {
        ProjectPodPlanning pp = new ProjectPodPlanning();
        pp.setId(id);
        pp.setProject(project);
        pp.setPod(pod);
        pp.setDevHours(devHours);
        pp.setQaHours(qaHours);
        pp.setBsaHours(bsaHours);
        pp.setTechLeadHours(techLeadHours);
        pp.setContingencyPct(contingencyPct != null ? contingencyPct : BigDecimal.ZERO);
        pp.setEffortPattern(patternOverride);
        pp.setPodStartMonth(podStart);
        pp.setDurationOverride(duration);
        return pp;
    }

    @BeforeEach
    void setUp() {
        calculator = new DemandCalculator();
    }

    // ── 1. Flat pattern, 3-month project ────────────────────────────────────
    @Nested
    @DisplayName("Flat pattern")
    class FlatPatternTests {

        @Test
        @DisplayName("Dev demand = 600 hours spread evenly across 3 months = 200/month")
        void devDemandFlatThreeMonths() {
            Pod pod = pod(POD_ID);
            Project project = activeProject(PROJ_ID, 1, 3, "Flat");
            // 600 dev hours, no contingency
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod,
                    new BigDecimal("600"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project)
            );

            var devByMonth = result.get(POD_ID).get(Role.DEVELOPER);
            assertThat(devByMonth.get(1)).isEqualByComparingTo("200.00");
            assertThat(devByMonth.get(2)).isEqualByComparingTo("200.00");
            assertThat(devByMonth.get(3)).isEqualByComparingTo("200.00");
            assertThat(devByMonth.get(4)).isNull(); // beyond project duration
        }

        @Test
        @DisplayName("QA demand = 200 hours / 3 months ≈ 66.67/month")
        void qaDemandFlatThreeMonths() {
            Pod pod = pod(POD_ID);
            Project project = activeProject(PROJ_ID, 1, 3, "Flat");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod,
                    BigDecimal.ZERO, new BigDecimal("200"), BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project)
            );

            BigDecimal qa1 = result.get(POD_ID).get(Role.QA).get(1);
            BigDecimal qa2 = result.get(POD_ID).get(Role.QA).get(2);
            BigDecimal qa3 = result.get(POD_ID).get(Role.QA).get(3);
            assertThat(qa1.add(qa2).add(qa3)).isEqualByComparingTo("200.00");
        }

        @Test
        @DisplayName("All 4 roles demand sums to total hours")
        void totalDemandEqualsAllRoleHours() {
            Pod pod = pod(POD_ID);
            Project project = activeProject(PROJ_ID, 1, 6, "Flat");
            // 1800 dev + 600 qa + 300 bsa + 300 tl = 3000 total
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod,
                    new BigDecimal("1800"), new BigDecimal("600"),
                    new BigDecimal("300"), new BigDecimal("300"),
                    BigDecimal.ZERO, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project)
            );

            BigDecimal total = BigDecimal.ZERO;
            for (Role role : Role.values()) {
                var byMonth = result.getOrDefault(POD_ID, Map.of())
                                    .getOrDefault(role, Map.of());
                for (var v : byMonth.values()) total = total.add(v);
            }
            assertThat(total).isEqualByComparingTo("3000.00");
        }
    }

    // ── 2. Contingency ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Contingency percentage")
    class ContingencyTests {

        @Test
        @DisplayName("10% contingency increases total demand by 10%")
        void contingencyIncreasesHours() {
            Pod pod = pod(POD_ID);
            Project project = activeProject(PROJ_ID, 1, 1, "Flat");
            // 1000 dev hours with 10% contingency = 1100
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod,
                    new BigDecimal("1000"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    new BigDecimal("10"), null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project)
            );

            assertThat(result.get(POD_ID).get(Role.DEVELOPER).get(1))
                .isEqualByComparingTo("1100.00");
        }
    }

    // ── 3. Effort pattern shapes ─────────────────────────────────────────────
    @Nested
    @DisplayName("Effort pattern shapes")
    class PatternShapeTests {

        @Test
        @DisplayName("Ramp-Up: M1 gets less demand than M4")
        void rampUpPatternFrontLoadsLess() {
            Pod pod = pod(POD_ID);
            Project project = activeProject(PROJ_ID, 1, 4, "Ramp Up");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod,
                    new BigDecimal("1000"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Ramp Up", rampUpPattern()),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project)
            );

            BigDecimal m1 = result.get(POD_ID).get(Role.DEVELOPER).get(1);
            BigDecimal m4 = result.get(POD_ID).get(Role.DEVELOPER).get(4);
            assertThat(m1).isLessThan(m4);
        }

        @Test
        @DisplayName("Ramp-Up over 4 months: total Dev demand is conserved")
        void rampUpTotalDemandIsConserved() {
            Pod pod = pod(POD_ID);
            Project project = activeProject(PROJ_ID, 1, 4, "Ramp Up");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod,
                    new BigDecimal("3000"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Ramp Up", rampUpPattern()),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project)
            );

            var byMonth = result.get(POD_ID).get(Role.DEVELOPER);
            BigDecimal total = byMonth.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            assertThat(total).isEqualByComparingTo("3000.00");
        }

        @Test
        @DisplayName("POD start month offset shifts demand window")
        void podStartMonthOffsetsDemandWindow() {
            Pod pod = pod(POD_ID);
            Project project = activeProject(PROJ_ID, 1, 6, "Flat");
            // POD starts M3 for 2 months, 1000 dev hours
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod,
                    new BigDecimal("1000"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, null, 3, 2);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project)
            );

            var devByMonth = result.get(POD_ID).get(Role.DEVELOPER);
            assertThat(devByMonth.get(1)).isNull();
            assertThat(devByMonth.get(2)).isNull();
            assertThat(devByMonth.get(3)).isEqualByComparingTo("500.00");
            assertThat(devByMonth.get(4)).isEqualByComparingTo("500.00");
            assertThat(devByMonth.get(5)).isNull();
        }
    }

    // ── 4. Edge cases ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Edge cases and defensive behaviour")
    class EdgeCaseTests {

        @Test
        @DisplayName("CANCELLED project produces zero demand")
        void cancelledProjectProducesZeroDemand() {
            Pod pod = pod(POD_ID);
            Project project = activeProject(PROJ_ID, 1, 6, "Flat");
            project.setStatus("CANCELLED");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod,
                    new BigDecimal("1000"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project)
            );

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("Unknown pattern name produces zero demand (and does not throw)")
        void unknownPatternProducesZeroDemand() {
            Pod pod = pod(POD_ID);
            Project project = activeProject(PROJ_ID, 1, 3, "NonExistent");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod,
                    new BigDecimal("1000"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()), // "NonExistent" not in map
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project)
            );

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("Zero hours for all roles produces zero demand")
        void zeroHoursProducesZeroDemand() {
            Pod pod = pod(POD_ID);
            Project project = activeProject(PROJ_ID, 1, 3, "Flat");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod,
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project)
            );

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("Multiple plannings for same pod accumulate demand")
        void multiplePlanningsAccumulateDemand() {
            Pod pod = pod(POD_ID);
            Project p1 = activeProject(1L, 1, 1, "Flat");
            Project p2 = activeProject(2L, 1, 1, "Flat");
            ProjectPodPlanning pp1 = planning(1L, p1, pod,
                    new BigDecimal("1000"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, null, null, null);
            ProjectPodPlanning pp2 = planning(2L, p2, pod,
                    new BigDecimal("1000"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, null, null, null);

            var result = calculator.calculate(
                List.of(pp1, pp2),
                Map.of("Flat", flatPattern()),
                Map.of(POD_ID, pod),
                Map.of(1L, p1, 2L, p2)
            );

            // Both 1000 dev hours in M1 = 2000 total
            assertThat(result.get(POD_ID).get(Role.DEVELOPER).get(1))
                .isEqualByComparingTo("2000.00");
        }
    }
}
