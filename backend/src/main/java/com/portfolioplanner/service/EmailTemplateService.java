package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.EmailTemplateOverride;
import com.portfolioplanner.domain.repository.EmailTemplateOverrideRepository;
import com.portfolioplanner.dto.EmailTemplateDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * DB-first email template resolution service.
 *
 * <p>Resolution order for each send:
 * <ol>
 *   <li>Look up {@code (orgId, templateName)} in {@code email_template_override}.</li>
 *   <li>If a row exists and its {@code htmlBody} is non-blank, render it using
 *       simple {@code {{variableName}}} substitution.</li>
 *   <li>Otherwise fall through to the Thymeleaf template on disk.</li>
 * </ol>
 *
 * <p>For the subject line the same logic applies: a non-blank {@code subject}
 * override in the DB wins; callers supply the application-default subject when
 * the override is absent.
 *
 * <p>Variable substitution uses {@code {{key}}} syntax.  Unknown variables are
 * left as-is (no error).  {@code null} values are substituted as empty string.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailTemplateService {

    /** All known template names shown in the admin UI. */
    public static final List<String> KNOWN_TEMPLATES = List.of(
            "approval-pending",
            "approval-decision",
            "approval-withdrawn",
            "weekly-digest",
            "password-reset",
            "support-staleness"
    );

    /** Human-readable descriptions for each known template. */
    private static final Map<String, String> TEMPLATE_DESCRIPTIONS = Map.of(
            "approval-pending",   "Sent to ADMIN reviewers when a new approval request is submitted",
            "approval-decision",  "Sent to the requester when their approval request is approved or rejected",
            "approval-withdrawn", "Sent to ADMIN reviewers when a pending approval request is withdrawn",
            "weekly-digest",      "Weekly digest of portfolio health sent to subscribed users",
            "password-reset",     "Sent when a user requests a password reset link",
            "support-staleness",  "Alert sent when a support ticket has been inactive beyond the SLA threshold"
    );

    /** Sample variable values shown in the UI preview and during test sends. */
    public static final Map<String, String> SAMPLE_VARIABLES = Map.of(
            "orgName",          "Acme Corp",
            "orgColor",         "#1971c2",
            "orgLogoUrl",       "",
            "projectName",      "Phoenix Platform Upgrade",
            "requestedBy",      "alice",
            "changeDescription","Status: PLANNING → ACTIVE",
            "requestNote",      "Approved by product committee on 2026-04-01.",
            "projectUrl",       "#",
            "decision",         "APPROVED",
            "reviewedBy",       "bob"
    );

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{(\\w+)\\}\\}");

    // ─────────────────────────────────────────────────────────────────────────

    private final EmailTemplateOverrideRepository overrideRepository;
    private final TemplateEngine                  templateEngine;

    @Value("${app.org-id:1}")
    private Long orgId;

    // ── Rendering ─────────────────────────────────────────────────────────────

    /**
     * Returns the rendered HTML for the given template and variable map.
     *
     * <p>If a DB override exists with a non-blank {@code htmlBody}, that body is
     * rendered using {{variable}} substitution.  Otherwise the Thymeleaf file is
     * used.
     *
     * @param templateName filename without path, e.g. {@code "approval-pending.html"}
     * @param variables    map of variable names → values
     * @return rendered HTML string
     */
    public String renderHtml(String templateName, Map<String, Object> variables) {
        // Strip .html suffix for DB lookup
        String name = stripHtmlSuffix(templateName);

        return overrideRepository.findByOrgIdAndTemplateName(orgId, name)
                .filter(o -> o.getHtmlBody() != null && !o.getHtmlBody().isBlank())
                .map(o -> substitute(o.getHtmlBody(), variables))
                .orElseGet(() -> renderThymeleaf(templateName, variables));
    }

    /**
     * Resolves the subject for a given template.  If a DB override exists with
     * a non-blank subject, that subject (with variable substitution) is returned;
     * otherwise the caller-supplied default subject is returned.
     *
     * @param templateName  template name (with or without .html suffix)
     * @param defaultSubject the application-computed default subject
     * @param variables     variables for substitution if the DB subject contains {{...}}
     * @return resolved subject string
     */
    public String resolveSubject(String templateName, String defaultSubject, Map<String, Object> variables) {
        String name = stripHtmlSuffix(templateName);
        return overrideRepository.findByOrgIdAndTemplateName(orgId, name)
                .map(EmailTemplateOverride::getSubject)
                .filter(s -> s != null && !s.isBlank())
                .map(s -> substitute(s, variables))
                .orElse(defaultSubject);
    }

    // ── Admin CRUD ────────────────────────────────────────────────────────────

    /** Returns a DTO list merging known templates with any DB overrides. */
    @Transactional(readOnly = true)
    public List<EmailTemplateDto> listAll() {
        Map<String, EmailTemplateOverride> overrideMap = new HashMap<>();
        overrideRepository.findAllByOrgId(orgId)
                .forEach(o -> overrideMap.put(o.getTemplateName(), o));

        List<EmailTemplateDto> result = new ArrayList<>();
        for (String name : KNOWN_TEMPLATES) {
            EmailTemplateOverride ov = overrideMap.get(name);
            EmailTemplateDto dto = new EmailTemplateDto();
            dto.setTemplateName(name);
            dto.setDescription(TEMPLATE_DESCRIPTIONS.getOrDefault(name, ""));
            dto.setCustomized(ov != null);
            if (ov != null) {
                dto.setSubject(ov.getSubject());
                dto.setHtmlBody(ov.getHtmlBody());
                dto.setUpdatedAt(ov.getUpdatedAt());
            }
            result.add(dto);
        }
        return result;
    }

    /** Returns the DTO for a single template (merged with defaults). */
    @Transactional(readOnly = true)
    public EmailTemplateDto get(String templateName) {
        EmailTemplateDto dto = new EmailTemplateDto();
        dto.setTemplateName(templateName);
        dto.setDescription(TEMPLATE_DESCRIPTIONS.getOrDefault(templateName, ""));

        overrideRepository.findByOrgIdAndTemplateName(orgId, templateName).ifPresent(ov -> {
            dto.setCustomized(true);
            dto.setSubject(ov.getSubject());
            dto.setHtmlBody(ov.getHtmlBody());
            dto.setUpdatedAt(ov.getUpdatedAt());
        });
        return dto;
    }

    /** Saves (upserts) a subject/body override for the given template. */
    @Transactional
    public EmailTemplateDto save(String templateName, String subject, String htmlBody) {
        EmailTemplateOverride ov = overrideRepository
                .findByOrgIdAndTemplateName(orgId, templateName)
                .orElseGet(() -> {
                    EmailTemplateOverride n = new EmailTemplateOverride();
                    n.setOrgId(orgId);
                    n.setTemplateName(templateName);
                    return n;
                });
        ov.setSubject(subject != null && !subject.isBlank() ? subject.trim() : null);
        ov.setHtmlBody(htmlBody != null && !htmlBody.isBlank() ? htmlBody.trim() : null);
        ov.setDescription(TEMPLATE_DESCRIPTIONS.getOrDefault(templateName, ""));
        EmailTemplateOverride saved = overrideRepository.save(ov);

        EmailTemplateDto dto = new EmailTemplateDto();
        dto.setTemplateName(saved.getTemplateName());
        dto.setDescription(saved.getDescription());
        dto.setCustomized(true);
        dto.setSubject(saved.getSubject());
        dto.setHtmlBody(saved.getHtmlBody());
        dto.setUpdatedAt(saved.getUpdatedAt());
        return dto;
    }

    /** Removes the DB override for a template, reverting to the Thymeleaf default. */
    @Transactional
    public void reset(String templateName) {
        overrideRepository.deleteByOrgIdAndTemplateName(orgId, templateName);
        log.info("EmailTemplateService: reset override for template '{}'", templateName);
    }

    /**
     * Renders a preview of the template with sample variables.
     * Uses the DB override if present, otherwise the Thymeleaf file.
     */
    public String preview(String templateName, String subjectOverride, String htmlBodyOverride) {
        Map<String, Object> vars = new HashMap<>(SAMPLE_VARIABLES);

        // If the caller passes a live draft body, preview that instead of saved DB
        if (htmlBodyOverride != null && !htmlBodyOverride.isBlank()) {
            return substitute(htmlBodyOverride, vars);
        }
        return renderHtml(templateName + ".html", vars);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** Replaces all {@code {{key}}} tokens in the template with values from the map. */
    public static String substitute(String template, Map<String, Object> variables) {
        if (template == null) return "";
        Matcher m = VARIABLE_PATTERN.matcher(template);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String key = m.group(1);
            Object val = variables.get(key);
            m.appendReplacement(sb, Matcher.quoteReplacement(val != null ? val.toString() : ""));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String renderThymeleaf(String templateName, Map<String, Object> variables) {
        // Ensure the name has no directory prefix; it lives under email/
        String name = templateName.startsWith("email/") ? templateName : "email/" + templateName;
        Context ctx = new Context();
        if (variables != null) variables.forEach(ctx::setVariable);
        return templateEngine.process(name, ctx);
    }

    private static String stripHtmlSuffix(String name) {
        if (name == null) return "";
        if (name.endsWith(".html")) return name.substring(0, name.length() - 5);
        // Also strip "email/" prefix if present
        if (name.startsWith("email/")) return name.substring(6);
        return name;
    }
}
