package com.portfolioplanner.service.nlp.handler;

import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.service.nlp.NlpStrategy;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Greeting, capability discovery, and help handler.
 * Owns GREETING_PATTERNS, CAPABILITY_PATTERNS, HELP_PATTERNS, and HELP_TOPICS map.
 */
@Component
public class GreetingHelpHandler implements NlpPatternHandler {

    // ── Greeting / small-talk patterns ──────────────────────────────
    private static final List<Pattern> GREETING_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:hi|hello|hey|good morning|good afternoon|good evening|howdy|sup|yo)(?:\\s.*)?$"),
            Pattern.compile("(?i)^(?:thanks|thank you|thx|cheers|appreciate it)(?:\\s.*)?$")
    );

    // ── Capability discovery patterns ──────────────────────────────
    private static final List<Pattern> CAPABILITY_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:what can you do|what do you do|help me|show me what you can do|capabilities|features?)$"),
            Pattern.compile("(?i)^(?:how can you help|what are your capabilities|what should I ask|give me examples?)$"),
            Pattern.compile("(?i)^(?:tell me (?:something )?about (?:this |the )?(?:app|application|tool|system|platform|planner))$"),
            Pattern.compile("(?i)^(?:what (?:is|does) (?:this |the )?(?:app|application|tool|system|platform|planner)(?: do)?)$"),
            Pattern.compile("(?i)^(?:about (?:this |the )?(?:app|application|tool|system|platform|planner))$")
    );

    // ── Help / explanation patterns ────────────────────────────────────────
    private static final List<Pattern> HELP_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:what is|what are|explain|help|how does?|how do|tell me about)\\s+(.+)$"),
            Pattern.compile("(?i)^(?:what does?)\\s+(?:the\\s+)?(.+?)\\s+(?:mean|do|show|report)"),
            Pattern.compile("(?i)^(?:can you )?tell me (?:how|what|where|why)\\s+(.+)$"),
            Pattern.compile("(?i)^(?:can you )?(?:explain|help|clarify)\\s+(?:how|what)\\s+(.+)$")
    );

    // ── Help topics ────────────────────────────────────────────────────────
    private static final Map<String, String> HELP_TOPICS = new LinkedHashMap<>();
    static {
        HELP_TOPICS.put("bau", "BAU (Business As Usual) represents the percentage of a POD's capacity reserved for ongoing operational work like maintenance, support, and tech debt. For example, a 20% BAU means 20% of a POD's hours are set aside, and the remaining 80% is available for project work.");
        HELP_TOPICS.put("capacity", "Capacity represents the total available working hours for a POD in a given month. It's calculated as: working hours × FTE × (1 - BAU%). This gives you the 'project bandwidth' — hours available for planned project work after deducting BAU.");
        HELP_TOPICS.put("demand", "Demand is the total hours required by all projects assigned to a POD for a given month. It comes from the project-pod planning matrix.");
        HELP_TOPICS.put("gap", "The capacity gap is the difference between capacity and demand: Gap = Capacity - Demand. A positive gap means spare hours. A negative gap means over-committed.");
        HELP_TOPICS.put("effort pattern", "Effort patterns define how project work is distributed across months. For example, a 'Front-loaded' pattern might allocate 40% of hours in month 1, 30% in month 2, and 30% in month 3.");
        HELP_TOPICS.put("t-shirt size", "T-shirt sizes (XS, S, M, L, XL, XXL) are a quick way to estimate project effort. Each size maps to a base number of hours.");
        HELP_TOPICS.put("sprint planner", "The Sprint Planning Recommender shows capacity vs demand analysis per POD for the active Jira sprint with health scores and recommendations.");
        HELP_TOPICS.put("override", "Temporary overrides let you allocate a resource to a different POD for a specific time period.");
        HELP_TOPICS.put("concurrency", "Concurrency risk measures how many projects a POD is working on simultaneously. High concurrency increases context-switching costs and delivery risk.");
        HELP_TOPICS.put("utilization", "Utilization is the ratio of demand to capacity (Demand / Capacity). Under 65% = under-utilized, 65-100% = healthy, over 100% = over-capacity.");
        HELP_TOPICS.put("pod", "A POD is a cross-functional team (developers, QAs, BSAs, tech leads) that works together on a set of projects. Each pod has its own capacity and BAU allocation.");
        HELP_TOPICS.put("priority", "Projects are prioritized P0 through P3. P0 = Critical (must-do), P1 = High, P2 = Medium, P3 = Low/Nice-to-have.");
        HELP_TOPICS.put("roi", "Resource ROI shows the return on investment per resource or role, comparing their billing cost against the value delivered through project work.");
        HELP_TOPICS.put("gantt", "The Gantt chart provides a visual timeline view of all projects showing start dates, durations, and overlaps to help plan and identify scheduling conflicts.");
        HELP_TOPICS.put("budget", "The Budget report shows project costs calculated from resource hours × billing rates, broken down by pod, role, and month.");
        HELP_TOPICS.put("scenario", "Scenarios let you create 'what-if' simulations. Clone the current plan, adjust projects or resources, and compare the impact without affecting the live data.");
        HELP_TOPICS.put("cross-pod", "Cross-pod dependencies occur when a project needs resources from multiple PODs. The cross-pod report highlights these shared dependencies and coordination risks.");
        HELP_TOPICS.put("hiring", "The Hiring Forecast identifies upcoming capacity shortfalls by role and location, helping you plan hiring ahead of demand peaks.");
        HELP_TOPICS.put("cost rate", "Cost rates define the hourly billing rate for each role (Developer, QA, BSA, Tech Lead) per location (US, India). Used to compute project budgets: hours × rate.");
        HELP_TOPICS.put("audit", "The Audit Log tracks all changes made in the system — who changed what and when. Useful for compliance and troubleshooting.");
        HELP_TOPICS.put("capex", "CapEx (Capital Expenditure) vs OpEx (Operating Expenditure) classification for Jira work — tracks which hours count toward capitalized development vs operational maintenance.");
        HELP_TOPICS.put("worklog", "The Worklog report shows time logged in Jira — actual hours worked per resource, compared against planned capacity.");
        HELP_TOPICS.put("slack buffer", "Slack/Buffer represents the cushion between capacity and demand. Positive slack means breathing room; zero or negative means the team is stretched thin.");
        HELP_TOPICS.put("deadline gap", "The Deadline Gap report shows projects at risk of missing their target end dates based on current velocity and remaining effort.");
        HELP_TOPICS.put("dora", "DORA (DevOps Research and Assessment) metrics measure engineering performance: Deployment Frequency (how often you deploy), Lead Time for Changes (time from commit to production), Change Failure Rate (% of deploys causing issues), and Mean Time to Recovery (how fast you fix failures).");
        HELP_TOPICS.put("dora metrics", "DORA metrics measure engineering performance: Deployment Frequency, Lead Time for Changes, Change Failure Rate, and Mean Time to Recovery.");
        HELP_TOPICS.put("jira", "Jira integration syncs issues, sprints, and worklogs from your Jira projects into Portfolio Planner. This allows you to track actual work, sprint health, bug metrics, and workload distribution alongside your capacity planning data.");
        HELP_TOPICS.put("story points", "Story points are a relative estimation unit used in Agile to measure the effort, complexity, and uncertainty of a piece of work. Common scales include Fibonacci (1, 2, 3, 5, 8, 13, 21) or T-shirt sizes. They help teams estimate velocity and plan sprints.");
        HELP_TOPICS.put("sprint velocity", "Sprint velocity is the amount of work (usually in story points) a team completes in a sprint. It's used to predict how much work the team can handle in future sprints. Consistent velocity indicates a well-calibrated team.");
        HELP_TOPICS.put("fte", "FTE (Full-Time Equivalent) represents the portion of a full-time position a resource occupies. 1.0 FTE = full-time, 0.5 FTE = half-time. Used in capacity planning to calculate available hours.");
        HELP_TOPICS.put("ip week", "IP (Innovation & Planning) Week is a dedicated sprint period where teams step back from regular project work to focus on innovation, technical improvements, learning, or planning activities.");
        HELP_TOPICS.put("code freeze", "Code freeze is a period before a release where no new code changes are allowed. This gives QA time to do final testing and ensures stability. The freeze date is set in the release calendar.");
        HELP_TOPICS.put("complexity multiplier", "The complexity multiplier on a POD adjusts capacity calculations to account for the inherent complexity of a POD's domain. A multiplier > 1.0 means work takes longer than average; < 1.0 means it's simpler.");
        HELP_TOPICS.put("project mapping", "Project mapping links a Portfolio Planner project to Jira via an epic name, label, or project key. This enables the system to pull Jira tickets associated with each project for tracking and analytics.");
        HELP_TOPICS.put("support board", "Support boards track incoming support tickets and maintenance work. They help measure the support burden on teams, track stale tickets, and understand how much time goes to reactive vs proactive work.");
        HELP_TOPICS.put("reconciliation", "The reconciliation report compares planned capacity against actual demand across all pods and months, highlighting discrepancies between what was planned and what actually happened.");
        HELP_TOPICS.put("contingency", "Contingency is a buffer percentage added to project effort estimates to account for unknowns, risks, and scope creep. Typically 10-20%. It's configured per project-pod assignment.");
        HELP_TOPICS.put("owner demand", "The Owner Demand report shows how demand is distributed across project owners/PMs, helping identify if any single owner is overloaded with too many concurrent projects.");
    }

    @Override
    public String name() {
        return "GREETING_HELP";
    }

    @Override
    public NlpStrategy.NlpResult tryHandle(String query, NlpCatalogResponse catalog) {
        // Greeting has high priority
        NlpStrategy.NlpResult greeting = tryGreeting(query);
        if (greeting != null) return greeting;

        // Capability discovery
        NlpStrategy.NlpResult capability = tryCapabilityDiscovery(query);
        if (capability != null) return capability;

        // Help topics
        NlpStrategy.NlpResult help = tryHelp(query, catalog);
        if (help != null) return help;

        return null;
    }

    @Override
    public int order() {
        return 5;
    }

    private NlpStrategy.NlpResult tryGreeting(String query) {
        for (Pattern p : GREETING_PATTERNS) {
            if (p.matcher(query).matches()) {
                String lower = query.toLowerCase().trim();
                if (lower.startsWith("thank") || lower.startsWith("thx") || lower.startsWith("cheers") || lower.startsWith("appreciate")) {
                    return new NlpStrategy.NlpResult("HELP", 0.95, "You're welcome! Let me know if there's anything else I can help you with.",
                            null, null, null, null,
                            List.of("Show dashboard", "What can you do?"), null);
                }
                return new NlpStrategy.NlpResult("HELP", 0.95,
                        "Hello! I'm your Portfolio Planner AI assistant. I can help you navigate pages, look up resources/projects/pods, check sprints & releases, run risk checks, export data, and much more. What would you like to do?",
                        null, null, null, null,
                        List.of("What can you do?", "Show dashboard", "Any red flags?", "Current sprint"), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryCapabilityDiscovery(String query) {
        for (Pattern p : CAPABILITY_PATTERNS) {
            if (p.matcher(query).matches()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "CAPABILITIES");
                data.put("Navigate", "\"Go to capacity gap report\", \"Open sprint planner\"");
                data.put("Create", "\"Create a new project called Alpha\", \"Add a new resource\"");
                data.put("Lookup", "\"Who is John Smith?\", \"Tell me about SgNIPT project\", \"API pod details\"");
                data.put("Compare", "\"Compare API pod vs Platform pod\"");
                data.put("Cross-Entity", "\"Who works on Project X?\", \"What projects is John on?\"");
                data.put("Sprint/Release", "\"Current sprint\", \"Next release\", \"Release date in July\"");
                data.put("Risk Check", "\"Any red flags?\", \"Show highest priority tickets\"");
                data.put("Analytics", "\"How many tech leads in India?\", \"Average billing rate of QAs\"");
                data.put("Budget & Cost", "\"What's the total budget?\", \"Cost of Project X\", \"Show cost rates\"");
                data.put("Export", "\"Export projects as CSV\"");
                data.put("Filter", "\"Show P0 projects\", \"List active projects\", \"John's projects\"");
                data.put("Status Update", "\"Mark Project X as on hold\"");
                data.put("BAU & Overrides", "\"What's the BAU for API pod?\", \"Any active overrides?\"");
                data.put("Jira", "\"Show CapEx report\", \"Worklog summary\", \"Jira dashboard for API pod\"");
                data.put("Scenario", "\"What if we add a new project?\", \"Run a simulation\"");
                data.put("Audit", "\"Who changed X?\", \"Recent changes\", \"Audit log\"");
                data.put("Explain", "\"What is BAU?\", \"Explain capacity\", \"What does utilization mean?\"");
                return new NlpStrategy.NlpResult("HELP", 0.95,
                        "Here's what I can help you with — try any of the example queries below!",
                        null, null, data, null,
                        List.of("Any red flags?", "Current sprint", "Show dashboard", "How many active projects?"), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryHelp(String query, NlpCatalogResponse catalog) {
        for (Pattern p : HELP_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String topic = m.group(1).trim().toLowerCase();

                // Dynamic t-shirt size help using catalog data
                if (topic.contains("t-shirt") || topic.contains("tshirt") || topic.contains("t shirt")
                        || topic.contains("sizing") || topic.matches(".*\\b(xs|xl|xxl)\\b.*")) {
                    if (catalog != null && catalog.tshirtSizes() != null && !catalog.tshirtSizes().isEmpty()) {
                        StringBuilder sb = new StringBuilder("T-shirt sizes map to base effort hours: ");
                        for (NlpCatalogResponse.TshirtSizeInfo ts : catalog.tshirtSizes()) {
                            sb.append(ts.name()).append(" = ").append(ts.baseHours()).append("hrs, ");
                        }
                        sb.setLength(sb.length() - 2);
                        sb.append(". These hours are then multiplied by pod complexity and role effort mix to get the final demand.");
                        Map<String, Object> data = new LinkedHashMap<>();
                        data.put("_type", "COST_RATE");
                        for (NlpCatalogResponse.TshirtSizeInfo ts : catalog.tshirtSizes()) {
                            data.put(ts.name(), ts.baseHours() + " hours");
                        }
                        return new NlpStrategy.NlpResult("HELP", 0.90, sb.toString(),
                                null, null, data, "/settings/ref-data",
                                List.of("Show reference data settings", "What is an effort pattern?"), null);
                    }
                }

                for (var entry : HELP_TOPICS.entrySet()) {
                    if (topic.contains(entry.getKey())) {
                        return new NlpStrategy.NlpResult("HELP", 0.88, entry.getValue(),
                                null, null, null, null, List.of("Go to " + entry.getKey() + " settings"), null);
                    }
                }

                // Fallback: generic help
                return new NlpStrategy.NlpResult("HELP", 0.75,
                        "I don't have specific information about \"" + topic + "\" yet. Try asking about capacity, demand, utilization, budget, BAU, hiring, or any other concept you'd like to understand better.",
                        null, null, null, null, List.of("What can you do?", "Show dashboard"), null);
            }
        }
        return null;
    }
}
