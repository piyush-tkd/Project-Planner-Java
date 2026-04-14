package com.portfolioplanner.controller;

import com.portfolioplanner.dto.request.SprintRequest;
import com.portfolioplanner.dto.response.SprintResponse;
import com.portfolioplanner.service.SprintService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/sprints")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class SprintController {

    private final SprintService sprintService;

    @GetMapping
    public ResponseEntity<List<SprintResponse>> getAll() {
        return ResponseEntity.ok(sprintService.getAll());
    }

    @PostMapping
    public ResponseEntity<SprintResponse> create(@Valid @RequestBody SprintRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(sprintService.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SprintResponse> update(@PathVariable Long id,
                                                  @Valid @RequestBody SprintRequest request) {
        return ResponseEntity.ok(sprintService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        sprintService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
