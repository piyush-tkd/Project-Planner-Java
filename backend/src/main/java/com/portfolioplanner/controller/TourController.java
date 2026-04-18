package com.portfolioplanner.controller;

import com.portfolioplanner.service.TourService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/tour")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class TourController {

    private final TourService tourService;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(tourService.getStatus(principal.getUsername()));
    }

    @PostMapping("/seen")
    public ResponseEntity<Void> markSeen(
            @AuthenticationPrincipal UserDetails principal) {
        tourService.markSeen(principal.getUsername());
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getConfig() {
        return ResponseEntity.ok(tourService.getConfig());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/config")
    public ResponseEntity<Map<String, Object>> updateConfig(
            @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(tourService.updateConfig(body));
    }
}
