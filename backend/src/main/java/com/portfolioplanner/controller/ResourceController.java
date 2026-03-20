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
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor
public class ResourceController {

    private final ResourceService resourceService;
    private final AvailabilityService availabilityService;

    @GetMapping
    public ResponseEntity<List<ResourceResponse>> getAll() {
        return ResponseEntity.ok(resourceService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResourceResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(resourceService.getById(id));
    }

    @PostMapping
    public ResponseEntity<ResourceResponse> create(@Valid @RequestBody ResourceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(resourceService.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResourceResponse> update(@PathVariable Long id, @Valid @RequestBody ResourceRequest request) {
        return ResponseEntity.ok(resourceService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        resourceService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/actual-rate")
    public ResponseEntity<ResourceResponse> updateActualRate(@PathVariable Long id,
                                                             @RequestBody Map<String, BigDecimal> body) {
        BigDecimal rate = body.get("actualRate");
        return ResponseEntity.ok(resourceService.updateActualRate(id, rate));
    }

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

    @PutMapping("/{id}/availability")
    public ResponseEntity<AvailabilityResponse> setAvailability(@PathVariable Long id,
                                                                @Valid @RequestBody List<ResourceAvailabilityRequest> requests) {
        return ResponseEntity.ok(availabilityService.setAvailability(id, requests));
    }
}
