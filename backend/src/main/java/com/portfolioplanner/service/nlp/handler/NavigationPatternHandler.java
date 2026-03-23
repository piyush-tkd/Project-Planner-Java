package com.portfolioplanner.service.nlp.handler;

import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.service.nlp.NlpStrategy;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Navigation handler: routes navigation queries to pages.
 * Owns NAV_PATTERNS, PAGE_ALIASES, and all page routing logic.
 */
@Component
public class NavigationPatternHandler implements NlpPatternHandler {

    // ── Navigation patterns ────────────────────────────────────────────────
    private static final List<Pattern> NAV_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:go to|open|show|show me|navigate to|take me to)\\s+(?:the\\s+)?(.+)$"),
            Pattern.compile("(?i)^(?:where is|find)\\s+(?:the\\s+)?(.+?)\\s*(?:page|screen|report)?$")
    );

    // ── Budget / cost patterns ─────────────────────────────────────────
    private static final List<Pattern> BUDGET_PATTERNS = List.of(
            Pattern.compile("(?i)(?:total|overall)\\s+(?:budget|cost|spend|expense)"),
            Pattern.compile("(?i)(?:budget|cost|spend|expense)\\s+(?:of|for)\\s+(?:project\\s+)?(.+)$"),
            Pattern.compile("(?i)(?:most expensive|highest cost|costliest)\\s+(?:projects?|pods?)"),
            Pattern.compile("(?i)(?:budget|cost)\\s+(?:breakdown|summary|overview|by pod|by project)"),
            Pattern.compile("(?i)(?:what.s|what is|how much)\\s+(?:the\\s+)?(?:total\\s+)?(?:budget|cost|spend)"),
            Pattern.compile("(?i)(?:show me|show)\\s+(?:the\\s+)?(?:budget|cost)")
    );

    // ── Override / temp allocation patterns ────────────────────────────
    private static final List<Pattern> OVERRIDE_PATTERNS = List.of(
            Pattern.compile("(?i)(?:any|are there|show|list)\\s+(?:active\\s+)?(?:overrides?|temp(?:orary)?\\s+(?:allocations?|assignments?))"),
            Pattern.compile("(?i)(?:who has|who is on)\\s+(?:a\\s+)?(?:temp(?:orary)?\\s+)?(?:override|allocation|assignment)"),
            Pattern.compile("(?i)(?:override|temp allocation)\\s+(?:for|of)\\s+(.+)")
    );

    // ── Jira-specific patterns ────────────────────────────────────────
    private static final List<Pattern> JIRA_SPECIFIC_PATTERNS = List.of(
            Pattern.compile("(?i)(?:show|open)\\s+(?:the\\s+)?(?:jira|pod)\\s+(?:dashboard|metrics|board)\\s+(?:for|of)\\s+(.+)$"),
            Pattern.compile("(?i)(?:capex|opex)\\s+(?:report|breakdown|summary)?"),
            Pattern.compile("(?i)(?:worklog|time tracking|time spent)\\s+(?:for|of|summary|report)?"),
            Pattern.compile("(?i)(?:jira)\\s+(?:actuals|actual hours|logged hours)")
    );

    // ── Utilization / heatmap patterns ────────────────────────────────
    private static final List<Pattern> UTILIZATION_PATTERNS = List.of(
            Pattern.compile("(?i)(?:resource\\s+)?utilization\\s+(?:rate|heatmap|report|by\\s+(?:pod|role|month|resource))"),
            Pattern.compile("(?i)who\\s+is\\s+(?:over|under|most|least)\\s*[-\\s]?(?:utilized|loaded|used)"),
            Pattern.compile("(?i)(?:over|under)\\s*[-\\s]?(?:utilized|utilization)\\s+(?:resources?|people|team|pods?)"),
            Pattern.compile("(?i)(?:what.s?|show|give)\\s+(?:me\\s+)?(?:the\\s+)?(?:overall\\s+)?utilization(?:\\s+(?:rate|heatmap|report|dashboard))?"),
            Pattern.compile("(?i)(?:utilization|usage)\\s+(?:trend|over time|by month)")
    );

    // ── Capacity demand patterns ──────────────────────────────────────
    private static final List<Pattern> CAPACITY_DEMAND_PATTERNS = List.of(
            Pattern.compile("(?i)(?:capacity|supply)\\s+(?:vs?\\.?|versus)\\s+(?:demand|need)"),
            Pattern.compile("(?i)(?:do we have|is there)\\s+(?:enough\\s+)?(?:capacity|bandwidth|room)"),
            Pattern.compile("(?i)(?:total|overall)\\s+(?:dev(?:eloper)?|qa|bsa|tech lead)?\\s*(?:capacity|bandwidth)(?:\\s+(?:for|in|this)\\s+(?:month|quarter|sprint|Q[1-4]))?"),
            Pattern.compile("(?i)(?:total|overall)\\s+(?:demand|need|requirement)(?:\\s+(?:for|in|this)\\s+(?:month|quarter|sprint))?"),
            Pattern.compile("(?i)(?:where|what)\\s+(?:is|are)\\s+(?:the\\s+)?(?:bottleneck|constraint|shortage|gap)"),
            Pattern.compile("(?i)(?:capacity|demand)\\s+(?:gap|shortfall|surplus|deficit|forecast)"),
            Pattern.compile("(?i)(?:are we)\\s+(?:over|under)\\s*[-\\s]?(?:capacity|staffed|resourced)")
    );

    // ── Hiring forecast patterns ──────────────────────────────────────
    private static final List<Pattern> HIRING_PATTERNS = List.of(
            Pattern.compile("(?i)(?:do we|should we)\\s+(?:need to\\s+)?hire"),
            Pattern.compile("(?i)(?:hiring|recruitment|hire)\\s+(?:forecast|plan|needs?|recommendation|timeline)"),
            Pattern.compile("(?i)(?:how many)\\s+(?:people|resources?|developers?|QAs?)\\s+(?:should we|do we need to)\\s+hire"),
            Pattern.compile("(?i)(?:when|by when)\\s+(?:do we|should we)\\s+(?:need to\\s+)?hire"),
            Pattern.compile("(?i)(?:what|which)\\s+(?:roles?|positions?)\\s+(?:do we\\s+)?(?:need|should|must)\\s+(?:to\\s+)?(?:hire|fill|recruit)"),
            Pattern.compile("(?i)(?:show|open)\\s+(?:me\\s+)?(?:the\\s+)?hiring\\s+(?:forecast|plan|needs)")
    );

    // ── Concurrency risk patterns ─────────────────────────────────────
    private static final List<Pattern> CONCURRENCY_PATTERNS = List.of(
            Pattern.compile("(?i)(?:concurrency|scheduling|resource)\\s+(?:risk|conflict|contention|clash|collision)"),
            Pattern.compile("(?i)(?:which|any|are there)\\s+(?:resources?|people)\\s+(?:double|multi)\\s*[-\\s]?(?:booked|allocated|assigned)"),
            Pattern.compile("(?i)(?:competing|overlapping|conflicting)\\s+(?:for\\s+)?(?:the same\\s+)?(?:resources?|people)"),
            Pattern.compile("(?i)(?:show|open)\\s+(?:me\\s+)?(?:the\\s+)?concurrency\\s+(?:risk|report|analysis)")
    );

    // ── Project Gantt / timeline visual patterns ──────────────────────
    private static final List<Pattern> GANTT_PATTERNS = List.of(
            Pattern.compile("(?i)(?:show|open)\\s+(?:me\\s+)?(?:the\\s+)?(?:project\\s+)?(?:gantt|timeline|roadmap)(?:\\s+(?:chart|view|report))?"),
            Pattern.compile("(?i)(?:project\\s+)?(?:gantt|timeline|roadmap)\\s+(?:chart|view|report|visualization)"),
            Pattern.compile("(?i)(?:visual|graphical)\\s+(?:project\\s+)?(?:timeline|schedule|roadmap)")
    );

    // ── Owner demand patterns ─────────────────────────────────────────
    private static final List<Pattern> OWNER_DEMAND_PATTERNS = List.of(
            Pattern.compile("(?i)(?:owner|ownership)\\s+(?:demand|load|workload|breakdown)"),
            Pattern.compile("(?i)(?:demand|work|projects?)\\s+(?:by|per)\\s+(?:owner|project owner|pm)"),
            Pattern.compile("(?i)(?:which|who)\\s+(?:owner|pm|project manager)\\s+(?:has|owns)\\s+(?:the\\s+)?(?:most|least|heaviest|lightest)\\s+(?:demand|load|work|projects?)")
    );

    // ── Slack buffer patterns ─────────────────────────────────────────
    private static final List<Pattern> SLACK_BUFFER_PATTERNS = List.of(
            Pattern.compile("(?i)(?:how much|what.s|what is)\\s+(?:the\\s+)?(?:slack|buffer|cushion|breathing room)"),
            Pattern.compile("(?i)(?:slack|buffer)\\s+(?:analysis|report|by pod|per pod)"),
            Pattern.compile("(?i)(?:is there|do we have)\\s+(?:enough\\s+)?(?:slack|buffer|contingency|cushion)"),
            Pattern.compile("(?i)(?:show|open)\\s+(?:me\\s+)?(?:the\\s+)?(?:slack|buffer)\\s+(?:report|analysis|page)")
    );

    // ── CapEx / OpEx patterns ─────────────────────────────────────────
    private static final List<Pattern> CAPEX_OPEX_PATTERNS = List.of(
            Pattern.compile("(?i)(?:capex|cap.?ex|capital\\s+expenditure)\\s+(?:report|breakdown|summary|vs?\\.?|split|by|trend)"),
            Pattern.compile("(?i)(?:opex|op.?ex|operating\\s+expenditure)\\s+(?:report|breakdown|summary)"),
            Pattern.compile("(?i)(?:capex|cap.?ex)\\s+(?:vs?\\.?|versus)\\s+(?:opex|op.?ex)"),
            Pattern.compile("(?i)(?:what|how much|show)\\s+(?:is|are|me)\\s+(?:the\\s+)?(?:capex|cap.?ex|capitalized|capitalizable)\\s+(?:hours?|work|percentage|split)?"),
            Pattern.compile("(?i)(?:capitalization|capitalized)\\s+(?:rate|percentage|split|hours?|report)")
    );

    // ── Pod capacity patterns ─────────────────────────────────────────
    private static final List<Pattern> POD_CAPACITY_PATTERNS = List.of(
            Pattern.compile("(?i)(?:which|what)\\s+pods?\\s+(?:are|is)\\s+(?:over|under|at)\\s*[-\\s]?(?:capacity)"),
            Pattern.compile("(?i)(?:pod|team)\\s+(?:capacity|workload|load)\\s+(?:report|summary|overview|by pod)"),
            Pattern.compile("(?i)(?:show|open)\\s+(?:me\\s+)?(?:the\\s+)?pod\\s+(?:capacity|workload)\\s+(?:report|page|view)")
    );

    // ── Dashboard / overview patterns ─────────────────────────────────
    private static final List<Pattern> DASHBOARD_PATTERNS = List.of(
            Pattern.compile("(?i)(?:give me|show me|what.s?)\\s+(?:a\\s+)?(?:an?\\s+)?(?:overview|summary|snapshot|status|dashboard|executive summary|exec summary)"),
            Pattern.compile("(?i)(?:what do I need to|what should I)\\s+(?:know|focus on|pay attention to)\\s+(?:today|right now|this week)?"),
            Pattern.compile("(?i)(?:portfolio|project|team|overall)\\s+(?:overview|summary|status|health|snapshot)"),
            Pattern.compile("(?i)(?:state of|current state|how.s?)\\s+(?:things|the team|the portfolio|everything|the world)")
    );

    // ── Scenario / what-if patterns ───────────────────────────────────
    private static final List<Pattern> SCENARIO_PATTERNS = List.of(
            Pattern.compile("(?i)(?:what if|what-if|simulate|scenario|hypothetical)\\s+(.+)$"),
            Pattern.compile("(?i)(?:run|create|start)\\s+(?:a\\s+)?(?:simulation|scenario|what-if)"),
            Pattern.compile("(?i)(?:impact|effect)\\s+(?:of|if)\\s+(.+)")
    );

    // ── Audit log patterns ────────────────────────────────────────────
    private static final List<Pattern> AUDIT_PATTERNS = List.of(
            Pattern.compile("(?i)(?:who changed|who modified|who edited|who updated|who deleted|who created)\\s+(.+)$"),
            Pattern.compile("(?i)(?:recent|latest)\\s+(?:changes|modifications|edits|activity|audit)"),
            Pattern.compile("(?i)(?:audit log|audit trail|change log|activity log)"),
            Pattern.compile("(?i)(?:what changed|what.s changed|changes?)\\s+(?:today|recently|this week|last week)")
    );

    // ── Page alias lookup ──────────────────────────────────────────────────
    private static final Map<String, String[]> PAGE_ALIASES = new LinkedHashMap<>();
    static {
        PAGE_ALIASES.put("/",                        new String[]{"dashboard", "home", "main", "landing"});
        PAGE_ALIASES.put("/projects",                new String[]{"projects", "project list", "portfolio"});
        PAGE_ALIASES.put("/resources",               new String[]{"resources", "resource list", "team", "people"});
        PAGE_ALIASES.put("/pods",                    new String[]{"pods", "pod list", "teams"});
        PAGE_ALIASES.put("/availability",            new String[]{"availability", "capacity", "hours", "availability grid"});
        PAGE_ALIASES.put("/overrides",               new String[]{"overrides", "temporary allocations", "temp allocations"});
        PAGE_ALIASES.put("/team-calendar",           new String[]{"team calendar", "calendar"});
        PAGE_ALIASES.put("/sprint-calendar",         new String[]{"sprint calendar", "sprints", "sprint list"});
        PAGE_ALIASES.put("/release-calendar",        new String[]{"release calendar", "releases", "release list"});
        PAGE_ALIASES.put("/sprint-planner",          new String[]{"sprint planner", "sprint planning", "sprint recommender", "pod health"});
        PAGE_ALIASES.put("/reports/capacity-gap",    new String[]{"capacity gap", "gap report", "capacity gap report"});
        PAGE_ALIASES.put("/reports/utilization",     new String[]{"utilization", "heatmap", "utilization heatmap"});
        PAGE_ALIASES.put("/reports/capacity-demand", new String[]{"capacity demand", "capacity vs demand", "supply demand"});
        PAGE_ALIASES.put("/reports/concurrency",     new String[]{"concurrency", "concurrency risk"});
        PAGE_ALIASES.put("/reports/hiring-forecast", new String[]{"hiring forecast", "hiring", "hiring needs"});
        PAGE_ALIASES.put("/reports/project-health",  new String[]{"project health", "project status", "project risk"});
        PAGE_ALIASES.put("/reports/cross-pod",       new String[]{"cross pod", "cross-pod dependency", "dependencies"});
        PAGE_ALIASES.put("/reports/gantt",           new String[]{"gantt", "gantt chart", "project gantt", "timeline chart"});
        PAGE_ALIASES.put("/reports/budget",          new String[]{"budget", "budget report", "cost", "cost report"});
        PAGE_ALIASES.put("/reports/resource-roi",    new String[]{"resource roi", "roi", "return on investment"});
        PAGE_ALIASES.put("/reports/slack-buffer",    new String[]{"slack buffer", "slack", "buffer"});
        PAGE_ALIASES.put("/reports/owner-demand",    new String[]{"owner demand", "demand by owner"});
        PAGE_ALIASES.put("/reports/deadline-gap",    new String[]{"deadline gap", "deadline risk"});
        PAGE_ALIASES.put("/reports/pod-resources",   new String[]{"pod resources", "pod resource summary"});
        PAGE_ALIASES.put("/reports/pod-capacity",    new String[]{"pod capacity", "pods over capacity", "over capacity", "pods capacity", "pod over capacity", "under capacity", "pods under capacity"});
        PAGE_ALIASES.put("/reports/resource-pod-matrix", new String[]{"resource pod matrix", "resource matrix"});
        PAGE_ALIASES.put("/reports/pod-project-matrix",  new String[]{"pod project matrix"});
        PAGE_ALIASES.put("/reports/project-pod-matrix",  new String[]{"project pod matrix"});
        PAGE_ALIASES.put("/reports/pod-splits",      new String[]{"pod splits"});
        PAGE_ALIASES.put("/reports/resource-allocation", new String[]{"resource allocation"});
        PAGE_ALIASES.put("/jira-pods",               new String[]{"jira pods", "jira pod dashboard", "pod dashboard"});
        PAGE_ALIASES.put("/jira-releases",           new String[]{"jira releases"});
        PAGE_ALIASES.put("/release-notes",           new String[]{"release notes"});
        PAGE_ALIASES.put("/jira-actuals",            new String[]{"jira actuals", "actuals"});
        PAGE_ALIASES.put("/jira-capex",              new String[]{"capex", "jira capex", "opex"});
        PAGE_ALIASES.put("/jira-support",            new String[]{"jira support", "support queue", "support tickets"});
        PAGE_ALIASES.put("/jira-worklog",            new String[]{"worklog", "jira worklog", "time tracking"});
        PAGE_ALIASES.put("/simulator/timeline",      new String[]{"timeline simulator", "what if", "simulator"});
        PAGE_ALIASES.put("/simulator/scenario",      new String[]{"scenario simulator", "scenario"});
        PAGE_ALIASES.put("/settings/timeline",       new String[]{"timeline settings", "timeline config"});
        PAGE_ALIASES.put("/settings/ref-data",       new String[]{"reference data", "ref data", "effort patterns", "t-shirt sizes"});
        PAGE_ALIASES.put("/settings/jira",           new String[]{"jira settings", "jira config", "pod watch"});
        PAGE_ALIASES.put("/settings/jira-credentials", new String[]{"jira credentials", "jira connection"});
        PAGE_ALIASES.put("/settings/releases",       new String[]{"release settings"});
        PAGE_ALIASES.put("/settings/support-boards", new String[]{"support boards", "support board settings"});
        PAGE_ALIASES.put("/settings/users",          new String[]{"user management", "users", "permissions"});
        PAGE_ALIASES.put("/settings/nlp",            new String[]{"nlp settings", "nlp config", "nlp configuration", "ai settings"});
        PAGE_ALIASES.put("/settings/audit-log",      new String[]{"audit log", "audit trail"});
        PAGE_ALIASES.put("/settings/tables",         new String[]{"database browser", "tables", "db browser"});
        PAGE_ALIASES.put("/settings/feedback-hub",   new String[]{"feedback hub", "feedback", "user feedback", "suggestions"});
        PAGE_ALIASES.put("/settings/error-log",      new String[]{"error log", "error logs", "application errors", "app errors"});
        PAGE_ALIASES.put("/reports/dora-metrics",    new String[]{"dora metrics", "dora", "dora report", "deployment metrics", "engineering metrics", "deployment frequency", "lead time", "change failure rate", "mttr"});
        PAGE_ALIASES.put("/reports/jira-analytics",  new String[]{"jira analytics", "jira metrics", "jira report", "jira summary", "jira stats"});
        PAGE_ALIASES.put("/reports/jira-dashboard-builder", new String[]{"jira dashboard builder", "jira dashboard", "custom jira dashboard"});
        PAGE_ALIASES.put("/settings/nlp-optimizer",  new String[]{"nlp optimizer", "nlp trainer", "ai trainer", "ai optimizer"});
        PAGE_ALIASES.put("/nlp",                     new String[]{"ask ai", "ai assistant", "chat", "nlp", "ask", "ask question"});
    }

    @Override
    public String name() {
        return "NAVIGATION";
    }

    @Override
    public NlpStrategy.NlpResult tryHandle(String query, NlpCatalogResponse catalog) {
        // Try standard navigation patterns
        NlpStrategy.NlpResult nav = tryNavigation(query);
        if (nav != null) return nav;

        // Try budget queries
        NlpStrategy.NlpResult budget = tryBudgetQueries(query, catalog);
        if (budget != null) return budget;

        // Try override queries
        NlpStrategy.NlpResult override = tryOverrideQueries(query, catalog);
        if (override != null) return override;

        // Try Jira-specific queries
        NlpStrategy.NlpResult jira = tryJiraSpecific(query, catalog);
        if (jira != null) return jira;

        // Try utilization queries
        NlpStrategy.NlpResult util = tryUtilization(query);
        if (util != null) return util;

        // Try capacity vs demand queries
        NlpStrategy.NlpResult capDemand = tryCapacityDemand(query);
        if (capDemand != null) return capDemand;

        // Try hiring forecast
        NlpStrategy.NlpResult hiring = tryHiringForecast(query);
        if (hiring != null) return hiring;

        // Try concurrency risk
        NlpStrategy.NlpResult concurrency = tryConcurrencyRisk(query);
        if (concurrency != null) return concurrency;

        // Try gantt chart
        NlpStrategy.NlpResult gantt = tryGantt(query);
        if (gantt != null) return gantt;

        // Try owner demand
        NlpStrategy.NlpResult ownerDemand = tryOwnerDemand(query);
        if (ownerDemand != null) return ownerDemand;

        // Try slack buffer
        NlpStrategy.NlpResult slackBuf = trySlackBuffer(query);
        if (slackBuf != null) return slackBuf;

        // Try capex/opex
        NlpStrategy.NlpResult capex = tryCapexOpex(query);
        if (capex != null) return capex;

        // Try pod capacity
        NlpStrategy.NlpResult podCap = tryPodCapacity(query);
        if (podCap != null) return podCap;

        // Try dashboard/overview
        NlpStrategy.NlpResult dash = tryDashboardOverview(query);
        if (dash != null) return dash;

        // Try scenario/what-if
        NlpStrategy.NlpResult scenario = tryScenario(query);
        if (scenario != null) return scenario;

        // Try audit log
        NlpStrategy.NlpResult audit = tryAuditLog(query);
        if (audit != null) return audit;

        return null;
    }

    @Override
    public int order() {
        return 25;
    }

    private NlpStrategy.NlpResult tryNavigation(String query) {
        for (Pattern p : NAV_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.matches()) {
                String target = m.group(1).trim().toLowerCase()
                        .replaceAll("\\s+page$", "").replaceAll("\\s+report$", "").replaceAll("\\s+screen$", "");
                String route = findBestRoute(target);
                if (route != null) {
                    String title = getPageTitle(route);
                    return new NlpStrategy.NlpResult("NAVIGATE", 0.92, "Opening " + title + "…",
                            route, null, null, null, List.of("What does " + title + " show?"), null);
                }
            }
        }

        // Bare alias match
        String bare = query.trim().toLowerCase()
                .replaceAll("\\s+page$", "").replaceAll("\\s+report$", "").replaceAll("\\s+screen$", "");
        String bareRoute = findBestRoute(bare);
        if (bareRoute != null) {
            String title = getPageTitle(bareRoute);
            return new NlpStrategy.NlpResult("NAVIGATE", 0.90, "Opening " + title + "…",
                    bareRoute, null, null, null, List.of("What does " + title + " show?"), null);
        }

        return null;
    }

    private NlpStrategy.NlpResult tryBudgetQueries(String query, NlpCatalogResponse catalog) {
        for (Pattern p : BUDGET_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("action", "View budget report with cost breakdown by project and POD");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.85,
                        "Opening the Budget & Cost report — it shows project costs by pod, role, and month.",
                        "/reports/budget", null, data, null,
                        List.of("Show project health", "Export budget as CSV", null), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryOverrideQueries(String query, NlpCatalogResponse catalog) {
        for (Pattern p : OVERRIDE_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("action", "View temporary overrides and allocations");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.85,
                        "Opening the Temporary Overrides page — you can view and manage temp allocations there.",
                        "/overrides", null, data, null,
                        List.of("Show resources", "Show availability grid", null), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryJiraSpecific(String query, NlpCatalogResponse catalog) {
        for (Pattern p : JIRA_SPECIFIC_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String lower = query.toLowerCase();

                if (lower.contains("capex") || lower.contains("opex")) {
                    return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                            "Opening the Jira CapEx/OpEx report.",
                            "/jira-capex", null,
                            Map.of("_type", "NAVIGATE_ACTION", "action", "View CapEx/OpEx report"),
                            null, List.of("Show budget report", "Show Jira POD dashboard"), null);
                }

                if (lower.contains("worklog") || lower.contains("time tracking") || lower.contains("time spent")) {
                    return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                            "Opening the Jira Worklog report.",
                            "/jira-worklog", null,
                            Map.of("_type", "NAVIGATE_ACTION", "action", "View worklog and time tracking"),
                            null, List.of("Show Jira actuals", "Show Jira POD dashboard"), null);
                }

                if (lower.contains("actual")) {
                    return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                            "Opening Jira Actuals — logged hours vs planned.",
                            "/jira-actuals", null,
                            Map.of("_type", "NAVIGATE_ACTION", "action", "View Jira actuals"),
                            null, List.of("Show worklog", "Show budget report"), null);
                }

                if (m.groupCount() >= 1 && m.group(1) != null) {
                    String podName = m.group(1).trim();
                    String msg = "Opening Jira POD Dashboard — you can filter for " + podName + " there.";
                    return new NlpStrategy.NlpResult("NAVIGATE", 0.85, msg,
                            "/jira-pods", null,
                            Map.of("_type", "NAVIGATE_ACTION", "action", "View Jira POD dashboard"),
                            null, List.of("Show sprint planner", "Show support queue"), null);
                }
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryUtilization(String query) {
        for (Pattern p : UTILIZATION_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Utilization Heatmap");
                data.put("route", "/reports/utilization");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                        "Opening the Utilization Heatmap — see who is over or under-utilized by pod, role, and month.",
                        "/reports/utilization", null, data, null,
                        List.of("Show capacity gap", "Show hiring forecast", "Show resource allocation", null), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryCapacityDemand(String query) {
        for (Pattern p : CAPACITY_DEMAND_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Capacity vs Demand");
                data.put("route", "/reports/capacity-demand");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                        "Opening the Capacity vs Demand report — see supply, demand, and gaps across pods and months.",
                        "/reports/capacity-demand", null, data, null,
                        List.of("Show capacity gap", "Show utilization heatmap", "Show hiring forecast", null), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryHiringForecast(String query) {
        for (Pattern p : HIRING_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Hiring Forecast");
                data.put("route", "/reports/hiring-forecast");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                        "Opening the Hiring Forecast — see upcoming capacity shortfalls by role and location, with recommendations on when and what to hire.",
                        "/reports/hiring-forecast", null, data, null,
                        List.of("Show capacity gap", "Show utilization heatmap", "Do we need to hire?", null), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryConcurrencyRisk(String query) {
        for (Pattern p : CONCURRENCY_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Concurrency Risk");
                data.put("route", "/reports/concurrency");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                        "Opening the Concurrency Risk report — see which pods or resources are double-booked or have conflicting allocations.",
                        "/reports/concurrency", null, data, null,
                        List.of("Show resource allocation", "Show capacity demand", "Show project dependencies", null), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryGantt(String query) {
        for (Pattern p : GANTT_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Project Gantt Chart");
                data.put("route", "/reports/gantt");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.90,
                        "Opening the Project Gantt Chart — a visual timeline of all projects showing start dates, durations, and overlaps.",
                        "/reports/gantt", null, data, null,
                        List.of("Show project health", "Show cross-pod dependencies", "Show deadline gap", null), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryOwnerDemand(String query) {
        for (Pattern p : OWNER_DEMAND_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Owner Demand");
                data.put("route", "/reports/owner-demand");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                        "Opening the Owner Demand report — see how project demand is distributed across project owners.",
                        "/reports/owner-demand", null, data, null,
                        List.of("Show project health", "List all projects", "Show capacity demand", null), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult trySlackBuffer(String query) {
        for (Pattern p : SLACK_BUFFER_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Slack / Buffer Analysis");
                data.put("route", "/reports/slack-buffer");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                        "Opening the Slack/Buffer Analysis — see how much breathing room each pod has between capacity and demand.",
                        "/reports/slack-buffer", null, data, null,
                        List.of("Show capacity gap", "Show utilization heatmap", "Show pod capacity", null), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryCapexOpex(String query) {
        for (Pattern p : CAPEX_OPEX_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "CapEx / OpEx Report");
                data.put("route", "/jira-capex");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                        "Opening the CapEx/OpEx report — see how Jira work hours are classified as capital vs operating expenditure.",
                        "/jira-capex", null, data, null,
                        List.of("What is CapEx?", "Show budget report", "Show Jira worklog", null), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryPodCapacity(String query) {
        for (Pattern p : POD_CAPACITY_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Pod Capacity");
                data.put("route", "/reports/pod-capacity");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.88,
                        "Opening the Pod Capacity report — see which pods are over or under capacity.",
                        "/reports/pod-capacity", null, data, null,
                        List.of("Show capacity gap", "Show utilization heatmap", "Show hiring forecast", null), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryDashboardOverview(String query) {
        for (Pattern p : DASHBOARD_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Dashboard");
                data.put("route", "/");
                return new NlpStrategy.NlpResult("NAVIGATE", 0.85,
                        "Opening the Dashboard — your central hub for portfolio overview, key metrics, and quick navigation.",
                        "/", null, data, null,
                        List.of("Show project health", "Show capacity gap", "Any risks?", null), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryScenario(String query) {
        for (Pattern p : SCENARIO_PATTERNS) {
            if (p.matcher(query).find()) {
                String lower = query.toLowerCase();
                String route = lower.contains("timeline") ? "/simulator/timeline" : "/simulator/scenario";
                String label = lower.contains("timeline") ? "Timeline Simulator" : "Scenario Simulator";
                return new NlpStrategy.NlpResult("NAVIGATE", 0.85,
                        "Opening the " + label + " — you can model changes and compare outcomes without affecting live data.",
                        route, null,
                        Map.of("_type", "NAVIGATE_ACTION", "action", "Open " + label),
                        null, List.of("What is a scenario?", "Show capacity gap"), null);
            }
        }
        return null;
    }

    private NlpStrategy.NlpResult tryAuditLog(String query) {
        for (Pattern p : AUDIT_PATTERNS) {
            if (p.matcher(query).find()) {
                return new NlpStrategy.NlpResult("NAVIGATE", 0.85,
                        "Opening the Audit Log — it tracks all changes made across the system.",
                        "/settings/audit-log", null,
                        Map.of("_type", "NAVIGATE_ACTION", "action", "View audit trail"),
                        null, List.of("Show dashboard", "Any red flags?"), null);
            }
        }
        return null;
    }

    private String findBestRoute(String target) {
        String lowerTarget = target.toLowerCase().trim();
        for (var entry : PAGE_ALIASES.entrySet()) {
            for (String alias : entry.getValue()) {
                if (lowerTarget.equals(alias)) {
                    return entry.getKey();
                }
            }
        }
        for (var entry : PAGE_ALIASES.entrySet()) {
            for (String alias : entry.getValue()) {
                if (lowerTarget.contains(alias)) {
                    return entry.getKey();
                }
            }
        }
        return null;
    }

    private String getPageTitle(String route) {
        return switch (route) {
            case "/" -> "Dashboard";
            case "/projects" -> "Projects";
            case "/resources" -> "Resources";
            case "/pods" -> "Pods";
            case "/availability" -> "Availability Grid";
            case "/overrides" -> "Temporary Overrides";
            case "/team-calendar" -> "Team Calendar";
            case "/sprint-calendar" -> "Sprint Calendar";
            case "/release-calendar" -> "Release Calendar";
            case "/sprint-planner" -> "Sprint Planner";
            case "/reports/capacity-gap" -> "Capacity Gap";
            case "/reports/utilization" -> "Utilization Heatmap";
            case "/reports/capacity-demand" -> "Capacity vs Demand";
            case "/reports/concurrency" -> "Concurrency Risk";
            case "/reports/hiring-forecast" -> "Hiring Forecast";
            case "/reports/project-health" -> "Project Health";
            case "/reports/cross-pod" -> "Cross-Pod Dependencies";
            case "/reports/gantt" -> "Project Gantt Chart";
            case "/reports/budget" -> "Budget & Cost";
            case "/reports/resource-roi" -> "Resource ROI";
            case "/reports/slack-buffer" -> "Slack/Buffer Analysis";
            case "/reports/owner-demand" -> "Owner Demand";
            case "/reports/deadline-gap" -> "Deadline Gap";
            case "/reports/pod-resources" -> "Pod Resources";
            case "/reports/pod-capacity" -> "Pod Capacity";
            case "/reports/resource-pod-matrix" -> "Resource-Pod Matrix";
            case "/reports/pod-project-matrix" -> "Pod-Project Matrix";
            case "/reports/project-pod-matrix" -> "Project-Pod Matrix";
            case "/reports/pod-splits" -> "Pod Splits";
            case "/reports/resource-allocation" -> "Resource Allocation";
            case "/jira-pods" -> "Jira POD Dashboard";
            case "/jira-releases" -> "Jira Releases";
            case "/release-notes" -> "Release Notes";
            case "/jira-actuals" -> "Jira Actuals";
            case "/jira-capex" -> "CapEx/OpEx Report";
            case "/jira-support" -> "Support Queue";
            case "/jira-worklog" -> "Jira Worklog";
            case "/simulator/timeline" -> "Timeline Simulator";
            case "/simulator/scenario" -> "Scenario Simulator";
            case "/settings/timeline" -> "Timeline Settings";
            case "/settings/ref-data" -> "Reference Data";
            case "/settings/jira" -> "Jira Settings";
            case "/settings/jira-credentials" -> "Jira Credentials";
            case "/settings/releases" -> "Release Settings";
            case "/settings/support-boards" -> "Support Boards";
            case "/settings/users" -> "User Management";
            case "/settings/nlp" -> "NLP Settings";
            case "/settings/audit-log" -> "Audit Log";
            case "/settings/tables" -> "Database Browser";
            case "/settings/feedback-hub" -> "Feedback Hub";
            case "/settings/error-log" -> "Error Log";
            case "/reports/dora-metrics" -> "DORA Metrics";
            case "/reports/jira-analytics" -> "Jira Analytics";
            case "/reports/jira-dashboard-builder" -> "Jira Dashboard Builder";
            case "/settings/nlp-optimizer" -> "NLP Optimizer";
            case "/nlp" -> "Ask AI";
            default -> "Page";
        };
    }
}
