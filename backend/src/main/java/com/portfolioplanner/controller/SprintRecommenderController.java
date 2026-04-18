package com.portfolioplanner.controller;

import com.portfolioplanner.service.SprintRecommenderService;
import com.portfolioplanner.service.SprintRecommenderService.RecommendResult;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Sprint Planning Recommender — POST /api/sprints/recommend
 *
 * Accepts current sprint planning inputs and returns a recommended scope
 * with confidence level and rationale.
 */
@RestController
@RequestMapping("/api/sprints")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class SprintRecommenderController {

    private final SprintRecommenderService sprintRecommenderService;

    public record RecommendRequest(
            Double  avgVelocity,
            Integer backlogPoints,
            Double  teamCapacity,
            String  projectKey
    ) {}

    public record RecommendResponse(
            int     recommendedPoints,
            String  confidence,
            String  riskLevel,
            String  rationale,
            Integer historicalBaseline,
            Integer sprintsAnalyzed
    ) {}

    @PostMapping("/recommend")
    public ResponseEntity<RecommendResponse> recommend(@RequestBody RecommendRequest req) {
        RecommendResult result = sprintRecommenderService.recommend(
                req.avgVelocity(), req.backlogPoints(), req.teamCapacity(), req.projectKey());
        return ResponseEntity.ok(new RecommendResponse(
                result.recommendedPoints(), result.confidence(), result.riskLevel(),
                result.rationale(), result.historicalBaseline(), result.sprintsAnalyzed()));
    }
}
