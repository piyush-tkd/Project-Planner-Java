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
 * In-memory cache configuration for Jira API responses.
 *
 * All Jira caches use Caffeine; TTLs are tuned to the frequency of change:
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
 *
 * Each cache holds at most 500 entries to bound memory usage.
 * Users can bust all jira caches via POST /api/jira/cache/clear.
 */
@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        SimpleCacheManager manager = new SimpleCacheManager();
        manager.setCaches(List.of(
            jiraCache("jira-projects",         15, 50),
            jiraCache("jira-boards",           15, 200),
            jiraCache("jira-epics",            15, 500),
            jiraCache("jira-epics-from-board", 15, 500),
            jiraCache("jira-labels",           30, 200),
            jiraCache("jira-active-sprints",    3, 200),
            jiraCache("jira-closed-sprints",   30, 200),
            jiraCache("jira-sprint-issues",     5, 500),
            jiraCache("jira-backlog",           5, 200)
        ));
        return manager;
    }

    private static CaffeineCache jiraCache(String name, int ttlMinutes, int maxSize) {
        return new CaffeineCache(name,
            Caffeine.newBuilder()
                .expireAfterWrite(ttlMinutes, TimeUnit.MINUTES)
                .maximumSize(maxSize)
                .recordStats()
                .build());
    }
}
