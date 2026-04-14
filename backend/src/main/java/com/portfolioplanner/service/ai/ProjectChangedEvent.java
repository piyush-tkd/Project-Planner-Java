package com.portfolioplanner.service.ai;

/**
 * Fired by ProjectService after a project is created, updated, or status-patched.
 * AiSyncPublisher listens for this and pings the AI microservice to re-index the project.
 */
public record ProjectChangedEvent(Long projectId) {}
