package com.portfolioplanner.health;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Reports Jira API reachability.
 * Result is cached for 60 seconds to avoid hammering Jira on every /actuator/health poll.
 */
@Slf4j
@Component("jira")
public class JiraHealthIndicator implements HealthIndicator {

    private static final long CACHE_TTL_MS = 60_000L;

    private final RestTemplate restTemplate;
    private final String jiraBaseUrl;

    /** Cached health snapshot: [0] = Health, [1] = Instant of last check */
    private final AtomicReference<CachedHealth> cache = new AtomicReference<>(null);

    public JiraHealthIndicator(
            RestTemplate restTemplate,
            @Value("${jira.base-url:}") String jiraBaseUrl) {
        this.restTemplate = restTemplate;
        this.jiraBaseUrl  = jiraBaseUrl;
    }

    @Override
    public Health health() {
        if (jiraBaseUrl == null || jiraBaseUrl.isBlank()) {
            return Health.unknown().withDetail("reason", "jira.base-url not configured").build();
        }

        CachedHealth cached = cache.get();
        if (cached != null && !cached.isExpired()) {
            return cached.health;
        }

        Health fresh = probe();
        cache.set(new CachedHealth(fresh, Instant.now()));
        return fresh;
    }

    private Health probe() {
        try {
            String url = jiraBaseUrl.replaceAll("/+$", "") + "/rest/api/3/serverInfo";
            restTemplate.getForObject(url, String.class);
            return Health.up().withDetail("url", jiraBaseUrl).build();
        } catch (Exception ex) {
            log.debug("Jira health probe failed: {}", ex.getMessage());
            return Health.down()
                    .withDetail("url", jiraBaseUrl)
                    .withDetail("error", ex.getMessage())
                    .build();
        }
    }

    private record CachedHealth(Health health, Instant checkedAt) {
        boolean isExpired() {
            return Instant.now().toEpochMilli() - checkedAt.toEpochMilli() > CACHE_TTL_MS;
        }
    }
}
