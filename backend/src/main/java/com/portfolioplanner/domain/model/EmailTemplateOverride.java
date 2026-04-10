package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Stores admin-configured overrides for email template subjects and HTML bodies.
 *
 * <p>When a row exists for {@code (orgId, templateName)} the application renders
 * the stored {@code htmlBody} (with {@code {{variable}}} substitution) instead of
 * the Thymeleaf file on disk.  A {@code null} subject or htmlBody means "use the
 * application default" for that field.
 *
 * <p>Variable syntax in subject and htmlBody: {@code {{variableName}}}
 */
@Entity
@Table(name = "email_template_override",
       uniqueConstraints = @UniqueConstraint(name = "uq_email_template_org",
                                             columnNames = {"org_id", "template_name"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmailTemplateOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id", nullable = false)
    private Long orgId;

    /** Template identifier, e.g. {@code "approval-pending"}, {@code "approval-decision"}. */
    @Column(name = "template_name", nullable = false, length = 100)
    private String templateName;

    /** Override subject line. {@code null} = use application-default subject. */
    @Column(name = "subject", length = 500)
    private String subject;

    /** Override HTML body. {@code null} = use Thymeleaf file. */
    @Column(name = "html_body", columnDefinition = "TEXT")
    private String htmlBody;

    /** Human-readable description shown in the admin UI. */
    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
