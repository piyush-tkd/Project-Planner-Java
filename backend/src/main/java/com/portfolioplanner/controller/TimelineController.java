package com.portfolioplanner.controller;

import com.portfolioplanner.dto.request.TimelineConfigRequest;
import com.portfolioplanner.dto.response.TimelineConfigResponse;
import com.portfolioplanner.service.TimelineService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/timeline")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class TimelineController {

    private final TimelineService timelineService;

    @GetMapping
    public ResponseEntity<TimelineConfigResponse> get() {
        return ResponseEntity.ok(timelineService.getCurrentConfig());
    }

    @PutMapping
    public ResponseEntity<TimelineConfigResponse> update(@Valid @RequestBody TimelineConfigRequest request) {
        return ResponseEntity.ok(timelineService.update(request));
    }
}
