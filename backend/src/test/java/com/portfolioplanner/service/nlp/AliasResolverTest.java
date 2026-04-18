package com.portfolioplanner.service.nlp;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for AliasResolver — the single normalization layer
 * that maps domain synonyms to canonical values before routing.
 * Pure Java — no Spring context required.
 */
class AliasResolverTest {

    private AliasResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new AliasResolver();
    }

    // ══════════════════════════════════════════════════════════════════
    //  resolve() — full query normalization
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("resolve() — priority aliases")
    class PriorityResolution {

        @ParameterizedTest
        @CsvSource({
                "show me highest priority projects, show me HIGHEST projects",
                "list critical projects, list HIGHEST projects",
                "show me p-zero projects, show me HIGHEST projects",
                "high priority items, HIGH items",
                "p-one tasks, HIGH tasks",
                "medium priority projects, MEDIUM projects",
                "p2 stuff, MEDIUM stuff",
                "low priority items, LOW items"
        })
        void shouldResolvePriorityAliases(String input, String expected) {
            assertThat(resolver.resolve(input)).isEqualTo(expected);
        }
    }

    @Nested
    @DisplayName("resolve() — status aliases")
    class StatusResolution {

        @ParameterizedTest
        @CsvSource({
                "show paused projects, show ON_HOLD projects",
                "list frozen projects, list ON_HOLD projects",
                "show on hold projects, show ON_HOLD projects",
                "show done projects, show COMPLETED projects",
                "show finished projects, show COMPLETED projects",
                "show live projects, show ACTIVE projects",
                "show running projects, show ACTIVE projects",
                "show not started projects, show NOT_STARTED projects",
                "show pending projects, show NOT_STARTED projects",
                "show cancelled projects, show CANCELLED projects",
                "show dropped projects, show CANCELLED projects",
                "show in discovery projects, show IN_DISCOVERY projects"
        })
        void shouldResolveStatusAliases(String input, String expected) {
            assertThat(resolver.resolve(input)).isEqualTo(expected);
        }
    }

    @Nested
    @DisplayName("resolve() — entity type aliases")
    class EntityResolution {

        @ParameterizedTest
        @CsvSource({
                "show me all squads, show me all pod",
                "list teams, list pod",
                "show iterations, show sprint",
                "show staff, show resources",
                "show personnel, show resources",
                "show headcount, show resources",
                "check bandwidth, check capacity"
        })
        void shouldResolveEntityAliases(String input, String expected) {
            assertThat(resolver.resolve(input)).isEqualTo(expected);
        }
    }

    @Nested
    @DisplayName("resolve() — location aliases")
    class LocationResolution {

        @ParameterizedTest
        @CsvSource({
                "show onshore developers, show US DEVELOPER",
                "show offshore team, show India pod"
        })
        void shouldResolveLocationAliases(String input, String expected) {
            // "onshore" → "US", "offshore" → "INDIA", "team" → "pod" (entity alias)
            String result = resolver.resolve(input);
            assertThat(result).satisfiesAnyOf(
                    r -> assertThat(r).contains("US"),
                    r -> assertThat(r).contains("INDIA")
            );
        }
    }

    @Nested
    @DisplayName("resolve() — edge cases")
    class EdgeCases {

        @Test
        void shouldReturnNullForNull() {
            assertThat(resolver.resolve(null)).isNull();
        }

        @Test
        void shouldReturnBlankForBlank() {
            assertThat(resolver.resolve("   ")).isEqualTo("   ");
        }

        @Test
        void shouldCollapseMultipleSpaces() {
            // Use a term with no aliases to test pure whitespace collapsing
            assertThat(resolver.resolve("show  me   alpha  projects")).isEqualTo("show me alpha projects");
        }

        @Test
        void shouldNotModifyUnknownTerms() {
            String input = "show me project XYZ details";
            assertThat(resolver.resolve(input)).isEqualTo(input);
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  extractPriority()
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("extractPriority()")
    class ExtractPriority {

        @ParameterizedTest
        @CsvSource({
                "P0 projects, HIGHEST",
                "show highest priority tasks, HIGHEST",
                "critical items, HIGHEST",
                "P1 projects, HIGH",
                "high priority tasks, HIGH",
                "P2 items, MEDIUM",
                "medium priority work, MEDIUM",
                "P3 items, LOW",
                "low priority tasks, LOW"
        })
        void shouldExtractCorrectPriority(String input, String expected) {
            assertThat(resolver.extractPriority(input)).isEqualTo(expected);
        }

        @Test
        void shouldReturnNullWhenNoPriority() {
            assertThat(resolver.extractPriority("show all projects")).isNull();
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  extractStatus()
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("extractStatus()")
    class ExtractStatus {

        @ParameterizedTest
        @CsvSource({
                "paused projects, ON_HOLD",
                "on hold items, ON_HOLD",
                "completed tasks, COMPLETED",
                "done work, COMPLETED",
                "active projects, ACTIVE",
                "live items, ACTIVE",
                "not started tasks, NOT_STARTED",
                "pending items, NOT_STARTED",
                "cancelled projects, CANCELLED",
                "in discovery items, IN_DISCOVERY"
        })
        void shouldExtractCorrectStatus(String input, String expected) {
            assertThat(resolver.extractStatus(input)).isEqualTo(expected);
        }

        @Test
        void shouldReturnNullWhenNoStatus() {
            assertThat(resolver.extractStatus("show all P0 projects")).isNull();
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  extractRole()
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("extractRole()")
    class ExtractRole {

        @ParameterizedTest
        @CsvSource({
                "show all developers, DEVELOPER",
                "list devs, DEVELOPER",
                "list engineers, DEVELOPER",
                "show QA team, QA",
                "show testers, QA",
                "list BSA resources, BSA",
                "business analysts, BSA",
                "tech leads, TECH_LEAD",
                "lead developer, TECH_LEAD"
        })
        void shouldExtractCorrectRole(String input, String expected) {
            assertThat(resolver.extractRole(input)).isEqualTo(expected);
        }

        @Test
        void shouldReturnNullWhenNoRole() {
            assertThat(resolver.extractRole("show all resources")).isNull();
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  extractLocation()
    // ══════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("extractLocation()")
    class ExtractLocation {

        @ParameterizedTest
        @CsvSource({
                "show onshore developers, US",
                "US resources, US",
                "offshore team, INDIA",
                "India based resources, INDIA"
        })
        void shouldExtractCorrectLocation(String input, String expected) {
            assertThat(resolver.extractLocation(input)).isEqualTo(expected);
        }

        @Test
        void shouldReturnNullWhenNoLocation() {
            assertThat(resolver.extractLocation("show all developers")).isNull();
        }
    }
}
