package com.portfolioplanner.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for {@link com.portfolioplanner.domain.model.NotificationSchedule}.
 * Transferred as-is — no sensitive fields to mask.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationScheduleDto {

    /** Comma-separated recipient addresses shared by both notification types. */
    private String  recipients       = "";

    private boolean digestEnabled    = false;
    /** Spring cron expression, e.g. {@code 0 0 8 * * MON}. */
    private String  digestCron       = "0 0 8 * * MON";

    private boolean stalenessEnabled = false;
    /** Spring cron expression, e.g. {@code 0 0 9 * * MON}. */
    private String  stalenessCron    = "0 0 9 * * MON";
}
