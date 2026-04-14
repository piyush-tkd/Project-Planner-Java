package com.portfolioplanner.service.nlp;

import com.portfolioplanner.dto.response.NlpCatalogResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Generates proactive insight cards for the Ask AI landing page.
 * Analyzes the entity catalog to surface timely, actionable information
 * that the user might want to ask about.
 */
@Service
@RequiredArgsConstructor
public class NlpInsightService {

    private static final Logger log = LoggerFactory.getLogger(NlpInsightService.class);
    private final NlpCatalogService catalogService;

    public record InsightCard(
            String id,
            String icon,                   // Tabler icon name (e.g., "alert-triangle", "calendar-event")
            String color,                  // Mantine color
            String title,                  // Short headline
            String description,            // 1-2 sentence detail
            String query,                  // Pre-filled query to run when clicked
            String toolName,               // Direct tool to call (e.g., "list_projects")
            Map<String, String> toolParams, // Tool params (e.g., {priority: "P0"})
            Map<String, String> filters,   // URL filter params for navigation (e.g., {priority: "P0"})
            String drillDownRoute          // Where to navigate (e.g., "/projects")
    ) {}

    /**
     * Generate a list of proactive insight cards based on current data.
     * Returns up to 4 most relevant insights.
     */
    public List<InsightCard> getInsights() {
        try {
            NlpCatalogResponse catalog = catalogService.getCatalog();
            List<InsightCard> insights = new ArrayList<>();

            generateSprintInsights(catalog, insights);
            generateReleaseInsights(catalog, insights);
            generateProjectInsights(catalog, insights);
            generateTeamInsights(catalog, insights);

            // Return top 4 insights, prioritized by urgency
            return insights.stream().limit(4).collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Failed to generate insights: {}", e.getMessage());
            return List.of();
        }
    }

    private void generateSprintInsights(NlpCatalogResponse catalog, List<InsightCard> insights) {
        if (catalog.sprintDetails() == null) return;
        LocalDate today = LocalDate.now();

        for (var sprint : catalog.sprintDetails()) {
            try {
                LocalDate end = LocalDate.parse(sprint.endDate(), DateTimeFormatter.ISO_DATE);
                long daysLeft = ChronoUnit.DAYS.between(today, end);

                if (daysLeft >= 0 && daysLeft <= 5) {
                    insights.add(0, new InsightCard(
                            "sprint-ending-" + sprint.id(),
                            "clock",
                            "orange",
                            sprint.name() + " ends in " + daysLeft + " day" + (daysLeft == 1 ? "" : "s"),
                            "Review sprint allocations and ensure all deliverables are on track.",
                            "Show me " + sprint.name() + " allocations",
                            "get_sprint_allocations",
                            Map.of("filter", "current"),
                            Map.of(),
                            "/sprint-calendar"
                    ));
                } else if (daysLeft > 5 && daysLeft <= 14) {
                    insights.add(new InsightCard(
                            "sprint-active-" + sprint.id(),
                            "player-play",
                            "blue",
                            sprint.name() + " is active (" + daysLeft + " days left)",
                            "Check sprint progress and team workload.",
                            "What's the sprint status?",
                            "get_sprint_info",
                            Map.of("name", "current"),
                            Map.of(),
                            "/sprint-calendar"
                    ));
                }
            } catch (Exception ignored) {}
        }
    }

    private void generateReleaseInsights(NlpCatalogResponse catalog, List<InsightCard> insights) {
        if (catalog.releaseDetails() == null) return;
        LocalDate today = LocalDate.now();

        for (var release : catalog.releaseDetails()) {
            try {
                // Check code freeze date
                if (release.codeFreezeDate() != null) {
                    LocalDate freeze = LocalDate.parse(release.codeFreezeDate(), DateTimeFormatter.ISO_DATE);
                    long daysToFreeze = ChronoUnit.DAYS.between(today, freeze);

                    if (daysToFreeze >= 0 && daysToFreeze <= 3) {
                        insights.add(0, new InsightCard(
                                "freeze-soon-" + release.id(),
                                "snowflake",
                                "red",
                                "Code freeze for " + release.name() + " in " + daysToFreeze + " day" + (daysToFreeze == 1 ? "" : "s") + "!",
                                "Ensure all features are merged and tested before the freeze.",
                                "Tell me about release " + release.name(),
                                "get_release_info",
                                Map.of("name", release.name()),
                                Map.of(),
                                "/release-calendar"
                        ));
                    }
                }

                // Check release date
                LocalDate relDate = LocalDate.parse(release.releaseDate(), DateTimeFormatter.ISO_DATE);
                long daysToRelease = ChronoUnit.DAYS.between(today, relDate);

                if (daysToRelease >= 0 && daysToRelease <= 7) {
                    insights.add(new InsightCard(
                            "release-soon-" + release.id(),
                            "rocket",
                            "grape",
                            release.name() + " releases in " + daysToRelease + " day" + (daysToRelease == 1 ? "" : "s"),
                            release.type() + " release — verify readiness and deployment plan.",
                            "Show upcoming releases",
                            "get_release_info",
                            Map.of("name", "upcoming"),
                            Map.of(),
                            "/release-calendar"
                    ));
                }
            } catch (Exception ignored) {}
        }
    }

    private void generateProjectInsights(NlpCatalogResponse catalog, List<InsightCard> insights) {
        if (catalog.projectDetails() == null) return;

        long activeCount = catalog.projectDetails().stream()
                .filter(p -> "ACTIVE".equalsIgnoreCase(p.status())).count();
        // Exclude COMPLETED and CANCELLED — critical = HIGHEST or BLOCKER
        long p0Count = catalog.projectDetails().stream()
                .filter(p -> ("HIGHEST".equalsIgnoreCase(p.priority()) || "BLOCKER".equalsIgnoreCase(p.priority()))
                        && !"COMPLETED".equalsIgnoreCase(p.status())
                        && !"CANCELLED".equalsIgnoreCase(p.status()))
                .count();
        long onHoldCount = catalog.projectDetails().stream()
                .filter(p -> "ON_HOLD".equalsIgnoreCase(p.status())).count();

        if (p0Count > 0) {
            insights.add(new InsightCard(
                    "p0-projects",
                    "alert-triangle",
                    "red",
                    p0Count + " critical (Highest) project" + (p0Count == 1 ? "" : "s") + " active",
                    "These need priority resource allocation. Verify they're on track.",
                    "Show me highest priority projects",
                    "list_projects",
                    Map.of("priority", "HIGHEST"),
                    Map.of("priority", "HIGHEST"),
                    "/projects"
            ));
        }

        if (onHoldCount >= 2) {
            insights.add(new InsightCard(
                    "on-hold-projects",
                    "status-change",
                    "yellow",
                    onHoldCount + " projects on hold",
                    "Review if any should be reactivated or cancelled to free up planning capacity.",
                    "Show on-hold projects",
                    "list_projects",
                    Map.of("status", "ON_HOLD"),
                    Map.of("status", "ON_HOLD"),
                    "/projects"
            ));
        }

        if (activeCount > 0 && insights.size() < 6) {
            insights.add(new InsightCard(
                    "portfolio-overview",
                    "briefcase",
                    "teal",
                    activeCount + " active projects across your portfolio",
                    "Get a health check on all active work.",
                    "Give me a portfolio overview",
                    "get_portfolio_summary",
                    Map.of(),
                    Map.of(),
                    "/reports/portfolio-health"
            ));
        }
    }

    private void generateTeamInsights(NlpCatalogResponse catalog, List<InsightCard> insights) {
        if (catalog.resourceDetails() == null) return;

        long totalResources = catalog.resourceDetails().size();
        // Count by actual location using centralized AliasResolver matching
        long usCount = catalog.resourceDetails().stream()
                .filter(r -> AliasResolver.matchesField(r.location(), "US"))
                .count();
        long indiaCount = catalog.resourceDetails().stream()
                .filter(r -> AliasResolver.matchesField(r.location(), "INDIA"))
                .count();

        if (totalResources > 0 && insights.size() < 6) {
            Map<String, Long> roleCounts = catalog.resourceDetails().stream()
                    .collect(Collectors.groupingBy(NlpCatalogResponse.ResourceInfo::role, Collectors.counting()));
            long devs = roleCounts.getOrDefault("DEVELOPER", 0L);
            long qas = roleCounts.getOrDefault("QA", 0L);

            if (qas > 0 && devs / qas > 3) {
                insights.add(new InsightCard(
                        "dev-qa-ratio",
                        "users",
                        "orange",
                        "Dev:QA ratio is " + devs + ":" + qas + " (" + String.format("%.1f", (double) devs / qas) + ":1)",
                        "Industry standard is ~2.5:1. You might need more QA coverage.",
                        "Show team composition",
                        "get_team_composition",
                        Map.of(),
                        Map.of(),
                        "/resources"
                ));
            }

            insights.add(new InsightCard(
                    "team-snapshot",
                    "chart-bar",
                    "blue",
                    totalResources + " team members (" + usCount + " US, " + indiaCount + " India)",
                    "Check utilization and capacity across all pods.",
                    "Show utilization summary",
                    "get_team_composition",
                    Map.of(),
                    Map.of(),
                    "/resources"
            ));
        }
    }
}
