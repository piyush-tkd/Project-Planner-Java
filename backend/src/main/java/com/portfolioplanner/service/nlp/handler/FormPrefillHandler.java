package com.portfolioplanner.service.nlp.handler;

import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.service.nlp.NlpStrategy;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Form prefill and entity creation handler.
 * Owns CREATE_PATTERNS, STATUS_UPDATE_PATTERNS, ADD_MEMBER_PATTERNS, EXPORT_PATTERNS,
 * CREATE_ROUTES, and EXPORT_ROUTES maps.
 */
@Component
public class FormPrefillHandler implements NlpPatternHandler {

    // ── Creation patterns ──────────────────────────────────────────────────
    private static final List<Pattern> CREATE_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:create|add|new|make)\\s+(?:a\\s+)?(?:new\\s+)?(.+)$"),
            Pattern.compile("(?i)^(?:set up|setup)\\s+(?:a\\s+)?(?:new\\s+)?(.+)$")
    );

    // ── Status update patterns ───────────────────────────────────────────
    private static final List<Pattern> STATUS_UPDATE_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:mark|set|change|update)\\s+(?:project\\s+)?(.+?)\\s+(?:as|to|status to)\\s+(active|on[\\s\\-_]?hold|completed|cancelled|not[\\s\\-_]?started|in[\\s\\-_]?discovery)$"),
            Pattern.compile("(?i)^(?:put|move)\\s+(?:project\\s+)?(.+?)\\s+(?:on[\\s\\-_]?hold|to active|to completed)$")
    );

    // ── Add-member-to-entity patterns (must be checked BEFORE creation) ──
    private static final List<Pattern> ADD_MEMBER_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:add|assign|move|put)\\s+(.+?)\\s+(?:to|into|in|onto)\\s+(?:the\\s+)?(.+?)(?:\\s+(?:pod|team|group))?$"),
            Pattern.compile("(?i)^(?:add|assign|move|put)\\s+(.+?)\\s+(?:to|into|in|onto)\\s+(?:the\\s+)?(.+)$")
    );

    // ── Export patterns ──────────────────────────────────────────────────
    private static final List<Pattern> EXPORT_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:export|download|get|generate)\\s+(.+?)\\s+(?:as|to|in)\\s+(?:csv|excel|xlsx|spreadsheet)$"),
            Pattern.compile("(?i)^(?:export|download)\\s+(.+?)(?:\\s+csv|\\s+excel|\\s+xlsx)?$"),
            Pattern.compile("(?i)^(?:csv|excel|xlsx)\\s+(?:of|for|export)\\s+(.+)$")
    );

    // ── Entity type to route mapping for form prefill ──────────────────────
    private static final Map<String, String> CREATE_ROUTES = new LinkedHashMap<>();
    static {
        CREATE_ROUTES.put("resource", "/resources?action=create");
        CREATE_ROUTES.put("override", "/overrides?action=create");
        CREATE_ROUTES.put("project",  "/projects?action=create");
        CREATE_ROUTES.put("release",  "/release-calendar?action=create");
        CREATE_ROUTES.put("sprint",   "/sprint-calendar?action=create");
        CREATE_ROUTES.put("pod",      "/pods?action=create");
    }

    // ── Export route mapping ──────────────────────────────────────────────
    private static final Map<String, String> EXPORT_ROUTES = new LinkedHashMap<>();
    static {
        EXPORT_ROUTES.put("reconciliation",     "/api/reports/export/reconciliation");
        EXPORT_ROUTES.put("capacity",           "/api/reports/export/reconciliation");
        EXPORT_ROUTES.put("projects",           "/api/reports/export/reconciliation");
        EXPORT_ROUTES.put("resources",          "/api/reports/export/reconciliation");
        EXPORT_ROUTES.put("budget",             "/api/reports/export/reconciliation");
    }

    @Override
    public String name() {
        return "FORM_PREFILL";
    }

    @Override
    public NlpStrategy.NlpResult tryHandle(String query, NlpCatalogResponse catalog) {
        // Try creation (form prefill)
        NlpStrategy.NlpResult create = tryCreation(query, catalog);
        if (create != null) return create;

        // Try status update
        NlpStrategy.NlpResult statusUpdate = tryStatusUpdate(query, catalog);
        if (statusUpdate != null) return statusUpdate;

        // Try add member to entity
        NlpStrategy.NlpResult addMember = tryAddMemberToEntity(query, catalog);
        if (addMember != null) return addMember;

        // Try export
        NlpStrategy.NlpResult export = tryExport(query);
        if (export != null) return export;

        return null;
    }

    @Override
    public int order() {
        return 20;
    }

    private NlpStrategy.NlpResult tryCreation(String query, NlpCatalogResponse catalog) {
        for (Pattern p : CREATE_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.matches()) {
                String rest = m.group(1).trim().toLowerCase();

                // First pass: startsWith
                for (var entry : CREATE_ROUTES.entrySet()) {
                    if (rest.startsWith(entry.getKey())) {
                        Map<String, Object> formData = extractFormFields(rest, entry.getKey(), catalog);
                        return new NlpStrategy.NlpResult("FORM_PREFILL", 0.85,
                                "I'll set up a new " + entry.getKey() + " for you. Review the details and hit Save when ready.",
                                entry.getValue(), formData, null, null,
                                List.of("Show all " + entry.getKey() + "s"), null);
                    }
                }

                // Second pass: word-boundary contains
                for (var entry : CREATE_ROUTES.entrySet()) {
                    Pattern wordBoundary = Pattern.compile("(?i)\\b" + Pattern.quote(entry.getKey()) + "\\b");
                    if (wordBoundary.matcher(rest).find()) {
                        Map<String, Object> formData = extractFormFields(rest, entry.getKey(), catalog);
                        return new NlpStrategy.NlpResult("FORM_PREFILL", 0.85,
                                "I'll set up a new " + entry.getKey() + " for you. Review the details and hit Save when ready.",
                                entry.getValue(), formData, null, null,
                                List.of("Show all " + entry.getKey() + "s"), null);
                    }
                }
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryStatusUpdate(String query, NlpCatalogResponse catalog) {
        if (catalog == null || catalog.projectDetails() == null) return null;

        for (Pattern p : STATUS_UPDATE_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String projectName = m.group(1).trim();
                String newStatus = m.groupCount() >= 2 ? m.group(2).trim().toUpperCase().replace(" ", "_") : null;

                NlpCatalogResponse.ProjectInfo proj = findProjectByName(projectName, catalog.projectDetails());
                if (proj != null && newStatus != null) {
                    Map<String, Object> formData = new LinkedHashMap<>();
                    formData.put("projectId", proj.id());
                    formData.put("status", newStatus);

                    return new NlpStrategy.NlpResult("FORM_PREFILL", 0.88,
                            "I'll update " + proj.name() + " status to " + formatStatus(newStatus) + ". Please confirm on the project form.",
                            "/projects?action=edit&id=" + proj.id(), formData, null, null,
                            List.of("Show " + proj.name() + " details"), null);
                }
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryAddMemberToEntity(String query, NlpCatalogResponse catalog) {
        if (catalog == null) return null;

        for (Pattern p : ADD_MEMBER_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.matches()) {
                String personFragment = m.group(1).trim();
                String targetFragment = m.group(2).trim();

                NlpCatalogResponse.ResourceInfo resource = findResourceByName(personFragment, catalog.resourceDetails());
                NlpCatalogResponse.PodInfo pod = findPodByName(targetFragment, catalog.podDetails());

                if (resource != null && pod != null) {
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "ACTION_GUIDANCE");
                    data.put("Resource", resource.name());
                    data.put("Current POD", resource.podName());
                    data.put("Target POD", pod.name());
                    data.put("POD Members", String.valueOf(pod.memberCount()));
                    return new NlpStrategy.NlpResult("DATA_QUERY", 0.90,
                            resource.name() + " is currently in the " + resource.podName() + " POD. "
                                    + "To move them to " + pod.name() + ", go to the Resources page and update their POD assignment.",
                            "/resources", null, data, "/pods/" + pod.id(),
                            List.of("Show " + pod.name() + " POD details", "Go to Resources page"), null);
                } else if (pod != null) {
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "ACTION_GUIDANCE");
                    data.put("Target POD", pod.name());
                    data.put("POD Members", String.valueOf(pod.memberCount()));
                    if (pod.members() != null && !pod.members().isEmpty()) {
                        data.put("Current Members", String.join(", ", pod.members()));
                    }
                    return new NlpStrategy.NlpResult("DATA_QUERY", 0.85,
                            "To add a member to the " + pod.name() + " POD, go to the Resources page and update their POD assignment. "
                                    + "The " + pod.name() + " POD currently has " + pod.memberCount() + " member(s).",
                            "/resources", null, data, "/pods/" + pod.id(),
                            List.of("Show " + pod.name() + " POD details", "Go to Resources page"), null);
                } else if (resource != null) {
                    NlpCatalogResponse.ProjectInfo proj = findProjectByName(targetFragment, catalog.projectDetails());
                    if (proj != null) {
                        Map<String, Object> data = new LinkedHashMap<>();
                        data.put("_type", "ACTION_GUIDANCE");
                        data.put("Resource", resource.name());
                        data.put("Project", proj.name());
                        return new NlpStrategy.NlpResult("DATA_QUERY", 0.88,
                                resource.name() + " can be assigned to " + proj.name()
                                        + " via POD-level project assignments. Go to the project's POD planning to configure.",
                                "/projects/" + proj.id(), null, data, null,
                                List.of("Show " + proj.name() + " details", "Go to Resources page"), null);
                    }
                }
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryExport(String query) {
        for (Pattern p : EXPORT_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String subject = m.group(1).trim().toLowerCase();
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "EXPORT");

                String exportUrl = null;
                String label = "data";
                for (var entry : EXPORT_ROUTES.entrySet()) {
                    if (subject.contains(entry.getKey())) {
                        exportUrl = entry.getValue();
                        label = entry.getKey();
                        break;
                    }
                }

                if (exportUrl == null) {
                    exportUrl = "/api/reports/export/reconciliation";
                    label = "capacity reconciliation";
                }

                data.put("exportUrl", exportUrl);
                data.put("label", label);

                return new NlpStrategy.NlpResult("DATA_QUERY", 0.85,
                        "Ready to export " + label + " data. Click the download button below.",
                        null, null, data, null,
                        List.of("Show " + label + " report", null), null);
            }
        }
        return null;
    }

    private Map<String, Object> extractFormFields(String input, String entityType, NlpCatalogResponse catalog) {
        Map<String, Object> formData = new LinkedHashMap<>();

        // Remove the entity type from the start
        String name = input.replaceAll("^(?:new\\s+)?(?:a\\s+)?(?:an\\s+)?" + Pattern.quote(entityType) + "\\s+", "").trim();
        if (!name.isEmpty()) {
            formData.put("name", name);
        }

        return formData;
    }

    private NlpCatalogResponse.ProjectInfo findProjectByName(String name, List<NlpCatalogResponse.ProjectInfo> projects) {
        if (projects == null || name == null) return null;
        String lower = name.toLowerCase();
        return projects.stream()
                .filter(p -> p.name().toLowerCase().contains(lower) || lower.contains(p.name().toLowerCase()))
                .findFirst()
                .orElse(null);
    }

    private NlpCatalogResponse.PodInfo findPodByName(String name, List<NlpCatalogResponse.PodInfo> pods) {
        if (pods == null || name == null) return null;
        String lower = name.toLowerCase();
        return pods.stream()
                .filter(p -> p.name().toLowerCase().contains(lower) || lower.contains(p.name().toLowerCase()))
                .findFirst()
                .orElse(null);
    }

    private NlpCatalogResponse.ResourceInfo findResourceByName(String name, List<NlpCatalogResponse.ResourceInfo> resources) {
        if (resources == null || name == null) return null;
        String lower = name.toLowerCase();
        return resources.stream()
                .filter(r -> r.name().toLowerCase().contains(lower) || lower.contains(r.name().toLowerCase()))
                .findFirst()
                .orElse(null);
    }

    private String formatStatus(String status) {
        if (status == null) return "";
        return status.replace("_", " ").toLowerCase();
    }
}
