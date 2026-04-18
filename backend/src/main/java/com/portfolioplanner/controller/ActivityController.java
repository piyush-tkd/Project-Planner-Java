package com.portfolioplanner.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Stub endpoint for the frontend activity feed.
 *
 * The frontend's useActivityFeed hook polls GET /api/activity every 30 seconds.
 * Until a real audit/activity log is implemented this returns an empty list so
 * the hook falls back to its synthetic feed without generating 404 errors.
 */
@RestController
@RequestMapping("/api/activity")
public class ActivityController {

    @GetMapping
    public ResponseEntity<List<Object>> getActivity() {
        return ResponseEntity.ok(List.of());
    }
}
