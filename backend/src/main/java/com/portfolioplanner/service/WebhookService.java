package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.WebhookConfig;
import com.portfolioplanner.domain.repository.WebhookConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

/**
 * Fires outbound webhooks to Slack, Microsoft Teams, or custom HTTP receivers.
 *
 * All public methods are @Async — they post to the webhook URL in a background thread
 * so they never block the HTTP request that triggered the event.
 *
 * Payload formats:
 *   SLACK   — Slack Incoming Webhook JSON  {"text": "...", "attachments": [...]}
 *   TEAMS   — Legacy Connector "MessageCard" JSON
 *   CUSTOM  — Simple structured JSON  {"event": "...", "data": {...}}
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebhookService {

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private final WebhookConfigRepository repo;

    // ── Public event methods ──────────────────────────────────────────────────

    /** Fire when a project's status changes (Kanban drag or manual update). */
    @Async
    public void fireProjectStatusChanged(Long projectId, String projectName,
                                         String oldStatus, String newStatus) {
        String title = String.format("📋 Project Status Changed: %s", projectName);
        String body  = String.format("%s → *%s*", oldStatus, newStatus);
        String detail = String.format("{\"projectId\":%d,\"projectName\":\"%s\",\"from\":\"%s\",\"to\":\"%s\"}",
                projectId, esc(projectName), oldStatus, newStatus);
        deliverToSubscribers("project.status_changed", title, body, detail);
    }

    /** Fire when a project approval is reviewed (approved or rejected). */
    @Async
    public void fireApprovalReviewed(Long projectId, String projectName,
                                     String action, String reviewedBy) {
        boolean approved = "APPROVED".equalsIgnoreCase(action);
        String title = approved
                ? String.format("✅ Approval Granted: %s", projectName)
                : String.format("❌ Approval Rejected: %s", projectName);
        String body = String.format("Decision by *%s*", reviewedBy);
        String detail = String.format("{\"projectId\":%d,\"projectName\":\"%s\",\"action\":\"%s\",\"reviewedBy\":\"%s\"}",
                projectId, esc(projectName), action, esc(reviewedBy));
        String event = approved ? "approval.approved" : "approval.rejected";
        deliverToSubscribers(event, title, body, detail);
    }

    /** Fire when an automation rule triggers. */
    @Async
    public void fireAutomationRuleFired(String ruleName, String triggerEvent) {
        String title = String.format("⚡ Automation Rule Fired: %s", ruleName);
        String body  = String.format("Triggered by event: *%s*", triggerEvent);
        String detail = String.format("{\"ruleName\":\"%s\",\"triggerEvent\":\"%s\"}",
                esc(ruleName), esc(triggerEvent));
        deliverToSubscribers("automation.rule_fired", title, body, detail);
    }

    // ── Internal delivery ─────────────────────────────────────────────────────

    private void deliverToSubscribers(String eventType, String title,
                                      String bodyText, String dataJson) {
        List<WebhookConfig> hooks = repo.findEnabledByEvent(eventType);
        for (WebhookConfig hook : hooks) {
            try {
                String payload = buildPayload(hook.getProvider(), title, bodyText, eventType, dataJson);
                post(hook.getUrl(), payload);
                log.info("Webhook fired: event={} provider={} url={}",
                        eventType, hook.getProvider(), abbrev(hook.getUrl()));
            } catch (Exception ex) {
                // Never throw — webhook failures must not break the primary operation
                log.warn("Webhook delivery failed: event={} url={} error={}",
                        eventType, abbrev(hook.getUrl()), ex.getMessage());
            }
        }
    }

    private String buildPayload(String provider, String title,
                                 String bodyText, String eventType, String dataJson) {
        return switch (provider.toUpperCase()) {
            case "SLACK" -> String.format(
                    "{\"text\":\"%s\",\"attachments\":[{\"color\":\"#2DCCD3\",\"text\":\"%s\"}]}",
                    esc(title), esc(bodyText));
            case "TEAMS" -> String.format(
                    "{\"@type\":\"MessageCard\",\"@context\":\"http://schema.org/extensions\"," +
                    "\"summary\":\"%s\",\"themeColor\":\"0C2340\"," +
                    "\"sections\":[{\"activityTitle\":\"%s\",\"activityText\":\"%s\"}]}",
                    esc(title), esc(title), esc(bodyText));
            default -> // CUSTOM
                    String.format("{\"event\":\"%s\",\"title\":\"%s\",\"message\":\"%s\",\"data\":%s}",
                            esc(eventType), esc(title), esc(bodyText), dataJson);
        };
    }

    private void post(String url, String jsonPayload) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<Void> resp = HTTP.send(req, HttpResponse.BodyHandlers.discarding());
        if (resp.statusCode() >= 300) {
            log.warn("Webhook HTTP {} from {}", resp.statusCode(), abbrev(url));
        }
    }

    /** Escape JSON string special chars. */
    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "");
    }

    private static String abbrev(String url) {
        return url != null && url.length() > 60 ? url.substring(0, 60) + "…" : url;
    }
}
