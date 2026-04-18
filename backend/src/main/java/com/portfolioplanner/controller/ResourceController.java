package com.portfolioplanner.controller;

import com.portfolioplanner.dto.request.ResourceAvailabilityRequest;
import com.portfolioplanner.dto.request.ResourcePodAssignmentRequest;
import com.portfolioplanner.dto.request.ResourceRequest;
import com.portfolioplanner.dto.response.AvailabilityResponse;
import com.portfolioplanner.dto.response.ResourceResponse;
import com.portfolioplanner.service.AvailabilityService;
import com.portfolioplanner.service.ResourceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ResourceController {

    private final ResourceService resourceService;
    private final AvailabilityService availabilityService;

    @GetMapping
    public ResponseEntity<Page<ResourceResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(resourceService.getAll(page, size));
    }

    @GetMapping("/all")
    public ResponseEntity<List<ResourceResponse>> getAllUnpaginated() {
        return ResponseEntity.ok(resourceService.getAllUnpaginated());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResourceResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(resourceService.getById(id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<ResourceResponse> create(@Valid @RequestBody ResourceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(resourceService.create(request));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<ResourceResponse> update(@PathVariable Long id, @Valid @RequestBody ResourceRequest request) {
        return ResponseEntity.ok(resourceService.update(id, request));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        resourceService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/actual-rate")
    public ResponseEntity<ResourceResponse> updateActualRate(@PathVariable Long id,
                                                             @RequestBody Map<String, BigDecimal> body) {
        BigDecimal rate = body.get("actualRate");
        return ResponseEntity.ok(resourceService.updateActualRate(id, rate));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/assignment")
    public ResponseEntity<ResourceResponse> setAssignment(@PathVariable Long id,
                                                          @Valid @RequestBody ResourcePodAssignmentRequest request) {
        return ResponseEntity.ok(resourceService.setAssignment(id, request));
    }

    @GetMapping("/availability")
    public ResponseEntity<List<AvailabilityResponse>> getAllAvailability() {
        return ResponseEntity.ok(availabilityService.getAllAvailability());
    }

    @GetMapping("/{id}/availability")
    public ResponseEntity<AvailabilityResponse> getAvailability(@PathVariable Long id) {
        return ResponseEntity.ok(availabilityService.getAvailability(id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/availability")
    public ResponseEntity<AvailabilityResponse> setAvailability(@PathVariable Long id,
                                                                @Valid @RequestBody List<ResourceAvailabilityRequest> requests) {
        return ResponseEntity.ok(availabilityService.setAvailability(id, requests));
    }
}
