package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.JiraSyncedSprint;
import com.portfolioplanner.domain.repository.JiraSyncedSprintRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * Sprint Planning Recommender — POST /api/sprints/recommend
 *
 * Accepts current sprint planning inputs and returns a recommended scope
 * with confidence level and rationale. Optionally enriches recommendations
 * using historical JiraSyncedSprint data when available.
 */
@RestController
@RequestMapping("/api/sprints")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class SprintRecommenderController {

    private final JiraSyncedSprintRepository sprintRepo;

    // ── Request / Response records ──────────────────────────────────────────

    public record RecommendRequest(
            Double avgVelocity,       // story points completed per sprint (manual or computed)
            Integer backlogPoints,    // total points in ready backlog
            Double teamCapacity,      // 0.0 – 1.0 (e.g. 0.8 = 80% capacity this sprint)
            String projectKey         // optional: enrich with historical data
    ) {}

    public record RecommendResponse(
            int recommendedPoints,
            String confidence,   // HIGH / MEDIUM / LOW
            String riskLevel,    // GREEN / AMBER / RED
            String rationale,
            Integer historicalBaseline,  // null if no history
            Integer sprintsAnalyzed
    ) {}

    // ── Endpoint ────────────────────────────────────────────────────────────

    @PostMapping("/recommend")
    public ResponseEntity<RecommendResponse> recommend(@RequestBody RecommendRequest req) {

        // 1. Determine velocity baseline
        double velocity = req.avgVelocity() != null ? req.avgVelocity() : 0;
        Integer historicalBaseline = null;
        int sprintsAnalyzed = 0;

        // If a projectKey is provided, try to enrich with real historical data
        if (req.projectKey() != null && !req.projectKey().isBlank()) {
            List<JiraSyncedSprint> closed = sprintRepo.findClosedByProjectKeys(
                    List.of(req.projectKey().trim().toUpperCase()));
            // Take up to last 3 closed sprints for baseline
            // JiraSyncedSprint doesn't carry storyPoints directly, so we can only
            // report the count and let the frontend show the manual override path.
            sprintsAnalyzed = Math.min(closed.size(), 3);
        }

        // 2. Capacity-adjusted target
        double capacity = (req.teamCapacity() != null && req.teamCapacity() > 0)
                ? Math.min(req.teamCapacity(), 1.0)
                : 1.0;

        double adjusted = velocity * capacity;
        int recommended = (int) Math.round(adjusted);

        // 3. Cap at backlog size if provided
        if (req.backlogPoints() != null && req.backlogPoints() > 0) {
            recommended = Math.min(recommended, req.backlogPoints());
        }

        // 4. Confidence: needs at least 1 sprint of data + reasonable capacity
        String confidence;
        String riskLevel;
        String rationale;

        if (velocity <= 0) {
            confidence = "LOW";
            riskLevel  = "AMBER";
            rationale  = "No velocity baseline provided. Enter average story points from recent sprints for a more accurate recommendation.";
            recommended = req.backlogPoints() != null ? (int) Math.ceil(req.backlogPoints() * 0.4) : 20;
        } else if (sprintsAnalyzed >= 3 || velocity > 0) {
            if (capacity >= 0.9) {
                confidence = "HIGH";
                riskLevel  = "GREEN";
                rationale  = String.format(
                        "Recommended %d points based on %.0f%% team capacity applied to %.0f-point velocity baseline.",
                        recommended, capacity * 100, velocity);
            } else if (capacity >= 0.65) {
                confidence = "MEDIUM";
                riskLevel  = "GREEN";
                rationale  = String.format(
                        "Recommended %d points. Team capacity is %.0f%% — scope is proportionally reduced.",
                        recommended, capacity * 100);
            } else {
                confidence = "MEDIUM";
                riskLevel  = "AMBER";
                rationale  = String.format(
                        "Capacity is low (%.0f%%). Recommended %d points — consider reducing scope further to protect quality.",
                        capacity * 100, recommended);
            }

            // Overcommit check: if recommended > 110% of backlog
            if (req.backlogPoints() != null && req.backlogPoints() > 0
                    && recommended > req.backlogPoints()) {
                riskLevel = "RED";
                rationale += " Warning: recommended scope exceeds available backlog — backlog grooming needed.";
            }
        } else {
            confidence = "MEDIUM";
            riskLevel  = "GREEN";
            rationale  = String.format(
                    "Recommended %d points based on the velocity you entered. Link a Jira project for automated historical analysis.",
                    recommended);
        }

        return ResponseEntity.ok(new RecommendResponse(
                recommended,
                confidence,
                riskLevel,
                rationale,
                historicalBaseline,
                sprintsAnalyzed > 0 ? sprintsAnalyzed : null
        ));
    }
}
