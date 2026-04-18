package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.dto.response.CostRateResponse;
import com.portfolioplanner.service.CostRateService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/cost-rates")
@RequiredArgsConstructor
public class CostRateController {

    private final CostRateService service;

    /** Request DTO for create / update */
    public record CostRateRequest(
            @NotNull Role role,
            @NotNull Location location,
            @NotNull @DecimalMin("0.00") BigDecimal hourlyRate
    ) {}

    @GetMapping
    public List<CostRateResponse> getAll() {
        return service.getAll();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<CostRateResponse> create(@Valid @RequestBody CostRateRequest req) {
        CostRateResponse response = service.create(req.role(), req.location(), req.hourlyRate());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public CostRateResponse update(@PathVariable Long id, @Valid @RequestBody CostRateRequest req) {
        return service.update(id, req.role(), req.location(), req.hourlyRate());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
