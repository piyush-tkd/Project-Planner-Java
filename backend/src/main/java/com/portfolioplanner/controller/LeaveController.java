package com.portfolioplanner.controller;

import com.portfolioplanner.service.LeaveService;
import com.portfolioplanner.service.LeaveService.LeaveEntryResponse;
import com.portfolioplanner.service.LeaveService.ImportResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/leave")
@RequiredArgsConstructor
public class LeaveController {

    private final LeaveService service;

    @GetMapping
    public List<LeaveEntryResponse> getAll(@RequestParam(defaultValue = "0") int year) {
        return service.getAll(year);
    }

    @PostMapping("/import")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<ImportResult> importExcel(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "0") int year,
            @RequestParam(defaultValue = "false") boolean replace) throws IOException {
        return ResponseEntity.ok(service.importExcel(file, year, replace));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/year/{year}")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<Void> clearYear(@PathVariable int year) {
        service.clearYear(year);
        return ResponseEntity.noContent().build();
    }
}
