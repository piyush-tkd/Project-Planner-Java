package com.portfolioplanner.controller;

import com.portfolioplanner.dto.request.BauAssumptionRequest;
import com.portfolioplanner.dto.response.BauAssumptionResponse;
import com.portfolioplanner.service.BauAssumptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/bau-assumptions")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class BauAssumptionController {

    private final BauAssumptionService bauService;

    @GetMapping
    public ResponseEntity<List<BauAssumptionResponse>> getAll() {
        return ResponseEntity.ok(bauService.getAll());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping
    public ResponseEntity<List<BauAssumptionResponse>> bulkUpdate(
            @Valid @RequestBody List<BauAssumptionRequest> requests) {
        return ResponseEntity.ok(bauService.bulkUpdate(requests));
    }
}
