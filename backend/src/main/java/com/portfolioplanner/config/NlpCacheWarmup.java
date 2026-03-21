package com.portfolioplanner.config;

import com.portfolioplanner.service.nlp.NlpCatalogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Warms up the NLP catalog cache on application startup so the first
 * NLP query doesn't time out waiting for 15+ database queries.
 */
@Component
public class NlpCacheWarmup {

    private static final Logger log = LoggerFactory.getLogger(NlpCacheWarmup.class);

    private final NlpCatalogService catalogService;

    public NlpCacheWarmup(NlpCatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void warmUpNlpCatalog() {
        try {
            log.info("Warming up NLP catalog cache...");
            long start = System.currentTimeMillis();
            catalogService.getCatalog();
            long elapsed = System.currentTimeMillis() - start;
            log.info("NLP catalog cache warmed up in {}ms", elapsed);
        } catch (Exception e) {
            log.warn("Failed to warm up NLP catalog cache: {}. First query will be slow.", e.getMessage());
        }
    }
}
