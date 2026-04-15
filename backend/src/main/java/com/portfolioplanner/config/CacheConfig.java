package com.portfolioplanner.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * In-memory cache configuration.
 *
 * ── Portfolio-planner calculation cache ─────────────────────────────────────
 *  calculations           no TTL  — evicted explicitly on every data mutation
 *                                   (resources, projects, plannings, overrides…)
 *
 * ── Jira API response caches ────────────────────────────────────────────────
 *  TTLs are tuned to frequency of change:
 *
 *  jira-projects          15 min  — project list rarely changes
 *  jira-boards            15 min  — board-to-project mapping rarely changes
 *  jira-epics             15 min  — epics rarely change during a sprint
 *  jira-labels            30 min  — labels are very stable
 *  jira-epics-from-board  15 min  — same as jira-epics but for board endpoint
 *  jira-active-sprints     3 min  — changes when sprint starts/ends
 *  jira-closed-sprints    30 min  — historical, immutable once closed
 *  jira-sprint-issues      5 min  — issue status changes during a sprint
 *  jira-backlog            5 min  — backlog changes frequently
 *  jira-board-config      30 min  — board estimation field config (rarely changes)
 *  jira-sprint-report     10 min  — sprint report SP totals (authoritative source)
 *  jira-fix-versions      30 min  — project fix/release versions (stable)
 *  jira-release-issues    10 min  — issues belonging to a release version
 *
 * Users can bust all jira caches via POST /api/jira/cache/clear.
 */
@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        SimpleCacheManager manager = new SimpleCacheManager();
        manager.setCaches(List.of(
            // ── Portfolio-planner ──────────────────────────────────────────
            // No TTL — mutating services call @CacheEvict("calculations")
            noTtlCache("calculations", 50),

            // ── Jira API ───────────────────────────────────────────────────
            jiraCache("jira-projects",         15, 50),
            jiraCache("jira-boards",           15, 200),
            jiraCache("jira-epics",            15, 500),
            jiraCache("jira-epics-from-board", 15, 500),
            jiraCache("jira-labels",           30, 200),
            jiraCache("jira-active-sprints",    3, 200),
            jiraCache("jira-all-sprints",       10, 200),   // all sprints per board (active+closed+future) — 10 min TTL
            jiraCache("jira-closed-sprints",   30, 200),
            jiraCache("jira-sprint-issues",     5, 500),
            jiraCache("jira-backlog",            5, 200),
            jiraCache("jira-board-config",      30, 100), // board estimation field config — rarely changes
            jiraCache("jira-sprint-report",     10, 200),  // sprint report SP totals — 10 min TTL
            jiraCache("jira-fix-versions",       30, 200),  // project fix/release versions — 30 min TTL
            jiraCache("jira-release-issues",     10, 200),  // issues per release version  — 10 min TTL
            jiraCache("jira-initiatives",        15, 200),  // initiative issues (epics/themes) — 15 min TTL

            // ── DB-backed analytics ───────────────────────────────────────────
            jiraCache("jira-analytics",           10, 50),   // aggregated analytics from synced DB — 10 min TTL

            // ── Support Queue ───────────────────────────────────────────────
            jiraCache("jira-all-boards",         15, 1),    // all Jira boards for picker   — 15 min TTL
            jiraCache("jira-support-issues",      2, 50),   // non-Done issues per board    —  2 min TTL

            // ── NLP ───────────────────────────────────────────────────────
            jiraCache("nlp-catalog",              15, 1)     // entity catalog for NLP       — 15 min TTL
        ));
        return manager;
    }

    /** Cache with a write-after TTL — for Jira responses. */
    private static CaffeineCache jiraCache(String name, int ttlMinutes, int maxSize) {
        return new CaffeineCache(name,
            Caffeine.newBuilder()
                .expireAfterWrite(ttlMinutes, TimeUnit.MINUTES)
                .maximumSize(maxSize)
                .recordStats()
                .build());
    }

    /** Eviction-only cache (no TTL) — for computation results invalidated by data mutations. */
    private static CaffeineCache noTtlCache(String name, int maxSize) {
        return new CaffeineCache(name,
            Caffeine.newBuilder()
                .maximumSize(maxSize)
                .recordStats()
                .build());
    }
}
