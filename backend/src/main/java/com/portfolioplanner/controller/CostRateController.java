package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.CostRate;
import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.domain.repository.CostRateRepository;
import com.portfolioplanner.dto.response.CostRateResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/cost-rates")
@RequiredArgsConstructor
public class CostRateController {

    private final CostRateRepository costRateRepository;

    /** Request DTO for create / update */
    public record CostRateRequest(
            @NotNull Role role,
            @NotNull Location location,
            @NotNull @DecimalMin("0.00") BigDecimal hourlyRate
    ) {}

    private CostRateResponse toResponse(CostRate r) {
        return new CostRateResponse(r.getId(), r.getRole(), r.getLocation(), r.getHourlyRate());
    }

    @GetMapping
    public List<CostRateResponse> getAll() {
        return costRateRepository.findAll().stream().map(this::toResponse).toList();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<CostRateResponse> create(@Valid @RequestBody CostRateRequest req) {
        // Enforce uniqueness: one rate per role+location
        costRateRepository.findByRoleAndLocation(req.role(), req.location()).ifPresent(existing -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A cost rate for " + req.role() + " / " + req.location() + " already exists");
        });
        CostRate entity = new CostRate(null, req.role(), req.location(), req.hourlyRate());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(costRateRepository.save(entity)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public CostRateResponse update(@PathVariable Long id, @Valid @RequestBody CostRateRequest req) {
        CostRate entity = costRateRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cost rate not found"));
        entity.setRole(req.role());
        entity.setLocation(req.location());
        entity.setHourlyRate(req.hourlyRate());
        return toResponse(costRateRepository.save(entity));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!costRateRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cost rate not found");
        }
        costRateRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
