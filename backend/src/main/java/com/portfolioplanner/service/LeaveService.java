package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.LeaveEntry;
import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.repository.LeaveEntryRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LeaveService {

    private final LeaveEntryRepository leaveRepo;
    private final ResourceRepository resourceRepo;

    public record LeaveEntryResponse(
        Long   id,
        Long   resourceId,
        String resourceName,
        int    monthIndex,
        int    leaveYear,
        double leaveHours,
        String leaveType,
        String notes
    ) {}

    public record ImportResult(int imported, int skipped, List<String> skippedNames) {}

    public List<LeaveEntryResponse> getAll(int year) {
        int y = year > 0 ? year : LocalDate.now().getYear();
        return leaveRepo.findByLeaveYearWithResource(y).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public ImportResult importExcel(MultipartFile file, int year, boolean replace) throws IOException {
        int planYear = year > 0 ? year : LocalDate.now().getYear();

        List<Resource> allResources = resourceRepo.findAll();
        Map<String, Resource> byLower = new HashMap<>();
        for (Resource r : allResources) {
            if (Boolean.TRUE.equals(r.getActive())) {
                byLower.put(r.getName().toLowerCase().trim(), r);
            }
        }

        Set<String> leaveTypes = Set.of("PL", "SL", "HD", "CPL");
        List<LeaveEntry> toSave = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> matched = new ArrayList<>();

        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);

            Row headerRow = null;
            for (int r = 0; r <= 15; r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                int dateCells = 0;
                for (int c = 2; c < 35; c++) {
                    Cell cell = row.getCell(c);
                    if (cell != null && cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
                        dateCells++;
                    }
                }
                if (dateCells >= 20) {
                    headerRow = row;
                    log.info("LeaveImport: found header row at index {}", r);
                    break;
                }
            }

            if (headerRow == null) {
                return new ImportResult(0, 0, List.of("Could not find header row with dates"));
            }

            Map<Integer, Integer> colToMonth = new HashMap<>();
            for (int c = 2; c < headerRow.getLastCellNum(); c++) {
                Cell cell = headerRow.getCell(c);
                if (cell != null && cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
                    LocalDate d = cell.getLocalDateTimeCellValue().toLocalDate();
                    colToMonth.put(c, d.getMonthValue());
                }
            }

            int dataStartRow = headerRow.getRowNum() + 1;

            for (int r = dataStartRow; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                Cell nameCell = row.getCell(1);
                if (nameCell == null) continue;
                String rawName = nameCell.getStringCellValue().trim();
                if (rawName.isEmpty()) continue;

                Resource resource = byLower.get(rawName.toLowerCase());
                if (resource == null) {
                    String lowerName = rawName.toLowerCase();
                    for (Map.Entry<String, Resource> entry : byLower.entrySet()) {
                        if (entry.getKey().contains(lowerName) || lowerName.contains(entry.getKey().split("\\s")[0])) {
                            String[] parts = entry.getKey().split("\\s+");
                            if (parts.length > 0 && lowerName.startsWith(parts[0])) {
                                resource = entry.getValue();
                                break;
                            }
                        }
                    }
                }

                if (resource == null) {
                    skipped.add(rawName + " (not found in resources)");
                    continue;
                }

                Map<Integer, Double> monthHours = new HashMap<>();
                for (int c = 2; c < row.getLastCellNum(); c++) {
                    Cell cell = row.getCell(c);
                    if (cell == null) continue;
                    String val = "";
                    if (cell.getCellType() == CellType.STRING) {
                        val = cell.getStringCellValue().trim().toUpperCase();
                    }
                    if (!leaveTypes.contains(val)) continue;

                    Integer month = colToMonth.get(c);
                    if (month == null) continue;

                    double hrs = val.equals("HD") ? 4.0 : 8.0;
                    if (val.equals("CPL")) continue;

                    monthHours.merge(month, hrs, Double::sum);
                }

                if (!monthHours.isEmpty()) {
                    matched.add(rawName + " → " + resource.getName());
                    for (Map.Entry<Integer, Double> e : monthHours.entrySet()) {
                        LeaveEntry entry = new LeaveEntry();
                        entry.setResource(resource);
                        entry.setMonthIndex(e.getKey());
                        entry.setLeaveYear(planYear);
                        entry.setLeaveHours(BigDecimal.valueOf(e.getValue()));
                        entry.setLeaveType("PL");
                        entry.setNotes("Imported from Leave Planner");
                        toSave.add(entry);
                    }
                }
            }
        }

        if (replace && !toSave.isEmpty()) {
            for (LeaveEntry e : toSave) {
                leaveRepo.findByYearAndResourceId(planYear, e.getResource().getId())
                         .stream()
                         .filter(ex -> ex.getMonthIndex().equals(e.getMonthIndex()))
                         .forEach(ex -> leaveRepo.deleteById(ex.getId()));
            }
        }

        List<LeaveEntry> saved = leaveRepo.saveAll(toSave);
        log.info("LeaveImport: saved {} entries, skipped {} names", saved.size(), skipped.size());
        return new ImportResult(saved.size(), skipped.size(), skipped);
    }

    @Transactional
    public void delete(Long id) {
        leaveRepo.deleteById(id);
    }

    @Transactional
    public void clearYear(int year) {
        leaveRepo.deleteByLeaveYear(year);
    }

    private LeaveEntryResponse toResponse(LeaveEntry e) {
        return new LeaveEntryResponse(
            e.getId(),
            e.getResource().getId(),
            e.getResource().getName(),
            e.getMonthIndex(),
            e.getLeaveYear(),
            e.getLeaveHours().doubleValue(),
            e.getLeaveType(),
            e.getNotes()
        );
    }
}
