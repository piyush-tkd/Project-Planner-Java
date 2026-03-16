package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.domain.repository.*;
import jakarta.persistence.EntityManager;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for ExcelImportService — Sizing sheet parsing.
 *
 * Tests the critical "Mix%" column header detection logic that caused
 * org-wide demand to be zero when the column was labelled "Mix%" instead
 * of the legacy "Effort Mix %" label.
 *
 * Uses Mockito to supply the 17 required constructor dependencies so the
 * private parser methods can be tested via reflection — no Spring context needed.
 */
@ExtendWith(MockitoExtension.class)
class ExcelImportServiceSizingTest {

    // ── All 17 required constructor dependencies ────────────────────────────
    @Mock EntityManager entityManager;
    @Mock TimelineConfigRepository timelineConfigRepository;
    @Mock PodRepository podRepository;
    @Mock TshirtSizeConfigRepository tshirtSizeConfigRepository;
    @Mock RoleEffortMixRepository roleEffortMixRepository;
    @Mock EffortPatternRepository effortPatternRepository;
    @Mock ResourceRepository resourceRepository;
    @Mock ResourcePodAssignmentRepository resourcePodAssignmentRepository;
    @Mock ResourceAvailabilityRepository resourceAvailabilityRepository;
    @Mock BauAssumptionRepository bauAssumptionRepository;
    @Mock ProjectRepository projectRepository;
    @Mock ProjectPodPlanningRepository projectPodPlanningRepository;
    @Mock TemporaryOverrideRepository temporaryOverrideRepository;
    @Mock ScenarioOverrideRepository scenarioOverrideRepository;
    @Mock ScenarioRepository scenarioRepository;
    @Mock CostRateRepository costRateRepository;
    @Mock ProjectActualRepository projectActualRepository;

    @InjectMocks
    private ExcelImportService service;

    // ── 1. Mix% column header variants ─────────────────────────────────────
    @Nested
    @DisplayName("Mix% column header detection")
    class MixHeaderDetectionTests {

        @Test
        @DisplayName("'Mix%' header label is recognised → role mixes parsed correctly")
        void mixPercentLabelIsDetected() throws Exception {
            Sheet sizing = buildSizingSheet("Mix%");
            var mixes = invokeParseRoleEffortMix(sizing);

            assertThat(mixes).hasSize(4);
            assertMixPct(mixes, Role.DEVELOPER, new BigDecimal("60.00"));
            assertMixPct(mixes, Role.QA,        new BigDecimal("20.00"));
            assertMixPct(mixes, Role.BSA,        new BigDecimal("10.00"));
            assertMixPct(mixes, Role.TECH_LEAD,  new BigDecimal("10.00"));
        }

        @Test
        @DisplayName("'Effort Mix %' legacy header label is still recognised")
        void legacyEffortMixLabelIsDetected() throws Exception {
            Sheet sizing = buildSizingSheet("Effort Mix %");
            var mixes = invokeParseRoleEffortMix(sizing);

            assertThat(mixes).hasSize(4);
            assertMixPct(mixes, Role.DEVELOPER, new BigDecimal("60.00"));
        }

        @Test
        @DisplayName("'Mix' short header label is recognised")
        void shortMixLabelIsDetected() throws Exception {
            Sheet sizing = buildSizingSheet("Mix");
            var mixes = invokeParseRoleEffortMix(sizing);

            assertThat(mixes).hasSize(4);
        }

        @Test
        @DisplayName("Unrecognised header label produces empty result and no exception")
        void unrecognisedHeaderProducesEmptyResult() throws Exception {
            Sheet sizing = buildSizingSheet("EffortPercent"); // not matched
            var mixes = invokeParseRoleEffortMix(sizing);

            assertThat(mixes).isEmpty();
        }
    }

    // ── 2. Percentage normalisation ─────────────────────────────────────────
    @Nested
    @DisplayName("Decimal-to-percentage normalisation")
    class PercentNormalisationTests {

        @Test
        @DisplayName("Decimal values (0.60) are converted to percentages (60)")
        void decimalValuesAreNormalisedToPercentages() throws Exception {
            // Values already set as 0.6, 0.2, 0.1, 0.1 in buildSizingSheet
            Sheet sizing = buildSizingSheet("Mix%");
            var mixes = invokeParseRoleEffortMix(sizing);

            // All values should be in the 0–100 range, not 0–1
            for (Object mix : mixes) {
                BigDecimal pct = getMixPct(mix);
                assertThat(pct).isGreaterThan(BigDecimal.ONE);
            }
        }

        @Test
        @DisplayName("Whole-number percentages (60.0) pass through unchanged")
        void wholeNumberPercentagesAreUnchanged() throws Exception {
            XSSFWorkbook wb = new XSSFWorkbook();
            Sheet sheet = wb.createSheet("Sizing");
            Row header = sheet.createRow(2);
            header.createCell(0).setCellValue("Role");
            header.createCell(1).setCellValue("Mix%");

            Row r3 = sheet.createRow(3);
            r3.createCell(0).setCellValue("Developer");
            r3.createCell(1).setCellValue(60.0);  // already a percentage

            var mixes = invokeParseRoleEffortMix(sheet);
            assertThat(mixes).hasSize(1);
            assertMixPct(mixes, Role.DEVELOPER, new BigDecimal("60.0"));
        }
    }

    // ── 3. Data quality — warnings emitted ──────────────────────────────────
    @Nested
    @DisplayName("Data quality warnings")
    class DataQualityWarningTests {

        @Test
        @DisplayName("Valid role mix produces no warnings")
        void validRoleMixProducesNoWarnings() throws Exception {
            Sheet sizing = buildSizingSheet("Mix%");
            List<String> warnings = new ArrayList<>();
            invokeParseRoleEffortMix(sizing, warnings);

            assertThat(warnings).isEmpty();
        }

        @Test
        @DisplayName("Null sheet produces empty result without throwing")
        void nullSheetReturnsEmpty() throws Exception {
            var mixes = invokeParseRoleEffortMix(null);
            assertThat(mixes).isEmpty();
        }

        @Test
        @DisplayName("Unknown role name in data row is skipped with a warning")
        void unknownRoleSkippedWithWarning() throws Exception {
            XSSFWorkbook wb = new XSSFWorkbook();
            Sheet sheet = wb.createSheet("Sizing");
            Row header = sheet.createRow(2);
            header.createCell(0).setCellValue("Role");
            header.createCell(1).setCellValue("Mix%");

            Row r3 = sheet.createRow(3);
            r3.createCell(0).setCellValue("UNKNOWN_ROLE");
            r3.createCell(1).setCellValue(0.5);

            List<String> warnings = new ArrayList<>();
            var mixes = invokeParseRoleEffortMix(sheet, warnings);

            assertThat(mixes).isEmpty();
            assertThat(warnings).anyMatch(w -> w.contains("unknown role"));
        }
    }

    // ── 4. Edge cases ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Edge cases")
    class EdgeCaseTests {

        @Test
        @DisplayName("Empty sheet (row 2 missing) returns empty without throwing")
        void emptySheetReturnsEmpty() throws Exception {
            XSSFWorkbook wb = new XSSFWorkbook();
            Sheet sheet = wb.createSheet("Sizing");
            // row 2 deliberately not created

            var mixes = invokeParseRoleEffortMix(sheet);
            assertThat(mixes).isEmpty();
        }

        @Test
        @DisplayName("Rows with blank role name are skipped silently")
        void blankRoleNameRowsAreSkipped() throws Exception {
            XSSFWorkbook wb = new XSSFWorkbook();
            Sheet sheet = wb.createSheet("Sizing");
            Row header = sheet.createRow(2);
            header.createCell(0).setCellValue("Role");
            header.createCell(1).setCellValue("Mix%");

            Row r3 = sheet.createRow(3);
            r3.createCell(0).setCellValue("");       // blank — should be skipped
            r3.createCell(1).setCellValue(0.5);

            Row r4 = sheet.createRow(4);
            r4.createCell(0).setCellValue("Developer");
            r4.createCell(1).setCellValue(0.6);

            var mixes = invokeParseRoleEffortMix(sheet);
            assertThat(mixes).hasSize(1);
        }

        @Test
        @DisplayName("All four roles can coexist in one sheet")
        void allFourRolesAreAccepted() throws Exception {
            Sheet sheet = buildSizingSheet("Mix%");
            var mixes = invokeParseRoleEffortMix(sheet);

            List<Role> roles = mixes.stream().map(m -> {
                try { return getRole(m); } catch (Exception e) { throw new RuntimeException(e); }
            }).toList();

            assertThat(roles).containsExactlyInAnyOrder(
                    Role.DEVELOPER, Role.QA, Role.BSA, Role.TECH_LEAD);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Build a minimal Sizing sheet with all four roles at decimal mix values.
     * Row 2  = header (Role | <mixHeader>)
     * Row 3+ = data
     */
    private static Sheet buildSizingSheet(String mixHeader) {
        XSSFWorkbook wb = new XSSFWorkbook();
        Sheet sheet = wb.createSheet("Sizing");

        Row header = sheet.createRow(2);
        header.createCell(0).setCellValue("Role");
        header.createCell(1).setCellValue(mixHeader);

        Object[][] data = {
            { "Developer", 0.60 },
            { "QA",        0.20 },
            { "BSA",       0.10 },
            { "Tech Lead", 0.10 },
        };
        int rowIdx = 3;
        for (Object[] row : data) {
            Row r = sheet.createRow(rowIdx++);
            r.createCell(0).setCellValue((String) row[0]);
            r.createCell(1).setCellValue((double) row[1]);
        }
        return sheet;
    }

    /** Invoke the private parseRoleEffortMix(Sheet, List) via reflection. */
    @SuppressWarnings("unchecked")
    private List<Object> invokeParseRoleEffortMix(Sheet sheet) throws Exception {
        return invokeParseRoleEffortMix(sheet, new ArrayList<>());
    }

    @SuppressWarnings("unchecked")
    private List<Object> invokeParseRoleEffortMix(Sheet sheet, List<String> warnings) throws Exception {
        Method m = ExcelImportService.class.getDeclaredMethod(
                "parseRoleEffortMix", Sheet.class, List.class);
        m.setAccessible(true);
        return (List<Object>) m.invoke(service, sheet, warnings);
    }

    /** Read the {@code role()} accessor on the private RoleMixData record. */
    private static Role getRole(Object roleMixData) throws Exception {
        return (Role) roleMixData.getClass().getDeclaredMethod("role").invoke(roleMixData);
    }

    /** Read the {@code mixPct()} accessor on the private RoleMixData record. */
    private static BigDecimal getMixPct(Object roleMixData) throws Exception {
        return (BigDecimal) roleMixData.getClass().getDeclaredMethod("mixPct").invoke(roleMixData);
    }

    /** Assert that the mix list contains the given role with the expected percentage. */
    private static void assertMixPct(List<Object> mixes, Role expectedRole, BigDecimal expectedPct)
            throws Exception {
        for (Object mix : mixes) {
            if (getRole(mix) == expectedRole) {
                assertThat(getMixPct(mix))
                        .as("Mix% for " + expectedRole)
                        .isEqualByComparingTo(expectedPct);
                return;
            }
        }
        fail("No entry found for role " + expectedRole + " in " + mixes);
    }
}
