package com.portfolioplanner.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationPreferenceDto {

    private Long    id;
    private String  username;

    // ── In-app toggles ────────────────────────────────────────────────────────
    private boolean onStatusChange;
    private boolean onRiskAdded;
    private boolean onCommentMention;
    private boolean onSprintStart;
    private boolean onAutomationFired;
    private boolean onTargetDatePassed;

    // ── Email ─────────────────────────────────────────────────────────────────
    private boolean emailEnabled;
    private String  emailDigest;   // NONE | DAILY | WEEKLY

    // ── Quiet hours ───────────────────────────────────────────────────────────
    private Integer quietStartHour;
    private Integer quietEndHour;
}
