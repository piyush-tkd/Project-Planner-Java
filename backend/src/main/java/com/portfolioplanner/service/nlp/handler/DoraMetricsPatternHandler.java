package com.portfolioplanner.service.nlp.handler;

import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.service.nlp.NlpStrategy;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;

/**
 * DORA metrics and engineering performance handler.
 * Owns DORA_PATTERNS.
 */
@Component
public class DoraMetricsPatternHandler implements NlpPatternHandler {

    // ── DORA metrics patterns ─────────────────────────────────────────
    private static final List<Pattern> DORA_PATTERNS = List.of(
            Pattern.compile("(?i)(?:dora|deployment|deploy)\\s+(?:metrics|frequency|performance|stats|report)"),
            Pattern.compile("(?i)(?:show|give|open)\\s+(?:me\\s+)?(?:the\\s+)?dora\\s+(?:metrics|report|dashboard)"),
            Pattern.compile("(?i)(?:lead\\s+time)\\s+(?:for\\s+)?(?:changes?|deployments?)"),
            Pattern.compile("(?i)(?:change|deployment)\\s+(?:failure|fail)\\s+rate"),
            Pattern.compile("(?i)(?:mean\\s+time\\s+to)\\s+(?:recovery|restore|recover|MTTR)"),
            Pattern.compile("(?i)(?:deployment|deploy)\\s+(?:frequency|cadence|rate|count)")
    );

    @Override
    public String name() {
        return "DORA_METRICS";
    }

    @Override
    public NlpStrategy.NlpResult tryHandle(String query, NlpCatalogResponse catalog) {
        return tryDoraMetrics(query);
    }

    @Override
    public int order() {
        return 65;
    }

    private NlpStrategy.NlpResult tryDoraMetrics(String query) {
        for (Pattern p : DORA_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "DORA Metrics");
                data.put("route", "/reports/dora-metrics");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                        "Opening the DORA Metrics dashboard — deployment frequency, lead time for changes, change failure rate, and mean time to recovery.",
                        "/reports/dora-metrics", null, data, null,
                        List.of("Show Jira analytics", "Show sprint health", null), null);
            }
        }
        return null;
    }
}
