package com.portfolioplanner.domain.model.enums;

/**
 * Tracks the origin of a Portfolio Planner project.
 *
 * <ul>
 *   <li>{@code MANUAL}         — created directly inside PP by a user</li>
 *   <li>{@code JIRA_SYNCED}    — auto-discovered from a Jira epic and kept in sync</li>
 *   <li>{@code PUSHED_TO_JIRA} — started as MANUAL but then pushed to Jira via "Create in Jira"</li>
 * </ul>
 */
public enum SourceType {
    MANUAL,
    JIRA_SYNCED,
    PUSHED_TO_JIRA
}
