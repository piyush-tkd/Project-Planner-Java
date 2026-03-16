package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.dto.response.PodResponse;
import com.portfolioplanner.service.PodService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pods")
@RequiredArgsConstructor
public class PodController {

    private final PodService podService;

    @GetMapping
    public ResponseEntity<List<PodResponse>> getAll() {
        return ResponseEntity.ok(podService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PodResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(podService.getById(id));
    }

    @PostMapping
    public ResponseEntity<PodResponse> create(@RequestBody Pod pod) {
        return ResponseEntity.status(HttpStatus.CREATED).body(podService.create(pod));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PodResponse> update(@PathVariable Long id, @RequestBody Pod pod) {
        return ResponseEntity.ok(podService.update(id, pod));
    }
}
