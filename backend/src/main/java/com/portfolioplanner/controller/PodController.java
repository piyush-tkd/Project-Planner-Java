package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.dto.response.PodResponse;
import com.portfolioplanner.service.PodService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/pods")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class PodController {

    private final PodService podService;

    @GetMapping
    public ResponseEntity<Page<PodResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(podService.getAll(page, size));
    }

    @GetMapping("/all")
    public ResponseEntity<List<PodResponse>> getAllUnpaginated() {
        return ResponseEntity.ok(podService.getAllUnpaginated());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PodResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(podService.getById(id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<PodResponse> create(@RequestBody Pod pod) {
        return ResponseEntity.status(HttpStatus.CREATED).body(podService.create(pod));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<PodResponse> update(@PathVariable Long id, @RequestBody Pod pod) {
        return ResponseEntity.ok(podService.update(id, pod));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        podService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
