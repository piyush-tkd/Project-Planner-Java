package com.portfolioplanner.controller;

import com.portfolioplanner.dto.request.ReleaseCalendarRequest;
import com.portfolioplanner.dto.response.ReleaseCalendarResponse;
import com.portfolioplanner.service.ReleaseCalendarService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/releases")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ReleaseCalendarController {

    private final ReleaseCalendarService releaseCalendarService;

    @GetMapping
    public ResponseEntity<List<ReleaseCalendarResponse>> getAll() {
        return ResponseEntity.ok(releaseCalendarService.getAll());
    }

    @PostMapping
    public ResponseEntity<ReleaseCalendarResponse> create(@Valid @RequestBody ReleaseCalendarRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(releaseCalendarService.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ReleaseCalendarResponse> update(@PathVariable Long id,
                                                           @Valid @RequestBody ReleaseCalendarRequest request) {
        return ResponseEntity.ok(releaseCalendarService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        releaseCalendarService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
