package com.portfolioplanner.controller;

import com.portfolioplanner.dto.EmailTemplateDto;
import com.portfolioplanner.service.EmailTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin REST endpoints for managing configurable email templates.
 *
 * <pre>
 *   GET    /api/settings/email-templates              → list all known templates
 *   GET    /api/settings/email-templates/{name}       → single template
 *   PUT    /api/settings/email-templates/{name}       → save override (upsert)
 *   DELETE /api/settings/email-templates/{name}       → reset to Thymeleaf default
 *   POST   /api/settings/email-templates/{name}/preview → rendered HTML preview
 * </pre>
 *
 * All endpoints require ADMIN or SUPER_ADMIN role.
 */
@RestController
@RequestMapping("/api/settings/email-templates")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
public class EmailTemplateController {

    private final EmailTemplateService emailTemplateService;

    /** Returns all known templates merged with any saved DB overrides. */
    @GetMapping
    public ResponseEntity<List<EmailTemplateDto>> list() {
        return ResponseEntity.ok(emailTemplateService.listAll());
    }

    /** Returns a single template DTO. */
    @GetMapping("/{name}")
    public ResponseEntity<EmailTemplateDto> get(@PathVariable String name) {
        return ResponseEntity.ok(emailTemplateService.get(name));
    }

    /**
     * Saves a subject/body override for the named template.
     *
     * <p>Request body: {@code { "subject": "...", "htmlBody": "..." }}
     * Either field may be null/blank to keep using the Thymeleaf default for that field.
     */
    @PutMapping("/{name}")
    public ResponseEntity<EmailTemplateDto> save(
            @PathVariable String name,
            @RequestBody Map<String, String> body) {
        String subject  = body.get("subject");
        String htmlBody = body.get("htmlBody");
        return ResponseEntity.ok(emailTemplateService.save(name, subject, htmlBody));
    }

    /**
     * Removes the DB override for a template, reverting it to the Thymeleaf default.
     */
    @DeleteMapping("/{name}")
    public ResponseEntity<Void> reset(@PathVariable String name) {
        emailTemplateService.reset(name);
        return ResponseEntity.noContent().build();
    }

    /**
     * Returns a rendered HTML preview of the template.
     *
     * <p>Request body (optional): {@code { "subject": "...", "htmlBody": "..." }}
     * If {@code htmlBody} is provided, it is previewed directly (draft mode)
     * rather than the saved DB override.
     *
     * <p>Response: {@code { "html": "<rendered html>" }}
     */
    @PostMapping("/{name}/preview")
    public ResponseEntity<Map<String, String>> preview(
            @PathVariable String name,
            @RequestBody(required = false) Map<String, String> body) {
        String subjectDraft  = body != null ? body.get("subject")  : null;
        String htmlBodyDraft = body != null ? body.get("htmlBody") : null;
        String rendered = emailTemplateService.preview(name, subjectDraft, htmlBodyDraft);
        return ResponseEntity.ok(Map.of("html", rendered));
    }
}
