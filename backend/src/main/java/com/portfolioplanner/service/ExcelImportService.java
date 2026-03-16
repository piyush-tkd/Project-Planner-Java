package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.model.enums.*;
import com.portfolioplanner.domain.repository.*;
import com.portfolioplanner.dto.response.ExcelImportResponse;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExcelImportService {

    private final EntityManager entityManager;
    private final TimelineConfigRepository timelineConfigRepository;
    private final PodRepository podRepository;
    private final TshirtSizeConfigRepository tshirtSizeConfigRepository;
    private final RoleEffortMixRepository roleEffortMixRepository;
    private final EffortPatternRepository effortPatternRepository;
    private final ResourceRepository resourceRepository;
    private final ResourcePodAssignmentRepository resourcePodAssignmentRepository;
    private final ResourceAvailabilityRepository resourceAvailabilityRepository;
    private final BauAssumptionRepository bauAssumptionRepository;
    private final ProjectRepository projectRepository;
    private final ProjectPodPlanningRepository projectPodPlanningRepository;
    private final TemporaryOverrideRepository temporaryOverrideRepository;
    private final ScenarioOverrideRepository scenarioOverrideRepository;
    private final ScenarioRepository scenarioRepository;
    private final CostRateRepository costRateRepository;
    private final ProjectActualRepository projectActualRepository;

    private static final Map<String, Role> ROLE_MAP = Map.of(
            "developer", Role.DEVELOPER,
            "qa", Role.QA,
            "bsa", Role.BSA,
            "tech lead", Role.TECH_LEAD
    );

    private static final Map<String, ProjectStatus> STATUS_MAP = Map.of(
            "active", ProjectStatus.ACTIVE,
            "on hold", ProjectStatus.ON_HOLD,
            "on_hold", ProjectStatus.ON_HOLD,
            "completed", ProjectStatus.COMPLETED,
            "cancelled", ProjectStatus.CANCELLED
    );

    private static final Map<String, Location> LOCATION_MAP = Map.of(
            "us", Location.US,
            "india", Location.INDIA
    );

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public ExcelImportResponse importExcel(MultipartFile file) {
        List<String> warnings = new ArrayList<>();
        Map<String, Integer> counts = new LinkedHashMap<>();

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {

            // ── Parse all sheets first ──
            var timelineData = parseTimeline(workbook.getSheet("Timeline"), warnings);
            var podComplexityMap = parsePodComplexity(workbook.getSheet("Sizing"), warnings);
            var resourcePodNames = parseResourcePodNames(workbook.getSheet("Resources"), warnings);
            var tshirtSizes = parseTshirtSizes(workbook.getSheet("Sizing"), warnings);
            var roleMixes = parseRoleEffortMix(workbook.getSheet("Sizing"), warnings);
            var effortPatterns = parseEffortPatterns(workbook.getSheet("Effort Patterns"), warnings);
            var resourceRows = parseResources(workbook.getSheet("Resources"), warnings);
            var availabilityMap = parseAvailability(workbook.getSheet("Availability"), warnings);
            var bauRows = parseBauAssumptions(workbook.getSheet("Assumptions"), warnings);
            var projectRows = parseProjects(workbook.getSheet("Projects"), warnings);
            var podPlanningRows = parsePodPlanning(workbook.getSheet("POD Planning"), warnings);
            var splitRows = parsePodSplits(workbook.getSheet("POD Splits"), warnings);
            var costRateRows = parseCostRates(workbook.getSheet("Cost Rates"), warnings);
            // skills parsing removed
            var actualsData = parseActuals(workbook.getSheet("Actuals"), warnings);

            // ── Validate parsed percentage data (catch decimal-vs-percentage bugs early) ──
            validatePercentageData(roleMixes, bauRows, warnings);

            // ── Cross-validate: pattern names in Projects / POD Planning must exist in Effort Patterns ──
            Set<String> importedPatternNames = new java.util.HashSet<>();
            for (var ep : effortPatterns) importedPatternNames.add(ep.name);

            for (var pp : podPlanningRows) {
                if (pp.effortPattern != null && !pp.effortPattern.isBlank()
                        && !importedPatternNames.contains(pp.effortPattern)) {
                    warnings.add("⚠ DATA QUALITY: POD Planning '" + pp.projectName + " / " + pp.podName
                            + "' references unknown pattern '" + pp.effortPattern
                            + "'. Demand for this row will be 0. Check the Effort Patterns sheet.");
                }
            }
            for (var pr : projectRows) {
                if (pr.defaultPattern != null && !pr.defaultPattern.isBlank()
                        && !importedPatternNames.contains(pr.defaultPattern)) {
                    warnings.add("⚠ DATA QUALITY: Project '" + pr.name
                            + "' has unknown default pattern '" + pr.defaultPattern + "'.");
                }
            }

            // ── Cross-validate: Resources without Availability entries will have 0 capacity ──
            Set<String> availNames = availabilityMap.keySet();
            for (var rr : resourceRows) {
                if (rr.active && !availNames.contains(rr.name)) {
                    warnings.add("⚠ DATA QUALITY: Resource '" + rr.name
                            + "' (pod: " + rr.podName + ") is active but has no entry in the "
                            + "Availability sheet. Their capacity will be 0 for all months.");
                }
            }

            // ── Collect all pod names ──
            Set<String> allPodNames = new LinkedHashSet<>();
            allPodNames.addAll(podComplexityMap.keySet());
            allPodNames.addAll(resourcePodNames);
            for (var bau : bauRows) allPodNames.add(bau.podName);
            for (var pp : podPlanningRows) allPodNames.add(pp.podName);
            for (var s : splitRows) allPodNames.add(s.toPodName);

            // ── Delete all existing data (FK-safe reverse order) ──
            scenarioOverrideRepository.deleteAllInBatch();
            scenarioRepository.deleteAllInBatch();
            temporaryOverrideRepository.deleteAllInBatch();
            projectPodPlanningRepository.deleteAllInBatch();
            projectActualRepository.deleteAllInBatch();
            projectRepository.deleteAllInBatch();
            costRateRepository.deleteAllInBatch();
            resourceAvailabilityRepository.deleteAllInBatch();
            resourcePodAssignmentRepository.deleteAllInBatch();
            bauAssumptionRepository.deleteAllInBatch();
            resourceRepository.deleteAllInBatch();
            effortPatternRepository.deleteAllInBatch();
            roleEffortMixRepository.deleteAllInBatch();
            tshirtSizeConfigRepository.deleteAllInBatch();
            podRepository.deleteAllInBatch();
            entityManager.flush();

            // ── Insert: Timeline ──
            TimelineConfig tc = timelineConfigRepository.findAll().stream().findFirst()
                    .orElse(new TimelineConfig());
            tc.setStartYear(timelineData.startYear);
            tc.setStartMonth(timelineData.startMonth);
            tc.setCurrentMonthIndex(timelineData.currentMonthIndex);
            // Clear existing working hours before setting new ones to avoid stale entries
            tc.setWorkingHours(new LinkedHashMap<>(timelineData.workingHours));
            timelineConfigRepository.save(tc);
            entityManager.flush();
            counts.put("timeline", 1);

            // ── Insert: Pods ──
            Map<String, Pod> podMap = new HashMap<>();
            int podOrder = 1;
            for (String podName : allPodNames) {
                Pod pod = new Pod();
                pod.setName(podName);
                pod.setComplexityMultiplier(podComplexityMap.getOrDefault(podName, BigDecimal.ONE));
                pod.setDisplayOrder(podOrder++);
                pod.setActive(true);
                podMap.put(podName, podRepository.save(pod));
            }
            entityManager.flush();
            counts.put("pods", podMap.size());

            // ── Insert: TshirtSizeConfig ──
            int sizeOrder = 1;
            for (var ts : tshirtSizes) {
                TshirtSizeConfig cfg = new TshirtSizeConfig();
                cfg.setName(ts.name);
                cfg.setBaseHours(ts.baseHours);
                cfg.setDisplayOrder(sizeOrder++);
                tshirtSizeConfigRepository.save(cfg);
            }
            entityManager.flush();
            counts.put("tshirtSizes", tshirtSizes.size());

            // ── Insert: RoleEffortMix ──
            for (var rm : roleMixes) {
                RoleEffortMix mix = new RoleEffortMix();
                mix.setRole(rm.role);
                mix.setMixPct(rm.mixPct);
                roleEffortMixRepository.save(mix);
            }
            entityManager.flush();
            counts.put("roleEffortMix", roleMixes.size());

            // ── Insert: EffortPatterns ──
            for (var ep : effortPatterns) {
                EffortPattern pattern = new EffortPattern();
                pattern.setName(ep.name);
                pattern.setWeights(ep.weights);
                effortPatternRepository.save(pattern);
            }
            entityManager.flush();
            counts.put("effortPatterns", effortPatterns.size());

            // ── Insert: Resources + Assignments ──
            Map<String, Resource> resourceMap = new HashMap<>();
            int resCount = 0;
            int assignCount = 0;
            for (var rr : resourceRows) {
                Resource res = new Resource();
                res.setName(rr.name);
                res.setRole(rr.role);
                res.setLocation(rr.location);
                res.setActive(rr.active);
                res.setCountsInCapacity(true);
                // skills field removed
                res = resourceRepository.save(res);
                resourceMap.put(rr.name, res);
                resCount++;

                if (rr.podName != null && podMap.containsKey(rr.podName)) {
                    ResourcePodAssignment assign = new ResourcePodAssignment();
                    assign.setResource(res);
                    assign.setPod(podMap.get(rr.podName));
                    assign.setCapacityFte(rr.capacityFte);
                    resourcePodAssignmentRepository.save(assign);
                    assignCount++;
                } else if (rr.podName != null) {
                    warnings.add("Resource '" + rr.name + "': pod '" + rr.podName + "' not found");
                }
            }
            entityManager.flush();
            counts.put("resources", resCount);
            counts.put("resourceAssignments", assignCount);

            // ── Insert: Availability ──
            int availCount = 0;
            for (var entry : availabilityMap.entrySet()) {
                Resource res = resourceMap.get(entry.getKey());
                if (res == null) {
                    warnings.add("Availability: resource '" + entry.getKey() + "' not found in Resources sheet");
                    continue;
                }
                for (var monthEntry : entry.getValue().entrySet()) {
                    ResourceAvailability ra = new ResourceAvailability();
                    ra.setResource(res);
                    ra.setMonthIndex(monthEntry.getKey());
                    ra.setHours(monthEntry.getValue());
                    resourceAvailabilityRepository.save(ra);
                    availCount++;
                }
            }
            entityManager.flush();
            counts.put("availability", availCount);

            // ── Insert: Cost Rates ──
            for (var cr : costRateRows) {
                CostRate rate = new CostRate();
                rate.setRole(cr.role);
                rate.setLocation(cr.location);
                rate.setHourlyRate(cr.hourlyRate);
                costRateRepository.save(rate);
            }
            entityManager.flush();
            counts.put("costRates", costRateRows.size());

            // ── Insert: BAU Assumptions ──
            int bauCount = 0;
            for (var bau : bauRows) {
                Pod pod = podMap.get(bau.podName);
                if (pod == null) {
                    warnings.add("BAU: pod '" + bau.podName + "' not found");
                    continue;
                }
                BauAssumption ba = new BauAssumption();
                ba.setPod(pod);
                ba.setRole(bau.role);
                ba.setBauPct(bau.bauPct);
                bauAssumptionRepository.save(ba);
                bauCount++;
            }
            entityManager.flush();
            counts.put("bauAssumptions", bauCount);

            // ── Insert: Projects ──
            Map<String, Project> projectMap = new HashMap<>();
            for (var pr : projectRows) {
                Project project = new Project();
                project.setName(pr.name);
                project.setPriority(pr.priority);
                project.setOwner(pr.owner);
                project.setStartMonth(pr.startMonth);
                project.setTargetEndMonth(pr.targetEndMonth);
                project.setDurationMonths(pr.durationMonths);
                project.setDefaultPattern(pr.defaultPattern);
                project.setStatus(pr.status);
                project.setTargetDate(pr.targetDate);
                project.setNotes(pr.notes);
                // requiredSkills field removed
                projectMap.put(pr.name, projectRepository.save(project));
            }
            entityManager.flush();
            counts.put("projects", projectMap.size());

            // ── Insert: Project Actuals ──
            int actualCount = 0;
            for (var entry : actualsData.entrySet()) {
                Project project = projectMap.get(entry.getKey());
                if (project == null) continue; // Actuals for unknown project — skip silently
                for (var monthEntry : entry.getValue().entrySet()) {
                    BigDecimal hours = monthEntry.getValue();
                    if (hours == null || hours.compareTo(BigDecimal.ZERO) == 0) continue;
                    ProjectActual actual = new ProjectActual();
                    actual.setProject(project);
                    actual.setMonthKey(monthEntry.getKey());
                    actual.setActualHours(hours);
                    projectActualRepository.save(actual);
                    actualCount++;
                }
            }
            entityManager.flush();
            counts.put("actuals", actualCount);

            // ── Insert: ProjectPodPlanning ──
            int ppCount = 0;
            for (var pp : podPlanningRows) {
                Project project = projectMap.get(pp.projectName);
                Pod pod = podMap.get(pp.podName);
                if (project == null) {
                    warnings.add("POD Planning: project '" + pp.projectName + "' not found");
                    continue;
                }
                if (pod == null) {
                    warnings.add("POD Planning: pod '" + pp.podName + "' not found");
                    continue;
                }
                ProjectPodPlanning planning = new ProjectPodPlanning();
                planning.setProject(project);
                planning.setPod(pod);
                planning.setTshirtSize(pp.tshirtSize);
                planning.setComplexityOverride(pp.complexityOverride);
                planning.setEffortPattern(pp.effortPattern);
                planning.setPodStartMonth(pp.podStartMonth);
                planning.setDurationOverride(pp.durationOverride);
                projectPodPlanningRepository.save(planning);
                ppCount++;
            }
            entityManager.flush();
            counts.put("podPlanning", ppCount);

            // ── Insert: Temporary Overrides (POD Splits) ──
            int overrideCount = 0;
            for (var s : splitRows) {
                Resource res = resourceMap.get(s.resourceName);
                Pod pod = podMap.get(s.toPodName);
                if (res == null) {
                    warnings.add("POD Splits: resource '" + s.resourceName + "' not found");
                    continue;
                }
                if (pod == null) {
                    warnings.add("POD Splits: pod '" + s.toPodName + "' not found");
                    continue;
                }
                TemporaryOverride override = new TemporaryOverride();
                override.setResource(res);
                override.setToPod(pod);
                override.setStartMonth(s.startMonth);
                override.setEndMonth(s.endMonth);
                override.setAllocationPct(s.allocationPct);
                override.setNotes(s.notes);
                temporaryOverrideRepository.save(override);
                overrideCount++;
            }
            entityManager.flush();
            counts.put("temporaryOverrides", overrideCount);

            log.info("Excel import complete: {}", counts);
            return new ExcelImportResponse(true, "Import successful", counts, warnings);

        } catch (Exception e) {
            log.error("Excel import failed", e);
            throw new RuntimeException("Excel import failed: " + e.getMessage(), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Sheet Parsers
    // ═══════════════════════════════════════════════════════════════

    private TimelineData parseTimeline(Sheet sheet, List<String> warnings) {
        if (sheet == null) throw new IllegalArgumentException("Missing 'Timeline' sheet");

        TimelineData data = new TimelineData();
        data.workingHours = new LinkedHashMap<>();

        // Header at row index 2 (0-indexed), data starts at row index 3
        int currentMonthIdx = 1;
        for (int i = 3; i <= 14 && i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;

            String monthKey = getCellString(row.getCell(0));
            if (monthKey == null || monthKey.isBlank()) continue;

            int monthIndex = parseMonthKey(monthKey);
            String calLabel = getCellString(row.getCell(1));
            Integer hours = getCellInt(row.getCell(2));
            String isCurrent = getCellString(row.getCell(3));

            if (monthIndex == 1 && calLabel != null) {
                parseCalendarLabel(calLabel, data);
            }

            if (hours != null) {
                data.workingHours.put("M" + monthIndex, hours);
            }

            if (parseBoolean(isCurrent)) {
                currentMonthIdx = monthIndex;
            }
        }
        data.currentMonthIndex = currentMonthIdx;

        if (data.startYear == null) data.startYear = 2026;
        if (data.startMonth == null) data.startMonth = 1;

        return data;
    }

    private void parseCalendarLabel(String label, TimelineData data) {
        // Parse "Mar-26", "Jan-27", etc.
        try {
            String[] parts = label.split("-");
            if (parts.length == 2) {
                DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH);
                java.time.Month m = java.time.Month.from(fmt.parse(parts[0].trim()));
                int month = m.getValue();
                int year = 2000 + Integer.parseInt(parts[1].trim());
                data.startYear = year;
                data.startMonth = month;
            }
        } catch (Exception e) {
            log.warn("Could not parse calendar label '{}': {}", label, e.getMessage());
        }
    }

    private Map<String, BigDecimal> parsePodComplexity(Sheet sheet, List<String> warnings) {
        Map<String, BigDecimal> map = new LinkedHashMap<>();
        if (sheet == null) return map;

        // Find the POD complexity sub-table: scan row 2 for "POD" header
        Row headerRow = sheet.getRow(2);
        if (headerRow == null) return map;

        int podCol = -1;
        int complexCol = -1;
        for (int c = 0; c <= headerRow.getLastCellNum(); c++) {
            String val = getCellString(headerRow.getCell(c));
            if ("POD".equalsIgnoreCase(val)) podCol = c;
            if (val != null && val.toLowerCase().contains("complexity")) complexCol = c;
        }
        if (podCol < 0 || complexCol < 0) return map;

        for (int i = 3; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String podName = getCellString(row.getCell(podCol));
            if (podName == null || podName.isBlank()) continue;
            BigDecimal complexity = getCellBigDecimal(row.getCell(complexCol));
            if (complexity != null) {
                map.put(podName, complexity);
            }
        }
        return map;
    }

    private Set<String> parseResourcePodNames(Sheet sheet, List<String> warnings) {
        Set<String> podNames = new LinkedHashSet<>();
        if (sheet == null) return podNames;

        // Header at row 2, data from row 3
        for (int i = 3; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String podName = getCellString(row.getCell(1));
            if (podName != null && !podName.isBlank()) {
                podNames.add(podName);
            }
        }
        return podNames;
    }

    private List<TshirtSizeData> parseTshirtSizes(Sheet sheet, List<String> warnings) {
        List<TshirtSizeData> sizes = new ArrayList<>();
        if (sheet == null) return sizes;

        // First sub-table: cols 0-1, header at row 2: "Size", "Base Hours"
        for (int i = 3; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String name = getCellString(row.getCell(0));
            Integer hours = getCellInt(row.getCell(1));
            if (name == null || name.isBlank() || hours == null) continue;
            sizes.add(new TshirtSizeData(name, hours));
        }
        return sizes;
    }

    private List<RoleMixData> parseRoleEffortMix(Sheet sheet, List<String> warnings) {
        List<RoleMixData> mixes = new ArrayList<>();
        if (sheet == null) return mixes;

        // Find Role sub-table: scan row 2 for "Role" header
        Row headerRow = sheet.getRow(2);
        if (headerRow == null) return mixes;

        int roleCol = -1;
        int mixCol = -1;
        for (int c = 0; c <= headerRow.getLastCellNum(); c++) {
            String val = getCellString(headerRow.getCell(c));
            if ("Role".equalsIgnoreCase(val)) { roleCol = c; }
            if (val != null && (val.toLowerCase().contains("effort mix")
                    || val.toLowerCase().contains("mix%")
                    || val.equalsIgnoreCase("mix"))) { mixCol = c; }
        }
        if (roleCol < 0 || mixCol < 0) return mixes;

        for (int i = 3; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String roleName = getCellString(row.getCell(roleCol));
            BigDecimal mixPct = getCellBigDecimal(row.getCell(mixCol));
            if (roleName == null || roleName.isBlank() || mixPct == null) continue;

            Role role = mapRole(roleName);
            if (role == null) {
                warnings.add("Sizing: unknown role '" + roleName + "', skipping");
                continue;
            }
            // mixPct in Excel is decimal (0.6 = 60%), convert to percentage (60) for the calculator
            if (mixPct.compareTo(BigDecimal.ONE) <= 0) {
                mixPct = mixPct.multiply(new BigDecimal("100"));
            }
            mixes.add(new RoleMixData(role, mixPct));
        }
        return mixes;
    }

    private List<EffortPatternData> parseEffortPatterns(Sheet sheet, List<String> warnings) {
        List<EffortPatternData> patterns = new ArrayList<>();
        if (sheet == null) return patterns;

        // Header at row 2: "Pattern", "W1"-"W12"; data from row 3
        for (int i = 3; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String name = getCellString(row.getCell(0));
            if (name == null || name.isBlank()) continue;

            Map<String, BigDecimal> weights = new LinkedHashMap<>();
            for (int w = 1; w <= 12; w++) {
                BigDecimal val = getCellBigDecimal(row.getCell(w));
                weights.put("M" + w, val != null ? val : BigDecimal.ZERO);
            }
            patterns.add(new EffortPatternData(name, weights));
        }
        return patterns;
    }

    private List<ResourceRow> parseResources(Sheet sheet, List<String> warnings) {
        List<ResourceRow> rows = new ArrayList<>();
        if (sheet == null) return rows;

        // Header at row 2: Name, POD, Role, Cap FTE, Location, Active
        for (int i = 3; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String name = getCellString(row.getCell(0));
            if (name == null || name.isBlank()) continue;

            String podName = getCellString(row.getCell(1));
            String roleName = getCellString(row.getCell(2));
            BigDecimal capFte = getCellBigDecimal(row.getCell(3));
            String locationStr = getCellString(row.getCell(4));
            String activeStr = getCellString(row.getCell(5));

            Role role = mapRole(roleName);
            if (role == null) {
                warnings.add("Resources row " + (i + 1) + ": unknown role '" + roleName + "', defaulting to DEVELOPER");
                role = Role.DEVELOPER;
            }

            Location location = mapLocation(locationStr);
            if (location == null) {
                warnings.add("Resources row " + (i + 1) + ": unknown location '" + locationStr + "', defaulting to US");
                location = Location.US;
            }

            boolean active = activeStr == null || parseBoolean(activeStr);
            if (capFte == null) capFte = BigDecimal.ONE;

            rows.add(new ResourceRow(name, podName, role, capFte, location, active));
        }
        return rows;
    }

    private Map<String, Map<Integer, BigDecimal>> parseAvailability(Sheet sheet, List<String> warnings) {
        Map<String, Map<Integer, BigDecimal>> result = new LinkedHashMap<>();
        if (sheet == null) return result;

        // Header at row 2: Name, then 12 month columns
        for (int i = 3; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String name = getCellString(row.getCell(0));
            if (name == null || name.isBlank()) continue;

            Map<Integer, BigDecimal> months = new LinkedHashMap<>();
            for (int m = 1; m <= 12; m++) {
                BigDecimal hours = getCellBigDecimal(row.getCell(m));
                if (hours != null) {
                    months.put(m, hours);
                }
            }
            result.put(name, months);
        }
        return result;
    }

    private List<BauRow> parseBauAssumptions(Sheet sheet, List<String> warnings) {
        List<BauRow> rows = new ArrayList<>();
        if (sheet == null) return rows;

        // Find header row with "POD", "Role", "BAU %"
        int headerRowIdx = -1;
        for (int i = 0; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String first = getCellString(row.getCell(0));
            if ("POD".equalsIgnoreCase(first)) {
                headerRowIdx = i;
                break;
            }
        }
        if (headerRowIdx < 0) return rows;

        for (int i = headerRowIdx + 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String podName = getCellString(row.getCell(0));
            String roleName = getCellString(row.getCell(1));
            BigDecimal bauPct = getCellBigDecimal(row.getCell(2));

            if (podName == null || podName.isBlank()) continue;
            Role role = mapRole(roleName);
            if (role == null) {
                warnings.add("Assumptions row " + (i + 1) + ": unknown role '" + roleName + "', skipping");
                continue;
            }
            if (bauPct == null) bauPct = BigDecimal.ZERO;

            // bauPct in Excel is decimal (0.2 = 20%), convert to percentage (20) for the calculator
            if (bauPct.compareTo(BigDecimal.ONE) < 0) {
                bauPct = bauPct.multiply(new BigDecimal("100"));
            }
            rows.add(new BauRow(podName, role, bauPct));
        }
        return rows;
    }

    private List<ProjectRow> parseProjects(Sheet sheet, List<String> warnings) {
        List<ProjectRow> rows = new ArrayList<>();
        if (sheet == null) return rows;

        // Header at row 3: Name, Priority, Owner, Start M, End M, Duration, Pattern, Status, Launch Date, Notes, Required Skills
        for (int i = 3; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String name = getCellString(row.getCell(0));
            if (name == null || name.isBlank()) continue;

            String priorityStr = getCellString(row.getCell(1));
            String owner = getCellString(row.getCell(2));
            String startMonthStr = getCellString(row.getCell(3));
            String endMonthStr = getCellString(row.getCell(4));
            Integer duration = getCellInt(row.getCell(5));
            String pattern = getCellString(row.getCell(6));
            String statusStr = getCellString(row.getCell(7));
            String targetLaunchStr = getCellString(row.getCell(8));
            String notes = getCellString(row.getCell(9));

            Priority priority = mapPriority(priorityStr);
            if (priority == null) {
                warnings.add("Projects row " + (i + 1) + ": unknown priority '" + priorityStr + "', defaulting to P3");
                priority = Priority.P3;
            }

            ProjectStatus status = mapStatus(statusStr);
            if (status == null) status = ProjectStatus.ACTIVE;

            Integer startMonth = parseMonthKey(startMonthStr);
            Integer endMonth = parseMonthKey(endMonthStr);
            if (startMonth == 0) startMonth = 1;
            if (endMonth == 0) endMonth = null;

            LocalDate targetDate = parseTargetLaunch(targetLaunchStr, warnings, i + 1);

            rows.add(new ProjectRow(name, priority, owner, startMonth, endMonth, duration, pattern, status, targetDate, notes));
        }
        return rows;
    }

    private List<PodPlanningRow> parsePodPlanning(Sheet sheet, List<String> warnings) {
        List<PodPlanningRow> rows = new ArrayList<>();
        if (sheet == null) return rows;

        // Header at row 2: Project, POD, Size, Complexity, Pattern Override, POD Start Month, POD Duration (M), Notes
        for (int i = 3; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String projectName = getCellString(row.getCell(0));
            if (projectName == null || projectName.isBlank()) continue;

            String podName = getCellString(row.getCell(1));
            String size = getCellString(row.getCell(2));
            BigDecimal complexity = getCellBigDecimal(row.getCell(3));
            String patternOverride = getCellString(row.getCell(4));
            String podStartStr = getCellString(row.getCell(5));
            Integer durationOverride = getCellInt(row.getCell(6));

            Integer podStartMonth = null;
            if (podStartStr != null && !podStartStr.isBlank()) {
                podStartMonth = parseMonthKey(podStartStr);
                if (podStartMonth == 0) podStartMonth = null;
            }

            rows.add(new PodPlanningRow(projectName, podName, size, complexity, patternOverride, podStartMonth, durationOverride));
        }
        return rows;
    }

    private List<SplitRow> parsePodSplits(Sheet sheet, List<String> warnings) {
        List<SplitRow> rows = new ArrayList<>();
        if (sheet == null) return rows;

        // Header at row 2: Name, Start Month, End Month, Override POD, Allocation %, Notes, Type
        for (int i = 3; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String name = getCellString(row.getCell(0));
            if (name == null || name.isBlank()) continue;

            String startStr = getCellString(row.getCell(1));
            String endStr = getCellString(row.getCell(2));
            String toPodName = getCellString(row.getCell(3));
            BigDecimal allocationPct = getCellBigDecimal(row.getCell(4));
            String notes = getCellString(row.getCell(5));

            int startMonth = parseMonthKey(startStr);
            int endMonth = parseMonthKey(endStr);
            if (startMonth == 0) startMonth = 1;
            if (endMonth == 0) endMonth = 12;

            if (allocationPct == null) {
                warnings.add("POD Splits: row for '" + name + "' has no Split% value — skipping this override.");
                continue;
            }
            // Convert decimal to percentage if < 1 (e.g., 0.5 -> 50)
            // Values >= 1 are assumed to already be percentages (e.g., 50 = 50%)
            if (allocationPct.compareTo(BigDecimal.ONE) < 0) {
                allocationPct = allocationPct.multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP);
            }

            rows.add(new SplitRow(name, startMonth, endMonth, toPodName, allocationPct, notes));
        }
        return rows;
    }

    /**
     * Parses the "Cost Rates" sheet.
     * Expected layout (row 1 = sheet title, row 2 = optional description, row 3 = header, data from row 4):
     *   Role | US ($/hr) | India ($/hr)
     * Columns beyond the first three are ignored.
     */
    private List<CostRateData> parseCostRates(Sheet sheet, List<String> warnings) {
        List<CostRateData> rows = new ArrayList<>();
        if (sheet == null) return rows; // Optional sheet — gracefully absent

        for (int i = 3; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String roleStr = getCellString(row.getCell(0));
            if (roleStr == null || roleStr.isBlank()) continue;

            Role role = ROLE_MAP.get(roleStr.toLowerCase());
            if (role == null) {
                warnings.add("Cost Rates row " + (i + 1) + ": unknown role '" + roleStr + "' — skipping.");
                continue;
            }

            BigDecimal usRate = getCellBigDecimal(row.getCell(1));
            BigDecimal indiaRate = getCellBigDecimal(row.getCell(2));

            if (usRate != null) rows.add(new CostRateData(role, Location.US, usRate));
            if (indiaRate != null) rows.add(new CostRateData(role, Location.INDIA, indiaRate));
        }
        return rows;
    }

    /**
     * Parses the "Actuals" sheet.
     * Expected layout (row 1 = title, row 2 = blank, row 3 = header, data from row 4):
     *   Project | Mar-26 | Apr-26 | ... (calendar labels matching Timeline)
     * Returns a map of projectName → (monthIndex 1-12 → actualHours).
     * Month index is derived by position (col 1 = M1, col 2 = M2, etc.) matching the Timeline order.
     */
    private Map<String, Map<Integer, BigDecimal>> parseActuals(Sheet sheet, List<String> warnings) {
        Map<String, Map<Integer, BigDecimal>> result = new LinkedHashMap<>();
        if (sheet == null) return result; // Optional sheet

        for (int i = 3; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            String projectName = getCellString(row.getCell(0));
            if (projectName == null || projectName.isBlank()) continue;

            Map<Integer, BigDecimal> monthHours = new LinkedHashMap<>();
            for (int m = 1; m <= 12; m++) {
                BigDecimal hours = getCellBigDecimal(row.getCell(m));
                if (hours != null && hours.compareTo(BigDecimal.ZERO) > 0) {
                    monthHours.put(m, hours);
                }
            }
            if (!monthHours.isEmpty()) {
                result.put(projectName, monthHours);
            }
        }
        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Cell Helpers
    // ═══════════════════════════════════════════════════════════════

    private String getCellString(Cell cell) {
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    yield cell.getLocalDateTimeCellValue().toLocalDate().toString();
                }
                double val = cell.getNumericCellValue();
                if (val == Math.floor(val) && !Double.isInfinite(val)) {
                    yield String.valueOf((long) val);
                }
                yield String.valueOf(val);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield cell.getStringCellValue().trim();
                } catch (Exception e) {
                    try {
                        double val = cell.getNumericCellValue();
                        if (val == Math.floor(val)) yield String.valueOf((long) val);
                        yield String.valueOf(val);
                    } catch (Exception e2) {
                        yield null;
                    }
                }
            }
            default -> null;
        };
    }

    private Double getCellNumeric(Cell cell) {
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case NUMERIC -> cell.getNumericCellValue();
            case STRING -> {
                try {
                    yield Double.parseDouble(cell.getStringCellValue().trim());
                } catch (NumberFormatException e) {
                    yield null;
                }
            }
            case FORMULA -> {
                try {
                    yield cell.getNumericCellValue();
                } catch (Exception e) {
                    yield null;
                }
            }
            default -> null;
        };
    }

    private Integer getCellInt(Cell cell) {
        Double val = getCellNumeric(cell);
        return val != null ? (int) Math.round(val) : null;
    }

    private BigDecimal getCellBigDecimal(Cell cell) {
        Double val = getCellNumeric(cell);
        return val != null ? BigDecimal.valueOf(val).setScale(2, RoundingMode.HALF_UP) : null;
    }

    private int parseMonthKey(String key) {
        if (key == null || key.isBlank()) return 0;
        key = key.trim().toUpperCase();
        if (key.startsWith("M")) {
            try {
                int val = Integer.parseInt(key.substring(1));
                return (val >= 1 && val <= 12) ? val : 0;
            } catch (NumberFormatException e) {
                return 0;
            }
        }
        try {
            int val = Integer.parseInt(key);
            return (val >= 1 && val <= 12) ? val : 0;
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private Role mapRole(String name) {
        if (name == null) return null;
        return ROLE_MAP.get(name.trim().toLowerCase());
    }

    private Location mapLocation(String name) {
        if (name == null) return null;
        return LOCATION_MAP.get(name.trim().toLowerCase());
    }

    private Priority mapPriority(String val) {
        if (val == null) return null;
        try {
            return Priority.valueOf(val.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private ProjectStatus mapStatus(String val) {
        if (val == null) return null;
        return STATUS_MAP.get(val.trim().toLowerCase());
    }

    private boolean parseBoolean(String val) {
        if (val == null) return false;
        String v = val.trim().toLowerCase();
        return "y".equals(v) || "yes".equals(v) || "true".equals(v) || "1".equals(v);
    }

    private LocalDate parseTargetLaunch(String val, List<String> warnings, int rowNum) {
        if (val == null || val.isBlank()) return null;
        try {
            // Try "MMM-yy" format like "Apr-26"
            String[] parts = val.split("-");
            if (parts.length == 2) {
                java.time.Month month = java.time.Month.from(
                        DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH).parse(parts[0].trim()));
                int year = 2000 + Integer.parseInt(parts[1].trim());
                return LocalDate.of(year, month, 1);
            }
        } catch (Exception ignored) {}
        try {
            return LocalDate.parse(val);
        } catch (Exception e) {
            warnings.add("Projects row " + rowNum + ": could not parse target launch '" + val + "'");
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Data Records
    // ═══════════════════════════════════════════════════════════════

    private static class TimelineData {
        Integer startYear;
        Integer startMonth;
        int currentMonthIndex = 1;
        Map<String, Integer> workingHours = new LinkedHashMap<>();
    }

    private record TshirtSizeData(String name, int baseHours) {}
    private record RoleMixData(Role role, BigDecimal mixPct) {}
    private record EffortPatternData(String name, Map<String, BigDecimal> weights) {}
    private record ResourceRow(String name, String podName, Role role, BigDecimal capacityFte,
                               Location location, boolean active) {}
    private record BauRow(String podName, Role role, BigDecimal bauPct) {}
    private record ProjectRow(String name, Priority priority, String owner, Integer startMonth,
                              Integer targetEndMonth, Integer durationMonths, String defaultPattern,
                              ProjectStatus status, LocalDate targetDate, String notes) {}
    private record PodPlanningRow(String projectName, String podName, String tshirtSize,
                                  BigDecimal complexityOverride, String effortPattern,
                                  Integer podStartMonth, Integer durationOverride) {}
    private record CostRateData(Role role, Location location, BigDecimal hourlyRate) {}
    private record SplitRow(String resourceName, int startMonth, int endMonth, String toPodName,
                            BigDecimal allocationPct, String notes) {}

    // ═══════════════════════════════════════════════════════════════
    //  Post-Parse Validation — catch decimal-vs-percentage bugs early
    // ═══════════════════════════════════════════════════════════════

    private void validatePercentageData(List<RoleMixData> roleMixes, List<BauRow> bauRows, List<String> warnings) {
        // 0. Role Effort Mix must not be empty — if it is, ALL demand will be zero
        if (roleMixes.isEmpty()) {
            warnings.add("⚠ CRITICAL DATA QUALITY: Role Effort Mix table parsed as empty. "
                    + "Check that the Sizing sheet has a column labelled 'Effort Mix%', 'Mix%', or 'Mix'. "
                    + "Without role percentages ALL demand calculations will produce zero hours.");
        }

        // 1. Role Effort Mix% should sum to ~100
        BigDecimal mixSum = BigDecimal.ZERO;
        for (var rm : roleMixes) mixSum = mixSum.add(rm.mixPct());
        if (mixSum.compareTo(BigDecimal.ZERO) > 0 && mixSum.compareTo(BigDecimal.TEN) < 0) {
            warnings.add("⚠ DATA QUALITY: Role Effort Mix percentages sum to " + mixSum
                    + " (expected ~100). Values may be stored as decimals in Excel. Auto-converted to percentages.");
        }
        if (mixSum.compareTo(new BigDecimal("80")) < 0 || mixSum.compareTo(new BigDecimal("120")) > 0) {
            if (mixSum.compareTo(BigDecimal.TEN) >= 0) {
                warnings.add("⚠ DATA QUALITY: Role Effort Mix percentages sum to " + mixSum
                        + "% (expected ~100%). Please verify the Sizing sheet.");
            }
        }

        // 2. BAU% should be 0–100 per role per pod
        for (var bau : bauRows) {
            if (bau.bauPct().compareTo(BigDecimal.ZERO) < 0) {
                warnings.add("⚠ DATA QUALITY: BAU% for " + bau.podName() + "/" + bau.role()
                        + " is negative (" + bau.bauPct() + "%). Setting to 0.");
            }
            if (bau.bauPct().compareTo(new BigDecimal("100")) > 0) {
                warnings.add("⚠ DATA QUALITY: BAU% for " + bau.podName() + "/" + bau.role()
                        + " exceeds 100% (" + bau.bauPct() + "%). This will result in zero capacity.");
            }
        }

        // 3. Individual role mix values should each be 0–100
        for (var rm : roleMixes) {
            if (rm.mixPct().compareTo(BigDecimal.ZERO) < 0 || rm.mixPct().compareTo(new BigDecimal("100")) > 0) {
                warnings.add("⚠ DATA QUALITY: Role Effort Mix for " + rm.role()
                        + " is " + rm.mixPct() + "% (expected 0–100%).");
            }
        }

        log.info("Validation: Role Mix sum={}%, BAU entries={}", mixSum, bauRows.size());
    }
}
