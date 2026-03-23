package com.portfolioplanner.service.nlp;

import com.portfolioplanner.dto.response.NlpQueryResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for NlpQueryResponse record — validates factory methods,
 * immutable copy methods, and the debug field added in Phase 0.
 */
class NlpQueryResponseTest {

    @Nested
    @DisplayName("Factory methods")
    class FactoryMethods {

        @Test
        void textShouldCreateHelpIntent() {
            NlpQueryResponse resp = NlpQueryResponse.text("Hello!", "RULE_BASED", 0.95, List.of("Ask me anything"));

            assertThat(resp.intent()).isEqualTo("HELP");
            assertThat(resp.confidence()).isEqualTo(0.95);
            assertThat(resp.resolvedBy()).isEqualTo("RULE_BASED");
            assertThat(resp.response().message()).isEqualTo("Hello!");
            assertThat(resp.response().route()).isNull();
            assertThat(resp.suggestions()).containsExactly("Ask me anything");
            assertThat(resp.queryLogId()).isNull();
            assertThat(resp.debug()).isNull();
        }

        @Test
        void navigateShouldCreateNavigateIntent() {
            NlpQueryResponse resp = NlpQueryResponse.navigate("Going to projects", "/projects",
                    "DETERMINISTIC", 0.92, List.of());

            assertThat(resp.intent()).isEqualTo("NAVIGATE");
            assertThat(resp.response().route()).isEqualTo("/projects");
            assertThat(resp.resolvedBy()).isEqualTo("DETERMINISTIC");
        }

        @Test
        void formPrefillShouldCreateFormPrefillIntent() {
            Map<String, Object> formData = Map.of("name", "Alpha", "priority", "P0");
            NlpQueryResponse resp = NlpQueryResponse.formPrefill("Prefilling form", "/projects/new",
                    formData, "RULE_BASED", 0.88, List.of());

            assertThat(resp.intent()).isEqualTo("FORM_PREFILL");
            assertThat(resp.response().route()).isEqualTo("/projects/new");
            assertThat(resp.response().formData()).containsEntry("name", "Alpha");
        }

        @Test
        void dataQueryShouldCreateDataQueryIntent() {
            Map<String, Object> data = Map.of("Count", "5", "#1", "Alpha");
            NlpQueryResponse resp = NlpQueryResponse.dataQuery("Found 5 projects:", data, "/projects",
                    "DETERMINISTIC", 0.92, List.of("Show P0 projects"));

            assertThat(resp.intent()).isEqualTo("DATA_QUERY");
            assertThat(resp.response().data()).containsEntry("Count", "5");
            assertThat(resp.response().drillDown()).isEqualTo("/projects");
        }

        @Test
        void insightShouldCreateInsightIntent() {
            Map<String, Object> data = Map.of("metric", "utilization", "value", "85%");
            NlpQueryResponse resp = NlpQueryResponse.insight("Utilization is at 85%", data, "/heatmap",
                    "LOCAL_LLM", 0.85, List.of());

            assertThat(resp.intent()).isEqualTo("INSIGHT");
            assertThat(resp.response().data()).containsEntry("metric", "utilization");
        }

        @Test
        void fallbackShouldCreateUnknownIntent() {
            NlpQueryResponse resp = NlpQueryResponse.fallback("Something went wrong");

            assertThat(resp.intent()).isEqualTo("UNKNOWN");
            assertThat(resp.confidence()).isEqualTo(0.0);
            assertThat(resp.resolvedBy()).isEqualTo("NONE");
            assertThat(resp.response().message()).isEqualTo("Something went wrong");
            assertThat(resp.suggestions()).isEmpty();
        }
    }

    @Nested
    @DisplayName("Copy methods")
    class CopyMethods {

        @Test
        void withLogIdShouldPreserveAllFields() {
            NlpQueryResponse original = NlpQueryResponse.dataQuery("Test", Map.of("x", "y"), "/projects",
                    "DETERMINISTIC", 0.92, List.of("Suggest"));
            NlpQueryResponse withDebug = original.withDebug(Map.of("timing", 50));

            NlpQueryResponse withLog = withDebug.withLogId(42L);

            assertThat(withLog.queryLogId()).isEqualTo(42L);
            assertThat(withLog.intent()).isEqualTo("DATA_QUERY");
            assertThat(withLog.confidence()).isEqualTo(0.92);
            assertThat(withLog.resolvedBy()).isEqualTo("DETERMINISTIC");
            assertThat(withLog.response().data()).containsEntry("x", "y");
            assertThat(withLog.suggestions()).containsExactly("Suggest");
            assertThat(withLog.debug()).containsEntry("timing", 50); // Debug preserved
        }

        @Test
        void withDebugShouldPreserveAllFields() {
            NlpQueryResponse original = NlpQueryResponse.text("Hello", "RULE_BASED", 0.95, List.of("Hi"));
            NlpQueryResponse withLogId = original.withLogId(99L);

            NlpQueryResponse withDebug = withLogId.withDebug(Map.of("strategy", "DETERMINISTIC", "elapsed", 25));

            assertThat(withDebug.debug()).containsEntry("strategy", "DETERMINISTIC");
            assertThat(withDebug.debug()).containsEntry("elapsed", 25);
            assertThat(withDebug.queryLogId()).isEqualTo(99L); // LogId preserved
            assertThat(withDebug.intent()).isEqualTo("HELP");
        }
    }

    @Nested
    @DisplayName("NlpResponsePayload")
    class PayloadTests {

        @Test
        void payloadShouldStoreAllFields() {
            var payload = new NlpQueryResponse.NlpResponsePayload(
                    "Test message", "/projects", Map.of("field", "value"),
                    Map.of("key", "data"), "/drill-down", null);

            assertThat(payload.message()).isEqualTo("Test message");
            assertThat(payload.route()).isEqualTo("/projects");
            assertThat(payload.formData()).containsEntry("field", "value");
            assertThat(payload.data()).containsEntry("key", "data");
            assertThat(payload.drillDown()).isEqualTo("/drill-down");
        }
    }
}
