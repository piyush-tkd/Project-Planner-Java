package com.portfolioplanner.service.nlp;

import com.portfolioplanner.dto.response.NlpCatalogResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Manages the lifecycle of embedding sync:
 * 1. STARTUP — sync catalog embeddings once Ollama is available
 * 2. PERIODIC — re-sync every 30 minutes to catch catalog changes
 * 3. ON-DEMAND — triggered when catalog cache is refreshed
 */
@Service
public class NlpEmbeddingSyncService {

    private static final Logger log = LoggerFactory.getLogger(NlpEmbeddingSyncService.class);

    private final NlpCatalogService catalogService;
    private final NlpVectorSearchService vectorSearchService;
    private final EmbeddingService embeddingService;

    private volatile boolean initialSyncDone = false;

    public NlpEmbeddingSyncService(NlpCatalogService catalogService,
                                    NlpVectorSearchService vectorSearchService,
                                    EmbeddingService embeddingService) {
        this.catalogService = catalogService;
        this.vectorSearchService = vectorSearchService;
        this.embeddingService = embeddingService;
    }

    /**
     * On application startup, attempt initial embedding sync.
     * Runs async so it doesn't block startup.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Async
    public void onStartup() {
        log.info("NLP Embedding Sync: checking if embeddings are available...");
        try {
            if (!vectorSearchService.isPgvectorAvailable()) {
                log.info("NLP Embedding Sync: pgvector not installed — semantic search is disabled. " +
                         "Install pgvector, restart PostgreSQL, and call POST /api/nlp/embeddings/sync to activate.");
                return;
            }
            if (embeddingService.isAvailable()) {
                syncNow();
                initialSyncDone = true;
            } else {
                log.info("NLP Embedding Sync: Ollama not available at startup — embeddings will sync on first availability");
            }
        } catch (Exception e) {
            log.warn("NLP Embedding Sync: startup sync failed — will retry on next scheduled run: {}", e.getMessage());
        }
    }

    /**
     * Periodic re-sync every 30 minutes.
     * Also retries initial sync if it hasn't completed yet.
     */
    @Scheduled(fixedDelay = 1800000, initialDelay = 300000) // 30 min, first run after 5 min
    public void periodicSync() {
        if (!vectorSearchService.isPgvectorAvailable()) {
            log.debug("NLP Embedding Sync: pgvector not available, skipping periodic sync");
            return;
        }
        if (!embeddingService.isAvailable()) {
            // Try to check availability again — Ollama might have started
            embeddingService.checkAvailability();
            if (!embeddingService.isAvailable()) {
                log.debug("NLP Embedding Sync: Ollama still not available, skipping periodic sync");
                return;
            }
        }

        try {
            syncNow();
            if (!initialSyncDone) {
                initialSyncDone = true;
                log.info("NLP Embedding Sync: initial sync completed (delayed)");
            }
        } catch (Exception e) {
            log.warn("NLP Embedding Sync: periodic sync failed: {}", e.getMessage());
        }
    }

    /**
     * Trigger an immediate sync. Can be called from the admin UI or after catalog refresh.
     */
    public void syncNow() {
        log.info("NLP Embedding Sync: starting catalog embedding sync...");
        long start = System.currentTimeMillis();

        NlpCatalogResponse catalog = catalogService.getCatalog();
        vectorSearchService.syncCatalogEmbeddings(catalog);

        long elapsed = System.currentTimeMillis() - start;
        log.info("NLP Embedding Sync: completed in {}ms", elapsed);
    }

    public boolean isInitialSyncDone() {
        return initialSyncDone;
    }
}
