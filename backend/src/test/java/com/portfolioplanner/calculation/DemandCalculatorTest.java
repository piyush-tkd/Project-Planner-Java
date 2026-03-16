package com.portfolioplanner.calculation;

import com.portfolioplanner.domain.model.EffortPattern;
import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.ProjectPodPlanning;
import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.domain.model.enums.ProjectStatus;
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
 */
class DemandCalculatorTest {

    private DemandCalculator calculator;

    // ── Common fixtures ──────────────────────────────────────────────────────
    private static final Long POD_ID   = 1L;
    private static final Long PROJ_ID  = 10L;
    private static final Long PLAN_ID  = 100L;

    /** Standard 4-role mix: Dev 60%, QA 20%, BSA 10%, TL 10% */
    private static Map<Role, BigDecimal> stdRoleMix() {
        return Map.of(
            Role.DEVELOPER, BigDecimal.valueOf(60),
            Role.QA,        BigDecimal.valueOf(20),
            Role.BSA,       BigDecimal.valueOf(10),
            Role.TECH_LEAD, BigDecimal.valueOf(10)
        );
    }

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

    private static Pod pod(Long id, BigDecimal complexity) {
        Pod p = new Pod();
        p.setId(id);
        p.setName("Test POD");
        p.setComplexityMultiplier(complexity);
        return p;
    }

    private static Project activeProject(Long id, int start, int duration, String pattern) {
        Project p = new Project();
        p.setId(id);
        p.setName("Test Project");
        p.setPriority(Priority.P1);
        p.setStatus(ProjectStatus.ACTIVE);
        p.setStartMonth(start);
        p.setDurationMonths(duration);
        p.setDefaultPattern(pattern);
        return p;
    }

    private static ProjectPodPlanning planning(Long id, Project project, Pod pod,
                                               String size, BigDecimal complexity,
                                               String patternOverride,
                                               Integer podStart, Integer duration) {
        ProjectPodPlanning pp = new ProjectPodPlanning();
        pp.setId(id);
        pp.setProject(project);
        pp.setPod(pod);
        pp.setTshirtSize(size);
        pp.setComplexityOverride(complexity);
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
        @DisplayName("Dev demand = baseHours × complexity × 60% spread evenly across 3 months")
        void devDemandFlatThreeMonths() {
            Pod pod = pod(POD_ID, BigDecimal.ONE);
            Project project = activeProject(PROJ_ID, 1, 3, "Flat");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod, "M", BigDecimal.ONE, null, null, null);
            // M size = 1000 base hours

            Map<String, Integer> sizes = Map.of("M", 1000);
            Map<String, EffortPattern> patterns = Map.of("Flat", flatPattern());
            Map<Long, Pod> pods = Map.of(POD_ID, pod);
            Map<Long, Project> projects = Map.of(PROJ_ID, project);

            var result = calculator.calculate(List.of(pp), patterns, stdRoleMix(), pods, projects, sizes);

            // Total Dev hours = 1000 × 1.0 complexity × 60% = 600 hours spread over 3 months = 200/month
            var devByMonth = result.get(POD_ID).get(Role.DEVELOPER);
            assertThat(devByMonth.get(1)).isEqualByComparingTo("200.00");
            assertThat(devByMonth.get(2)).isEqualByComparingTo("200.00");
            assertThat(devByMonth.get(3)).isEqualByComparingTo("200.00");
            assertThat(devByMonth.get(4)).isNull(); // beyond project duration
        }

        @Test
        @DisplayName("QA demand = 1000 × 20% / 3 months = 66.67/month")
        void qaDemandFlatThreeMonths() {
            Pod pod = pod(POD_ID, BigDecimal.ONE);
            Project project = activeProject(PROJ_ID, 1, 3, "Flat");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod, "M", BigDecimal.ONE, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                stdRoleMix(),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project),
                Map.of("M", 1000)
            );

            BigDecimal qa1 = result.get(POD_ID).get(Role.QA).get(1);
            BigDecimal qa2 = result.get(POD_ID).get(Role.QA).get(2);
            BigDecimal qa3 = result.get(POD_ID).get(Role.QA).get(3);
            // Total QA = 200, each month ≈ 66.67
            assertThat(qa1.add(qa2).add(qa3)).isEqualByComparingTo("200.00");
        }

        @Test
        @DisplayName("All 4 roles demand sums to total base hours × complexity")
        void totalDemandEqualsBaseHoursTimesComplexity() {
            Pod pod = pod(POD_ID, BigDecimal.ONE);
            Project project = activeProject(PROJ_ID, 1, 6, "Flat");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod, "L", BigDecimal.ONE, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                stdRoleMix(),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project),
                Map.of("L", 3000)
            );

            // Sum all roles all months for this pod
            BigDecimal total = BigDecimal.ZERO;
            for (Role role : Role.values()) {
                var byMonth = result.getOrDefault(POD_ID, Map.of())
                                    .getOrDefault(role, Map.of());
                for (var v : byMonth.values()) total = total.add(v);
            }
            // Total = 3000 × 1.0 × (60+20+10+10)% = 3000 (mix sums to 100%)
            assertThat(total).isEqualByComparingTo("3000.00");
        }
    }

    // ── 2. Complexity multiplier ─────────────────────────────────────────────
    @Nested
    @DisplayName("Complexity multiplier")
    class ComplexityTests {

        @Test
        @DisplayName("Pod complexity 1.4 multiplies base hours")
        void podComplexityScalesHours() {
            Pod pod = pod(POD_ID, new BigDecimal("1.4")); // Integrations-level complexity
            Project project = activeProject(PROJ_ID, 1, 1, "Flat");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod, "M", BigDecimal.ONE, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                Map.of(Role.DEVELOPER, BigDecimal.valueOf(100)), // 100% dev for simplicity
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project),
                Map.of("M", 1000)
            );

            // 1000 × 1.4 pod × 1.0 row × 100% dev = 1400 in M1
            assertThat(result.get(POD_ID).get(Role.DEVELOPER).get(1))
                .isEqualByComparingTo("1400.00");
        }

        @Test
        @DisplayName("Row complexity 1.2 stacks multiplicatively with pod complexity 1.1")
        void rowAndPodComplexityAreMultiplicative() {
            Pod pod = pod(POD_ID, new BigDecimal("1.1"));
            Project project = activeProject(PROJ_ID, 1, 1, "Flat");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod, "M", new BigDecimal("1.2"), null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                Map.of(Role.DEVELOPER, BigDecimal.valueOf(100)),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project),
                Map.of("M", 1000)
            );

            // 1000 × 1.1 × 1.2 × 100% = 1320
            assertThat(result.get(POD_ID).get(Role.DEVELOPER).get(1))
                .isEqualByComparingTo("1320.00");
        }
    }

    // ── 3. Effort pattern shapes ─────────────────────────────────────────────
    @Nested
    @DisplayName("Effort pattern shapes")
    class PatternShapeTests {

        @Test
        @DisplayName("Ramp-Up: M1 gets less demand than M4")
        void rampUpPatternFrontLoadsLess() {
            Pod pod = pod(POD_ID, BigDecimal.ONE);
            Project project = activeProject(PROJ_ID, 1, 4, "Ramp Up");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod, "M", BigDecimal.ONE, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Ramp Up", rampUpPattern()),
                Map.of(Role.DEVELOPER, BigDecimal.valueOf(100)),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project),
                Map.of("M", 1000)
            );

            BigDecimal m1 = result.get(POD_ID).get(Role.DEVELOPER).get(1);
            BigDecimal m4 = result.get(POD_ID).get(Role.DEVELOPER).get(4);
            assertThat(m1).isLessThan(m4);
        }

        @Test
        @DisplayName("Ramp-Up over 4 months: total Dev demand = base hours × 100%")
        void rampUpTotalDemandIsConserved() {
            Pod pod = pod(POD_ID, BigDecimal.ONE);
            Project project = activeProject(PROJ_ID, 1, 4, "Ramp Up");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod, "L", BigDecimal.ONE, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Ramp Up", rampUpPattern()),
                Map.of(Role.DEVELOPER, BigDecimal.valueOf(100)),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project),
                Map.of("L", 3000)
            );

            var byMonth = result.get(POD_ID).get(Role.DEVELOPER);
            BigDecimal total = byMonth.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            assertThat(total).isEqualByComparingTo("3000.00");
        }

        @Test
        @DisplayName("POD start month offset shifts demand window")
        void podStartMonthOffsetsDemandWindow() {
            Pod pod = pod(POD_ID, BigDecimal.ONE);
            Project project = activeProject(PROJ_ID, 1, 6, "Flat"); // project starts M1
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod, "M", BigDecimal.ONE, null, 3, 2); // POD starts M3 for 2 months

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                Map.of(Role.DEVELOPER, BigDecimal.valueOf(100)),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project),
                Map.of("M", 1000)
            );

            var devByMonth = result.get(POD_ID).get(Role.DEVELOPER);
            assertThat(devByMonth.get(1)).isNull(); // no demand before M3
            assertThat(devByMonth.get(2)).isNull();
            assertThat(devByMonth.get(3)).isEqualByComparingTo("500.00"); // 1000 / 2 months
            assertThat(devByMonth.get(4)).isEqualByComparingTo("500.00");
            assertThat(devByMonth.get(5)).isNull(); // after POD window
        }
    }

    // ── 4. Edge cases ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Edge cases and defensive behaviour")
    class EdgeCaseTests {

        @Test
        @DisplayName("ON_HOLD project produces zero demand")
        void onHoldProjectProducesZeroDemand() {
            Pod pod = pod(POD_ID, BigDecimal.ONE);
            Project project = activeProject(PROJ_ID, 1, 6, "Flat");
            project.setStatus(ProjectStatus.ON_HOLD);
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod, "M", BigDecimal.ONE, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                stdRoleMix(),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project),
                Map.of("M", 1000)
            );

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("Unknown pattern name produces zero demand (and does not throw)")
        void unknownPatternProducesZeroDemand() {
            Pod pod = pod(POD_ID, BigDecimal.ONE);
            Project project = activeProject(PROJ_ID, 1, 3, "NonExistent");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod, "M", BigDecimal.ONE, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()), // "NonExistent" not in map
                stdRoleMix(),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project),
                Map.of("M", 1000)
            );

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("Unknown t-shirt size produces zero demand")
        void unknownTshirtSizeProducesZeroDemand() {
            Pod pod = pod(POD_ID, BigDecimal.ONE);
            Project project = activeProject(PROJ_ID, 1, 3, "Flat");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod, "XXXL", BigDecimal.ONE, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                stdRoleMix(),
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project),
                Map.of("M", 1000) // "XXXL" not in sizes
            );

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("Empty role mix produces zero demand")
        void emptyRoleMixProducesZeroDemand() {
            Pod pod = pod(POD_ID, BigDecimal.ONE);
            Project project = activeProject(PROJ_ID, 1, 3, "Flat");
            ProjectPodPlanning pp = planning(PLAN_ID, project, pod, "M", BigDecimal.ONE, null, null, null);

            var result = calculator.calculate(
                List.of(pp),
                Map.of("Flat", flatPattern()),
                Map.of(), // empty role mix
                Map.of(POD_ID, pod),
                Map.of(PROJ_ID, project),
                Map.of("M", 1000)
            );

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("Multiple plannings for same pod accumulate demand")
        void multiplePlanningsAccumulateDemand() {
            Pod pod = pod(POD_ID, BigDecimal.ONE);

            Project p1 = activeProject(1L, 1, 1, "Flat");
            Project p2 = activeProject(2L, 1, 1, "Flat");
            ProjectPodPlanning pp1 = planning(1L, p1, pod, "M", BigDecimal.ONE, null, null, null);
            ProjectPodPlanning pp2 = planning(2L, p2, pod, "M", BigDecimal.ONE, null, null, null);

            var result = calculator.calculate(
                List.of(pp1, pp2),
                Map.of("Flat", flatPattern()),
                Map.of(Role.DEVELOPER, BigDecimal.valueOf(100)),
                Map.of(POD_ID, pod),
                Map.of(1L, p1, 2L, p2),
                Map.of("M", 1000)
            );

            // Both M-size projects: 1000 × 100% each = 2000 total in M1
            assertThat(result.get(POD_ID).get(Role.DEVELOPER).get(1))
                .isEqualByComparingTo("2000.00");
        }
    }
}
