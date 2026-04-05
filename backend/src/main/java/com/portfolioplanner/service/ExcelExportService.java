package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import com.portfolioplanner.service.calculation.CalculationEngine;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot.*;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExcelExportService {

    private final CalculationEngine calculationEngine;
    private final TimelineService timelineService;
    private final ResourceRepository resourceRepository;
    private final ResourcePodAssignmentRepository assignmentRepository;
    private final ResourceAvailabilityRepository availabilityRepository;
    private final ProjectRepository projectRepository;
    private final ProjectPodPlanningRepository projectPodPlanningRepository;
    private final PodRepository podRepository;

    private static final int MONTHS = 12;

    // ── Colour palette ───────────────────────────────────────────────
    private static final byte[] CLR_HEADER_BG = hex("#0C2340");
    private static final byte[] CLR_SECTION_BG = hex("#1e3a5f");
    private static final byte[] CLR_SUB_BG = hex("#d9e8f5");
    private static final byte[] CLR_GAP_POS = hex("#c6efce");
    private static final byte[] CLR_GAP_NEG = hex("#ffc7ce");
    private static final byte[] CLR_UTIL_HIGH = hex("#ffc7ce");
    private static final byte[] CLR_UTIL_WARN = hex("#ffeb9c");

    // ────────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public byte[] buildReconciliationWorkbook() throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {

            Map<Integer, String> monthLabels = timelineService.getMonthLabels();
            CalculationSnapshot snap = calculationEngine.compute();

            // Load all raw data inside transaction to avoid lazy-load issues
            List<Resource> resources = resourceRepository.findByActiveTrueAndCountsInCapacityTrue();
            List<Long> resourceIds = resources.stream().map(Resource::getId).collect(Collectors.toList());

            List<ResourcePodAssignment> assignments = assignmentRepository.findAll();
            List<ResourceAvailability> availabilities = resourceIds.isEmpty()
                    ? List.of()
                    : availabilityRepository.findByResourceIdIn(resourceIds);
            List<Project> projects = projectRepository.findAll();
            List<ProjectPodPlanning> plannings = projectPodPlanningRepository.findAll();
            List<Pod> pods = podRepository.findByActiveTrueOrderByDisplayOrderAsc();

            // Build lookup maps (access lazy fields while in transaction)
            Map<Long, String> resourcePodName = new HashMap<>();
            Map<Long, BigDecimal> resourceFte = new HashMap<>();
            for (ResourcePodAssignment a : assignments) {
                Long rid = a.getResource().getId();
                resourcePodName.put(rid, a.getPod().getName());
                resourceFte.put(rid, a.getCapacityFte() != null ? a.getCapacityFte() : BigDecimal.ONE);
            }

            Map<Long, List<ResourceAvailability>> availMap = availabilities.stream()
                    .collect(Collectors.groupingBy(a -> a.getResource().getId()));

            // For projects: store pod names & planning details eagerly
            Map<Long, List<ProjectPlanRow>> planMap = new LinkedHashMap<>();
            for (ProjectPodPlanning p : plannings) {
                Long pid = p.getProject().getId();
                planMap.computeIfAbsent(pid, k -> new ArrayList<>()).add(new ProjectPlanRow(
                        p.getPod().getName(),
                        p.getTshirtSize(),
                        p.getEffortPattern()
                ));
            }

            Styles s = new Styles(wb);

            buildResourcesTab(wb, s, resources, resourcePodName, resourceFte, availMap, monthLabels);
            buildProjectsTab(wb, s, projects, planMap, monthLabels);
            buildGapTab(wb, s, snap, monthLabels, pods);
            buildHiringTab(wb, s, snap, monthLabels);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    // Simple DTO to hold pre-fetched planning row data
    private record ProjectPlanRow(String podName, String tshirtSize, String effortPattern) {}

    // ── Tab 1: Resources ─────────────────────────────────────────────
    private void buildResourcesTab(XSSFWorkbook wb, Styles s,
            List<Resource> resources,
            Map<Long, String> podNameMap,
            Map<Long, BigDecimal> fteMap,
            Map<Long, List<ResourceAvailability>> availMap,
            Map<Integer, String> monthLabels) {

        XSSFSheet sheet = wb.createSheet("1. Resources");
        sheet.createFreezePane(6, 2);

        // Title row
        Row title = sheet.createRow(0);
        Cell tc = title.createCell(0);
        tc.setCellValue("Resources — Availability Hours per Month");
        tc.setCellStyle(s.sheetTitle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 5 + MONTHS));

        // Header row (columns: 0=ID, 1=Name, 2=Role, 3=Location, 4=FTE, 5=POD, 6..17=M1..M12)
        Row hdr = sheet.createRow(1);
        String[] fixedHdrs = {"ID", "Name", "Role", "Location", "FTE", "POD"};
        for (int i = 0; i < fixedHdrs.length; i++) {
            Cell c = hdr.createCell(i);
            c.setCellValue(fixedHdrs[i]);
            c.setCellStyle(s.colHeader);
        }
        for (int m = 1; m <= MONTHS; m++) {
            Cell c = hdr.createCell(5 + m);
            c.setCellValue(monthLabels.getOrDefault(m, "M" + m));
            c.setCellStyle(s.colHeader);
        }

        // Data rows
        int row = 2;
        List<Resource> sorted = resources.stream()
                .sorted(Comparator.comparing(Resource::getName))
                .collect(Collectors.toList());

        for (Resource r : sorted) {
            String podName = podNameMap.getOrDefault(r.getId(), "—");
            BigDecimal fte = fteMap.getOrDefault(r.getId(), BigDecimal.ONE);

            Map<Integer, BigDecimal> avail = availMap.getOrDefault(r.getId(), List.of())
                    .stream().collect(Collectors.toMap(ResourceAvailability::getMonthIndex,
                            a -> a.getHours() != null ? a.getHours() : BigDecimal.ZERO));

            Row dr = sheet.createRow(row++);
            setNum(dr, 0, r.getId(), s.num);
            setStr(dr, 1, r.getName(), s.normal);
            setStr(dr, 2, r.getRole().name(), s.normal);
            setStr(dr, 3, r.getLocation().name(), s.normal);
            setDbl(dr, 4, fte.doubleValue(), s.num2dp);
            setStr(dr, 5, podName, s.normal);
            for (int m = 1; m <= MONTHS; m++) {
                double h = avail.getOrDefault(m, BigDecimal.ZERO).doubleValue();
                setDbl(dr, 5 + m, h, s.num1dp);
            }
        }

        // Totals row
        Row tot = sheet.createRow(row);
        Cell lbl = tot.createCell(0);
        lbl.setCellValue("TOTAL");
        lbl.setCellStyle(s.totalsLabel);
        if (row > 2) {
            sheet.addMergedRegion(new CellRangeAddress(row, row, 0, 5));
        }
        for (int m = 1; m <= MONTHS; m++) {
            int col = 5 + m;
            Cell c = tot.createCell(col);
            if (row > 2) {
                c.setCellFormula("SUM(" + col(col) + "3:" + col(col) + row + ")");
            } else {
                c.setCellValue(0);
            }
            c.setCellStyle(s.totalsNum);
        }

        // Fixed column widths (no autoSizeColumn — unsafe on headless servers)
        sheet.setColumnWidth(0, 1800);   // ID
        sheet.setColumnWidth(1, 6000);   // Name
        sheet.setColumnWidth(2, 3000);   // Role
        sheet.setColumnWidth(3, 3000);   // Location
        sheet.setColumnWidth(4, 1800);   // FTE
        sheet.setColumnWidth(5, 4000);   // POD
        for (int m = 1; m <= MONTHS; m++) {
            sheet.setColumnWidth(5 + m, 2400);
        }
    }

    // ── Tab 2: Projects ───────────────────────────────────────────────
    private void buildProjectsTab(XSSFWorkbook wb, Styles s,
            List<Project> projects,
            Map<Long, List<ProjectPlanRow>> planMap,
            Map<Integer, String> monthLabels) {

        XSSFSheet sheet = wb.createSheet("2. Projects");
        sheet.createFreezePane(5, 2);

        Row title = sheet.createRow(0);
        Cell tc = title.createCell(0);
        tc.setCellValue("Projects — POD Assignments & Planning");
        tc.setCellStyle(s.sheetTitle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 9));

        Row hdr = sheet.createRow(1);
        String[] hdrs = {"ID", "Name", "Priority", "Owner", "Status",
                "Start Month", "Duration", "POD", "T-Shirt", "Pattern"};
        for (int i = 0; i < hdrs.length; i++) {
            Cell c = hdr.createCell(i);
            c.setCellValue(hdrs[i]);
            c.setCellStyle(s.colHeader);
        }

        int row = 2;
        for (Project p : projects.stream().sorted(Comparator.comparing(Project::getName)).collect(Collectors.toList())) {
            List<ProjectPlanRow> plans = planMap.getOrDefault(p.getId(), List.of());
            if (plans.isEmpty()) {
                writeProjectRow(sheet.createRow(row++), s, p, "—", "—", "—", monthLabels);
            } else {
                for (ProjectPlanRow plan : plans) {
                    writeProjectRow(sheet.createRow(row++), s, p,
                            plan.podName(),
                            nvl(plan.tshirtSize()),
                            nvl(plan.effortPattern()),
                            monthLabels);
                }
            }
        }

        sheet.setColumnWidth(0, 1800);
        sheet.setColumnWidth(1, 7000);
        sheet.setColumnWidth(2, 2800);
        sheet.setColumnWidth(3, 4000);
        sheet.setColumnWidth(4, 3000);
        sheet.setColumnWidth(5, 2800);
        sheet.setColumnWidth(6, 2400);
        sheet.setColumnWidth(7, 4000);
        sheet.setColumnWidth(8, 2800);
        sheet.setColumnWidth(9, 3500);
    }

    private void writeProjectRow(Row dr, Styles s, Project p,
            String pod, String size, String pattern,
            Map<Integer, String> monthLabels) {
        setNum(dr, 0, p.getId(), s.num);
        setStr(dr, 1, p.getName(), s.normal);
        setStr(dr, 2, p.getPriority() != null ? p.getPriority().name() : "—", s.normal);
        setStr(dr, 3, nvl(p.getOwner()), s.normal);
        setStr(dr, 4, p.getStatus() != null ? p.getStatus() : "—", s.normal);
        int startM = p.getStartMonth() != null ? p.getStartMonth() : 0;
        setStr(dr, 5, startM > 0 ? monthLabels.getOrDefault(startM, "M" + startM) : "—", s.normal);
        setNum(dr, 6, p.getDurationMonths() != null ? p.getDurationMonths() : 0, s.num);
        setStr(dr, 7, pod, s.normal);
        setStr(dr, 8, size, s.normal);
        setStr(dr, 9, pattern, s.normal);
    }

    // ── Tab 3: Capacity × Demand × Gap ───────────────────────────────
    private void buildGapTab(XSSFWorkbook wb, Styles s,
            CalculationSnapshot snap,
            Map<Integer, String> monthLabels,
            List<Pod> pods) {

        XSSFSheet sheet = wb.createSheet("3. Cap vs Dem vs Gap");
        sheet.createFreezePane(1, 3);

        // Title
        Row t0 = sheet.createRow(0);
        Cell tc = t0.createCell(0);
        tc.setCellValue("Capacity vs Demand vs Gap — Per POD, Per Month");
        tc.setCellStyle(s.sheetTitle);
        int lastCol = MONTHS * 4;
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, lastCol));

        // Row 1: month group labels spanning 4 cols each
        Row sub = sheet.createRow(1);
        Cell podLbl = sub.createCell(0);
        podLbl.setCellValue("POD");
        podLbl.setCellStyle(s.colHeader);
        for (int m = 1; m <= MONTHS; m++) {
            int base = 1 + (m - 1) * 4;
            Cell mc = sub.createCell(base);
            mc.setCellValue(monthLabels.getOrDefault(m, "M" + m));
            mc.setCellStyle(s.monthGroup);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, base, base + 3));
        }

        // Row 2: per-month sub-headers
        Row hdr = sheet.createRow(2);
        Cell ph = hdr.createCell(0);
        ph.setCellValue("POD");
        ph.setCellStyle(s.colHeader);
        for (int m = 1; m <= MONTHS; m++) {
            int base = 1 + (m - 1) * 4;
            makeCell(hdr, base,     "Cap (h)",  s.subHeader);
            makeCell(hdr, base + 1, "Dem (h)",  s.subHeader);
            makeCell(hdr, base + 2, "Gap (h)",  s.subHeader);
            makeCell(hdr, base + 3, "Util %",   s.subHeader);
        }

        // Build gap lookup: podName -> monthIndex -> gap record
        Map<String, Map<Integer, PodMonthGap>> gapLookup = new LinkedHashMap<>();
        for (PodMonthGap g : snap.gaps()) {
            gapLookup.computeIfAbsent(g.podName(), k -> new HashMap<>()).put(g.monthIndex(), g);
        }

        // Pod order: active pods first (in display order), then any extras from gaps
        List<String> podNames = pods.stream().map(Pod::getName).collect(Collectors.toList());
        snap.gaps().stream().map(PodMonthGap::podName)
                .filter(n -> !podNames.contains(n)).distinct().sorted().forEach(podNames::add);

        int dataStartRow = 3;
        int row = dataStartRow;
        for (String podName : podNames) {
            Map<Integer, PodMonthGap> monthGaps = gapLookup.getOrDefault(podName, Map.of());
            boolean hasData = !monthGaps.isEmpty();
            if (!hasData) continue; // skip pods with no gap data

            Row dr = sheet.createRow(row);
            Cell nc = dr.createCell(0);
            nc.setCellValue(podName);
            nc.setCellStyle(s.rowLabel);

            for (int m = 1; m <= MONTHS; m++) {
                int base = 1 + (m - 1) * 4;
                PodMonthGap g = monthGaps.get(m);
                double cap = (g != null && g.capacityHours() != null) ? g.capacityHours().doubleValue() : 0.0;
                double dem = (g != null && g.demandHours() != null) ? g.demandHours().doubleValue() : 0.0;

                // Cap & Dem — raw values from calculation engine
                setDbl(dr, base,     cap, s.num1dp);
                setDbl(dr, base + 1, dem, s.num1dp);

                // Gap = Cap - Dem (Excel formula)
                int exRow = row + 1;
                Cell gapCell = dr.createCell(base + 2);
                gapCell.setCellFormula(col(base) + exRow + "-" + col(base + 1) + exRow);
                gapCell.setCellStyle(dem <= cap ? s.gapPos : s.gapNeg);

                // Util % = Dem / Cap (Excel formula if cap > 0)
                Cell utilCell = dr.createCell(base + 3);
                if (cap > 0) {
                    utilCell.setCellFormula(col(base + 1) + exRow + "/" + col(base) + exRow);
                    utilCell.setCellStyle(dem > cap ? s.utilHigh : (dem > cap * 0.8 ? s.utilWarn : s.utilOk));
                } else {
                    utilCell.setCellValue(0);
                    utilCell.setCellStyle(s.pct);
                }
            }
            row++;
        }

        // Grand totals row
        if (row > dataStartRow) {
            Row tot = sheet.createRow(row);
            Cell tl = tot.createCell(0);
            tl.setCellValue("GRAND TOTAL");
            tl.setCellStyle(s.totalsLabel);
            for (int m = 1; m <= MONTHS; m++) {
                int base = 1 + (m - 1) * 4;
                // Cap & Dem sums
                for (int offset = 0; offset < 2; offset++) {
                    int c = base + offset;
                    Cell sc = tot.createCell(c);
                    sc.setCellFormula("SUM(" + col(c) + (dataStartRow + 1) + ":" + col(c) + row + ")");
                    sc.setCellStyle(s.totalsNum);
                }
                // Gap = Cap - Dem for totals row
                int exRow = row + 1;
                Cell gc = tot.createCell(base + 2);
                gc.setCellFormula(col(base) + exRow + "-" + col(base + 1) + exRow);
                gc.setCellStyle(s.totalsNum);
                // Util %
                Cell uc = tot.createCell(base + 3);
                uc.setCellFormula("IF(" + col(base) + exRow + ">0," + col(base + 1) + exRow + "/" + col(base) + exRow + ",0)");
                uc.setCellStyle(s.pct);
            }

            // Note explaining the numbers
            Row noteRow = sheet.createRow(row + 2);
            Cell note = noteRow.createCell(0);
            note.setCellValue(
                "Cap (h) and Dem (h) are computed by the planning engine from resource availability and project demand. " +
                "Gap = Cap − Dem (positive = surplus capacity, negative = overloaded). " +
                "Util % = Dem ÷ Cap.");
            note.setCellStyle(s.noteStyle);
            sheet.addMergedRegion(new CellRangeAddress(row + 2, row + 2, 0, lastCol));
        }

        // Column widths
        sheet.setColumnWidth(0, 5500);
        for (int c = 1; c <= lastCol; c++) {
            sheet.setColumnWidth(c, 2400);
        }
    }

    // ── Tab 4: Hiring Forecast ────────────────────────────────────────
    private void buildHiringTab(XSSFWorkbook wb, Styles s,
            CalculationSnapshot snap,
            Map<Integer, String> monthLabels) {

        XSSFSheet sheet = wb.createSheet("4. Hiring Forecast");
        sheet.createFreezePane(0, 2);

        Row title = sheet.createRow(0);
        Cell tc = title.createCell(0);
        tc.setCellValue("Hiring Forecast — Roles Needed to Close Capacity Gaps");
        tc.setCellStyle(s.sheetTitle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 5));

        Row hdr = sheet.createRow(1);
        String[] hdrs = {"POD", "Role", "Month", "Deficit (hrs)", "FTEs Needed", "Derivation"};
        for (int i = 0; i < hdrs.length; i++) {
            Cell c = hdr.createCell(i);
            c.setCellValue(hdrs[i]);
            c.setCellStyle(s.colHeader);
        }

        List<PodRoleMonthHire> hires = snap.hiringForecast().stream()
                .sorted(Comparator.comparing(PodRoleMonthHire::podName)
                        .thenComparing(h -> h.role().name())
                        .thenComparingInt(PodRoleMonthHire::monthIndex))
                .collect(Collectors.toList());

        int row = 2;
        for (PodRoleMonthHire h : hires) {
            Row dr = sheet.createRow(row++);
            setStr(dr, 0, h.podName(), s.normal);
            setStr(dr, 1, h.role().name(), s.normal);
            setStr(dr, 2, monthLabels.getOrDefault(h.monthIndex(), "M" + h.monthIndex()), s.normal);

            double defHrs = h.deficitHours() != null ? h.deficitHours().doubleValue() : 0.0;
            double ftesNeeded = h.ftesNeeded() != null ? h.ftesNeeded().setScale(2, RoundingMode.HALF_UP).doubleValue() : 0.0;
            setDbl(dr, 3, defHrs, s.num1dp);
            setDbl(dr, 4, ftesNeeded, s.num2dp);

            // Derivation note
            double workHrs = (defHrs > 0 && ftesNeeded > 0) ? defHrs / ftesNeeded : 160.0;
            Cell note = dr.createCell(5);
            note.setCellValue("≈ " + Math.round(defHrs) + " hrs ÷ " + Math.round(workHrs) + " working hrs/month");
            note.setCellStyle(s.noteStyle);
        }

        if (row == 2) {
            Row empty = sheet.createRow(2);
            Cell ec = empty.createCell(0);
            ec.setCellValue("No hiring needed — all capacity gaps are within tolerance.");
            ec.setCellStyle(s.noteStyle);
            sheet.addMergedRegion(new CellRangeAddress(2, 2, 0, 5));
        }

        sheet.setColumnWidth(0, 5000);
        sheet.setColumnWidth(1, 3500);
        sheet.setColumnWidth(2, 2800);
        sheet.setColumnWidth(3, 3200);
        sheet.setColumnWidth(4, 3200);
        sheet.setColumnWidth(5, 9000);
    }

    // ── Style factory ─────────────────────────────────────────────────
    private static class Styles {
        final CellStyle sheetTitle, colHeader, monthGroup, subHeader, rowLabel;
        final CellStyle normal, num, num1dp, num2dp, pct;
        final CellStyle gapPos, gapNeg, utilHigh, utilWarn, utilOk;
        final CellStyle totalsLabel, totalsNum, noteStyle;

        Styles(XSSFWorkbook wb) {
            Font hdrFont = wb.createFont();
            hdrFont.setBold(true);
            hdrFont.setFontHeightInPoints((short) 11);
            hdrFont.setColor(IndexedColors.WHITE.getIndex());

            Font subHdrFont = wb.createFont();
            subHdrFont.setBold(true);
            subHdrFont.setFontHeightInPoints((short) 9);

            Font boldFont = wb.createFont();
            boldFont.setBold(true);
            boldFont.setFontHeightInPoints((short) 10);

            Font normalFont = wb.createFont();
            normalFont.setFontHeightInPoints((short) 10);

            Font noteFont = wb.createFont();
            noteFont.setItalic(true);
            noteFont.setFontHeightInPoints((short) 9);
            noteFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());

            sheetTitle  = mk(wb, hdrFont,    CLR_HEADER_BG,  null, HorizontalAlignment.LEFT,   null);
            colHeader   = mk(wb, hdrFont,    CLR_SECTION_BG, null, HorizontalAlignment.CENTER, null);
            monthGroup  = mk(wb, hdrFont,    CLR_SECTION_BG, null, HorizontalAlignment.CENTER, null);
            subHeader   = mk(wb, subHdrFont, CLR_SUB_BG,     null, HorizontalAlignment.CENTER, null);
            rowLabel    = mk(wb, boldFont,   null,           null, HorizontalAlignment.LEFT,   null);
            normal      = mk(wb, normalFont, null,           null, HorizontalAlignment.LEFT,   null);
            num         = mk(wb, normalFont, null,           null, HorizontalAlignment.RIGHT,  "#,##0");
            num1dp      = mk(wb, normalFont, null,           null, HorizontalAlignment.RIGHT,  "#,##0.0");
            num2dp      = mk(wb, normalFont, null,           null, HorizontalAlignment.RIGHT,  "#,##0.00");
            pct         = mk(wb, normalFont, null,           null, HorizontalAlignment.RIGHT,  "0.0%");
            gapPos      = mk(wb, normalFont, CLR_GAP_POS,    null, HorizontalAlignment.RIGHT,  "#,##0.0");
            gapNeg      = mk(wb, normalFont, CLR_GAP_NEG,    null, HorizontalAlignment.RIGHT,  "#,##0.0");
            utilHigh    = mk(wb, normalFont, CLR_UTIL_HIGH,  null, HorizontalAlignment.RIGHT,  "0.0%");
            utilWarn    = mk(wb, normalFont, CLR_UTIL_WARN,  null, HorizontalAlignment.RIGHT,  "0.0%");
            utilOk      = mk(wb, normalFont, null,           null, HorizontalAlignment.RIGHT,  "0.0%");
            totalsLabel = mk(wb, boldFont,   CLR_SUB_BG,     null, HorizontalAlignment.RIGHT,  null);
            totalsNum   = mk(wb, boldFont,   CLR_SUB_BG,     null, HorizontalAlignment.RIGHT,  "#,##0.0");
            noteStyle   = mk(wb, noteFont,   null,           null, HorizontalAlignment.LEFT,   null);
        }

        private XSSFCellStyle mk(XSSFWorkbook wb, Font font, byte[] bg, byte[] fg,
                HorizontalAlignment align, String numFmt) {
            XSSFCellStyle cs = wb.createCellStyle();
            cs.setFont(font);
            if (bg != null) {
                cs.setFillForegroundColor(new XSSFColor(bg, null));
                cs.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            }
            cs.setAlignment(align);
            cs.setVerticalAlignment(VerticalAlignment.CENTER);
            cs.setBorderBottom(BorderStyle.THIN);
            cs.setBorderTop(BorderStyle.THIN);
            cs.setBorderLeft(BorderStyle.THIN);
            cs.setBorderRight(BorderStyle.THIN);
            if (numFmt != null) {
                cs.setDataFormat(wb.createDataFormat().getFormat(numFmt));
            }
            return cs;
        }
    }

    // ── Cell helpers ──────────────────────────────────────────────────
    private static void setStr(Row row, int col, String val, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(val != null ? val : "");
        c.setCellStyle(style);
    }

    private static void setNum(Row row, int col, Number val, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(val != null ? val.doubleValue() : 0);
        c.setCellStyle(style);
    }

    private static void setDbl(Row row, int col, double val, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(val);
        c.setCellStyle(style);
    }

    private static void makeCell(Row row, int col, String val, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(val);
        c.setCellStyle(style);
    }

    /** Convert 0-based column index to Excel letter: 0→A, 25→Z, 26→AA */
    private static String col(int idx) {
        StringBuilder sb = new StringBuilder();
        idx++; // make 1-based
        while (idx > 0) {
            idx--;
            sb.insert(0, (char) ('A' + idx % 26));
            idx /= 26;
        }
        return sb.toString();
    }

    private static String nvl(String s) {
        return s != null ? s : "—";
    }

    private static byte[] hex(String hex) {
        String h = hex.replace("#", "");
        return new byte[]{
                (byte) Integer.parseInt(h.substring(0, 2), 16),
                (byte) Integer.parseInt(h.substring(2, 4), 16),
                (byte) Integer.parseInt(h.substring(4, 6), 16)
        };
    }
}
