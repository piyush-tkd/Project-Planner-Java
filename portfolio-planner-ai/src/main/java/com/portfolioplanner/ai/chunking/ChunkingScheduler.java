package com.portfolioplanner.ai.chunking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled jobs for vector store maintenance.
 *
 * - Nightly full re-index at 2 AM (cron configurable in application.yml)
 * - On startup: skipped by default to not block startup; trigger manually if needed
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChunkingScheduler {

    private final ChunkingService chunkingService;

    @Value("${ai.sync.cron:0 0 2 * * *}")
    private String cronExpression;

    /**
     * Full nightly re-index.
     * Cron: "0 0 2 * * *" = every day at 2:00 AM
     */
    @Scheduled(cron = "${ai.sync.cron:0 0 2 * * *}")
    public void nightlyReindex() {
        log.info("Starting nightly full vector re-index...");
        try {
            int total = chunkingService.indexAllProjects();
            log.info("Nightly re-index complete: {} chunks written", total);
        } catch (Exception e) {
            log.error("Nightly re-index failed: {}", e.getMessage(), e);
        }
    }
}
