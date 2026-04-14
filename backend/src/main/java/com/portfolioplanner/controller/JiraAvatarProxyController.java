package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraCredentialsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * Proxies Jira avatar image requests through the backend so the browser
 * never needs to supply Jira credentials directly.
 *
 * Frontend usage:
 *   <img src="/api/jira/avatar-proxy?url=https://jira.example.com/secure/useravatar?..." />
 *
 * The backend fetches the image with Basic-Auth and returns the raw bytes
 * with the correct Content-Type, so the browser renders it normally.
 */
@RestController
@RequestMapping("/api/jira")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class JiraAvatarProxyController {

    private final JiraCredentialsService creds;
    private final RestTemplate           restTemplate;

    @GetMapping("/avatar-proxy")
    public ResponseEntity<byte[]> proxyAvatar(@RequestParam String url) {
        if (!creds.isConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }

        // Only proxy URLs that belong to the configured Jira instance or known CDNs
        // to prevent this endpoint being used as an open proxy.
        // Normalize base to end with "/" so "https://jira.co" can't match "https://jira.co.evil.com/..."
        String base = creds.getBaseUrl();
        String normalizedBase = base.endsWith("/") ? base : base + "/";
        boolean isTrusted = url.startsWith(normalizedBase)
                || url.equals(base)
                || url.startsWith("https://secure.gravatar.com/")
                || url.startsWith("https://avatar-management--avatars.")
                || url.startsWith("https://www.gravatar.com/");

        if (!isTrusted) {
            log.warn("Avatar proxy rejected untrusted URL: {}", url);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBasicAuth(creds.getEmail(), creds.getApiToken(), StandardCharsets.UTF_8);
            // Accept common image formats
            headers.set("Accept", "image/png, image/jpeg, image/gif, image/webp, image/svg+xml, */*");

            ResponseEntity<byte[]> resp = restTemplate.exchange(
                    URI.create(url),
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    byte[].class
            );

            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                HttpHeaders responseHeaders = new HttpHeaders();
                // Forward the Content-Type so the browser knows what image type it is
                MediaType contentType = resp.getHeaders().getContentType();
                responseHeaders.setContentType(contentType != null ? contentType : MediaType.IMAGE_PNG);
                // Cache for 1 hour — avatars rarely change
                responseHeaders.setCacheControl(CacheControl.maxAge(3600,
                        java.util.concurrent.TimeUnit.SECONDS).cachePublic());
                return new ResponseEntity<>(resp.getBody(), responseHeaders, HttpStatus.OK);
            }

            return ResponseEntity.notFound().build();

        } catch (Exception e) {
            log.debug("Avatar proxy fetch failed for {}: {}", url, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }
}
