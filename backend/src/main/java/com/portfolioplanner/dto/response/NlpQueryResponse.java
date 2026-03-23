package com.portfolioplanner.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record NlpQueryResponse(
        String intent,
        double confidence,
        String resolvedBy,
        NlpResponsePayload response,
        List<String> suggestions,
        Long queryLogId,
        Map<String, Object> debug
) {
    public record NlpResponsePayload(
            String message,
            String route,
            Map<String, Object> formData,
            Map<String, Object> data,
            String drillDown,
            String shape
    ) {}

    /** Return a copy with the queryLogId set. */
    public NlpQueryResponse withLogId(Long logId) {
        return new NlpQueryResponse(intent, confidence, resolvedBy, response, suggestions, logId, debug);
    }

    /** Return a copy with debug info attached. */
    public NlpQueryResponse withDebug(Map<String, Object> debugInfo) {
        return new NlpQueryResponse(intent, confidence, resolvedBy, response, suggestions, queryLogId, debugInfo);
    }

    /** Convenience factory for a simple text answer. */
    public static NlpQueryResponse text(String message, String resolvedBy, double confidence, List<String> suggestions) {
        return new NlpQueryResponse(
                "HELP", confidence, resolvedBy,
                new NlpResponsePayload(message, null, null, null, null, null),
                suggestions, null, null
        );
    }

    /** Convenience factory for a navigation result. */
    public static NlpQueryResponse navigate(String message, String route, String resolvedBy, double confidence, List<String> suggestions) {
        return new NlpQueryResponse(
                "NAVIGATE", confidence, resolvedBy,
                new NlpResponsePayload(message, route, null, null, null, null),
                suggestions, null, null
        );
    }

    /** Convenience factory for form prefill. */
    public static NlpQueryResponse formPrefill(String message, String route, Map<String, Object> formData,
                                                String resolvedBy, double confidence, List<String> suggestions) {
        return new NlpQueryResponse(
                "FORM_PREFILL", confidence, resolvedBy,
                new NlpResponsePayload(message, route, formData, null, null, null),
                suggestions, null, null
        );
    }

    /** Convenience factory for data query result. */
    public static NlpQueryResponse dataQuery(String message, Map<String, Object> data, String drillDown,
                                              String resolvedBy, double confidence, List<String> suggestions) {
        return new NlpQueryResponse(
                "DATA_QUERY", confidence, resolvedBy,
                new NlpResponsePayload(message, null, null, data, drillDown, null),
                suggestions, null, null
        );
    }

    /** Convenience factory for insight result. */
    public static NlpQueryResponse insight(String message, Map<String, Object> data, String drillDown,
                                            String resolvedBy, double confidence, List<String> suggestions) {
        return new NlpQueryResponse(
                "INSIGHT", confidence, resolvedBy,
                new NlpResponsePayload(message, null, null, data, drillDown, null),
                suggestions, null, null
        );
    }

    /** Fallback when no strategy could handle the query. */
    public static NlpQueryResponse fallback(String message) {
        return new NlpQueryResponse(
                "UNKNOWN", 0.0, "NONE",
                new NlpResponsePayload(message, null, null, null, null, null),
                List.of(), null, null
        );
    }
}
