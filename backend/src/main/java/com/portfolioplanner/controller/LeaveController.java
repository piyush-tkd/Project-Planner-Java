package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.LeaveEntry;
import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.repository.LeaveEntryRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/leave")
@RequiredArgsConstructor
public class LeaveController {

    private final LeaveEntryRepository leaveRepo;
    private final ResourceRepository   resourceRepo;

    /** Response DTO */
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

    /** Get all leave entries for a year */
    @Transactional(readOnly = true)
    @GetMapping
    public List<LeaveEntryResponse> getAll(@RequestParam(defaultValue = "0") int year) {
        int y = year > 0 ? year : LocalDate.now().getYear();
        return leaveRepo.findByLeaveYearWithResource(y)
                        .stream()
                        .map(this::toResponse)
                        .toList();
    }

    /** Import leave data from an Excel file (Leave Planner format) */
    @Transactional
    @PostMapping("/import")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<ImportResult> importExcel(
            @RequestParam("file")                  MultipartFile file,
            @RequestParam(defaultValue = "0")  int year,
            @RequestParam(defaultValue = "false") boolean replace) throws IOException {

        int planYear = year > 0 ? year : LocalDate.now().getYear();

        // Build resource lookup: lowercase name → resource
        List<Resource> allResources = resourceRepo.findAll();
        Map<String, Resource> byLower = new HashMap<>();
        for (Resource r : allResources) {
            if (Boolean.TRUE.equals(r.getActive())) {
                byLower.put(r.getName().toLowerCase().trim(), r);
            }
        }

        Set<String> leaveTypes = Set.of("PL", "SL", "HD", "CPL");

        List<LeaveEntry> toSave     = new ArrayList<>();
        List<String>     skipped    = new ArrayList<>();
        List<String>     matched    = new ArrayList<>();

        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);

            // Find header row (contains date cells) — typically row index 7
            Row headerRow = null;
            for (int r = 0; r <= 15; r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                // Look for a row with many date-typed cells starting at col 2
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
                return ResponseEntity.badRequest().body(new ImportResult(0, 0, List.of("Could not find header row with dates")));
            }

            // Build col→month map
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

                // Try exact match, then partial match
                Resource resource = byLower.get(rawName.toLowerCase());
                if (resource == null) {
                    // Try to find by first word (first name)
                    String lowerName = rawName.toLowerCase();
                    for (Map.Entry<String, Resource> entry : byLower.entrySet()) {
                        if (entry.getKey().contains(lowerName) || lowerName.contains(entry.getKey().split("\\s")[0])) {
                            // Check first name match
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

                // Accumulate leave hours per month for this person
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
                    // CPL = cancelled planned leave → ignore (negative offset)
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
            // Merge: collect affected (resource, month) pairs and delete existing
            for (LeaveEntry e : toSave) {
                leaveRepo.findByYearAndResourceId(planYear, e.getResource().getId())
                         .stream()
                         .filter(ex -> ex.getMonthIndex().equals(e.getMonthIndex()))
                         .forEach(ex -> leaveRepo.deleteById(ex.getId()));
            }
        }

        List<LeaveEntry> saved = leaveRepo.saveAll(toSave);

        log.info("LeaveImport: saved {} entries, skipped {} names", saved.size(), skipped.size());
        return ResponseEntity.ok(new ImportResult(saved.size(), skipped.size(), skipped));
    }

    /** Delete a single leave entry */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!leaveRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave entry not found");
        }
        leaveRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /** Clear all leave for a year */
    @DeleteMapping("/year/{year}")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<Void> clearYear(@PathVariable int year) {
        leaveRepo.deleteByLeaveYear(year);
        return ResponseEntity.noContent().build();
    }

    public record ImportResult(int imported, int skipped, List<String> skippedNames) {}
}
