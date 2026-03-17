package com.portfolioplanner.controller;

import com.portfolioplanner.config.JiraProperties;
import com.portfolioplanner.service.jira.JiraPodService;
import com.portfolioplanner.service.jira.JiraPodService.PodMetrics;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/jira/pods")
@RequiredArgsConstructor
public class JiraPodController {

    private final JiraPodService podService;
    private final JiraProperties props;

    /** Returns full POD metrics for all Jira projects. */
    @GetMapping
    public ResponseEntity<List<PodMetrics>> getAllPods() {
        return ResponseEntity.ok(podService.getAllPodMetrics());
    }
}
