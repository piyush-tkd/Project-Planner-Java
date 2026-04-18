package com.portfolioplanner.controller;

import com.portfolioplanner.dto.request.TemporaryOverrideRequest;
import com.portfolioplanner.dto.response.TemporaryOverrideResponse;
import com.portfolioplanner.service.TemporaryOverrideService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/overrides")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class TemporaryOverrideController {

    private final TemporaryOverrideService overrideService;

    @GetMapping
    public ResponseEntity<List<TemporaryOverrideResponse>> getAll() {
        return ResponseEntity.ok(overrideService.getAll());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<TemporaryOverrideResponse> create(@Valid @RequestBody TemporaryOverrideRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(overrideService.create(request));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<TemporaryOverrideResponse> update(@PathVariable Long id,
                                                            @Valid @RequestBody TemporaryOverrideRequest request) {
        return ResponseEntity.ok(overrideService.update(id, request));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        overrideService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
