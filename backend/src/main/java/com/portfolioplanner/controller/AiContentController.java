package com.portfolioplanner.controller;

import com.portfolioplanner.service.UserAiKeyService;
import com.portfolioplanner.service.nlp.CloudLlmStrategy;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * AI content generation endpoint for the AI Content Studio page.
 *
 * POST /api/ai/generate
 *   Body: { type, context, projectId?, tone? }
 *   Returns: { output: string, source: "ORG" | "USER" }
 *
 * Key resolution priority:
 *  1. Org-level key (nlp_config.cloud_api_key) — if set, used for all users
 *  2. User's personal key (user_ai_config) — fallback when no org key
 *  3. HTTP 503 when neither is configured
 */
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiContentController {

    private final CloudLlmStrategy cloudLlm;
    private final UserAiKeyService userAiKeyService;

    public record GenerateRequest(
        String type,       // status_email | retro_summary | risk_brief | meeting_actions
        String context,
        Long   projectId,
        String tone
    ) {}

    @PostMapping("/generate")
    public ResponseEntity<Map<String, String>> generate(
            @RequestBody GenerateRequest req,
            Authentication auth) {

        UserAiKeyService.ResolvedCredentials creds = userAiKeyService.resolve(auth.getName());

        if ("NONE".equals(creds.source())) {
            return ResponseEntity.status(503)
                .body(Map.of(
                    "error", "No AI key configured. Set an org key in NLP Settings or add your personal key in My AI Settings.",
                    "source", "NONE"
                ));
        }

        String systemPrompt = buildSystemPrompt(req.type(), req.tone());
        String userMessage  = buildUserMessage(req.type(), req.context(), req.projectId());

        String output = cloudLlm.generateContentWith(
                creds.provider(), creds.model(), creds.apiKey(),
                systemPrompt, userMessage);

        if (output == null || output.isBlank()) {
            return ResponseEntity.status(502)
                .body(Map.of("error", "AI generation returned empty response.", "source", creds.source()));
        }

        return ResponseEntity.ok(Map.of("output", output, "source", creds.source()));
    }

    private String buildSystemPrompt(String type, String tone) {
        String toneDesc = tone != null ? switch (tone) {
            case "concise"   -> "Be concise and to the point.";
            case "executive" -> "Write for a senior executive audience — high-level and strategic.";
            case "technical" -> "Include technical detail appropriate for an engineering audience.";
            default          -> "Be professional and clear.";
        } : "Be professional and clear.";

        return switch (type != null ? type : "") {
            case "status_email" -> """
                You are an experienced project manager drafting a project status update email.
                %s
                Write a well-structured email with sections for Current Status, Progress This Week,
                Risks & Watch Items, and Next Steps. Use markdown-compatible formatting.
                Do not include any preamble — output only the email content.
                """.formatted(toneDesc).strip();

            case "retro_summary" -> """
                You are a skilled Scrum Master synthesizing sprint retrospective notes.
                %s
                Produce a structured summary with sections:
                - What went well (with bullet points)
                - What needs improvement (with bullet points)
                - Action items (as a markdown table: #, Action, Owner, Due)
                - Team mood (one sentence)
                Do not include any preamble — output only the summary.
                """.formatted(toneDesc).strip();

            case "risk_brief" -> """
                You are a portfolio manager creating an executive risk brief.
                %s
                Structure the brief as:
                - Executive Summary (2-3 sentences)
                - Critical Risks (action required) — numbered list
                - Watch Items — numbered list
                - On Track items — bullet list
                - Recommended Actions — numbered list
                Do not include any preamble — output only the brief.
                """.formatted(toneDesc).strip();

            case "meeting_actions" -> """
                You are an AI assistant extracting action items from meeting notes.
                %s
                Produce:
                1. A markdown table of action items: # | Action Item | Owner | Priority | Due Date
                2. A "Decisions Made" section (bullet list of ✅ items)
                3. An "Open Questions" section (bullet list of ❓ items)
                Do not include any preamble — output only the extracted content.
                """.formatted(toneDesc).strip();

            default -> "You are a helpful assistant. " + toneDesc;
        };
    }

    private String buildUserMessage(String type, String context, Long projectId) {
        if (context != null && !context.isBlank()) return context;
        if (projectId != null) return "Project ID: " + projectId;
        return "Generate content for type: " + type;
    }
}
