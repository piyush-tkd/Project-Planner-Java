package com.portfolioplanner.config;

import com.portfolioplanner.domain.model.OrgSettings;
import com.portfolioplanner.domain.repository.OrgSettingsRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Intercepts API requests and returns 403 if the corresponding feature flag
 * is disabled in org_settings.features.
 *
 * Flag → URL prefix mapping:
 *   ai         → /api/nlp/
 *   financials → /api/jira/capex/, /api/cost-rates/, /api/actuals/, /api/bau-assumptions/
 *   risk       → /api/risks/
 *   okr        → /api/objectives/
 *   ideas      → /api/ideas/
 *
 * Settings are cached for 60 seconds to avoid a DB hit on every request.
 */
@Component
@RequiredArgsConstructor
public class FeatureFlagInterceptor implements HandlerInterceptor {

    private static final long CACHE_TTL_MS = 60_000L;
    private static final long DEFAULT_ORG_ID = 1L;

    private final OrgSettingsRepository orgSettingsRepository;

    /** In-memory cache: refreshed at most once per CACHE_TTL_MS. */
    private final AtomicReference<Map<String, Boolean>> cachedFeatures = new AtomicReference<>(null);
    private final AtomicLong cacheExpiry = new AtomicLong(0L);

    /** Each entry = (flagKey, List of URL prefixes guarded by that flag). */
    private static final List<FlagRule> RULES = List.of(
        new FlagRule("ai",         List.of("/api/nlp/")),
        new FlagRule("financials", List.of("/api/jira/capex/", "/api/cost-rates/", "/api/actuals/", "/api/bau-assumptions/")),
        new FlagRule("risk",       List.of("/api/risks/")),
        new FlagRule("okr",        List.of("/api/objectives/")),
        new FlagRule("ideas",      List.of("/api/ideas/"))
    );

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {

        String uri = request.getRequestURI();
        Map<String, Boolean> features = getFeatures();

        for (FlagRule rule : RULES) {
            for (String prefix : rule.prefixes()) {
                if (uri.startsWith(prefix) || uri.equals(prefix.stripTrailing())) {
                    boolean enabled = features.getOrDefault(rule.flag(), true);
                    if (!enabled) {
                        response.sendError(HttpServletResponse.SC_FORBIDDEN,
                            "Feature '" + rule.flag() + "' is disabled.");
                        return false;
                    }
                }
            }
        }
        return true;
    }

    private Map<String, Boolean> getFeatures() {
        long now = System.currentTimeMillis();
        if (now < cacheExpiry.get() && cachedFeatures.get() != null) {
            return cachedFeatures.get();
        }
        // Cache miss — reload from DB
        Map<String, Boolean> loaded = orgSettingsRepository
            .findByOrgId(DEFAULT_ORG_ID)
            .map(OrgSettings::getFeatures)
            .orElse(null);

        Map<String, Boolean> result = (loaded != null) ? loaded : Map.of();
        cachedFeatures.set(result);
        cacheExpiry.set(now + CACHE_TTL_MS);
        return result;
    }

    /** Allows tests to invalidate the cache so changes take effect immediately. */
    public void invalidateCache() {
        cacheExpiry.set(0L);
    }

    private record FlagRule(String flag, List<String> prefixes) {}
}
