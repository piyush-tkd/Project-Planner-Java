package com.portfolioplanner.service.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

/**
 * Listens for ProjectChangedEvents and fires a webhook to the AI microservice
 * so it can re-index the changed project's vector chunks.
 *
 * Runs @Async so it never adds latency to the main request path.
 * If the AI service is offline the warning is logged and silently swallowed —
 * the nightly re-index will catch any missed updates.
 */
@Component
@Slf4j
public class AiSyncPublisher {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${ai.service.url:http://localhost:8081}")
    private String aiServiceUrl;

    @Async
    @EventListener
    public void onProjectChanged(ProjectChangedEvent event) {
        String url = aiServiceUrl + "/internal/sync/project/" + event.projectId();
        try {
            restTemplate.postForEntity(url, null, Void.class);
            log.debug("AI sync triggered for project {}", event.projectId());
        } catch (ResourceAccessException e) {
            // AI service not running — nightly job will catch it
            log.debug("AI service offline, skipping sync for project {}: {}", event.projectId(), e.getMessage());
        } catch (Exception e) {
            log.warn("AI sync failed for project {}: {}", event.projectId(), e.getMessage());
        }
    }
}
