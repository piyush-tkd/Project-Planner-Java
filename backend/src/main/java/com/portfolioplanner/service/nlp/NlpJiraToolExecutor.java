package com.portfolioplanner.service.nlp;

import com.fasterxml.jackson.databind.JsonNode;
import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import com.portfolioplanner.service.jira.JiraAnalyticsService;
import com.portfolioplanner.service.jira.JiraCredentialsService;
import com.portfolioplanner.service.jira.JiraPodService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Executes Jira-related NLP tools. Separated from NlpToolRegistry because
 * these tools need live Jira service dependencies rather than just catalog data.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NlpJiraToolExecutor {

    private final JiraSyncedIssueRepository issueRepo;
    private final JiraIssueLabelRepository labelRepo;
    private final JiraIssueFixVersionRepository fixVersionRepo;
    private final JiraIssueComponentRepository componentRepo;
    private final JiraIssueCommentRepository commentRepo;
    private final JiraIssueWorklogRepository worklogRepo;
    private final JiraProjectMappingRepository mappingRepo;
    private final JiraPodRepository podRepo;
    private final JiraAnalyticsService analyticsService;
    private final JiraCredentialsService credentialsService;
    private final JiraPodService podService;

    // Tool definitions for the LLM prompt
    public List<NlpToolRegistry.ToolDefinition> getToolDefinitions() {
        return List.of(
            new NlpToolRegistry.ToolDefinition("get_jira_issue",
                "Fetch a single Jira issue by its key (e.g. PROJ-123). Returns summary, status, assignee, priority, type, story points, created/resolved dates, and description excerpt.",
                "{ \"key\": \"string (Jira issue key like PROJ-123)\" }"),

            new NlpToolRegistry.ToolDefinition("search_jira_issues",
                "Search Jira issues using filters. Can filter by project, type, status, assignee, priority, label. Returns up to 20 matching issues.",
                "{ \"project\": \"string? (project key)\", \"type\": \"string? (Bug|Story|Task|Epic)\", \"status\": \"string? (To Do|In Progress|Done)\", \"assignee\": \"string? (name)\", \"priority\": \"string? (Highest|High|Medium|Low|Lowest)\", \"label\": \"string?\", \"text\": \"string? (text search in summary)\" }"),

            new NlpToolRegistry.ToolDefinition("get_jira_analytics_summary",
                "Get aggregate Jira analytics: total issues, open/resolved counts, average cycle time, top assignees by workload, bug trend, created vs resolved trend. Optionally filter by time range and pod.",
                "{ \"months\": \"number? (lookback months, default 3)\", \"pod\": \"string? (pod name to filter)\" }"),

            new NlpToolRegistry.ToolDefinition("get_jira_workload",
                "Get assignee workload breakdown showing open issue count, in-progress count, and story points per person.",
                "{ \"pod\": \"string? (pod name to filter)\" }"),

            new NlpToolRegistry.ToolDefinition("get_jira_sprint_health",
                "Get health metrics for the current or a named sprint: total stories, completed, in-progress, blocked, completion percentage.",
                "{ \"sprint\": \"string? (sprint name or 'current')\" }"),

            new NlpToolRegistry.ToolDefinition("get_jira_bug_summary",
                "Get bug metrics: total open bugs by priority, bug creation trend, average bug resolution time.",
                "{ \"months\": \"number? (lookback, default 3)\", \"project\": \"string? (project key)\" }"),

            new NlpToolRegistry.ToolDefinition("get_project_jira_issues",
                "Get all Jira issues linked to a Portfolio Planner project via its epic/label mapping. Use when user asks about tickets, issues, or progress for a specific project by name.",
                "{ \"project_name\": \"string (Portfolio Planner project name)\" }"),

            new NlpToolRegistry.ToolDefinition("get_jira_issue_contributors",
                "Get who worked on a Jira issue: assignee, reporter, worklog authors with hours logged, and commenters. Use for 'who worked on X', 'who all worked on X', 'hours logged on X'.",
                "{ \"key\": \"string (Jira issue key like PROJ-123)\" }")
        );
    }

    // Check if this executor handles the tool
    public boolean handles(String toolName) {
        return Set.of("get_jira_issue", "search_jira_issues", "get_jira_analytics_summary",
                "get_jira_workload", "get_jira_sprint_health", "get_jira_bug_summary",
                "get_project_jira_issues", "get_jira_issue_contributors")
                .contains(toolName);
    }

    // Execute a Jira tool
    public NlpToolRegistry.ToolResult executeTool(String toolName, JsonNode params) {
        if (!credentialsService.isConfigured()) {
            return NlpToolRegistry.ToolResult.fail("Jira is not configured. Please set up Jira credentials in Settings.");
        }
        try {
            return switch (toolName) {
                case "get_jira_issue" -> getJiraIssue(params);
                case "search_jira_issues" -> searchJiraIssues(params);
                case "get_jira_analytics_summary" -> getAnalyticsSummary(params);
                case "get_jira_workload" -> getWorkload(params);
                case "get_jira_sprint_health" -> getSprintHealth(params);
                case "get_jira_bug_summary" -> getBugSummary(params);
                case "get_project_jira_issues" -> getProjectJiraIssues(params);
                case "get_jira_issue_contributors" -> getJiraIssueContributors(params);
                default -> NlpToolRegistry.ToolResult.fail("Unknown Jira tool: " + toolName);
            };
        } catch (Exception e) {
            log.warn("Jira tool '{}' failed: {}", toolName, e.getMessage());
            return NlpToolRegistry.ToolResult.fail("Jira tool error: " + e.getMessage());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Public: structured issue lookup (used by RuleBasedStrategy)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Look up a Jira issue by key and return structured data suitable for
     * the NLP frontend to render as a JIRA_ISSUE_PROFILE card.
     *
     * @return null if not found; otherwise a Map with _type = JIRA_ISSUE_PROFILE
     */
    public Map<String, Object> lookupIssueStructured(String issueKey) {
        if (issueKey == null || issueKey.isBlank()) return null;
        String key = issueKey.trim().toUpperCase();

        Optional<JiraSyncedIssue> issueOpt = issueRepo.findByIssueKey(key);
        if (issueOpt.isEmpty()) return null;

        JiraSyncedIssue issue = issueOpt.get();

        // Load related entities
        List<JiraIssueLabel> labels = labelRepo.findByIssueKeyIn(List.of(key));
        List<JiraIssueFixVersion> fixVersions = fixVersionRepo.findByIssueKeyIn(List.of(key));
        List<JiraIssueComponent> components = componentRepo.findByIssueKeyIn(List.of(key));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "JIRA_ISSUE_PROFILE");
        data.put("Key", key);
        data.put("Summary", issue.getSummary());
        data.put("Type", issue.getIssueType());
        data.put("Status", issue.getStatusName());
        data.put("Status Category", issue.getStatusCategory());
        data.put("Priority", issue.getPriorityName());
        data.put("Assignee", issue.getAssigneeDisplayName() != null ? issue.getAssigneeDisplayName() : "Unassigned");
        data.put("Reporter", issue.getReporterDisplayName() != null ? issue.getReporterDisplayName() : "Unknown");
        data.put("Story Points", issue.getStoryPoints() != null && issue.getStoryPoints() > 0
                ? String.valueOf(issue.getStoryPoints()) : "N/A");
        data.put("Created", formatDate(issue.getCreatedAt()));
        data.put("Resolved", issue.getResolutionDate() != null ? formatDate(issue.getResolutionDate()) : "Open");
        data.put("Time Logged", formatSeconds(issue.getTimeSpent() != null ? issue.getTimeSpent() : 0));
        data.put("Estimate", formatSeconds(issue.getTimeOriginalEstimate() != null ? issue.getTimeOriginalEstimate() : 0));

        if (issue.getSprintName() != null) data.put("Sprint", issue.getSprintName());
        if (issue.getEpicName() != null) data.put("Epic", issue.getEpicName());
        if (issue.getParentKey() != null) data.put("Parent", issue.getParentKey());
        if (issue.getDueDate() != null) data.put("Due Date", issue.getDueDate().toString());

        if (!labels.isEmpty()) {
            data.put("Labels", labels.stream().map(JiraIssueLabel::getLabel).collect(Collectors.joining(", ")));
        }
        if (!fixVersions.isEmpty()) {
            data.put("Fix Versions", fixVersions.stream().map(JiraIssueFixVersion::getVersionName).collect(Collectors.joining(", ")));
        }
        if (!components.isEmpty()) {
            data.put("Components", components.stream().map(JiraIssueComponent::getComponentName).collect(Collectors.joining(", ")));
        }

        data.put("Project", issue.getProjectKey());

        // Description text (truncated for display)
        if (issue.getDescriptionText() != null && !issue.getDescriptionText().isBlank()) {
            String desc = issue.getDescriptionText().trim();
            if (desc.length() > 1000) {
                desc = desc.substring(0, 1000) + "…";
            }
            data.put("Description", desc);
        }

        // Comments — fetch and include
        List<JiraIssueComment> comments = commentRepo.findByIssueKeyOrderByCreatedAsc(key);
        data.put("Comment Count", comments.size());
        if (!comments.isEmpty()) {
            List<Map<String, String>> commentList = new ArrayList<>();
            // Include last 10 comments to keep response manageable
            List<JiraIssueComment> recentComments = comments.size() > 10
                    ? comments.subList(comments.size() - 10, comments.size()) : comments;
            for (JiraIssueComment c : recentComments) {
                Map<String, String> cm = new LinkedHashMap<>();
                cm.put("author", c.getAuthorDisplayName() != null ? c.getAuthorDisplayName() : "Unknown");
                cm.put("date", c.getCreated() != null ? formatDate(c.getCreated()) : "");
                String body = c.getBody();
                if (body != null && body.length() > 500) {
                    body = body.substring(0, 500) + "…";
                }
                cm.put("body", body != null ? body : "");
                commentList.add(cm);
            }
            data.put("Comments", commentList);
        }

        return data;
    }

    /**
     * Build a human-readable summary string for a Jira issue (used by LLM tool flow).
     */
    public String summarizeIssue(Map<String, Object> structured) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Issue: %s — %s\n", structured.get("Key"), structured.get("Summary")));
        sb.append(String.format("Type: %s | Status: %s | Priority: %s\n",
                structured.get("Type"), structured.get("Status"), structured.get("Priority")));
        sb.append(String.format("Assignee: %s | Story Points: %s\n",
                structured.get("Assignee"), structured.get("Story Points")));
        sb.append(String.format("Created: %s | Resolved: %s\n",
                structured.get("Created"), structured.get("Resolved")));
        sb.append(String.format("Time Logged: %s | Estimate: %s\n",
                structured.get("Time Logged"), structured.get("Estimate")));
        if (structured.containsKey("Sprint")) sb.append("Sprint: ").append(structured.get("Sprint")).append("\n");
        if (structured.containsKey("Epic")) sb.append("Epic: ").append(structured.get("Epic")).append("\n");
        if (structured.containsKey("Labels")) sb.append("Labels: ").append(structured.get("Labels")).append("\n");
        if (structured.containsKey("Fix Versions")) sb.append("Fix Versions: ").append(structured.get("Fix Versions")).append("\n");
        if (structured.containsKey("Components")) sb.append("Components: ").append(structured.get("Components")).append("\n");
        if (structured.containsKey("Description")) {
            sb.append("\nDescription:\n").append(structured.get("Description")).append("\n");
        }
        if (structured.containsKey("Comments") && structured.get("Comments") instanceof List) {
            @SuppressWarnings("unchecked")
            List<Map<String, String>> comments = (List<Map<String, String>>) structured.get("Comments");
            if (!comments.isEmpty()) {
                sb.append("\nRecent Comments (").append(comments.size()).append("):\n");
                for (Map<String, String> c : comments) {
                    sb.append("  [").append(c.get("date")).append("] ").append(c.get("author")).append(": ");
                    sb.append(c.get("body")).append("\n");
                }
            }
        }
        return sb.toString();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Tool implementations
    // ═══════════════════════════════════════════════════════════════════════════

    private NlpToolRegistry.ToolResult getJiraIssue(JsonNode params) {
        String key = params.path("key").asText("").trim().toUpperCase();
        if (key.isBlank()) return NlpToolRegistry.ToolResult.fail("Missing 'key' parameter");

        Map<String, Object> structured = lookupIssueStructured(key);
        if (structured == null) return NlpToolRegistry.ToolResult.fail("Issue not found: " + key);

        return NlpToolRegistry.ToolResult.ok(summarizeIssue(structured));
    }

    private NlpToolRegistry.ToolResult searchJiraIssues(JsonNode params) {
        String project = params.path("project").asText(null);
        String type = params.path("type").asText(null);
        String status = params.path("status").asText(null);
        String assignee = params.path("assignee").asText(null);
        String priority = params.path("priority").asText(null);
        String label = params.path("label").asText(null);
        String text = params.path("text").asText(null);

        // Load all issues from DB (could be optimized with custom queries)
        List<JiraSyncedIssue> issues = new ArrayList<>(issueRepo.findAll());

        // Filter by criteria in memory
        if (project != null) {
            issues = issues.stream().filter(i -> i.getProjectKey().equalsIgnoreCase(project)).collect(Collectors.toList());
        }
        if (type != null) {
            issues = issues.stream().filter(i -> i.getIssueType().equalsIgnoreCase(type)).collect(Collectors.toList());
        }
        if (status != null) {
            issues = issues.stream().filter(i -> i.getStatusName().equalsIgnoreCase(status)).collect(Collectors.toList());
        }
        if (assignee != null) {
            issues = issues.stream().filter(i -> i.getAssigneeDisplayName() != null &&
                    i.getAssigneeDisplayName().toLowerCase().contains(assignee.toLowerCase())).collect(Collectors.toList());
        }
        if (priority != null) {
            issues = issues.stream().filter(i -> i.getPriorityName().equalsIgnoreCase(priority)).collect(Collectors.toList());
        }
        if (text != null) {
            issues = issues.stream().filter(i -> i.getSummary().toLowerCase().contains(text.toLowerCase())).collect(Collectors.toList());
        }

        // Default: recent open issues (statusCategory != Done)
        if (project == null && type == null && status == null && assignee == null && priority == null && label == null && text == null) {
            issues = issues.stream().filter(i -> !"Done".equalsIgnoreCase(i.getStatusCategory())).collect(Collectors.toList());
        }

        // Label filtering
        if (label != null) {
            List<String> labelIssueKeys = labelRepo.findAll().stream()
                    .filter(l -> l.getLabel() != null && l.getLabel().equalsIgnoreCase(label))
                    .map(JiraIssueLabel::getIssueKey)
                    .collect(Collectors.toList());
            issues = issues.stream().filter(i -> labelIssueKeys.contains(i.getIssueKey())).collect(Collectors.toList());
        }

        // Sort by created date descending and limit to 20
        issues.sort((a, b) -> {
            LocalDateTime aDate = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.MIN;
            LocalDateTime bDate = b.getCreatedAt() != null ? b.getCreatedAt() : LocalDateTime.MIN;
            return bDate.compareTo(aDate);
        });
        List<JiraSyncedIssue> topIssues = issues.stream().limit(20).collect(Collectors.toList());

        if (topIssues.isEmpty()) return NlpToolRegistry.ToolResult.ok("No issues found matching the criteria.");

        StringBuilder sb = new StringBuilder("Found " + topIssues.size() + " issues:\n");
        for (var issue : topIssues) {
            sb.append(String.format("  %s [%s] %s — %s | Assignee: %s | Priority: %s\n",
                    issue.getIssueKey(),
                    issue.getIssueType(),
                    issue.getSummary(),
                    issue.getStatusName(),
                    issue.getAssigneeDisplayName() != null ? issue.getAssigneeDisplayName() : "Unassigned",
                    issue.getPriorityName()));
        }
        return NlpToolRegistry.ToolResult.ok(sb.toString());
    }

    private NlpToolRegistry.ToolResult getAnalyticsSummary(JsonNode params) {
        int months = params.path("months").asInt(3);
        String podFilter = params.path("pod").asText(null);

        // Resolve pod IDs if filtered
        List<Long> podIds = null;
        if (podFilter != null && !podFilter.isBlank()) {
            podIds = podService.getAllPods().stream()
                    .filter(p -> p.getPodDisplayName().toLowerCase().contains(podFilter.toLowerCase()))
                    .map(p -> p.getId())
                    .collect(Collectors.toList());
        }

        var analytics = analyticsService.getAnalytics(months, podIds, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> analyticsMap = (Map<String, Object>) analytics;

        // Extract KPIs
        Map<String, Object> kpis = (Map<String, Object>) analyticsMap.get("kpis");
        StringBuilder sb = new StringBuilder("Jira Analytics Summary (last " + months + " months):\n\n");

        if (kpis != null) {
            sb.append(String.format("Total Issues: %s | Open: %s | Resolved: %s\n",
                    kpis.getOrDefault("totalIssues", 0),
                    kpis.getOrDefault("openIssues", 0),
                    kpis.getOrDefault("resolvedIssues", 0)));
            sb.append(String.format("Avg Cycle Time: %s days | Open Bugs: %s | Resolution Rate: %s%%\n",
                    kpis.getOrDefault("avgCycleTimeDays", "N/A"),
                    kpis.getOrDefault("openBugs", 0),
                    kpis.getOrDefault("resolutionRate", "N/A")));
        }

        // Top assignees by workload
        Object workloadObj = analyticsMap.get("workload");
        if (workloadObj instanceof List<?> workload && !workload.isEmpty()) {
            sb.append("\nTop Assignees by Open Issues:\n");
            int count = 0;
            for (Object w : workload) {
                if (count >= 10) break;
                if (w instanceof Map<?,?> wm) {
                    sb.append(String.format("  %s — Open: %s, In Progress: %s, SP: %s\n",
                            safeGet(wm, "assignee", "?"),
                            safeGet(wm, "openCount", 0),
                            safeGet(wm, "inProgressCount", 0),
                            safeGet(wm, "totalSp", 0)));
                }
                count++;
            }
        }

        // Status breakdown
        Object statusObj = analyticsMap.get("statusCategoryBreakdown");
        if (statusObj instanceof List<?> statuses && !statuses.isEmpty()) {
            sb.append("\nStatus Breakdown:\n");
            for (Object s : statuses) {
                if (s instanceof Map<?,?> sm) {
                    sb.append(String.format("  %s: %s issues\n",
                            safeGet(sm, "name", "?"), safeGet(sm, "count", 0)));
                }
            }
        }

        return NlpToolRegistry.ToolResult.ok(sb.toString());
    }

    private NlpToolRegistry.ToolResult getWorkload(JsonNode params) {
        String podFilter = params.path("pod").asText(null);
        List<Long> podIds = null;
        if (podFilter != null && !podFilter.isBlank()) {
            podIds = podService.getAllPods().stream()
                    .filter(p -> p.getPodDisplayName().toLowerCase().contains(podFilter.toLowerCase()))
                    .map(p -> p.getId())
                    .collect(Collectors.toList());
        }

        var analytics = analyticsService.getAnalytics(3, podIds, null);
        @SuppressWarnings("unchecked")
        Map<String, Object> analyticsMap = (Map<String, Object>) analytics;

        Object workloadObj = analyticsMap.get("workload");
        if (!(workloadObj instanceof List<?> workload) || workload.isEmpty()) {
            return NlpToolRegistry.ToolResult.ok("No workload data available.");
        }

        StringBuilder sb = new StringBuilder("Assignee Workload:\n");
        for (Object w : workload) {
            if (w instanceof Map<?,?> wm) {
                sb.append(String.format("  %s — Open: %s, In Progress: %s, Done: %s, Story Points: %s\n",
                        safeGet(wm, "assignee", "?"),
                        safeGet(wm, "openCount", 0),
                        safeGet(wm, "inProgressCount", 0),
                        safeGet(wm, "doneCount", 0),
                        safeGet(wm, "totalSp", 0)));
            }
        }
        return NlpToolRegistry.ToolResult.ok(sb.toString());
    }

    private NlpToolRegistry.ToolResult getSprintHealth(JsonNode params) {
        String sprintFilter = params.path("sprint").asText("current");

        // Get all enabled projects
        List<String> projectKeys = podRepo.findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc().stream()
                .flatMap(pod -> pod.getBoards().stream())
                .map(com.portfolioplanner.domain.model.JiraPodBoard::getJiraProjectKey)
                .distinct()
                .collect(Collectors.toList());

        List<JiraSyncedIssue> issues;
        if ("current".equalsIgnoreCase(sprintFilter)) {
            // Find active sprint issues
            issues = issueRepo.findActiveSprintIssuesByProjectKeys(projectKeys);
        } else {
            // Find issues by sprint name
            List<JiraSyncedIssue> allIssues = issueRepo.findByProjectKeyIn(projectKeys);
            issues = allIssues.stream()
                    .filter(i -> i.getSprintName() != null && i.getSprintName().equalsIgnoreCase(sprintFilter))
                    .collect(Collectors.toList());
        }

        if (issues.isEmpty()) return NlpToolRegistry.ToolResult.ok("No issues found in the sprint.");

        int total = issues.size();
        int done = 0, inProgress = 0, toDo = 0;
        double totalSp = 0, doneSp = 0;

        for (JiraSyncedIssue issue : issues) {
            String statusName = issue.getStatusName();
            Double sp = issue.getStoryPoints() != null ? issue.getStoryPoints() : 0;
            totalSp += sp;

            if (statusName != null) {
                String lower = statusName.toLowerCase();
                if (lower.contains("done") || lower.contains("closed") || lower.contains("resolved")) {
                    done++;
                    doneSp += sp;
                } else if (lower.contains("progress") || lower.contains("review") || lower.contains("testing")) {
                    inProgress++;
                } else {
                    toDo++;
                }
            }
        }

        StringBuilder sb = new StringBuilder("Sprint Health:\n");
        sb.append(String.format("Total Issues: %d | Done: %d | In Progress: %d | To Do: %d\n", total, done, inProgress, toDo));
        sb.append(String.format("Completion: %.0f%% (%d/%d)\n", total > 0 ? (double) done * 100 / total : 0, done, total));
        sb.append(String.format("Story Points: %.0f total, %.0f completed (%.0f%%)\n",
                totalSp, doneSp, totalSp > 0 ? doneSp * 100 / totalSp : 0));

        return NlpToolRegistry.ToolResult.ok(sb.toString());
    }

    private NlpToolRegistry.ToolResult getBugSummary(JsonNode params) {
        int months = params.path("months").asInt(3);
        String project = params.path("project").asText(null);

        // Get all bugs from DB
        List<JiraSyncedIssue> allBugs = issueRepo.findAll().stream()
                .filter(i -> "Bug".equalsIgnoreCase(i.getIssueType()))
                .collect(Collectors.toList());

        // Filter by project if specified
        if (project != null) {
            allBugs = allBugs.stream()
                    .filter(i -> i.getProjectKey().equalsIgnoreCase(project))
                    .collect(Collectors.toList());
        }

        // Separate open and resolved bugs
        LocalDateTime cutoffDate = LocalDateTime.now().minusMonths(months);
        List<JiraSyncedIssue> openBugs = allBugs.stream()
                .filter(i -> !"Done".equalsIgnoreCase(i.getStatusCategory()))
                .collect(Collectors.toList());

        List<JiraSyncedIssue> resolvedBugs = allBugs.stream()
                .filter(i -> "Done".equalsIgnoreCase(i.getStatusCategory()) &&
                        i.getResolutionDate() != null &&
                        i.getResolutionDate().isAfter(cutoffDate))
                .collect(Collectors.toList());

        // Count by priority
        Map<String, Integer> openByPriority = new LinkedHashMap<>();
        for (JiraSyncedIssue bug : openBugs) {
            String prio = bug.getPriorityName() != null ? bug.getPriorityName() : "None";
            openByPriority.merge(prio, 1, Integer::sum);
        }

        StringBuilder sb = new StringBuilder("Bug Summary (last " + months + " months):\n\n");
        sb.append("Open Bugs: " + openBugs.size() + "\n");
        if (!openByPriority.isEmpty()) {
            sb.append("By Priority: ");
            sb.append(openByPriority.entrySet().stream()
                    .map(e -> e.getKey() + "=" + e.getValue())
                    .collect(Collectors.joining(", ")));
            sb.append("\n");
        }
        sb.append("Resolved in period: " + resolvedBugs.size() + "\n");

        // Top 5 open bugs (sorted by priority)
        if (!openBugs.isEmpty()) {
            sb.append("\nTop Open Bugs:\n");
            openBugs.sort(Comparator.comparing(JiraSyncedIssue::getPriorityName, Comparator.nullsLast(Comparator.naturalOrder())));
            int count = 0;
            for (JiraSyncedIssue bug : openBugs) {
                if (count >= 5) break;
                sb.append(String.format("  %s [%s] %s — %s\n",
                        bug.getIssueKey(),
                        bug.getPriorityName(),
                        bug.getSummary(),
                        bug.getAssigneeDisplayName() != null ? bug.getAssigneeDisplayName() : "Unassigned"));
                count++;
            }
        }

        return NlpToolRegistry.ToolResult.ok(sb.toString());
    }

    private NlpToolRegistry.ToolResult getJiraIssueContributors(JsonNode params) {
        String key = params.path("key").asText("").trim().toUpperCase();
        if (key.isBlank()) return NlpToolRegistry.ToolResult.fail("Missing 'key' parameter");

        Map<String, Object> data = getIssueContributors(key);
        if (data == null) return NlpToolRegistry.ToolResult.fail("Issue not found: " + key);

        return NlpToolRegistry.ToolResult.ok(summarizeContributors(data));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Project → Jira mapping tool
    // ═══════════════════════════════════════════════════════════════════════════

    private NlpToolRegistry.ToolResult getProjectJiraIssues(JsonNode params) {
        String projectName = params.path("project_name").asText("").trim();
        if (projectName.isBlank()) return NlpToolRegistry.ToolResult.fail("Missing 'project_name' parameter");

        // Find active mappings that match this project name
        List<JiraProjectMapping> allMappings = mappingRepo.findByActiveTrueOrderByJiraProjectKey();
        List<JiraProjectMapping> matchedMappings = allMappings.stream()
                .filter(m -> m.getProject().getName().toLowerCase().contains(projectName.toLowerCase())
                        || projectName.toLowerCase().contains(m.getProject().getName().toLowerCase()))
                .collect(Collectors.toList());

        if (matchedMappings.isEmpty()) {
            return NlpToolRegistry.ToolResult.fail(
                    "No Jira mapping found for project '" + projectName + "'. "
                    + "Projects with Jira mappings: " + allMappings.stream()
                        .map(m -> m.getProject().getName()).distinct()
                        .collect(Collectors.joining(", ")));
        }

        // Gather issues based on mapping type
        Set<String> matchedKeys = new LinkedHashSet<>();
        String ppProjectName = matchedMappings.get(0).getProject().getName();

        for (JiraProjectMapping mapping : matchedMappings) {
            String jiraProject = mapping.getJiraProjectKey();
            String matchType = mapping.getMatchType();
            String matchValue = mapping.getMatchValue();

            List<JiraSyncedIssue> projectIssues = issueRepo.findAll().stream()
                    .filter(i -> i.getProjectKey().equalsIgnoreCase(jiraProject))
                    .collect(Collectors.toList());

            switch (matchType) {
                case "EPIC_NAME" -> {
                    // Match issues whose epic name matches the mapping value
                    projectIssues.stream()
                            .filter(i -> i.getEpicName() != null
                                    && i.getEpicName().toLowerCase().contains(matchValue.toLowerCase()))
                            .forEach(i -> matchedKeys.add(i.getIssueKey()));
                    // Also include the epic itself (parent issues matching by summary)
                    projectIssues.stream()
                            .filter(i -> "Epic".equalsIgnoreCase(i.getIssueType())
                                    && i.getSummary() != null
                                    && i.getSummary().toLowerCase().contains(matchValue.toLowerCase()))
                            .forEach(i -> matchedKeys.add(i.getIssueKey()));
                }
                case "LABEL" -> {
                    List<String> labelIssueKeys = labelRepo.findAll().stream()
                            .filter(l -> l.getLabel() != null
                                    && l.getLabel().equalsIgnoreCase(matchValue))
                            .map(JiraIssueLabel::getIssueKey)
                            .collect(Collectors.toList());
                    matchedKeys.addAll(labelIssueKeys);
                }
                case "PROJECT_NAME" -> {
                    // All issues in the Jira project
                    projectIssues.forEach(i -> matchedKeys.add(i.getIssueKey()));
                }
            }
        }

        // Fetch matched issues
        List<JiraSyncedIssue> issues = issueRepo.findAll().stream()
                .filter(i -> matchedKeys.contains(i.getIssueKey()))
                .sorted((a, b) -> {
                    LocalDateTime aDate = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.MIN;
                    LocalDateTime bDate = b.getCreatedAt() != null ? b.getCreatedAt() : LocalDateTime.MIN;
                    return bDate.compareTo(aDate);
                })
                .limit(30)
                .collect(Collectors.toList());

        if (issues.isEmpty()) {
            return NlpToolRegistry.ToolResult.ok("No Jira issues found linked to project '" + ppProjectName + "'.");
        }

        // Build summary with stats
        long openCount = issues.stream().filter(i -> !"Done".equalsIgnoreCase(i.getStatusCategory())).count();
        long doneCount = issues.stream().filter(i -> "Done".equalsIgnoreCase(i.getStatusCategory())).count();
        long bugCount = issues.stream().filter(i -> "Bug".equalsIgnoreCase(i.getIssueType())).count();
        double totalSP = issues.stream()
                .filter(i -> i.getStoryPoints() != null)
                .mapToDouble(JiraSyncedIssue::getStoryPoints).sum();

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Project: %s — %d Jira issues (Open: %d, Done: %d, Bugs: %d, Story Points: %.0f)\n\n",
                ppProjectName, issues.size(), openCount, doneCount, bugCount, totalSP));

        for (var issue : issues) {
            sb.append(String.format("  %s [%s] %s — %s | Assignee: %s | SP: %s | Priority: %s\n",
                    issue.getIssueKey(),
                    issue.getIssueType(),
                    issue.getSummary(),
                    issue.getStatusName(),
                    issue.getAssigneeDisplayName() != null ? issue.getAssigneeDisplayName() : "Unassigned",
                    issue.getStoryPoints() != null ? String.valueOf(issue.getStoryPoints().intValue()) : "–",
                    issue.getPriorityName()));
        }
        return NlpToolRegistry.ToolResult.ok(sb.toString());
    }

    /**
     * Build a structured issue list map suitable for frontend rendering as JIRA_ISSUE_LIST.
     * Used by both search results and project-linked issues.
     */
    public Map<String, Object> buildIssueListStructured(List<JiraSyncedIssue> issues, String title) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "JIRA_ISSUE_LIST");
        data.put("Title", title);
        data.put("Total", issues.size());

        long openCount = issues.stream().filter(i -> !"Done".equalsIgnoreCase(i.getStatusCategory())).count();
        long doneCount = issues.stream().filter(i -> "Done".equalsIgnoreCase(i.getStatusCategory())).count();
        data.put("Open", openCount);
        data.put("Done", doneCount);

        List<Map<String, String>> issueList = new ArrayList<>();
        for (var issue : issues) {
            Map<String, String> item = new LinkedHashMap<>();
            item.put("key", issue.getIssueKey());
            item.put("type", issue.getIssueType());
            item.put("summary", issue.getSummary());
            item.put("status", issue.getStatusName());
            item.put("statusCategory", issue.getStatusCategory() != null ? issue.getStatusCategory() : "");
            item.put("assignee", issue.getAssigneeDisplayName() != null ? issue.getAssigneeDisplayName() : "Unassigned");
            item.put("priority", issue.getPriorityName());
            item.put("sp", issue.getStoryPoints() != null ? String.valueOf(issue.getStoryPoints().intValue()) : "–");
            issueList.add(item);
        }
        data.put("issues", issueList);
        return data;
    }

    /**
     * Get contributors (assignees + worklog authors + comment authors) for a specific issue.
     * Includes hours logged per person. Used to answer "who worked on ticket X".
     */
    public Map<String, Object> getIssueContributors(String issueKey) {
        if (issueKey == null || issueKey.isBlank()) return null;
        String key = issueKey.trim().toUpperCase();

        Optional<JiraSyncedIssue> issueOpt = issueRepo.findByIssueKey(key);
        if (issueOpt.isEmpty()) return null;

        JiraSyncedIssue issue = issueOpt.get();

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "JIRA_ISSUE_CONTRIBUTORS");
        data.put("Key", key);
        data.put("Summary", issue.getSummary());
        data.put("Status", issue.getStatusName());
        data.put("Type", issue.getIssueType());

        // Track contributors with roles
        Map<String, Set<String>> personRoles = new LinkedHashMap<>();
        Map<String, Long> personHours = new LinkedHashMap<>();

        // Assignee
        if (issue.getAssigneeDisplayName() != null && !"Unassigned".equals(issue.getAssigneeDisplayName())) {
            personRoles.computeIfAbsent(issue.getAssigneeDisplayName(), k -> new LinkedHashSet<>()).add("Assignee");
        }
        if (issue.getReporterDisplayName() != null) {
            personRoles.computeIfAbsent(issue.getReporterDisplayName(), k -> new LinkedHashSet<>()).add("Reporter");
        }

        // Worklog authors with hours
        List<JiraIssueWorklog> worklogs = worklogRepo.findByIssueKey(key);
        for (JiraIssueWorklog wl : worklogs) {
            if (wl.getAuthorDisplayName() != null) {
                personRoles.computeIfAbsent(wl.getAuthorDisplayName(), k -> new LinkedHashSet<>()).add("Worklog");
                personHours.merge(wl.getAuthorDisplayName(), wl.getTimeSpentSeconds(), Long::sum);
            }
        }

        // Comment authors
        List<JiraIssueComment> comments = commentRepo.findByIssueKeyOrderByCreatedAsc(key);
        for (JiraIssueComment c : comments) {
            if (c.getAuthorDisplayName() != null) {
                personRoles.computeIfAbsent(c.getAuthorDisplayName(), k -> new LinkedHashSet<>()).add("Commenter");
            }
        }

        // Build contributor list
        List<Map<String, String>> contributorList = new ArrayList<>();
        for (Map.Entry<String, Set<String>> entry : personRoles.entrySet()) {
            Map<String, String> person = new LinkedHashMap<>();
            person.put("name", entry.getKey());
            person.put("roles", String.join(", ", entry.getValue()));
            Long seconds = personHours.get(entry.getKey());
            person.put("hoursLogged", seconds != null ? formatSeconds(seconds) : "0h");
            contributorList.add(person);
        }

        data.put("Contributors", contributorList);
        data.put("Contributor Count", personRoles.size());
        data.put("Total Time Logged", formatSeconds(issue.getTimeSpent() != null ? issue.getTimeSpent() : 0));
        data.put("Story Points", issue.getStoryPoints() != null ? String.valueOf(issue.getStoryPoints().intValue()) : "N/A");
        data.put("Comment Count", comments.size());

        return data;
    }

    /**
     * Summarize contributors as text for LLM consumption.
     */
    public String summarizeContributors(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Contributors for %s — %s\n", data.get("Key"), data.get("Summary")));
        sb.append(String.format("Status: %s | Type: %s | Story Points: %s | Total Time: %s\n\n",
                data.get("Status"), data.get("Type"), data.get("Story Points"), data.get("Total Time Logged")));

        @SuppressWarnings("unchecked")
        List<Map<String, String>> contributors = (List<Map<String, String>>) data.get("Contributors");
        if (contributors != null) {
            for (Map<String, String> c : contributors) {
                sb.append(String.format("  %s — %s | Hours: %s\n", c.get("name"), c.get("roles"), c.get("hoursLogged")));
            }
        }
        return sb.toString();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    private String formatDate(LocalDateTime dateTime) {
        if (dateTime == null) return "N/A";
        return dateTime.toLocalDate().toString();
    }

    private String formatSeconds(long seconds) {
        if (seconds <= 0) return "0h";
        long hours = seconds / 3600;
        long minutes = (seconds % 3600) / 60;
        if (hours > 0 && minutes > 0) return hours + "h " + minutes + "m";
        if (hours > 0) return hours + "h";
        return minutes + "m";
    }

    /** Safe wildcard-map getter: returns map.get(key) or the default if null. */
    private static Object safeGet(Map<?, ?> map, String key, Object defaultValue) {
        Object val = map.get(key);
        return val != null ? val : defaultValue;
    }
}
