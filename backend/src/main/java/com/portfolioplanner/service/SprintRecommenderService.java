package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.JiraSyncedSprint;
import com.portfolioplanner.domain.repository.JiraSyncedSprintRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SprintRecommenderService {

    private final JiraSyncedSprintRepository sprintRepo;

    /**
     * Recommends sprint scope based on velocity, capacity, and optional historical data.
     */
    public RecommendResult recommend(Double avgVelocity, Integer backlogPoints,
                                     Double teamCapacity, String projectKey) {
        double velocity = avgVelocity != null ? avgVelocity : 0;
        int sprintsAnalyzed = 0;

        if (projectKey != null && !projectKey.isBlank()) {
            List<JiraSyncedSprint> closed = sprintRepo.findClosedByProjectKeys(
                    List.of(projectKey.trim().toUpperCase()));
            sprintsAnalyzed = Math.min(closed.size(), 3);
        }

        double capacity = (teamCapacity != null && teamCapacity > 0)
                ? Math.min(teamCapacity, 1.0)
                : 1.0;

        double adjusted = velocity * capacity;
        int recommended = (int) Math.round(adjusted);

        if (backlogPoints != null && backlogPoints > 0) {
            recommended = Math.min(recommended, backlogPoints);
        }

        String confidence;
        String riskLevel;
        String rationale;

        if (velocity <= 0) {
            confidence  = "LOW";
            riskLevel   = "AMBER";
            rationale   = "No velocity baseline provided. Enter average story points from recent sprints for a more accurate recommendation.";
            recommended = backlogPoints != null ? (int) Math.ceil(backlogPoints * 0.4) : 20;
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

            if (backlogPoints != null && backlogPoints > 0 && recommended > backlogPoints) {
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

        return new RecommendResult(recommended, confidence, riskLevel, rationale,
                null, sprintsAnalyzed > 0 ? sprintsAnalyzed : null);
    }

    public record RecommendResult(
            int    recommendedPoints,
            String confidence,
            String riskLevel,
            String rationale,
            Integer historicalBaseline,
            Integer sprintsAnalyzed
    ) {}
}
