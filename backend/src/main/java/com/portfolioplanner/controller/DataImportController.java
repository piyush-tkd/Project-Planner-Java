package com.portfolioplanner.controller;

import com.portfolioplanner.dto.response.ExcelImportResponse;
import com.portfolioplanner.service.ExcelImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.CacheManager;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/data")
@RequiredArgsConstructor
public class DataImportController {

    private final ExcelImportService excelImportService;
    private final CacheManager cacheManager;

    @PostMapping(value = "/import-excel", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ExcelImportResponse> importExcel(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(
                    new ExcelImportResponse(false, "No file provided", Map.of(), List.of()));
        }

        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".xlsx")) {
            return ResponseEntity.badRequest().body(
                    new ExcelImportResponse(false, "Only .xlsx files are supported", Map.of(), List.of()));
        }

        ExcelImportResponse result = excelImportService.importExcel(file);

        // Explicitly evict calculation cache after transaction commits
        // to ensure subsequent requests see fresh data
        var cache = cacheManager.getCache("calculations");
        if (cache != null) {
            cache.clear();
        }

        return ResponseEntity.ok(result);
    }
}
