package com.portfolioplanner.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Represents an email template as seen by the admin UI.
 *
 * <p>{@code customized = true} means a DB override row exists for this template.
 * {@code subject} and {@code htmlBody} are the override values (may be null if
 * the template has not been overridden).
 */
@Data
@NoArgsConstructor
public class EmailTemplateDto {

    /** Template identifier, e.g. {@code "approval-pending"}. */
    private String templateName;

    /** Human-readable description of when this template is sent. */
    private String description;

    /** {@code true} when the DB contains an override for this template. */
    private boolean customized;

    /**
     * Override subject line (may contain {@code {{variable}}} tokens).
     * {@code null} means the application uses its default subject.
     */
    private String subject;

    /**
     * Override HTML body (may contain {@code {{variable}}} tokens).
     * {@code null} means the Thymeleaf file on disk is used.
     */
    private String htmlBody;

    /** Timestamp of the last save. {@code null} when not yet customized. */
    private LocalDateTime updatedAt;
}
