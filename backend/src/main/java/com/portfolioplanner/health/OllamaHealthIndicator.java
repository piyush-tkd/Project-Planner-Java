package com.portfolioplanner.health;

import com.portfolioplanner.service.AiServiceClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Reports Ollama (local LLM) reachability via the AI microservice.
 * Result is cached for 60 seconds to avoid excessive inter-service calls.
 */
@Slf4j
@Component("ollama")
@RequiredArgsConstructor
public class OllamaHealthIndicator implements HealthIndicator {

    private static final long CACHE_TTL_MS = 60_000L;

    private final AiServiceClient aiServiceClient;

    @Value("${ai.service.url:http://localhost:8081}")
    private String aiServiceUrl;

    private final AtomicReference<CachedHealth> cache = new AtomicReference<>(null);

    @Override
    public Health health() {
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
            boolean available = aiServiceClient.isOllamaHealthy();
            return available
                ? Health.up().withDetail("via", aiServiceUrl).build()
                : Health.down().withDetail("via", aiServiceUrl).withDetail("reason", "Ollama not available").build();
        } catch (Exception ex) {
            log.debug("Ollama health probe failed: {}", ex.getMessage());
            return Health.down()
                    .withDetail("via", aiServiceUrl)
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
