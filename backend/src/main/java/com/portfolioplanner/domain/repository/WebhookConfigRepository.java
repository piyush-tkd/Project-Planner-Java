package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.WebhookConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface WebhookConfigRepository extends JpaRepository<WebhookConfig, Long> {

    List<WebhookConfig> findAllByOrderByCreatedAtDesc();

    /**
     * Returns all enabled webhooks whose 'events' string contains the given event type.
     * Uses LIKE matching on the comma-separated events column.
     */
    @Query("SELECT w FROM WebhookConfig w WHERE w.enabled = true AND w.events LIKE %:eventType%")
    List<WebhookConfig> findEnabledByEvent(@Param("eventType") String eventType);
}
