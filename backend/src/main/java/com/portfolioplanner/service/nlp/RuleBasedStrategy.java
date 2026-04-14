package com.portfolioplanner.service.nlp;

import com.portfolioplanner.domain.model.NlpLearnedPattern;
import com.portfolioplanner.domain.repository.NlpLearnedPatternRepository;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Rule-based NLP strategy using regex patterns and keyword matching.
 * Always available — no external dependencies.
 */
@Component
public class RuleBasedStrategy implements NlpStrategy {

    private final NlpQueryPreprocessor preprocessor;
    private final NlpLearnedPatternRepository learnedPatternRepo;
    private final NlpLearnerService learnerService;
    private final NlpJiraToolExecutor jiraToolExecutor;
    private final NlpVectorSearchService vectorSearchService;
    private final AliasResolver aliasResolver;

    /** Minimum similarity for a vector entity match to be considered valid. */
    private static final double VECTOR_ENTITY_THRESHOLD = 0.65;

    public RuleBasedStrategy(NlpQueryPreprocessor preprocessor,
                             NlpLearnedPatternRepository learnedPatternRepo,
                             NlpLearnerService learnerService,
                             NlpJiraToolExecutor jiraToolExecutor,
                             NlpVectorSearchService vectorSearchService,
                             AliasResolver aliasResolver) {
        this.preprocessor = preprocessor;
        this.learnedPatternRepo = learnedPatternRepo;
        this.learnerService = learnerService;
        this.jiraToolExecutor = jiraToolExecutor;
        this.vectorSearchService = vectorSearchService;
        this.aliasResolver = aliasResolver;
    }

    // ── Jira Issue Key pattern (e.g. PROJ-123, TAT-456) ─────────────────────
    private static final Pattern JIRA_ISSUE_KEY_PATTERN =
            Pattern.compile("(?:^|\\s)([A-Z]{2,10}-\\d{1,6})(?:\\s|$|\\?|\\.|,)");

    private static final List<Pattern> JIRA_TICKET_LOOKUP_PATTERNS = List.of(
            // "tell me about TAT-123", "summarize PROJ-456", "what is PROJ-789"
            Pattern.compile("(?i)(?:tell me about|summarize|summary of|details? (?:for|of|on)|what is|what's|show me|look up|lookup|describe|status of|info (?:on|about|for))\\s+([A-Z]{2,10}-\\d{1,6})"),
            // Just the ticket key by itself: "TAT-123"
            Pattern.compile("^\\s*([A-Z]{2,10}-\\d{1,6})\\s*\\??\\s*$")
    );

    // ── Navigation patterns ────────────────────────────────────────────────
    private static final List<Pattern> NAV_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:go to|open|show|show me|navigate to|take me to)\\s+(?:the\\s+)?(.+)$"),
            Pattern.compile("(?i)^(?:where is|find)\\s+(?:the\\s+)?(.+?)\\s*(?:page|screen|report)?$")
    );

    // ── Creation patterns ──────────────────────────────────────────────────
    private static final List<Pattern> CREATE_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:create|add|new|make)\\s+(?:a\\s+)?(?:new\\s+)?(.+)$"),
            Pattern.compile("(?i)^(?:set up|setup)\\s+(?:a\\s+)?(?:new\\s+)?(.+)$")
    );

    // ── Resource lookup patterns ─────────────────────────────────────────
    private static final List<Pattern> RESOURCE_LOOKUP_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:who is|look up|lookup|about|info on|details for|tell me about|info about)\\s+(.+)$"),
            Pattern.compile("(?i)^(?:which pod|what pod|what team)\\s+(?:is|does)\\s+(.+?)\\s+(?:in|on|belong|assigned|work)"),
            Pattern.compile("(?i)^(.+?)\\s+(?:details|info|profile|pod|role|location|rate|billing)"),
            Pattern.compile("(?i)^(?:where does|where is)\\s+(.+?)\\s+(?:sit|work|belong)"),
            // "is there someone named Piyush", "is there any one named Ojas", "do we have someone called X"
            // Handles: anyone/any one, somebody/some one, etc.
            Pattern.compile("(?i)^(?:is there|do we have|does|can you find|can you check)\\s+(?:a\\s+|an\\s+|some\\s*one\\s+|any\\s*one\\s+|any\\s*body\\s+|somebody\\s+)?(?:someone|person|resource|member|employee|developer|dev|engineer)?\\s*(?:named|called|by the name|with the name)\\s+(.+?)(?:\\s+(?:in|on|at|across|from)\\s+.+?)?\\??$"),
            // "is there anyone Piyush in any of the pods", "is there a Piyush on the team", "do we have a John in any pod"
            // Handles: in any of the pods/teams, on any team, across teams, etc.
            Pattern.compile("(?i)^(?:is there|do we have|does the team have|does any (?:team|pod) have)\\s+(?:a\\s+|an\\s+|some\\s*one\\s+|any\\s*one\\s+|any\\s*body\\s+|somebody\\s+)?(.+?)(?:\\s+(?:in|on|at|across|from)\\s+(?:any\\s+(?:of\\s+)?(?:the\\s+)?|the\\s+|our\\s+|my\\s+)?(?:team|teams|pod|pods|org|organization|company|group|groups|department|departments)s?)?\\??$"),
            // "find Piyush", "search for Ojas"
            Pattern.compile("(?i)^(?:find|search|search for)\\s+(.+)$")
    );

    // ── Project lookup patterns ──────────────────────────────────────────
    private static final List<Pattern> PROJECT_LOOKUP_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:tell me about|about|info on|details for|info about|look up|lookup)\\s+(?:the\\s+)?(?:project\\s+)?(.+?)(?:\\s+project)?$"),
            Pattern.compile("(?i)^(?:what is|what's|whats)\\s+(?:the\\s+)?(?:status|state|progress)\\s+(?:of|for)\\s+(?:the\\s+)?(?:project\\s+)?(.+?)(?:\\s+project)?$"),
            Pattern.compile("(?i)^(.+?)\\s+(?:project\\s+)?(?:status|details|info|pods|owner|priority|timeline)")
    );

    // ── POD lookup patterns ──────────────────────────────────────────────
    private static final List<Pattern> POD_LOOKUP_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:tell me about|about|info on|details for|info about)\\s+(?:the\\s+)?(.+?)\\s+(?:pod|team)$"),
            Pattern.compile("(?i)^(?:tell me about|about|info on|details for|info about)\\s+(?:the\\s+)?(?:pod|team)\\s+(.+)$"),
            Pattern.compile("(?i)^(?:who is in|who works in|members of|team in|people in)\\s+(?:the\\s+)?(.+?)(?:\\s+pod|\\s+team)?$"),
            Pattern.compile("(?i)^(.+?)\\s+(?:pod|team)\\s+(?:details|info|members|projects|capacity)")
    );

    // ── Cross-entity patterns ────────────────────────────────────────────
    private static final List<Pattern> CROSS_ENTITY_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:who works on|who is on|team for|people on|resources on)\\s+(?:the\\s+)?(?:project\\s+)?(.+?)(?:\\s+project)?$"),
            Pattern.compile("(?i)^(?:what projects?|which projects?)\\s+(?:is|does|are)\\s+(.+?)\\s+(?:working on|assigned to|on)"),
            Pattern.compile("(?i)^(?:what projects?)\\s+(?:are in|belong to|assigned to)\\s+(?:the\\s+)?(.+?)(?:\\s+pod|\\s+team)?$"),
            Pattern.compile("(?i)^(?:projects? in|projects? for)\\s+(?:the\\s+)?(.+?)(?:\\s+pod|\\s+team)?$"),
            // "what is ojas working on", "what's piyush working on", "what does ojas work on"
            Pattern.compile("(?i)^(?:what is|what's|whats)\\s+(.+?)\\s+(?:working on|assigned to|doing)\\??$"),
            Pattern.compile("(?i)^(?:what does|what do)\\s+(.+?)\\s+(?:work on|do)\\??$")
    );

    // ── Aggregation patterns ─────────────────────────────────────────────
    private static final List<Pattern> AGGREGATION_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:how many)\\s+(.+)$"),
            Pattern.compile("(?i)^(?:total|count|number of)\\s+(.+)$"),
            Pattern.compile("(?i)^(?:list all|list|show all)\\s+(.+)$")
    );

    // ── Advanced resource analytics patterns ──────────────────────────────
    private static final List<Pattern> RESOURCE_ANALYTICS_PATTERNS = List.of(
            // "average billing of QAs in India", "avg billing rate for developers"
            Pattern.compile("(?i)(?:average|avg|mean)\\s+(?:billing|rate|cost|hourly)\\s+(?:rate\\s+)?(?:of|for)\\s+(.+)$"),
            // "what is the average billing of QAs in India"
            Pattern.compile("(?i)(?:what.s|what is)\\s+(?:the\\s+)?(?:average|avg|mean)\\s+(?:billing|rate|cost)\\s+(?:of|for)\\s+(.+)$"),
            // "capacity of tech leads", "what does tech lead capacity look like"
            Pattern.compile("(?i)(?:capacity|headcount|head count|breakdown|distribution|split)\\s+(?:of|for|by)\\s+(.+)$"),
            Pattern.compile("(?i)(?:what.s|what is|what does)\\s+(?:the\\s+)?(.+?)\\s+(?:capacity|headcount|breakdown|distribution)\\s+(?:look like|like)?$"),
            // "how many people in India", "how many devs in Houston"
            Pattern.compile("(?i)^(?:how many|total|count)\\s+(?:people|resources?|members?|devs?|developers?|qas?|bsas?|tech leads?)\\s+(?:in|at|from)\\s+(.+)$"),
            // "show me developers in India"
            Pattern.compile("(?i)^(?:show me|list|show|get)\\s+(?:all\\s+)?(.+?)\\s+(?:in|at|from)\\s+(.+)$"),
            // "who are the QAs", "who are the tech leads in India"
            Pattern.compile("(?i)^(?:who are|list)\\s+(?:the\\s+)?(.+?)(?:\\s+(?:in|at|from)\\s+(.+))?$")
    );

    // ── Timeline / deadline patterns ─────────────────────────────────────
    private static final List<Pattern> TIMELINE_PATTERNS = List.of(
            Pattern.compile("(?i)(?:what.s|what is)\\s+(?:due|ending|starting|launching)\\s+(?:this|next|in)\\s+(month|week|quarter|\\w+)"),
            Pattern.compile("(?i)(?:upcoming|next)\\s+(?:deadlines?|releases?|sprints?|milestones?)"),
            Pattern.compile("(?i)(?:when is|when.s)\\s+(?:the\\s+)?(?:next\\s+)?(.+?)(?:\\s+release|\\s+sprint|\\s+deadline)?$"),
            Pattern.compile("(?i)(?:release|sprint)\\s+(?:date|schedule)\\s+(?:in|for)\\s+(\\w+)"),
            Pattern.compile("(?i)(?:release date|sprint date)\\s+(?:in|for)\\s+(\\w+)"),
            // "give me releases in march", "show me releases in april 2026", "releases in march"
            Pattern.compile("(?i)(?:give me|show me|get|list|find|fetch|what are|what are the)?\\s*releases?\\s+(?:in|for|during)\\s+(\\w+)(?:\\s+\\d{4})?"),
            // "releases for march 2026", "what releases are in march"
            Pattern.compile("(?i)(?:what|which)\\s+releases?\\s+(?:are|is|fall|happen|come)\\s+(?:in|during|for)\\s+(\\w+)(?:\\s+\\d{4})?"),
            // "sprints in march", "give me sprints in april"
            Pattern.compile("(?i)(?:give me|show me|get|list|find|fetch|what are|what are the)?\\s*sprints?\\s+(?:in|for|during)\\s+(\\w+)(?:\\s+\\d{4})?")
    );

    // ── Comparison patterns ──────────────────────────────────────────────
    private static final List<Pattern> COMPARE_PATTERNS = List.of(
            Pattern.compile("(?i)^compare\\s+(.+?)\\s+(?:vs?\\.?|versus|and|with)\\s+(.+)$"),
            Pattern.compile("(?i)^(.+?)\\s+(?:vs?\\.?|versus)\\s+(.+)$")
    );

    // ── Status update patterns ───────────────────────────────────────────
    private static final List<Pattern> STATUS_UPDATE_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:mark|set|change|update)\\s+(?:project\\s+)?(.+?)\\s+(?:as|to|status to)\\s+(active|on[\\s\\-_]?hold|completed|cancelled|not[\\s\\-_]?started|in[\\s\\-_]?discovery)$"),
            Pattern.compile("(?i)^(?:put|move)\\s+(?:project\\s+)?(.+?)\\s+(?:on[\\s\\-_]?hold|to active|to completed)$")
    );

    // ── Sprint / release lookup patterns ─────────────────────────────────
    private static final List<Pattern> SPRINT_RELEASE_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:what.s|what is)\\s+(?:the\\s+)?(?:current|active|next)\\s+(sprint|release)"),
            Pattern.compile("(?i)^(?:tell me about|info on|details for|show)\\s+(?:sprint|release)\\s+(.+)$"),
            Pattern.compile("(?i)^(?:sprint|release)\\s+(.+?)\\s+(?:details|info|dates)$")
    );

    // ── Risk / alert patterns ────────────────────────────────────────────
    private static final List<Pattern> RISK_PATTERNS = List.of(
            Pattern.compile("(?i)(?:any|are there)\\s+(?:red flags?|risks?|issues?|problems?|alerts?|warnings?|concerns?)"),
            Pattern.compile("(?i)(?:what needs|anything need)\\s+(?:attention|my attention|help|action)"),
            Pattern.compile("(?i)(?:health check|system health|portfolio health|overall health)"),
            Pattern.compile("(?i)(?:show me|any)\\s+(?:highest|top|critical|urgent)\\s+(?:priority|p0|p1)\\s+(?:jira|tickets?|issues?|items?)"),
            Pattern.compile("(?i)(?:highest|top|critical|urgent)\\s+(?:priority|p0)\\s+(?:jira|tickets?|issues?)?")
    );

    // ── Greeting / small-talk patterns ──────────────────────────────────
    private static final List<Pattern> GREETING_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:hi|hello|hey|good morning|good afternoon|good evening|howdy|sup|yo)(?:\\s.*)?$"),
            Pattern.compile("(?i)^(?:thanks|thank you|thx|cheers|appreciate it)(?:\\s.*)?$")
    );

    // ── Capability discovery patterns ──────────────────────────────────
    private static final List<Pattern> CAPABILITY_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:what can you do|what do you do|help me|show me what you can do|capabilities|features?)$"),
            Pattern.compile("(?i)^(?:how can you help|what are your capabilities|what should I ask|give me examples?)$"),
            Pattern.compile("(?i)^(?:tell me (?:something )?about (?:this |the )?(?:app|application|tool|system|platform|planner))$"),
            Pattern.compile("(?i)^(?:what (?:is|does) (?:this |the )?(?:app|application|tool|system|platform|planner)(?: do)?)$"),
            Pattern.compile("(?i)^(?:about (?:this |the )?(?:app|application|tool|system|platform|planner))$")
    );

    // ── Project filter patterns (by owner, status, priority) ──────────
    private static final List<Pattern> PROJECT_FILTER_PATTERNS = List.of(
            // "show me all of John's projects", "John's projects", "projects owned by John"
            Pattern.compile("(?i)(?:show|list|get|give)\\s+(?:me\\s+)?(?:all\\s+)?(?:of\\s+)?(.+?)(?:'s|s')\\s+projects?$"),
            Pattern.compile("(?i)projects?\\s+(?:owned by|belonging to|assigned to|of|for|under)\\s+(.+)$"),
            // "give me all projects under BD", "projects under John", "all projects under BD"
            Pattern.compile("(?i)(?:show|list|get|give|display)\\s+(?:me\\s+)?(?:all\\s+)?projects?\\s+under\\s+(.+)$"),
            // "show active projects", "list completed projects", "which projects are on hold"
            Pattern.compile("(?i)(?:show|list|get|display|give)\\s+(?:me\\s+)?(?:all\\s+)?(active|on[\\s\\-_]?hold|completed|cancelled|not[\\s\\-_]?started|in[\\s\\-_]?discovery)\\s+projects?$"),
            Pattern.compile("(?i)(?:which|what)\\s+projects?\\s+(?:are|is)\\s+(active|on[\\s\\-_]?hold|completed|cancelled|not[\\s\\-_]?started|in[\\s\\-_]?discovery)"),
            // "show P0 projects", "list P1 projects", "P2 projects"
            Pattern.compile("(?i)(?:show|list|get|display|give)\\s+(?:me\\s+)?(?:all\\s+)?(p[0-3])\\s+projects?$"),
            Pattern.compile("(?i)(p[0-3])\\s+projects?$")
    );

    // ── Override / temp allocation patterns ────────────────────────────
    private static final List<Pattern> OVERRIDE_PATTERNS = List.of(
            Pattern.compile("(?i)(?:any|are there|show|list)\\s+(?:active\\s+)?(?:overrides?|temp(?:orary)?\\s+(?:allocations?|assignments?))"),
            Pattern.compile("(?i)(?:who has|who is on)\\s+(?:a\\s+)?(?:temp(?:orary)?\\s+)?(?:override|allocation|assignment)"),
            Pattern.compile("(?i)(?:override|temp allocation)\\s+(?:for|of)\\s+(.+)")
    );

    // ── BAU patterns ──────────────────────────────────────────────────
    private static final List<Pattern> BAU_PATTERNS = List.of(
            Pattern.compile("(?i)(?:what.s|what is|show|show me)\\s+(?:the\\s+)?bau\\s+(?:for|of|in)\\s+(?:the\\s+)?(.+?)(?:\\s+pod|\\s+team)?$"),
            Pattern.compile("(?i)bau\\s+(?:percentage|pct|%|breakdown|split|by pod|by role)"),
            Pattern.compile("(?i)(?:show|list)\\s+(?:me\\s+)?(?:all\\s+)?bau")
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

    // ── Cost rate patterns ─────────────────────────────────────────────
    private static final List<Pattern> COST_RATE_PATTERNS = List.of(
            Pattern.compile("(?i)(?:what.s|what is|show|show me)\\s+(?:the\\s+)?(?:billing|cost|hourly)?\\s*rate\\s+(?:for|of)\\s+(?:a\\s+)?(.+)$"),
            Pattern.compile("(?i)(?:how much)\\s+(?:does|do)\\s+(?:a\\s+)?(.+?)\\s+(?:cost|charge|bill)"),
            Pattern.compile("(?i)(?:cost rates?|billing rates?|rate card|rate table)$"),
            Pattern.compile("(?i)(?:show|list)\\s+(?:all\\s+)?(?:cost rates?|billing rates?|rates?)")
    );

    // ── Project estimates patterns ────────────────────────────────────
    private static final List<Pattern> PROJECT_ESTIMATE_PATTERNS = List.of(
            // "what are the estimates for SgNIPT project", "estimates for SgNIPT"
            Pattern.compile("(?i)(?:what are|what's|whats|show|show me|get|give me)\\s+(?:the\\s+)?(?:estimates?|hours?|effort|breakdown|hour breakdown|effort breakdown)\\s+(?:for|of)\\s+(?:the\\s+)?(?:project\\s+)?(.+?)(?:\\s+project)?$"),
            // "SgNIPT project estimates", "SgNIPT hours"
            Pattern.compile("(?i)^(.+?)\\s+(?:project\\s+)?(?:estimates?|hours?|effort|hour breakdown)$"),
            // "how many hours for SgNIPT", "total hours for SgNIPT project"
            Pattern.compile("(?i)(?:how many|total)\\s+hours?\\s+(?:for|in|on)\\s+(?:the\\s+)?(?:project\\s+)?(.+?)(?:\\s+project)?$"),
            // "what pods are in SgNIPT project", "pods involved in SgNIPT", "pods for SgNIPT"
            Pattern.compile("(?i)(?:what|which)\\s+(?:pods?|teams?)\\s+(?:are|is)\\s+(?:in|involved in|assigned to|working on)\\s+(?:the\\s+)?(?:project\\s+)?(.+?)(?:\\s+project)?$"),
            // "pods involved in SgNIPT project"
            Pattern.compile("(?i)(?:pods?|teams?)\\s+(?:involved|working|assigned)\\s+(?:in|on|to)\\s+(?:the\\s+)?(?:project\\s+)?(.+?)(?:\\s+project)?$"),
            // "show pod assignments for SgNIPT"
            Pattern.compile("(?i)(?:show|list|get|give me)\\s+(?:the\\s+)?(?:pod|team)\\s+(?:assignments?|allocations?|breakdown)\\s+(?:for|of)\\s+(?:the\\s+)?(?:project\\s+)?(.+?)(?:\\s+project)?$"),
            // "dev hours for SgNIPT", "QA hours for SgNIPT project"
            Pattern.compile("(?i)(?:dev(?:eloper)?|qa|bsa|tech lead)\\s+hours?\\s+(?:for|in|on)\\s+(?:the\\s+)?(?:project\\s+)?(.+?)(?:\\s+project)?$")
    );

    // ── Sprint allocation patterns ────────────────────────────────────
    private static final List<Pattern> SPRINT_ALLOC_PATTERNS = List.of(
            // "what's allocated for Sprint 25-01", "hours in Sprint 25-01"
            Pattern.compile("(?i)(?:what.s|what is|show|show me|get)\\s+(?:the\\s+)?(?:allocated|allocation|hours?|workload)\\s+(?:for|in)\\s+(?:sprint\\s+)?(.+)$"),
            // "sprint allocation for SgNIPT", "sprint hours for SgNIPT project"
            Pattern.compile("(?i)sprint\\s+(?:allocation|hours?|workload)\\s+(?:for|of)\\s+(?:the\\s+)?(?:project\\s+)?(.+?)(?:\\s+project)?$"),
            // "which projects are in the current sprint"
            Pattern.compile("(?i)(?:which|what)\\s+projects?\\s+(?:are|is)\\s+(?:in|allocated to)\\s+(?:the\\s+)?(?:current|active)\\s+sprint"),
            // "sprint workload for BD pod", "current sprint load for BD"
            Pattern.compile("(?i)(?:sprint|current sprint)\\s+(?:workload|load|hours?)\\s+(?:for|of)\\s+(?:the\\s+)?(.+?)(?:\\s+pod|\\s+team)?$")
    );

    // ── Resource availability patterns ─────────────────────────────────
    private static final List<Pattern> AVAILABILITY_PATTERNS = List.of(
            // "what's John's availability", "availability for John"
            Pattern.compile("(?i)(?:what.s|what is|show|show me|get)\\s+(.+?)(?:'s|s')\\s+availability"),
            Pattern.compile("(?i)availability\\s+(?:for|of)\\s+(.+)$"),
            // "who has capacity in April", "who is available in March"
            Pattern.compile("(?i)(?:who has|who is|who's)\\s+(?:available|capacity|free|bandwidth)\\s+(?:in|for|during)\\s+(\\w+)"),
            // "most available resources", "available resources next month"
            Pattern.compile("(?i)(?:most\\s+)?available\\s+(?:resources?|people|team members?)"),
            // "show availability for BD pod"
            Pattern.compile("(?i)(?:show|list|get)\\s+(?:the\\s+)?availability\\s+(?:for|of)\\s+(?:the\\s+)?(.+?)(?:\\s+pod|\\s+team)?$")
    );

    // ── Effort pattern query patterns ──────────────────────────────────
    private static final List<Pattern> EFFORT_PATTERN_PATTERNS = List.of(
            // "what effort patterns are available", "show effort patterns", "list patterns"
            Pattern.compile("(?i)(?:what|show|list|get)\\s+(?:the\\s+)?(?:available\\s+)?(?:effort\\s+)?patterns?"),
            // "explain front-loaded pattern", "what is bell curve pattern"
            Pattern.compile("(?i)(?:explain|what is|what's|describe)\\s+(?:the\\s+)?(.+?)\\s+pattern"),
            // "which projects use bell curve"
            Pattern.compile("(?i)(?:which|what)\\s+projects?\\s+(?:use|have)\\s+(?:the\\s+)?(.+?)\\s+pattern")
    );

    // ── Role effort mix patterns ───────────────────────────────────────
    private static final List<Pattern> ROLE_MIX_PATTERNS = List.of(
            // "what's the effort mix", "role effort split", "standard effort mix"
            Pattern.compile("(?i)(?:what.s|what is|show|show me)\\s+(?:the\\s+)?(?:standard\\s+)?(?:role\\s+)?(?:effort|hour)\\s+(?:mix|split|breakdown|distribution)"),
            // "what % goes to dev vs QA"
            Pattern.compile("(?i)(?:what|how much)\\s+(?:%|percent|percentage)\\s+(?:goes? to|for)\\s+(.+)"),
            Pattern.compile("(?i)(?:effort|role)\\s+(?:mix|split)\\s+(?:percentages?|breakdown)?$")
    );

    // ── Project dependency patterns ────────────────────────────────────
    private static final List<Pattern> DEPENDENCY_PATTERNS = List.of(
            // "what blocks SgNIPT", "is SgNIPT blocked"
            Pattern.compile("(?i)(?:what|which)\\s+(?:blocks?|is blocking)\\s+(.+?)(?:\\s+project)?$"),
            Pattern.compile("(?i)(?:is)\\s+(.+?)\\s+(?:blocked|blocking|dependent)"),
            // "show project dependencies", "dependency chain"
            Pattern.compile("(?i)(?:show|list|get)\\s+(?:the\\s+)?(?:project\\s+)?(?:dependencies|dependency|blockers|blocked projects)"),
            // "which projects have blockers"
            Pattern.compile("(?i)(?:which|what)\\s+projects?\\s+(?:have|are)\\s+(?:blocked|blockers?|dependencies)")
    );

    // ── Project actuals patterns ───────────────────────────────────────
    private static final List<Pattern> ACTUALS_PATTERNS = List.of(
            // "actual hours for SgNIPT", "actuals for SgNIPT project"
            Pattern.compile("(?i)(?:actual|actual hours?|actuals)\\s+(?:for|of)\\s+(?:the\\s+)?(?:project\\s+)?(.+?)(?:\\s+project)?$"),
            // "planned vs actual for SgNIPT"
            Pattern.compile("(?i)(?:planned|estimated)\\s+(?:vs?\\.?|versus)\\s+(?:actual|actuals?)\\s+(?:for|of)\\s+(?:the\\s+)?(?:project\\s+)?(.+?)(?:\\s+project)?$"),
            // "which projects are over on hours", "over budget projects"
            Pattern.compile("(?i)(?:which|what)\\s+projects?\\s+(?:are|is)\\s+(?:over|above|exceeding)\\s+(?:on\\s+)?(?:hours|budget|estimates?)"),
            // "actual hours in March", "actuals for March"
            Pattern.compile("(?i)(?:actual|actual hours?|actuals)\\s+(?:for|in|during)\\s+(\\w+)(?:\\s+\\d{4})?$")
    );

    // ── Jira support queue patterns ────────────────────────────────────
    private static final List<Pattern> SUPPORT_QUEUE_PATTERNS = List.of(
            // "how many support tickets are open", "open support tickets"
            Pattern.compile("(?i)(?:how many|show|list)\\s+(?:open\\s+)?support\\s+(?:tickets?|issues?)"),
            // "stale support tickets", "aging tickets"
            Pattern.compile("(?i)(?:stale|aging|old)\\s+(?:support\\s+)?(?:tickets?|issues?)"),
            // "support queue health", "support queue status"
            Pattern.compile("(?i)support\\s+(?:queue|ticket)\\s+(?:health|status|summary|overview|report)"),
            // "support trend"
            Pattern.compile("(?i)support\\s+(?:trend|trending|metrics)")
    );

    // ── Timeline config / working hours patterns ───────────────────────
    private static final List<Pattern> TIMELINE_CONFIG_PATTERNS = List.of(
            // "what's the fiscal year", "fiscal year settings"
            Pattern.compile("(?i)(?:what.s|what is)\\s+(?:the\\s+)?(?:fiscal|planning)\\s+year"),
            // "working hours per month", "how many working hours"
            Pattern.compile("(?i)(?:working|available|business)\\s+hours?\\s+(?:per|in|for)\\s+(?:month|each month)"),
            Pattern.compile("(?i)(?:how many)\\s+(?:working|available)\\s+hours?"),
            // "what month are we in", "current month index"
            Pattern.compile("(?i)(?:what|which)\\s+month\\s+(?:are we|index|is it|is current)")
    );

    // ── Scenario / what-if patterns ───────────────────────────────────
    private static final List<Pattern> SCENARIO_PATTERNS = List.of(
            Pattern.compile("(?i)(?:what if|what-if|simulate|scenario|hypothetical)\\s+(.+)$"),
            Pattern.compile("(?i)(?:run|create|start)\\s+(?:a\\s+)?(?:simulation|scenario|what-if)"),
            Pattern.compile("(?i)(?:impact|effect)\\s+(?:of|if)\\s+(.+)")
    );

    // ── Jira-specific patterns ────────────────────────────────────────
    private static final List<Pattern> JIRA_SPECIFIC_PATTERNS = List.of(
            Pattern.compile("(?i)(?:show|open)\\s+(?:the\\s+)?(?:jira|pod)\\s+(?:dashboard|metrics|board)\\s+(?:for|of)\\s+(.+)$"),
            Pattern.compile("(?i)(?:capex|opex)\\s+(?:report|breakdown|summary)?"),
            Pattern.compile("(?i)(?:worklog|time tracking|time spent)\\s+(?:for|of|summary|report)?"),
            Pattern.compile("(?i)(?:jira)\\s+(?:actuals|actual hours|logged hours)")
    );

    // ── Jira search / filter patterns ─────────────────────────────────
    private static final List<Pattern> JIRA_SEARCH_PATTERNS = List.of(
            // "show me all open bugs in CEP", "find bugs in PLAT"
            Pattern.compile("(?i)(?:show|find|list|get)\\s+(?:me\\s+)?(?:all\\s+)?(?:open\\s+)?(?:bugs?|defects?|issues?)\\s+(?:in|for|under|on)\\s+([A-Z]{2,10})"),
            // "tickets assigned to John", "issues assigned to Sarah"
            Pattern.compile("(?i)(?:tickets?|issues?|stories?|tasks?)\\s+(?:assigned to|for|owned by)\\s+(.+)$"),
            // "high priority tickets in CEP", "blocker issues"
            Pattern.compile("(?i)(?:high|highest|critical|blocker|urgent)\\s+(?:priority\\s+)?(?:tickets?|issues?|stories?)(?:\\s+in\\s+([A-Z]{2,10}))?"),
            // "open stories in PLAT", "unresolved issues"
            Pattern.compile("(?i)(?:open|unresolved|pending|in.progress)\\s+(?:tickets?|issues?|stories?|tasks?)(?:\\s+in\\s+([A-Z]{2,10}))?"),
            // "search for tickets with label payments"
            Pattern.compile("(?i)(?:search|find|look)\\s+(?:for\\s+)?(?:tickets?|issues?)\\s+(?:with|containing|matching|about|labeled?)\\s+(.+)$"),
            // "Jira backlog", "backlog size"
            Pattern.compile("(?i)(?:jira\\s+)?(?:backlog|todo|to.do)(?:\\s+(?:size|count|items?))?(?:\\s+(?:for|in)\\s+([A-Z]{2,10}))?")
    );

    // ── Jira contributor / worklog patterns ──────────────────────────
    private static final List<Pattern> JIRA_CONTRIBUTOR_PATTERNS = List.of(
            // "who worked on CEP-1234", "who contributed to PLAT-200"
            Pattern.compile("(?i)(?:who|which people|what people)\\s+(?:worked on|contributed to|touched|involved in|helped with)\\s+([A-Z]{2,10}-\\d{1,6})"),
            // "hours logged on CEP-1234", "time spent on PLAT-200"
            Pattern.compile("(?i)(?:hours?|time)\\s+(?:logged|spent|tracked|booked)\\s+(?:on|for|against)\\s+([A-Z]{2,10}-\\d{1,6})"),
            // "worklog for CEP-1234"
            Pattern.compile("(?i)(?:worklog|work log|work\\s+log)\\s+(?:for|of|on)\\s+([A-Z]{2,10}-\\d{1,6})"),
            // "contributors for CEP-1234"
            Pattern.compile("(?i)(?:contributors?|participants?|collaborators?)\\s+(?:for|of|on)\\s+([A-Z]{2,10}-\\d{1,6})"),
            // "who all worked on CEP-1234"
            Pattern.compile("(?i)who\\s+all\\s+(?:worked|contributed|logged)\\s+(?:on|to|for)\\s+([A-Z]{2,10}-\\d{1,6})")
    );

    // ── Jira bug patterns ─────────────────────────────────────────────
    private static final List<Pattern> JIRA_BUG_PATTERNS = List.of(
            // "how many bugs", "bug count", "open bugs", "bug summary"
            Pattern.compile("(?i)(?:how many|total|count of|number of)\\s+(?:open\\s+)?(?:bugs?|defects?)"),
            Pattern.compile("(?i)(?:bug|defect)\\s+(?:summary|count|report|trend|rate|metrics|stats|statistics|overview)"),
            Pattern.compile("(?i)(?:show|give|get)\\s+(?:me\\s+)?(?:the\\s+)?(?:bug|defect)\\s+(?:summary|report|trend|overview|metrics|count)"),
            Pattern.compile("(?i)(?:bugs?|defects?)\\s+(?:by|per)\\s+(?:priority|severity|assignee|status|project)"),
            Pattern.compile("(?i)(?:are we)\\s+(?:creating|making|producing)\\s+(?:bugs?|defects?)\\s+faster"),
            Pattern.compile("(?i)(?:bug|defect)\\s+(?:creation|escape|fix|resolution)\\s+(?:rate|trend|time)"),
            Pattern.compile("(?i)(?:average|avg|mean)\\s+(?:bug|defect)\\s+(?:resolution|fix)\\s+time"),
            Pattern.compile("(?i)(?:oldest|longest)\\s+(?:open\\s+)?(?:bugs?|defects?)")
    );

    // ── Jira sprint health patterns ──────────────────────────────────
    private static final List<Pattern> JIRA_SPRINT_HEALTH_PATTERNS = List.of(
            Pattern.compile("(?i)(?:jira\\s+)?sprint\\s+(?:health|velocity|progress|status|burndown|metrics|performance)"),
            Pattern.compile("(?i)(?:how is|how's)\\s+(?:the\\s+)?(?:current\\s+)?(?:jira\\s+)?sprint\\s+(?:going|doing|progressing)"),
            Pattern.compile("(?i)(?:sprint\\s+)?(?:completion|burn.?down|velocity)\\s+(?:rate|trend|chart|metrics)?"),
            Pattern.compile("(?i)(?:story|stories)\\s+(?:points?\\s+)?(?:completed|done|remaining|left|carried over|carry.?over)(?:\\s+this\\s+sprint)?"),
            Pattern.compile("(?i)(?:blocked|blocking)\\s+(?:stories?|tickets?|issues?)\\s+(?:this|in|current)\\s+sprint"),
            Pattern.compile("(?i)(?:what.s?|how many)\\s+(?:stories?|tickets?)\\s+(?:are\\s+)?(?:in.progress|done|completed|remaining|blocked)\\s+(?:this\\s+sprint|in\\s+the\\s+sprint)?")
    );

    // ── Jira workload patterns ────────────────────────────────────────
    private static final List<Pattern> JIRA_WORKLOAD_PATTERNS = List.of(
            Pattern.compile("(?i)(?:jira\\s+)?(?:workload|work\\s+load)\\s+(?:distribution|balance|breakdown|by\\s+(?:assignee|person|team))"),
            Pattern.compile("(?i)who\\s+has\\s+(?:the\\s+)?(?:most|least|fewest|lightest|heaviest)\\s+(?:open\\s+)?(?:tickets?|issues?|stories?)"),
            Pattern.compile("(?i)(?:is|are)\\s+(?:anyone|somebody|someone)\\s+(?:overloaded|overwhelmed|swamped)\\s+(?:with\\s+)?(?:tickets?|issues?)?"),
            Pattern.compile("(?i)(?:how|what)\\s+(?:is|does)\\s+(?:the\\s+)?(?:work|ticket|issue)\\s+(?:distribution|load|balance)\\s+(?:look|seem)")
    );

    // ── Jira analytics patterns ───────────────────────────────────────
    private static final List<Pattern> JIRA_ANALYTICS_PATTERNS = List.of(
            Pattern.compile("(?i)(?:jira\\s+)?(?:analytics|metrics|stats|statistics|dashboard)(?:\\s+(?:for|of|summary))?(?:\\s+([A-Z]{2,10}))?"),
            Pattern.compile("(?i)(?:show|give|get)\\s+(?:me\\s+)?(?:the\\s+)?jira\\s+(?:analytics|metrics|summary|overview|stats)"),
            Pattern.compile("(?i)(?:how many)\\s+(?:jira\\s+)?(?:issues?|tickets?)\\s+(?:are\\s+)?(?:open|created|resolved)"),
            Pattern.compile("(?i)(?:created|resolved)\\s+(?:vs?\\.?|versus)\\s+(?:resolved|created)\\s+(?:trend|ratio|comparison)"),
            Pattern.compile("(?i)(?:average|avg)\\s+(?:cycle|lead|resolution)\\s+time"),
            Pattern.compile("(?i)(?:issue|ticket)\\s+(?:trend|distribution|breakdown)\\s+(?:by\\s+)?(?:type|status|priority|project)?")
    );

    // ── DORA metrics patterns ─────────────────────────────────────────
    private static final List<Pattern> DORA_PATTERNS = List.of(
            Pattern.compile("(?i)(?:dora|deployment|deploy)\\s+(?:metrics|frequency|performance|stats|report)"),
            Pattern.compile("(?i)(?:show|give|open)\\s+(?:me\\s+)?(?:the\\s+)?dora\\s+(?:metrics|report|dashboard)"),
            Pattern.compile("(?i)(?:lead\\s+time)\\s+(?:for\\s+)?(?:changes?|deployments?)"),
            Pattern.compile("(?i)(?:change|deployment)\\s+(?:failure|fail)\\s+rate"),
            Pattern.compile("(?i)(?:mean\\s+time\\s+to)\\s+(?:recovery|restore|recover|MTTR)"),
            Pattern.compile("(?i)(?:deployment|deploy)\\s+(?:frequency|cadence|rate|count)")
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

    // ── Add-member-to-entity patterns (must be checked BEFORE creation) ──
    private static final List<Pattern> ADD_MEMBER_PATTERNS = List.of(
            // "add Piyush Baheti to the Accessioning POD"
            Pattern.compile("(?i)^(?:add|assign|move|put)\\s+(.+?)\\s+(?:to|into|in|onto)\\s+(?:the\\s+)?(.+?)(?:\\s+(?:pod|team|group))?$"),
            // "assign Piyush to Accessioning pod"
            Pattern.compile("(?i)^(?:add|assign|move|put)\\s+(.+?)\\s+(?:to|into|in|onto)\\s+(?:the\\s+)?(.+)$")
    );

    // ── Audit log patterns ────────────────────────────────────────────
    private static final List<Pattern> AUDIT_PATTERNS = List.of(
            Pattern.compile("(?i)(?:who changed|who modified|who edited|who updated|who deleted|who created)\\s+(.+)$"),
            Pattern.compile("(?i)(?:recent|latest)\\s+(?:changes|modifications|edits|activity|audit)"),
            Pattern.compile("(?i)(?:audit log|audit trail|change log|activity log)"),
            Pattern.compile("(?i)(?:what changed|what.s changed|changes?)\\s+(?:today|recently|this week|last week)")
    );

    // ── Export patterns ──────────────────────────────────────────────────
    private static final List<Pattern> EXPORT_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:export|download|get|generate)\\s+(.+?)\\s+(?:as|to|in)\\s+(?:csv|excel|xlsx|spreadsheet)$"),
            Pattern.compile("(?i)^(?:export|download)\\s+(.+?)(?:\\s+csv|\\s+excel|\\s+xlsx)?$"),
            Pattern.compile("(?i)^(?:csv|excel|xlsx)\\s+(?:of|for|export)\\s+(.+)$")
    );

    // ── Data query patterns ────────────────────────────────────────────────
    private static final List<Pattern> DATA_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:how many|how much|what is|what are|what's|whats)\\s+(.+)$"),
            Pattern.compile("(?i)^(?:show me|get|fetch|display)\\s+(?:the\\s+)?(?:data|numbers|metrics|stats)\\s+(?:for|of|about)\\s+(.+)$"),
            Pattern.compile("(?i)(?:capacity|demand|utilization|hours|bandwidth|gap)\\s+(?:for|of|in)\\s+(.+)$")
    );

    // ── Insight patterns ───────────────────────────────────────────────────
    private static final List<Pattern> INSIGHT_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:which|what)\\s+(?:pods?|teams?)\\s+(?:are|is)\\s+(?:over|under|at)\\s*[-\\s]?(?:capacity|utilized|loaded)"),
            Pattern.compile("(?i)(?:at risk|over capacity|under capacity|bottleneck|hiring|hire|need help)"),
            Pattern.compile("(?i)^(?:any|are there)\\s+(?:issues|problems|risks|concerns|blockers)")
    );

    // ── Help / explanation patterns ────────────────────────────────────────
    private static final List<Pattern> HELP_PATTERNS = List.of(
            Pattern.compile("(?i)^(?:what is|what are|explain|help|how does?|how do|tell me about)\\s+(.+)$"),
            Pattern.compile("(?i)^(?:what does?)\\s+(?:the\\s+)?(.+?)\\s+(?:mean|do|show|report)"),
            Pattern.compile("(?i)^(?:can you )?tell me (?:how|what|where|why)\\s+(.+)$"),
            Pattern.compile("(?i)^(?:can you )?(?:explain|help|clarify)\\s+(?:how|what)\\s+(.+)$")
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
        HELP_TOPICS.put("priority", "Projects use Jira-style priorities: HIGHEST (critical/must-do), HIGH, MEDIUM, LOW, LOWEST, BLOCKER, MINOR.");
        HELP_TOPICS.put("roi", "Resource ROI shows the return on investment per resource or role, comparing their billing cost against the value delivered through project work.");
        HELP_TOPICS.put("gantt", "The Gantt chart provides a visual timeline view of all projects showing start dates, durations, and overlaps to help plan and identify scheduling conflicts.");
        HELP_TOPICS.put("budget", "The Budget report shows project costs calculated from resource hours × billing rates, broken down by pod, role, and month.");
        HELP_TOPICS.put("scenario", "Scenarios let you create 'what-if' simulations. Clone the current plan, adjust projects or resources, and compare the impact without affecting the live data.");
        HELP_TOPICS.put("override", "Temporary overrides let you re-assign a resource to a different POD for a specific date range, useful for short-term needs without changing permanent assignments.");
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

    // ── Entity type to route mapping for form prefill ──────────────────────
    // Use LinkedHashMap with deterministic order — longer keys first to avoid false matches
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
        return "RULE_BASED";
    }

    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    public NlpResult classify(String query, NlpCatalogResponse catalog) {
        String q = query.trim();

        // 0. Check learned patterns first (from NLP Learner)
        NlpResult learned = tryLearnedPatterns(q);
        if (learned != null) return learned;

        // 0b. Jira ticket ID fast-path (deterministic, no LLM needed)
        NlpResult jiraTicket = tryJiraTicketLookup(q);
        if (jiraTicket != null) return jiraTicket;

        // 1. Greeting / small talk
        NlpResult greeting = tryGreeting(q);
        if (greeting != null) return greeting;

        // 2. Capability discovery ("what can you do", "help me")
        NlpResult capability = tryCapabilityDiscovery(q);
        if (capability != null) return capability;

        // 3. Navigation
        NlpResult nav = tryNavigation(q);
        if (nav != null) return nav;

        // 4a. "Add X to Y pod/team" — add member, NOT create new entity
        NlpResult addMember = tryAddMemberToEntity(q, catalog);
        if (addMember != null) return addMember;

        // 4b. Creation / form prefill
        NlpResult create = tryCreation(q, catalog);
        if (create != null) return create;

        // 5. Status update ("mark X as completed")
        NlpResult statusUpdate = tryStatusUpdate(q, catalog);
        if (statusUpdate != null) return statusUpdate;

        // 6. Export ("export projects as CSV")
        NlpResult export = tryExport(q);
        if (export != null) return export;

        // 7. Comparison ("compare Pod A vs Pod B")
        NlpResult compare = tryComparison(q, catalog);
        if (compare != null) return compare;

        // 8. Cross-entity ("who works on Project X", "what projects is John on")
        NlpResult crossEntity = tryCrossEntity(q, catalog);
        if (crossEntity != null) return crossEntity;

        // 9. Resource lookup
        NlpResult resourceLookup = tryResourceLookup(q, catalog);
        if (resourceLookup != null) return resourceLookup;

        // 10. Project estimates ("estimates for SgNIPT", "pods in SgNIPT project")
        NlpResult projectEstimate = tryProjectEstimates(q, catalog);
        if (projectEstimate != null) return projectEstimate;

        // 11. Project lookup
        NlpResult projectLookup = tryProjectLookup(q, catalog);
        if (projectLookup != null) return projectLookup;

        // 11. POD lookup
        NlpResult podLookup = tryPodLookup(q, catalog);
        if (podLookup != null) return podLookup;

        // 12. Sprint / release lookup
        NlpResult sprintRelease = trySprintReleaseLookup(q, catalog);
        if (sprintRelease != null) return sprintRelease;

        // 13. Timeline / deadline queries
        NlpResult timeline = tryTimeline(q, catalog);
        if (timeline != null) return timeline;

        // 14. Project filters (by owner, status, priority)
        NlpResult projFilter = tryProjectFilters(q, catalog);
        if (projFilter != null) return projFilter;

        // 15. Sprint allocation queries
        NlpResult sprintAlloc = trySprintAllocations(q, catalog);
        if (sprintAlloc != null) return sprintAlloc;

        // 16. Resource availability queries
        NlpResult avail = tryResourceAvailability(q, catalog);
        if (avail != null) return avail;

        // 17. Project dependencies
        NlpResult deps = tryProjectDependencies(q, catalog);
        if (deps != null) return deps;

        // 18. Project actuals (planned vs actual)
        NlpResult actuals = tryProjectActuals(q, catalog);
        if (actuals != null) return actuals;

        // 19. Effort patterns
        NlpResult patterns = tryEffortPatterns(q, catalog);
        if (patterns != null) return patterns;

        // 20. Role effort mix
        NlpResult roleMix = tryRoleEffortMix(q, catalog);
        if (roleMix != null) return roleMix;

        // 21. Support queue (Jira)
        NlpResult supportQueue = trySupportQueue(q, catalog);
        if (supportQueue != null) return supportQueue;

        // 22. Timeline config / working hours
        NlpResult timelineConfig = tryTimelineConfig(q, catalog);
        if (timelineConfig != null) return timelineConfig;

        // 23. Risk alerts
        NlpResult risk = tryRiskAlerts(q, catalog);
        if (risk != null) return risk;

        // 24. Budget / cost queries
        NlpResult budget = tryBudgetQueries(q, catalog);
        if (budget != null) return budget;

        // 25. Cost rate lookups
        NlpResult costRate = tryCostRateLookup(q, catalog);
        if (costRate != null) return costRate;

        // 26. BAU queries
        NlpResult bau = tryBauQueries(q, catalog);
        if (bau != null) return bau;

        // 27. Override / temp allocation queries (enhanced)
        NlpResult overrideResult = tryOverrideQueries(q, catalog);
        if (overrideResult != null) return overrideResult;

        // 28. Jira-specific queries
        NlpResult jira = tryJiraSpecific(q, catalog);
        if (jira != null) return jira;

        // 28a. Jira contributor queries ("who worked on CEP-1234")
        NlpResult jiraContribs = tryJiraContributors(q);
        if (jiraContribs != null) return jiraContribs;

        // 28b. Jira bug summary
        NlpResult jiraBugs = tryJiraBugSummary(q);
        if (jiraBugs != null) return jiraBugs;

        // 28c. Jira sprint health
        NlpResult jiraSprint = tryJiraSprintHealth(q);
        if (jiraSprint != null) return jiraSprint;

        // 28d. Jira workload
        NlpResult jiraWork = tryJiraWorkload(q);
        if (jiraWork != null) return jiraWork;

        // 28e. Jira analytics
        NlpResult jiraAnal = tryJiraAnalytics(q);
        if (jiraAnal != null) return jiraAnal;

        // 28f. DORA metrics
        NlpResult dora = tryDoraMetrics(q);
        if (dora != null) return dora;

        // 28g. Utilization queries
        NlpResult util = tryUtilization(q);
        if (util != null) return util;

        // 28h. Capacity vs Demand
        NlpResult capDemand = tryCapacityDemand(q);
        if (capDemand != null) return capDemand;

        // 28i. Hiring forecast
        NlpResult hiring = tryHiringForecast(q);
        if (hiring != null) return hiring;

        // 28j. Concurrency risk
        NlpResult concurrency = tryConcurrencyRisk(q);
        if (concurrency != null) return concurrency;

        // 28k. Project Gantt chart
        NlpResult gantt = tryGantt(q);
        if (gantt != null) return gantt;

        // 28l. Owner demand
        NlpResult ownerDemand = tryOwnerDemand(q);
        if (ownerDemand != null) return ownerDemand;

        // 28m. Slack/buffer analysis
        NlpResult slackBuf = trySlackBuffer(q);
        if (slackBuf != null) return slackBuf;

        // 28n. CapEx/OpEx
        NlpResult capex = tryCapexOpex(q);
        if (capex != null) return capex;

        // 28o. Pod capacity
        NlpResult podCap = tryPodCapacity(q);
        if (podCap != null) return podCap;

        // 28p. Dashboard / overview
        NlpResult dash = tryDashboardOverview(q);
        if (dash != null) return dash;

        // 29. Scenario / what-if
        NlpResult scenario = tryScenario(q);
        if (scenario != null) return scenario;

        // 30. Audit log queries
        NlpResult audit = tryAuditLog(q);
        if (audit != null) return audit;

        // 31a. Location-based team queries ("India team details", "US team", "give me India resources")
        NlpResult locationTeam = tryLocationTeamQuery(q, catalog);
        if (locationTeam != null) return locationTeam;

        // 31. Resource analytics (billing, capacity by role/location)
        NlpResult resAnalytics = tryResourceAnalytics(q, catalog);
        if (resAnalytics != null) return resAnalytics;

        // 32. Insight (now with catalog-aware data)
        NlpResult insight = tryInsight(q, catalog);
        if (insight != null) return insight;

        // 33. Aggregation queries
        NlpResult agg = tryAggregation(q, catalog);
        if (agg != null) return agg;

        // 34. Data query
        NlpResult data = tryDataQuery(q, catalog);
        if (data != null) return data;

        // 35. Help
        NlpResult help = tryHelp(q, catalog);
        if (help != null) return help;

        // 36. Smart catch-all: try to resolve ANY entity mention in the query
        NlpResult catchAll = tryCatchAllEntityResolution(q, catalog);
        if (catchAll != null) return catchAll;

        // No match
        return new NlpResult("UNKNOWN", 0.0, null, null, null, null, null, null, null);
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Jira Ticket ID Fast-Path ─────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Quick deterministic lookup for Jira ticket IDs like "TAT-123" or
     * "tell me about BGENG-456". No LLM needed — directly queries the DB.
     */
    private NlpResult tryJiraTicketLookup(String query) {
        if (jiraToolExecutor == null) return null;

        String issueKey = null;

        // Try explicit patterns first: "tell me about TAT-123", "summarize PROJ-456"
        for (Pattern p : JIRA_TICKET_LOOKUP_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                issueKey = m.group(1).toUpperCase();
                break;
            }
        }

        // If no explicit pattern matched, check for a bare ticket key in the query
        if (issueKey == null) {
            Matcher m = JIRA_ISSUE_KEY_PATTERN.matcher(query);
            if (m.find()) {
                issueKey = m.group(1).toUpperCase();
            }
        }

        if (issueKey == null) return null;

        // Look up the issue from the DB
        Map<String, Object> structured = jiraToolExecutor.lookupIssueStructured(issueKey);
        if (structured == null) {
            return new NlpResult(
                    "DATA_QUERY", 0.85,
                    "I couldn't find issue " + issueKey + " in our synced data. "
                            + "It may not have been synced yet, or the key might be incorrect.",
                    null, null, null, "/reports/jira-analytics",
                    List.of("Search for similar issues", "Check Jira sync status", "Show open issues")
            , null);
        }

        String summary = jiraToolExecutor.summarizeIssue(structured);
        String statusEmoji = "Done".equalsIgnoreCase(String.valueOf(structured.get("Status Category")))
                ? "✅ " : "🔷 ";

        return new NlpResult(
                "DATA_QUERY", 0.95,
                statusEmoji + structured.get("Key") + " — " + structured.get("Summary"),
                null, null, structured, null,
                List.of("Show worklogs for " + issueKey,
                        "Who else is working on " + structured.get("Project") + "?",
                        "Show open issues for " + structured.get("Assignee"))
        , null);
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Learned Patterns (from NLP Optimizer) ──────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryLearnedPatterns(String query) {
        try {
            List<NlpLearnedPattern> patterns = learnedPatternRepo.findByActiveTrueOrderByTimesSeenDesc();
            String normalized = query.toLowerCase().trim();

            // Best CONTAINS match tracked separately (lower priority than exact/regex/fuzzy)
            NlpLearnedPattern bestContainsMatch = null;
            double bestContainsScore = 0;

            for (NlpLearnedPattern p : patterns) {
                if ("UNKNOWN".equals(p.getResolvedIntent())) continue;

                boolean match = false;
                if ("EXACT".equals(p.getPatternType())) {
                    match = normalized.equals(p.getQueryPattern());
                } else if ("REGEX".equals(p.getPatternType())) {
                    try { match = normalized.matches(p.getQueryPattern()); } catch (Exception ignored) {}
                } else if ("FUZZY".equals(p.getPatternType())) {
                    match = normalized.contains(p.getQueryPattern()) || p.getQueryPattern().contains(normalized);
                } else if ("CONTAINS".equals(p.getPatternType()) && p.getKeywords() != null) {
                    // CONTAINS: check if query contains ALL keywords from the pattern
                    String[] keywords = p.getKeywords().split(",");
                    int matched = 0;
                    for (String kw : keywords) {
                        if (!kw.isBlank() && normalized.contains(kw.trim())) matched++;
                    }
                    if (keywords.length > 0 && matched == keywords.length) {
                        // Score: base confidence * (keyword count bonus) — more keywords = more specific
                        double score = p.getConfidence() * (1 + keywords.length * 0.05);
                        if (score > bestContainsScore) {
                            bestContainsScore = score;
                            bestContainsMatch = p;
                        }
                    }
                    continue; // Don't process CONTAINS as direct match; collect best candidate
                }

                if (match) {
                    // Learned patterns only store routing hints (intent + route), not actual data.
                    // For data-bearing intents, skip the shortcut so the real pipeline runs.
                    String intent = p.getResolvedIntent();
                    if ("DATA_QUERY".equals(intent) || "INSIGHT".equals(intent) || "REPORT".equals(intent)) {
                        continue;
                    }
                    // Record the match to keep the pattern alive (prevents confidence decay)
                    try { learnerService.recordPatternMatch(p.getId()); } catch (Exception ignored) {}

                    return buildLearnedPatternResult(p);
                }
            }

            // If no EXACT/REGEX/FUZZY matched, try best CONTAINS match
            if (bestContainsMatch != null) {
                String intent = bestContainsMatch.getResolvedIntent();
                if (!"DATA_QUERY".equals(intent) && !"INSIGHT".equals(intent) && !"REPORT".equals(intent)) {
                    try { learnerService.recordPatternMatch(bestContainsMatch.getId()); } catch (Exception ignored) {}
                    return buildLearnedPatternResult(bestContainsMatch);
                }
            }

        } catch (Exception e) {
            // Don't break the chain if learned patterns fail
        }
        return null;
    }

    private NlpResult buildLearnedPatternResult(NlpLearnedPattern p) {
        String route = p.getRoute();
        String message = "Matched learned pattern: " + p.getResolvedIntent();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_learnedPattern", true);
        data.put("patternId", p.getId());

        if ("NAVIGATE".equals(p.getResolvedIntent()) && route != null) {
            return new NlpResult("NAVIGATE", p.getConfidence(), message, route, null, data, null, List.of(), null);
        } else if ("FORM_PREFILL".equals(p.getResolvedIntent()) && route != null) {
            Map<String, Object> formData = new LinkedHashMap<>();
            if (p.getEntityName() != null) formData.put("name", p.getEntityName());
            return new NlpResult("FORM_PREFILL", p.getConfidence(), message, route, formData, data, null, List.of(), null);
        } else {
            return new NlpResult(p.getResolvedIntent(), p.getConfidence(), message, route, null, data, null, List.of(), null);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Navigation ─────────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryNavigation(String query) {
        for (Pattern p : NAV_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.matches()) {
                String target = m.group(1).trim().toLowerCase()
                        .replaceAll("\\s+page$", "").replaceAll("\\s+report$", "").replaceAll("\\s+screen$", "");
                String route = findBestRoute(target);
                if (route != null) {
                    String title = getPageTitle(route);
                    return new NlpResult("NAVIGATE", 0.92, "Opening " + title + "…",
                            route, null, null, null, List.of("What does " + title + " show?"), null);
                }
            }
        }

        // Bare alias match — catches preprocessed queries like "capacity gap report"
        // where "show me the" was already stripped by the preprocessor
        String bare = query.trim().toLowerCase()
                .replaceAll("\\s+page$", "").replaceAll("\\s+report$", "").replaceAll("\\s+screen$", "");
        String bareRoute = findBestRoute(bare);
        if (bareRoute != null) {
            String title = getPageTitle(bareRoute);
            return new NlpResult("NAVIGATE", 0.90, "Opening " + title + "…",
                    bareRoute, null, null, null, List.of("What does " + title + " show?"), null);
        }

        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Add Member to Entity (prevents "add X to Y pod" → create pod) ────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryAddMemberToEntity(String query, NlpCatalogResponse catalog) {
        for (Pattern p : ADD_MEMBER_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.matches()) {
                String personFragment = m.group(1).trim();
                String targetFragment = m.group(2).trim();

                // Check if person exists in catalog
                NlpCatalogResponse.ResourceInfo resource = findResourceByName(personFragment, catalog.resourceDetails());
                // Check if target is a POD
                NlpCatalogResponse.PodInfo pod = findPodByName(targetFragment, catalog.podDetails());

                if (resource != null && pod != null) {
                    // Both resource and pod found
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "ACTION_GUIDANCE");
                    data.put("Resource", resource.name());
                    data.put("Current POD", resource.podName());
                    data.put("Target POD", pod.name());
                    data.put("POD Members", String.valueOf(pod.memberCount()));
                    return new NlpResult("DATA_QUERY", 0.90,
                            resource.name() + " is currently in the " + resource.podName() + " POD. "
                                    + "To move them to " + pod.name() + ", go to the Resources page and update their POD assignment.",
                            "/resources", null, data, "/pods/" + pod.id(),
                            List.of("Show " + pod.name() + " POD details", "Go to Resources page"), null);
                } else if (pod != null) {
                    // Pod found, person not found or ambiguous
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "ACTION_GUIDANCE");
                    data.put("Target POD", pod.name());
                    data.put("POD Members", String.valueOf(pod.memberCount()));
                    data.put("Current Members", String.join(", ", pod.members()));
                    return new NlpResult("DATA_QUERY", 0.85,
                            "To add a member to the " + pod.name() + " POD, go to the Resources page and update their POD assignment. "
                                    + "The " + pod.name() + " POD currently has " + pod.memberCount() + " member(s).",
                            "/resources", null, data, "/pods/" + pod.id(),
                            List.of("Show " + pod.name() + " POD details", "Go to Resources page"), null);
                } else if (resource != null) {
                    // Resource found, target not recognized as a pod — check if it's a project
                    NlpCatalogResponse.ProjectInfo proj = findProjectByName(targetFragment, catalog.projectDetails());
                    if (proj != null) {
                        Map<String, Object> data = new LinkedHashMap<>();
                        data.put("_type", "ACTION_GUIDANCE");
                        data.put("Resource", resource.name());
                        data.put("Project", proj.name());
                        return new NlpResult("DATA_QUERY", 0.88,
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

    // ════════════════════════════════════════════════════════════════════════
    // ── Creation / Form Prefill ────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryCreation(String query, NlpCatalogResponse catalog) {
        for (Pattern p : CREATE_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.matches()) {
                String rest = m.group(1).trim().toLowerCase();

                // First pass: startsWith (highest confidence — "add a new resource …")
                for (var entry : CREATE_ROUTES.entrySet()) {
                    if (rest.startsWith(entry.getKey())) {
                        Map<String, Object> formData = extractFormFields(rest, entry.getKey(), catalog);
                        return new NlpResult("FORM_PREFILL", 0.85,
                                "I'll set up a new " + entry.getKey() + " for you. Review the details and hit Save when ready.",
                                entry.getValue(), formData, null, null,
                                List.of("Show all " + entry.getKey() + "s"), null);
                    }
                }

                // Second pass: word-boundary contains (fallback — "add Portal v1 project")
                for (var entry : CREATE_ROUTES.entrySet()) {
                    Pattern wordBoundary = Pattern.compile("(?i)\\b" + Pattern.quote(entry.getKey()) + "\\b");
                    if (wordBoundary.matcher(rest).find()) {
                        Map<String, Object> formData = extractFormFields(rest, entry.getKey(), catalog);
                        return new NlpResult("FORM_PREFILL", 0.85,
                                "I'll set up a new " + entry.getKey() + " for you. Review the details and hit Save when ready.",
                                entry.getValue(), formData, null, null,
                                List.of("Show all " + entry.getKey() + "s"), null);
                    }
                }
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Status Update ──────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryStatusUpdate(String query, NlpCatalogResponse catalog) {
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

                    return new NlpResult("FORM_PREFILL", 0.88,
                            "I'll update " + proj.name() + " status to " + formatStatus(newStatus) + ". Please confirm on the project form.",
                            "/projects?action=edit&id=" + proj.id(), formData, null, null,
                            List.of("Show " + proj.name() + " details"), null);
                }
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Export ──────────────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryExport(String query) {
        for (Pattern p : EXPORT_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String subject = m.group(1).trim().toLowerCase();
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "EXPORT");

                // Match known export subjects
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

                return new NlpResult("DATA_QUERY", 0.85,
                        "Ready to export " + label + " data. Click the download button below.",
                        null, null, data, null,
                        List.of("Show " + label + " report"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Comparison ─────────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryComparison(String query, NlpCatalogResponse catalog) {
        for (Pattern p : COMPARE_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String entityA = m.group(1).trim();
                String entityB = m.group(2).trim();

                // Try POD comparison
                NlpCatalogResponse.PodInfo podA = findPodByName(entityA, catalog.podDetails());
                NlpCatalogResponse.PodInfo podB = findPodByName(entityB, catalog.podDetails());
                if (podA != null && podB != null) {
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "COMPARISON");
                    data.put("compareType", "POD");
                    data.put("entityA", podA.name());
                    data.put("entityB", podB.name());
                    data.put(podA.name() + " Members", String.valueOf(podA.memberCount()));
                    data.put(podB.name() + " Members", String.valueOf(podB.memberCount()));
                    data.put(podA.name() + " Projects", String.valueOf(podA.projectCount()));
                    data.put(podB.name() + " Projects", String.valueOf(podB.projectCount()));
                    data.put(podA.name() + " Avg BAU", podA.avgBauPct());
                    data.put(podB.name() + " Avg BAU", podB.avgBauPct());

                    return new NlpResult("DATA_QUERY", 0.88,
                            "Comparing " + podA.name() + " vs " + podB.name() + ":",
                            null, null, data, "/reports/capacity-gap",
                            List.of("Show capacity gap report"), null);
                }

                // Try project comparison
                NlpCatalogResponse.ProjectInfo projA = findProjectByName(entityA, catalog.projectDetails());
                NlpCatalogResponse.ProjectInfo projB = findProjectByName(entityB, catalog.projectDetails());
                if (projA != null && projB != null) {
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "COMPARISON");
                    data.put("compareType", "PROJECT");
                    data.put("entityA", projA.name());
                    data.put("entityB", projB.name());
                    data.put(projA.name() + " Priority", projA.priority());
                    data.put(projB.name() + " Priority", projB.priority());
                    data.put(projA.name() + " Status", formatStatus(projA.status()));
                    data.put(projB.name() + " Status", formatStatus(projB.status()));
                    data.put(projA.name() + " PODs", projA.assignedPods());
                    data.put(projB.name() + " PODs", projB.assignedPods());
                    data.put(projA.name() + " Duration", projA.durationMonths());
                    data.put(projB.name() + " Duration", projB.durationMonths());

                    return new NlpResult("DATA_QUERY", 0.88,
                            "Comparing " + projA.name() + " vs " + projB.name() + ":",
                            null, null, data, "/reports/project-health",
                            List.of("Show project health report"), null);
                }
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Cross-Entity Queries ───────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryCrossEntity(String query, NlpCatalogResponse catalog) {
        String lower = query.toLowerCase();

        // "who works on PROJECT" / "team for PROJECT"
        if (lower.matches("(?i)^(?:who works on|who is on|team for|people on|resources on)\\s+.*")) {
            for (Pattern p : CROSS_ENTITY_PATTERNS) {
                Matcher m = p.matcher(query);
                if (m.find()) {
                    String entityName = m.group(1).trim();

                    // Try as project name → find members via POD
                    NlpCatalogResponse.ProjectInfo proj = findProjectByName(entityName, catalog.projectDetails());
                    if (proj != null) {
                        // Find all resources in the assigned PODs
                        List<String> podNames = Arrays.asList(proj.assignedPods().split(",\\s*"));
                        List<String> teamMembers = new ArrayList<>();
                        for (NlpCatalogResponse.PodInfo pod : catalog.podDetails()) {
                            if (podNames.contains(pod.name())) {
                                for (String member : pod.members()) {
                                    if (!teamMembers.contains(member)) teamMembers.add(member);
                                }
                            }
                        }

                        Map<String, Object> data = new LinkedHashMap<>();
                        data.put("_type", "LIST");
                        data.put("listType", "TEAM_MEMBERS");
                        data.put("Project", proj.name());
                        data.put("Assigned PODs", proj.assignedPods());
                        data.put("Team Size", String.valueOf(teamMembers.size()));
                        data.put("Members", String.join(", ", teamMembers));

                        return new NlpResult("DATA_QUERY", 0.88,
                                proj.name() + " has " + teamMembers.size() + " team member(s) across " + proj.assignedPods() + ".",
                                null, null, data, "/resources",
                                List.of("Go to Resources page", "Show " + proj.name() + " details"), null);
                    }
                }
            }
        }

        // "what projects is PERSON on" / "projects for POD" / "what is X working on"
        if (lower.matches("(?i)^(?:what projects?|which projects?|projects? in|projects? for|what is|what's|whats|what does|what do)\\s+.*")) {
            for (Pattern p : CROSS_ENTITY_PATTERNS) {
                Matcher m = p.matcher(query);
                if (m.find()) {
                    String entityName = m.group(1).trim();

                    // Try as resource name → find their pod → find pod's projects
                    NlpCatalogResponse.ResourceInfo resource = findResourceByName(entityName, catalog.resourceDetails());
                    if (resource != null && !"Unassigned".equals(resource.podName())) {
                        NlpCatalogResponse.PodInfo pod = findPodByName(resource.podName(), catalog.podDetails());
                        if (pod != null && !pod.projectNames().isEmpty()) {
                            Map<String, Object> data = new LinkedHashMap<>();
                            data.put("_type", "LIST");
                            data.put("listType", "PROJECTS");
                            data.put("Resource", resource.name());
                            data.put("POD", pod.name());
                            data.put("Project Count", String.valueOf(pod.projectNames().size()));
                            data.put("Projects", String.join(", ", pod.projectNames()));

                            return new NlpResult("DATA_QUERY", 0.88,
                                    resource.name() + " is in the " + pod.name() + " pod, working on " + pod.projectNames().size() + " project(s).",
                                    null, null, data, "/reports/project-pod-matrix",
                                    List.of("Show project-pod matrix"), null);
                        }
                    }

                    // Try as POD name → find pod's projects
                    NlpCatalogResponse.PodInfo pod = findPodByName(entityName, catalog.podDetails());
                    if (pod != null && !pod.projectNames().isEmpty()) {
                        Map<String, Object> data = new LinkedHashMap<>();
                        data.put("_type", "LIST");
                        data.put("listType", "PROJECTS");
                        data.put("POD", pod.name());
                        data.put("Project Count", String.valueOf(pod.projectNames().size()));
                        data.put("Projects", String.join(", ", pod.projectNames()));

                        return new NlpResult("DATA_QUERY", 0.88,
                                pod.name() + " pod has " + pod.projectNames().size() + " project(s): " + String.join(", ", pod.projectNames()) + ".",
                                null, null, data, "/reports/pod-project-matrix",
                                List.of("Show pod-project matrix"), null);
                    }
                }
            }
        }

        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Resource Lookup ────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    /** Strip trailing location/team phrases from a captured name fragment.
     *  Handles: "in any team", "in the team", "in any of the pods", "on our teams",
     *  "across all pods", "from the organization", etc. */
    private static final Pattern TRAILING_TEAM_PHRASE = Pattern.compile(
            "(?i)\\s+(?:in|on|at|from|of|across)\\s+(?:any\\s+(?:of\\s+)?)?(?:the|our|my|this|that|a|all)?\\s*(?:team|teams|pod|pods|org|organization|company|group|groups|department|departments)s?.*$");

    /** Noise words that can leak into captured name fragments from loose regexes. */
    private static final Pattern NAME_NOISE_PREFIX = Pattern.compile(
            "(?i)^(?:someone|anybody|anyone|person|resource|member|employee|a|an|the|named|called)\\s+");

    private NlpResult tryResourceLookup(String query, NlpCatalogResponse catalog) {
        if (catalog.resourceDetails() == null || catalog.resourceDetails().isEmpty()) return null;
        boolean namePatternMatched = false;
        String bestNameFragment = null; // keep the shortest (cleanest) extracted name
        for (Pattern p : RESOURCE_LOOKUP_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String nameFragment = m.group(1).trim();
                // Clean trailing team/pod/org phrases: "Piyush in any team" → "Piyush"
                nameFragment = TRAILING_TEAM_PHRASE.matcher(nameFragment).replaceAll("").trim();
                // Strip leading noise words: "named Piyush" → "Piyush", "anyone Piyush" → "Piyush"
                String cleaned = nameFragment;
                String prev;
                do { prev = cleaned; cleaned = NAME_NOISE_PREFIX.matcher(cleaned).replaceFirst(""); } while (!cleaned.equals(prev));
                cleaned = cleaned.trim();
                if (cleaned.isEmpty()) continue;
                namePatternMatched = true;
                // Keep the shortest clean fragment (most precise extraction)
                if (bestNameFragment == null || cleaned.length() < bestNameFragment.length()) {
                    bestNameFragment = cleaned;
                }
                NlpCatalogResponse.ResourceInfo match = findResourceByName(cleaned, catalog.resourceDetails());
                if (match != null) return buildResourceResult(match);
            }
        }
        NlpCatalogResponse.ResourceInfo directMatch = findResourceByName(query, catalog.resourceDetails());
        if (directMatch != null) return buildResourceResult(directMatch);

        // If a name-search pattern matched but no resource was found, return a smart "not found" result
        if (namePatternMatched && bestNameFragment != null) {
            return buildResourceNotFoundResult(bestNameFragment, catalog);
        }
        return null;
    }

    /** Build a helpful "not found" result with close-match suggestions (vector + Levenshtein hybrid). */
    private NlpResult buildResourceNotFoundResult(String searchedName, NlpCatalogResponse catalog) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "LIST");
        data.put("Count", "0");
        data.put("Search Term", searchedName);

        // Find close matches: try vector search first, fall back to Levenshtein
        List<String> closestNames = new ArrayList<>();
        Set<String> addedNames = new HashSet<>();

        // Vector-based suggestions (semantic similarity — catches nicknames, abbreviations)
        if (vectorSearchService != null && catalog.resourceDetails() != null) {
            try {
                var vectorResults = vectorSearchService.searchByTypes(searchedName, List.of("RESOURCE"), 5);
                for (var vr : vectorResults) {
                    if (vr.similarity() >= 0.45 && vr.entityName() != null && closestNames.size() < 3) {
                        // Match back to catalog for rich details
                        for (NlpCatalogResponse.ResourceInfo r : catalog.resourceDetails()) {
                            if (r.name().equalsIgnoreCase(vr.entityName()) && !addedNames.contains(r.name().toLowerCase())) {
                                closestNames.add(r.name() + " (" + formatRole(r.role()) + ", " + r.podName() + ")");
                                addedNames.add(r.name().toLowerCase());
                                break;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                // Vector search non-critical
            }
        }

        // Levenshtein fallback for any remaining suggestion slots
        if (closestNames.size() < 3 && catalog.resourceDetails() != null) {
            String lower = searchedName.toLowerCase();
            for (NlpCatalogResponse.ResourceInfo r : catalog.resourceDetails()) {
                if (addedNames.contains(r.name().toLowerCase())) continue;
                String rLower = r.name().toLowerCase();
                if (rLower.startsWith(lower.substring(0, Math.min(2, lower.length())))
                        || (lower.length() >= 3 && levenshteinClose(lower, rLower))) {
                    closestNames.add(r.name() + " (" + formatRole(r.role()) + ", " + r.podName() + ")");
                    addedNames.add(r.name().toLowerCase());
                    if (closestNames.size() >= 3) break;
                }
            }
        }

        String message;
        if (closestNames.isEmpty()) {
            message = "No one named \"" + searchedName + "\" was found in any team. "
                    + "There are " + (catalog.resourceDetails() != null ? catalog.resourceDetails().size() : 0)
                    + " resources across all pods.";
        } else {
            message = "No one named \"" + searchedName + "\" was found. Did you mean: "
                    + String.join(", ", closestNames) + "?";
        }

        List<String> suggestions = new ArrayList<>();
        suggestions.add("Show all resources");
        suggestions.add("Show all team members");
        if (!closestNames.isEmpty()) {
            // Add the first close match name as a suggestion
            String firstName = closestNames.get(0).split("\\s*\\(")[0].trim();
            suggestions.add("Tell me about " + firstName);
        }

        return new NlpResult("DATA_QUERY", 0.88, message, null, null, data, "/resources", suggestions, null);
    }

    /** Simple Levenshtein distance check — true if edit distance ≤ 2 for short names. */
    private boolean levenshteinClose(String a, String b) {
        // Only compare first names for closeness
        String aFirst = a.split("\\s+")[0];
        String bFirst = b.split("\\s+")[0];
        int dist = editDistance(aFirst, bFirst);
        return dist <= 2 && dist < Math.max(aFirst.length(), bFirst.length());
    }

    private int editDistance(String a, String b) {
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) dp[i][0] = i;
        for (int j = 0; j <= b.length(); j++) dp[0][j] = j;
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1), dp[i - 1][j - 1] + cost);
            }
        }
        return dp[a.length()][b.length()];
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Project Lookup ─────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════════════════
    // ── Project Estimates ───────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryProjectEstimates(String query, NlpCatalogResponse catalog) {
        if (catalog.projectEstimates() == null || catalog.projectEstimates().isEmpty()) return null;
        for (Pattern p : PROJECT_ESTIMATE_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String nameFragment = m.group(1).trim();
                for (NlpCatalogResponse.ProjectEstimateInfo est : catalog.projectEstimates()) {
                    if (est.projectName().toLowerCase().contains(nameFragment.toLowerCase())
                            || nameFragment.toLowerCase().contains(est.projectName().toLowerCase())) {
                        return buildProjectEstimateResult(est);
                    }
                }
            }
        }
        return null;
    }

    private NlpResult buildProjectEstimateResult(NlpCatalogResponse.ProjectEstimateInfo est) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "PROJECT_ESTIMATES");
        data.put("Project", est.projectName());
        data.put("Dev Hours", est.totalDevHours());
        data.put("QA Hours", est.totalQaHours());
        data.put("BSA Hours", est.totalBsaHours());
        data.put("Tech Lead Hours", est.totalTechLeadHours());
        data.put("Grand Total Hours", est.grandTotalHours());
        data.put("POD Count", String.valueOf(est.podCount()));

        // Per-POD breakdown as a sub-list
        List<Map<String, String>> podBreakdown = new ArrayList<>();
        for (NlpCatalogResponse.PodEstimateDetail pod : est.podEstimates()) {
            Map<String, String> podMap = new LinkedHashMap<>();
            podMap.put("POD", pod.podName());
            podMap.put("Dev", pod.devHours());
            podMap.put("QA", pod.qaHours());
            podMap.put("BSA", pod.bsaHours());
            podMap.put("TL", pod.techLeadHours());
            podMap.put("Total", pod.totalHours());
            podMap.put("Contingency", pod.contingencyPct());
            podMap.put("Pattern", pod.effortPattern());
            podMap.put("Release", pod.targetRelease());
            podBreakdown.add(podMap);
        }
        data.put("podBreakdown", podBreakdown);

        return new NlpResult("DATA_QUERY", 0.92,
                est.projectName() + " has " + est.grandTotalHours() + " total estimated hours across "
                        + est.podCount() + " POD(s). Dev: " + est.totalDevHours() + "h, QA: "
                        + est.totalQaHours() + "h, BSA: " + est.totalBsaHours() + "h, TL: "
                        + est.totalTechLeadHours() + "h.",
                null, null, data, "/projects",
                List.of("Go to Projects page", "Show project health report"), null);
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Sprint Allocations ──────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult trySprintAllocations(String query, NlpCatalogResponse catalog) {
        if (catalog.sprintAllocations() == null || catalog.sprintAllocations().isEmpty()) return null;
        String lower = query.toLowerCase();

        // "which projects are in the current sprint"
        if (lower.contains("current sprint") || lower.contains("active sprint")) {
            List<NlpCatalogResponse.SprintAllocationInfo> active = catalog.sprintAllocations().stream()
                    .filter(a -> "Active".equals(a.sprintStatus())).toList();
            if (!active.isEmpty()) return buildSprintAllocationListResult(active, "Current Sprint Allocations");
        }

        for (Pattern p : SPRINT_ALLOC_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String fragment = m.group(1).trim();
                // Try matching sprint name
                List<NlpCatalogResponse.SprintAllocationInfo> bySprintName = catalog.sprintAllocations().stream()
                        .filter(a -> a.sprintName().toLowerCase().contains(fragment.toLowerCase())).toList();
                if (!bySprintName.isEmpty()) return buildSprintAllocationListResult(bySprintName, "Sprint: " + bySprintName.get(0).sprintName());

                // Try matching project name
                List<NlpCatalogResponse.SprintAllocationInfo> byProject = catalog.sprintAllocations().stream()
                        .filter(a -> a.projectName().toLowerCase().contains(fragment.toLowerCase())).toList();
                if (!byProject.isEmpty()) return buildSprintAllocationListResult(byProject, "Sprint allocations for " + byProject.get(0).projectName());

                // Try matching pod name
                List<NlpCatalogResponse.SprintAllocationInfo> byPod = catalog.sprintAllocations().stream()
                        .filter(a -> a.podName().toLowerCase().contains(fragment.toLowerCase())).toList();
                if (!byPod.isEmpty()) return buildSprintAllocationListResult(byPod, "Sprint allocations for " + fragment + " pod");
            }
        }
        return null;
    }

    private NlpResult buildSprintAllocationListResult(List<NlpCatalogResponse.SprintAllocationInfo> allocs, String title) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "SPRINT_ALLOCATIONS");
        data.put("Title", title);
        data.put("Count", String.valueOf(allocs.size()));

        List<Map<String, String>> items = new ArrayList<>();
        for (NlpCatalogResponse.SprintAllocationInfo a : allocs) {
            Map<String, String> item = new LinkedHashMap<>();
            item.put("Sprint", a.sprintName());
            item.put("Project", a.projectName());
            item.put("POD", a.podName());
            item.put("Dev", a.devHours());
            item.put("QA", a.qaHours());
            item.put("BSA", a.bsaHours());
            item.put("TL", a.techLeadHours());
            item.put("Total", a.totalHours());
            items.add(item);
        }
        data.put("allocations", items);

        return new NlpResult("DATA_QUERY", 0.88, title + " — " + allocs.size() + " allocation(s).",
                null, null, data, "/sprint-planner",
                List.of("Go to Sprint Planner", "Show sprint calendar"), null);
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Resource Availability ───────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryResourceAvailability(String query, NlpCatalogResponse catalog) {
        if (catalog.resourceAvailabilities() == null || catalog.resourceAvailabilities().isEmpty()) return null;

        for (Pattern p : AVAILABILITY_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String fragment = m.group(1).trim();

                // Check if fragment is a month name
                int monthNum = parseMonth(fragment.toLowerCase());
                if (monthNum > 0) {
                    List<NlpCatalogResponse.ResourceAvailabilityInfo> byMonth = catalog.resourceAvailabilities().stream()
                            .filter(a -> a.monthIndex() == monthNum).toList();
                    if (!byMonth.isEmpty()) return buildAvailabilityListResult(byMonth, "Availability in " + fragment);
                }

                // Check if fragment is a resource name
                List<NlpCatalogResponse.ResourceAvailabilityInfo> byResource = catalog.resourceAvailabilities().stream()
                        .filter(a -> a.resourceName().toLowerCase().contains(fragment.toLowerCase())).toList();
                if (!byResource.isEmpty()) return buildAvailabilityListResult(byResource, fragment + "'s Availability");

                // Check if fragment is a pod name
                List<NlpCatalogResponse.ResourceAvailabilityInfo> byPod = catalog.resourceAvailabilities().stream()
                        .filter(a -> a.podName().toLowerCase().contains(fragment.toLowerCase())).toList();
                if (!byPod.isEmpty()) return buildAvailabilityListResult(byPod, "Availability for " + fragment + " pod");
            }
        }
        return null;
    }

    private NlpResult buildAvailabilityListResult(List<NlpCatalogResponse.ResourceAvailabilityInfo> avails, String title) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "RESOURCE_AVAILABILITY");
        data.put("Title", title);
        data.put("Count", String.valueOf(avails.size()));

        List<Map<String, String>> items = new ArrayList<>();
        for (NlpCatalogResponse.ResourceAvailabilityInfo a : avails) {
            Map<String, String> item = new LinkedHashMap<>();
            item.put("Resource", a.resourceName());
            item.put("Role", a.role());
            item.put("POD", a.podName());
            item.put("Month", a.monthLabel());
            item.put("Hours", a.availableHours());
            items.add(item);
        }
        data.put("entries", items);

        return new NlpResult("DATA_QUERY", 0.88, title + " — " + avails.size() + " record(s).",
                null, null, data, "/availability",
                List.of("Go to Availability page", "Show capacity gap report"), null);
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Project Dependencies ────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryProjectDependencies(String query, NlpCatalogResponse catalog) {
        if (catalog.projectDependencies() == null) return null;

        for (Pattern p : DEPENDENCY_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String fragment = m.groupCount() > 0 ? m.group(1).trim() : "";

                if (!fragment.isEmpty()) {
                    // Specific project dependency check
                    List<NlpCatalogResponse.ProjectDependencyInfo> deps = catalog.projectDependencies().stream()
                            .filter(d -> d.projectName().toLowerCase().contains(fragment.toLowerCase())
                                    || d.blockedByName().toLowerCase().contains(fragment.toLowerCase())).toList();
                    if (!deps.isEmpty()) return buildDependencyResult(deps, "Dependencies for " + fragment);
                }

                // Show all dependencies
                if (!catalog.projectDependencies().isEmpty()) {
                    return buildDependencyResult(catalog.projectDependencies(), "All Project Dependencies");
                }
            }
        }
        return null;
    }

    private NlpResult buildDependencyResult(List<NlpCatalogResponse.ProjectDependencyInfo> deps, String title) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "PROJECT_DEPENDENCIES");
        data.put("Title", title);
        data.put("Count", String.valueOf(deps.size()));

        List<Map<String, String>> items = new ArrayList<>();
        for (NlpCatalogResponse.ProjectDependencyInfo d : deps) {
            Map<String, String> item = new LinkedHashMap<>();
            item.put("Project", d.projectName());
            item.put("Blocked By", d.blockedByName());
            item.put("Project Status", formatStatus(d.projectStatus()));
            item.put("Blocker Status", formatStatus(d.blockedByStatus()));
            items.add(item);
        }
        data.put("dependencies", items);

        return new NlpResult("DATA_QUERY", 0.88, title + " — " + deps.size() + " dependency(ies).",
                null, null, data, "/reports/cross-pod",
                List.of("Go to Cross-POD Dependencies", "Show project health"), null);
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Project Actuals ─────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryProjectActuals(String query, NlpCatalogResponse catalog) {
        if (catalog.projectActuals() == null || catalog.projectActuals().isEmpty()) return null;

        for (Pattern p : ACTUALS_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String fragment = m.group(1).trim();

                // Check month name
                int monthNum = parseMonth(fragment.toLowerCase());
                if (monthNum > 0) {
                    List<NlpCatalogResponse.ProjectActualInfo> byMonth = catalog.projectActuals().stream()
                            .filter(a -> a.monthKey() == monthNum).toList();
                    if (!byMonth.isEmpty()) return buildActualsResult(byMonth, "Actual Hours in " + fragment);
                }

                // Check project name
                List<NlpCatalogResponse.ProjectActualInfo> byProject = catalog.projectActuals().stream()
                        .filter(a -> a.projectName().toLowerCase().contains(fragment.toLowerCase())).toList();
                if (!byProject.isEmpty()) return buildActualsResult(byProject, "Actual Hours for " + fragment);
            }
        }

        // "which projects are over on hours" — compare estimates vs actuals
        String lower = query.toLowerCase();
        if (lower.contains("over") && (lower.contains("hours") || lower.contains("budget") || lower.contains("estimate"))) {
            // Aggregate actuals by project
            Map<String, java.math.BigDecimal> actualsByProject = new LinkedHashMap<>();
            for (NlpCatalogResponse.ProjectActualInfo a : catalog.projectActuals()) {
                actualsByProject.merge(a.projectName(),
                        new java.math.BigDecimal(a.actualHours()), java.math.BigDecimal::add);
            }
            // Compare with estimates
            List<Map<String, String>> overProjects = new ArrayList<>();
            if (catalog.projectEstimates() != null) {
                for (NlpCatalogResponse.ProjectEstimateInfo est : catalog.projectEstimates()) {
                    java.math.BigDecimal actual = actualsByProject.get(est.projectName());
                    if (actual != null) {
                        java.math.BigDecimal estimated = new java.math.BigDecimal(est.grandTotalHours());
                        if (actual.compareTo(estimated) > 0) {
                            Map<String, String> item = new LinkedHashMap<>();
                            item.put("Project", est.projectName());
                            item.put("Estimated", est.grandTotalHours());
                            item.put("Actual", actual.toPlainString());
                            item.put("Over By", actual.subtract(estimated).toPlainString());
                            overProjects.add(item);
                        }
                    }
                }
            }
            if (!overProjects.isEmpty()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "PROJECT_ACTUALS");
                data.put("Title", "Projects Over Estimated Hours");
                data.put("Count", String.valueOf(overProjects.size()));
                data.put("entries", overProjects);
                return new NlpResult("DATA_QUERY", 0.88,
                        overProjects.size() + " project(s) have exceeded their estimated hours.",
                        null, null, data, "/reports/budget",
                        List.of("Go to Budget & Cost", "Show project health"), null);
            }
        }
        return null;
    }

    private NlpResult buildActualsResult(List<NlpCatalogResponse.ProjectActualInfo> actuals, String title) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "PROJECT_ACTUALS");
        data.put("Title", title);
        data.put("Count", String.valueOf(actuals.size()));

        List<Map<String, String>> items = new ArrayList<>();
        for (NlpCatalogResponse.ProjectActualInfo a : actuals) {
            Map<String, String> item = new LinkedHashMap<>();
            item.put("Project", a.projectName());
            item.put("Month", a.monthLabel());
            item.put("Actual Hours", a.actualHours());
            items.add(item);
        }
        data.put("entries", items);

        return new NlpResult("DATA_QUERY", 0.88, title + " — " + actuals.size() + " record(s).",
                null, null, data, "/reports/budget",
                List.of("Go to Budget & Cost", "Show project health"), null);
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Effort Patterns ─────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryEffortPatterns(String query, NlpCatalogResponse catalog) {
        if (catalog.effortPatterns() == null || catalog.effortPatterns().isEmpty()) return null;

        for (Pattern p : EFFORT_PATTERN_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                if (m.groupCount() > 0) {
                    String fragment = m.group(1).trim();
                    // Specific pattern lookup
                    for (NlpCatalogResponse.EffortPatternInfo ep : catalog.effortPatterns()) {
                        if (ep.name().toLowerCase().contains(fragment.toLowerCase())) {
                            Map<String, Object> data = new LinkedHashMap<>();
                            data.put("_type", "EFFORT_PATTERN");
                            data.put("Name", ep.name());
                            data.put("Description", ep.description());
                            data.put("Weights", ep.weights());
                            return new NlpResult("DATA_QUERY", 0.88,
                                    ep.name() + ": " + ep.description(),
                                    null, null, data, null,
                                    List.of("Show all effort patterns", "Go to Projects page"), null);
                        }
                    }
                }
                // List all patterns
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "EFFORT_PATTERN_LIST");
                data.put("Title", "Available Effort Patterns");
                data.put("Count", String.valueOf(catalog.effortPatterns().size()));
                List<Map<String, String>> items = new ArrayList<>();
                for (NlpCatalogResponse.EffortPatternInfo ep : catalog.effortPatterns()) {
                    Map<String, String> item = new LinkedHashMap<>();
                    item.put("Name", ep.name());
                    item.put("Description", ep.description());
                    items.add(item);
                }
                data.put("patterns", items);
                return new NlpResult("DATA_QUERY", 0.85,
                        catalog.effortPatterns().size() + " effort patterns available.",
                        null, null, data, null,
                        List.of("Go to Projects page"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Role Effort Mix ─────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryRoleEffortMix(String query, NlpCatalogResponse catalog) {
        if (catalog.roleEffortMixes() == null || catalog.roleEffortMixes().isEmpty()) return null;

        for (Pattern p : ROLE_MIX_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "ROLE_EFFORT_MIX");
                data.put("Title", "Standard Role Effort Mix");

                List<Map<String, String>> items = new ArrayList<>();
                for (NlpCatalogResponse.RoleEffortMixInfo mix : catalog.roleEffortMixes()) {
                    Map<String, String> item = new LinkedHashMap<>();
                    item.put("Role", formatRole(mix.role()));
                    item.put("Mix %", mix.mixPct());
                    items.add(item);
                }
                data.put("roles", items);

                return new NlpResult("DATA_QUERY", 0.88,
                        "Standard role effort mix: " + catalog.roleEffortMixes().stream()
                                .map(r -> formatRole(r.role()) + " " + r.mixPct())
                                .collect(Collectors.joining(", ")),
                        null, null, data, null,
                        List.of("Show cost rates", "Go to Resources page"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Support Queue ───────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult trySupportQueue(String query, NlpCatalogResponse catalog) {
        for (Pattern p : SUPPORT_QUEUE_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Jira Support Queue");
                data.put("route", "/jira-support");
                return new NlpResult("NAVIGATION", 0.88,
                        "Opening the Jira Support Queue dashboard where you can see open tickets, stale tickets, and support trends.",
                        "/jira-support", null, data, null,
                        List.of("Show Jira POD dashboard", "Show project health"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Timeline Config / Working Hours ─────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryTimelineConfig(String query, NlpCatalogResponse catalog) {
        for (Pattern p : TIMELINE_CONFIG_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Settings");
                data.put("route", "/settings");
                return new NlpResult("NAVIGATION", 0.85,
                        "Timeline configuration (fiscal year, working hours per month) can be found in Settings. Navigate there to view or adjust these values.",
                        "/settings", null, data, null,
                        List.of("Go to Settings", "Show availability grid"), null);
            }
        }
        return null;
    }

    private String formatRole(String role) {
        if (role == null) return "N/A";
        return switch (role) {
            case "DEVELOPER" -> "Developer";
            case "QA" -> "QA";
            case "BSA" -> "BSA";
            case "TECH_LEAD" -> "Tech Lead";
            default -> role;
        };
    }

    private NlpResult tryProjectLookup(String query, NlpCatalogResponse catalog) {
        if (catalog.projectDetails() == null || catalog.projectDetails().isEmpty()) return null;
        for (Pattern p : PROJECT_LOOKUP_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String nameFragment = m.group(1).trim();
                NlpCatalogResponse.ProjectInfo match = findProjectByName(nameFragment, catalog.projectDetails());
                if (match != null) return buildProjectResult(match);
            }
        }
        NlpCatalogResponse.ProjectInfo directMatch = findProjectByName(query, catalog.projectDetails());
        if (directMatch != null) return buildProjectResult(directMatch);
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── POD Lookup ─────────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryPodLookup(String query, NlpCatalogResponse catalog) {
        if (catalog.podDetails() == null || catalog.podDetails().isEmpty()) return null;
        for (Pattern p : POD_LOOKUP_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String nameFragment = m.group(1).trim();
                NlpCatalogResponse.PodInfo match = findPodByName(nameFragment, catalog.podDetails());
                if (match != null) return buildPodResult(match, catalog);
            }
        }
        NlpCatalogResponse.PodInfo directMatch = findPodByName(query, catalog.podDetails());
        if (directMatch != null) return buildPodResult(directMatch, catalog);
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Sprint / Release Lookup ────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult trySprintReleaseLookup(String query, NlpCatalogResponse catalog) {
        String lower = query.toLowerCase();

        // "current sprint" / "active sprint" / "next sprint"
        if (lower.contains("current sprint") || lower.contains("active sprint")) {
            return catalog.sprintDetails().stream()
                    .filter(s -> "Active".equals(s.status()))
                    .findFirst()
                    .map(this::buildSprintResult)
                    .orElse(null);
        }
        if (lower.contains("next sprint")) {
            return catalog.sprintDetails().stream()
                    .filter(s -> "Upcoming".equals(s.status()))
                    .findFirst()
                    .map(this::buildSprintResult)
                    .orElse(null);
        }

        // "current release" / "next release"
        if (lower.contains("current release") || lower.contains("latest release")) {
            return catalog.releaseDetails().stream()
                    .filter(r -> "Released".equals(r.status()))
                    .reduce((a, b) -> b) // last released
                    .map(this::buildReleaseResult)
                    .orElse(null);
        }
        if (lower.contains("next release") || lower.contains("upcoming release")) {
            return catalog.releaseDetails().stream()
                    .filter(r -> "Upcoming".equals(r.status()) || "Code Frozen".equals(r.status()))
                    .findFirst()
                    .map(this::buildReleaseResult)
                    .orElse(null);
        }

        // Named sprint/release lookup
        for (Pattern p : SPRINT_RELEASE_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String name = m.group(1).trim();
                // Try sprint
                for (NlpCatalogResponse.SprintInfo s : catalog.sprintDetails()) {
                    if (s.name().toLowerCase().contains(name.toLowerCase())) {
                        return buildSprintResult(s);
                    }
                }
                // Try release
                for (NlpCatalogResponse.ReleaseInfo r : catalog.releaseDetails()) {
                    if (r.name().toLowerCase().contains(name.toLowerCase())) {
                        return buildReleaseResult(r);
                    }
                }
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Timeline / Deadline Queries ────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryTimeline(String query, NlpCatalogResponse catalog) {
        String lower = query.toLowerCase();

        // "release date in July", "release in August"
        for (Pattern p : TIMELINE_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String monthOrKeyword = m.group(1).trim().toLowerCase();

                // Check if it's a month name
                int monthNum = parseMonth(monthOrKeyword);
                if (monthNum > 0) {
                    // Extract optional year from query (e.g., "march 2026")
                    java.util.regex.Matcher yearMatcher = Pattern.compile("\\b(20\\d{2})\\b").matcher(query);
                    int yearFilter = yearMatcher.find() ? Integer.parseInt(yearMatcher.group(1)) : -1;

                    // Find releases in that month (and optionally year)
                    final int finalMonthNum = monthNum;
                    List<NlpCatalogResponse.ReleaseInfo> monthReleases = catalog.releaseDetails().stream()
                            .filter(r -> {
                                try {
                                    java.time.LocalDate d = java.time.LocalDate.parse(r.releaseDate(),
                                            java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy"));
                                    return d.getMonthValue() == finalMonthNum
                                            && (yearFilter < 0 || d.getYear() == yearFilter);
                                } catch (Exception e) { return false; }
                            })
                            .toList();

                    if (!monthReleases.isEmpty()) {
                        Map<String, Object> data = new LinkedHashMap<>();
                        data.put("_type", "LIST");
                        data.put("listType", "RELEASES");
                        for (int i = 0; i < monthReleases.size(); i++) {
                            NlpCatalogResponse.ReleaseInfo r = monthReleases.get(i);
                            data.put("Release " + (i + 1), r.name() + " — " + r.releaseDate()
                                    + " (freeze: " + r.codeFreezeDate() + ") [" + r.status() + "]");
                        }

                        String monthName = java.time.Month.of(monthNum).name();
                        monthName = monthName.charAt(0) + monthName.substring(1).toLowerCase();

                        return new NlpResult("DATA_QUERY", 0.88,
                                monthReleases.size() + " release(s) in " + monthName + ".",
                                null, null, data, "/release-calendar",
                                List.of("Go to Release Calendar"), null);
                    }
                }
            }
        }

        // "upcoming releases" / "upcoming sprints" / "upcoming deadlines"
        if (lower.contains("upcoming") || lower.contains("next")) {
            if (lower.contains("release") || lower.contains("deadline")) {
                List<NlpCatalogResponse.ReleaseInfo> upcoming = catalog.releaseDetails().stream()
                        .filter(r -> !"Released".equals(r.status()))
                        .limit(5)
                        .toList();
                if (!upcoming.isEmpty()) {
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "LIST");
                    data.put("listType", "RELEASES");
                    for (int i = 0; i < upcoming.size(); i++) {
                        NlpCatalogResponse.ReleaseInfo r = upcoming.get(i);
                        data.put("Release " + (i + 1), r.name() + " — " + r.releaseDate() + " [" + r.status() + "]");
                    }
                    return new NlpResult("DATA_QUERY", 0.85,
                            upcoming.size() + " upcoming release(s).",
                            null, null, data, "/release-calendar",
                            List.of("Go to Release Calendar"), null);
                }
            }
            if (lower.contains("sprint")) {
                List<NlpCatalogResponse.SprintInfo> upcoming = catalog.sprintDetails().stream()
                        .filter(s -> !"Completed".equals(s.status()))
                        .limit(5)
                        .toList();
                if (!upcoming.isEmpty()) {
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "LIST");
                    data.put("listType", "SPRINTS");
                    data.put("_itemType", "SPRINT");
                    data.put("_itemIds", upcoming.stream().map(NlpCatalogResponse.SprintInfo::id).toList());
                    for (int i = 0; i < upcoming.size(); i++) {
                        NlpCatalogResponse.SprintInfo s = upcoming.get(i);
                        data.put("#" + (i + 1), s.name() + " — " + s.startDate() + " to " + s.endDate() + " [" + s.status() + "]");
                    }
                    return new NlpResult("DATA_QUERY", 0.85,
                            upcoming.size() + " upcoming sprint(s).",
                            null, null, data, "/sprint-calendar",
                            List.of("Go to Sprint Calendar"), null);
                }
            }
        }

        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Risk Alerts ────────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryRiskAlerts(String query, NlpCatalogResponse catalog) {
        for (Pattern p : RISK_PATTERNS) {
            if (p.matcher(query).find()) {
                String lower = query.toLowerCase();

                // Jira priority tickets
                if (lower.contains("jira") || lower.contains("ticket") || lower.contains("issue")
                        || lower.contains("highest priority") || lower.contains("p0") || lower.contains("critical")
                        || lower.contains("urgent")) {
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "NAVIGATE_ACTION");
                    data.put("action", "View highest priority Jira tickets in the Support Queue");
                    return new NlpResult("NAVIGATE", 0.88,
                            "Opening the Jira Support Queue — you'll see tickets sorted by priority there.",
                            "/jira-support", null, data, null,
                            List.of("Show Jira POD dashboard", "Show sprint planner"), null);
                }

                // General risk health check
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "RISK_SUMMARY");

                // Count P0 projects
                long p0Count = catalog.projectDetails().stream()
                        .filter(p2 -> ("HIGHEST".equalsIgnoreCase(p2.priority()) || "BLOCKER".equalsIgnoreCase(p2.priority())) && !"COMPLETED".equalsIgnoreCase(p2.status()) && !"CANCELLED".equalsIgnoreCase(p2.status()))
                        .count();

                // Count overloaded pods (many projects, few members)
                long busyPods = catalog.podDetails().stream()
                        .filter(pod -> pod.projectCount() > 0 && pod.memberCount() > 0
                                && (double) pod.projectCount() / pod.memberCount() > 2.0)
                        .count();

                // Count unassigned projects
                long unassigned = catalog.projectDetails().stream()
                        .filter(p2 -> "None".equals(p2.assignedPods()) && !"COMPLETED".equalsIgnoreCase(p2.status()) && !"CANCELLED".equalsIgnoreCase(p2.status()))
                        .count();

                // Active projects on hold
                long onHold = catalog.projectDetails().stream()
                        .filter(p2 -> "ON_HOLD".equalsIgnoreCase(p2.status()))
                        .count();

                data.put("P0 Active Projects", String.valueOf(p0Count));
                data.put("High-Load PODs", String.valueOf(busyPods) + " (>2 projects/member)");
                data.put("Unassigned Projects", String.valueOf(unassigned));
                data.put("On Hold Projects", String.valueOf(onHold));
                data.put("Total Active Projects", String.valueOf(catalog.projectDetails().stream()
                        .filter(p2 -> "ACTIVE".equalsIgnoreCase(p2.status())).count()));

                List<String> alerts = new ArrayList<>();
                if (p0Count > 0) alerts.add(p0Count + " P0 project(s) active");
                if (busyPods > 0) alerts.add(busyPods + " overloaded pod(s)");
                if (unassigned > 0) alerts.add(unassigned + " unassigned project(s)");

                String summary = alerts.isEmpty() ? "No major red flags detected."
                        : "Found " + alerts.size() + " area(s) needing attention: " + String.join(", ", alerts) + ".";

                return new NlpResult("INSIGHT", 0.85, summary,
                        null, null, data, "/reports/project-health",
                        List.of("Show project health", "Show capacity gap", "Show hiring forecast"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Aggregation Queries ────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryAggregation(String query, NlpCatalogResponse catalog) {
        for (Pattern p : AGGREGATION_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String subject = m.group(1).trim().toLowerCase();
                Map<String, Object> data = new LinkedHashMap<>();

                // "how many active projects"
                if (subject.contains("active project")) {
                    long count = catalog.projectDetails().stream().filter(p2 -> "ACTIVE".equalsIgnoreCase(p2.status())).count();
                    data.put("Active Projects", String.valueOf(count));
                    return new NlpResult("DATA_QUERY", 0.85,
                            "There are " + count + " active project(s).",
                            null, null, data, "/projects",
                            List.of("Show all projects", "Show project health"), null);
                }

                // "how many projects"
                if (subject.contains("project")) {
                    data.put("Total Projects", String.valueOf(catalog.projectDetails().size()));
                    data.put("Active", String.valueOf(catalog.projectDetails().stream().filter(p2 -> "ACTIVE".equalsIgnoreCase(p2.status())).count()));
                    data.put("On Hold", String.valueOf(catalog.projectDetails().stream().filter(p2 -> "ON_HOLD".equalsIgnoreCase(p2.status())).count()));
                    data.put("Completed", String.valueOf(catalog.projectDetails().stream().filter(p2 -> "COMPLETED".equalsIgnoreCase(p2.status())).count()));
                    return new NlpResult("DATA_QUERY", 0.85,
                            "There are " + catalog.projectDetails().size() + " project(s) in total.",
                            null, null, data, "/projects",
                            List.of("Show all projects"), null);
                }

                // "how many tech leads", "how many QAs", "how many developers"
                String roleDetected = detectRole(subject);
                String locDetected = detectLocation(subject, catalog);
                if (roleDetected != null || locDetected != null) {
                    // Delegate to the resource analytics handler for role/location filtering
                    NlpResult analytics = tryResourceAnalytics(query, catalog);
                    if (analytics != null) return analytics;
                }

                // "how many resources / people / team members"
                if (subject.contains("resource") || subject.contains("people") || subject.contains("team member")
                        || subject.contains("member") || subject.contains("staff")) {
                    long total = catalog.resourceDetails().size();
                    Map<String, Long> byRole = catalog.resourceDetails().stream()
                            .collect(Collectors.groupingBy(NlpCatalogResponse.ResourceInfo::role, Collectors.counting()));
                    Map<String, Long> byLocation = catalog.resourceDetails().stream()
                            .collect(Collectors.groupingBy(NlpCatalogResponse.ResourceInfo::location, Collectors.counting()));

                    data.put("Total Resources", String.valueOf(total));
                    byRole.forEach((role, count) -> data.put(formatRole(role), String.valueOf(count)));
                    byLocation.forEach((loc, count) -> data.put(loc, String.valueOf(count)));

                    return new NlpResult("DATA_QUERY", 0.85,
                            "There are " + total + " active resource(s).",
                            null, null, data, "/resources",
                            List.of("Show all resources", "Show resource allocation"), null);
                }

                // "how many pods"
                if (subject.contains("pod") || subject.contains("team")) {
                    long active = catalog.podDetails().stream().filter(NlpCatalogResponse.PodInfo::active).count();
                    data.put("Total PODs", String.valueOf(catalog.podDetails().size()));
                    data.put("Active", String.valueOf(active));
                    return new NlpResult("DATA_QUERY", 0.85,
                            "There are " + catalog.podDetails().size() + " POD(s), " + active + " active.",
                            null, null, data, "/pods",
                            List.of("Show all PODs"), null);
                }

                // "how many sprints"
                if (subject.contains("sprint")) {
                    data.put("Total Sprints", String.valueOf(catalog.sprintDetails().size()));
                    data.put("Active", String.valueOf(catalog.sprintDetails().stream().filter(s -> "Active".equals(s.status())).count()));
                    data.put("Upcoming", String.valueOf(catalog.sprintDetails().stream().filter(s -> "Upcoming".equals(s.status())).count()));
                    return new NlpResult("DATA_QUERY", 0.85,
                            catalog.sprintDetails().size() + " sprint(s) total.",
                            null, null, data, "/sprint-calendar",
                            List.of("Show sprint calendar"), null);
                }

                // "list all P0 projects"
                if (subject.contains("p0") || subject.contains("highest priority") || subject.contains("critical")) {
                    List<NlpCatalogResponse.ProjectInfo> p0s = catalog.projectDetails().stream()
                            .filter(p2 -> ("HIGHEST".equalsIgnoreCase(p2.priority()) || "BLOCKER".equalsIgnoreCase(p2.priority())) && !"COMPLETED".equalsIgnoreCase(p2.status()) && !"CANCELLED".equalsIgnoreCase(p2.status()))
                            .toList();
                    data.put("_type", "LIST");
                    data.put("listType", "PROJECTS");
                    data.put("_itemType", "PROJECT");
                    data.put("_itemIds", p0s.stream().map(NlpCatalogResponse.ProjectInfo::id).toList());
                    data.put("Count", String.valueOf(p0s.size()));
                    for (int i = 0; i < p0s.size(); i++) {
                        NlpCatalogResponse.ProjectInfo proj = p0s.get(i);
                        data.put("#" + (i + 1), proj.name() + " [" + proj.priority() + "] — " + formatStatus(proj.status()) + " (Owner: " + proj.owner() + ")");
                    }
                    return new NlpResult("DATA_QUERY", 0.85,
                            p0s.size() + " P0 project(s) active.",
                            null, null, data, "/projects",
                            List.of("Show project health report"), null);
                }

                // "list all on hold"
                if (subject.contains("on hold") || subject.contains("on_hold")) {
                    List<NlpCatalogResponse.ProjectInfo> onHold = catalog.projectDetails().stream()
                            .filter(p2 -> "ON_HOLD".equalsIgnoreCase(p2.status())).toList();
                    data.put("_type", "LIST");
                    data.put("listType", "PROJECTS");
                    data.put("_itemType", "PROJECT");
                    data.put("_itemIds", onHold.stream().map(NlpCatalogResponse.ProjectInfo::id).toList());
                    data.put("Count", String.valueOf(onHold.size()));
                    for (int i = 0; i < onHold.size(); i++) {
                        data.put("#" + (i + 1), onHold.get(i).name() + " [ON_HOLD] — On Hold (Owner: " + onHold.get(i).owner() + ")");
                    }
                    return new NlpResult("DATA_QUERY", 0.85,
                            onHold.size() + " project(s) on hold.",
                            null, null, data, "/projects",
                            List.of("Show all projects"), null);
                }

                // "list all releases"
                if (subject.contains("release")) {
                    data.put("_type", "LIST");
                    data.put("listType", "RELEASES");
                    for (int i = 0; i < catalog.releaseDetails().size(); i++) {
                        NlpCatalogResponse.ReleaseInfo r = catalog.releaseDetails().get(i);
                        data.put("Release " + (i + 1), r.name() + " — " + r.releaseDate() + " [" + r.status() + "]");
                    }
                    return new NlpResult("DATA_QUERY", 0.85,
                            catalog.releaseDetails().size() + " release(s).",
                            null, null, data, "/release-calendar",
                            List.of("Show release calendar"), null);
                }
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Insight ────────────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryInsight(String query, NlpCatalogResponse catalog) {
        for (Pattern p : INSIGHT_PATTERNS) {
            if (p.matcher(query).find()) {
                String lower = query.toLowerCase();

                // ── Over-capacity PODs ──
                if (lower.contains("over capacity") || lower.contains("overloaded") || lower.contains("over-capacity")) {
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "RISK_SUMMARY");
                    if (catalog.podDetails() != null) {
                        // PODs with high project-to-member ratio or high BAU
                        var overPods = catalog.podDetails().stream()
                                .filter(pod -> pod.active() && pod.memberCount() > 0)
                                .filter(pod -> {
                                    double ratio = (double) pod.projectCount() / pod.memberCount();
                                    double bau = 0;
                                    try { bau = Double.parseDouble(pod.avgBauPct().replace("%", "")); } catch (Exception ignored) {}
                                    return ratio > 1.5 || bau > 30;
                                })
                                .toList();
                        data.put("Over-Capacity PODs", String.valueOf(overPods.size()));
                        data.put("Total Active PODs", String.valueOf(catalog.podDetails().stream().filter(NlpCatalogResponse.PodInfo::active).count()));
                        for (int i = 0; i < overPods.size(); i++) {
                            var pod = overPods.get(i);
                            double ratio = (double) pod.projectCount() / pod.memberCount();
                            data.put("#" + (i + 1), pod.name() + " — " + pod.memberCount() + " members, "
                                    + pod.projectCount() + " projects (ratio: " + String.format("%.1f", ratio)
                                    + "), BAU: " + pod.avgBauPct());
                        }
                        if (overPods.isEmpty()) {
                            data.put("Status", "All PODs are within healthy capacity ranges.");
                        }
                        return new NlpResult("INSIGHT", 0.88,
                                overPods.isEmpty() ? "All PODs are within healthy capacity ranges."
                                        : overPods.size() + " POD(s) appear to be over capacity based on project-to-member ratio and BAU allocation.",
                                null, null, data, "/reports/capacity-gap",
                                List.of("Show capacity gap report", "Show POD details", "Show hiring forecast"), null);
                    }
                    return new NlpResult("INSIGHT", 0.82, "Checking for over-capacity PODs…",
                            null, null, data, "/reports/capacity-gap",
                            List.of("Show capacity gap report", "Open sprint planner"), null);
                }

                // ── Under-utilized PODs ──
                if (lower.contains("under") || lower.contains("idle") || lower.contains("under-utilized")) {
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "RISK_SUMMARY");
                    if (catalog.podDetails() != null) {
                        var underPods = catalog.podDetails().stream()
                                .filter(pod -> pod.active() && pod.projectCount() == 0)
                                .toList();
                        data.put("Under-Utilized PODs", String.valueOf(underPods.size()));
                        for (int i = 0; i < underPods.size(); i++) {
                            var pod = underPods.get(i);
                            data.put("#" + (i + 1), pod.name() + " — " + pod.memberCount() + " members, 0 projects");
                        }
                        if (underPods.isEmpty()) {
                            data.put("Status", "All active PODs have assigned projects.");
                        }
                        return new NlpResult("INSIGHT", 0.88,
                                underPods.isEmpty() ? "All active PODs have at least one project assigned."
                                        : underPods.size() + " POD(s) have no projects assigned.",
                                null, null, data, "/reports/capacity-gap",
                                List.of("Show capacity gap report", "Show POD assignments"), null);
                    }
                }

                // ── Hiring needs ──
                if (lower.contains("hiring") || lower.contains("hire") || lower.contains("need help") || lower.contains("headcount")) {
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "RISK_SUMMARY");

                    // Check if query mentions a specific project
                    NlpCatalogResponse.ProjectInfo mentionedProject = null;
                    if (catalog.projectDetails() != null) {
                        mentionedProject = findProjectByName(query, catalog.projectDetails());
                    }

                    if (mentionedProject != null && catalog.podDetails() != null) {
                        // ── Project-specific hiring analysis ──
                        String projName = mentionedProject.name();
                        data.put("Project", projName);
                        data.put("Priority", mentionedProject.priority() != null ? mentionedProject.priority() : "–");
                        data.put("Status", mentionedProject.status() != null ? mentionedProject.status() : "–");
                        if (mentionedProject.assignedPods() != null) {
                            data.put("Assigned PODs", mentionedProject.assignedPods());
                        }

                        // Find PODs assigned to this project and analyze their capacity
                        var projectPods = catalog.podDetails().stream()
                                .filter(pod -> pod.active() && pod.projectNames() != null
                                        && pod.projectNames().stream().anyMatch(pn -> pn.equalsIgnoreCase(projName)))
                                .toList();

                        int idx = 1;
                        int totalMembers = 0;
                        int totalProjects = 0;
                        for (var pod : projectPods) {
                            totalMembers += pod.memberCount();
                            totalProjects += pod.projectCount();
                            double ratio = pod.memberCount() > 0 ? (double) pod.projectCount() / pod.memberCount() : 0;
                            String status = ratio > 2.0 ? " ⚠ strained" : ratio > 1.5 ? " ⚡ busy" : " ✓ healthy";
                            data.put("#" + idx, pod.name() + " — " + pod.memberCount() + " members, "
                                    + pod.projectCount() + " projects (BAU " + pod.avgBauPct() + ")" + status);
                            idx++;
                        }
                        data.put("Total Members (across PODs)", String.valueOf(totalMembers));
                        data.put("Total Projects (across PODs)", String.valueOf(totalProjects));

                        String msg = projectPods.isEmpty()
                                ? "No active PODs found assigned to " + projName + ". The project may not have POD assignments yet."
                                : "Capacity analysis for " + projName + ": " + projectPods.size() + " POD(s) with "
                                    + totalMembers + " total members handling " + totalProjects + " projects.";
                        return new NlpResult("INSIGHT", 0.88, msg,
                                null, null, data, "/reports/capacity-gap",
                                List.of("Show " + projName + " details", "Show capacity gap report", "Show hiring forecast"), null);
                    } else {
                        // ── General hiring needs ──
                        if (catalog.podDetails() != null) {
                            var strained = catalog.podDetails().stream()
                                    .filter(pod -> pod.active() && pod.memberCount() > 0
                                            && (double) pod.projectCount() / pod.memberCount() > 2.0)
                                    .toList();
                            data.put("PODs Needing Help", String.valueOf(strained.size()));
                            for (int i = 0; i < strained.size(); i++) {
                                var pod = strained.get(i);
                                data.put("#" + (i + 1), pod.name() + " — " + pod.projectCount()
                                        + " projects for " + pod.memberCount() + " members");
                            }
                        }
                        return new NlpResult("INSIGHT", 0.85,
                                "Here's the hiring needs analysis based on project-to-member ratios.",
                                null, null, data, "/reports/hiring-forecast",
                                List.of("Show hiring forecast", "Show all PODs"), null);
                    }
                }

                // ── At-risk projects ──
                if (lower.contains("risk") || lower.contains("at risk") || lower.contains("blocked")) {
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "RISK_SUMMARY");
                    if (catalog.projectDetails() != null) {
                        long p0Active = catalog.projectDetails().stream()
                                .filter(proj -> ("HIGHEST".equalsIgnoreCase(proj.priority()) || "BLOCKER".equalsIgnoreCase(proj.priority())) && "ACTIVE".equalsIgnoreCase(proj.status()))
                                .count();
                        long onHold = catalog.projectDetails().stream()
                                .filter(proj -> "ON_HOLD".equalsIgnoreCase(proj.status()))
                                .count();
                        long totalActive = catalog.projectDetails().stream()
                                .filter(proj -> "ACTIVE".equalsIgnoreCase(proj.status()))
                                .count();
                        data.put("P0 Active Projects", String.valueOf(p0Active));
                        data.put("On Hold Projects", String.valueOf(onHold));
                        data.put("Total Active Projects", String.valueOf(totalActive));
                        // List P0 and On-Hold projects
                        var riskProjects = catalog.projectDetails().stream()
                                .filter(proj -> ("HIGHEST".equalsIgnoreCase(proj.priority()) || "BLOCKER".equalsIgnoreCase(proj.priority())) || "ON_HOLD".equalsIgnoreCase(proj.status()))
                                .toList();
                        for (int i = 0; i < riskProjects.size(); i++) {
                            var proj = riskProjects.get(i);
                            data.put("#" + (i + 1), proj.name() + " [" + proj.priority() + "] — "
                                    + formatStatus(proj.status()) + " (Owner: " + proj.owner() + ")");
                        }
                        return new NlpResult("INSIGHT", 0.88,
                                p0Active + " P0 project(s) active, " + onHold + " project(s) on hold out of " + totalActive + " active.",
                                null, null, data, "/reports/project-health",
                                List.of("Show project health report", "Show all projects", "Show capacity gaps"), null);
                    }
                }

                // ── Generic insight fallback ──
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "RISK_SUMMARY");
                if (catalog.projectDetails() != null && catalog.podDetails() != null) {
                    long p0 = catalog.projectDetails().stream().filter(proj -> ("HIGHEST".equalsIgnoreCase(proj.priority()) || "BLOCKER".equalsIgnoreCase(proj.priority())) && "ACTIVE".equalsIgnoreCase(proj.status())).count();
                    long onHold = catalog.projectDetails().stream().filter(proj -> "ON_HOLD".equalsIgnoreCase(proj.status())).count();
                    long totalActive = catalog.projectDetails().stream().filter(proj -> "ACTIVE".equalsIgnoreCase(proj.status())).count();
                    long highLoad = catalog.podDetails().stream().filter(pod -> pod.active() && pod.memberCount() > 0
                            && (double) pod.projectCount() / pod.memberCount() > 1.5).count();
                    long unassigned = catalog.projectDetails().stream().filter(proj -> proj.assignedPods() == null || proj.assignedPods().isEmpty() || "None".equals(proj.assignedPods())).count();

                    data.put("P0 Active Projects", String.valueOf(p0));
                    data.put("High-Load PODs", String.valueOf(highLoad));
                    data.put("Unassigned Projects", String.valueOf(unassigned));
                    data.put("On Hold Projects", String.valueOf(onHold));
                    data.put("Total Active Projects", String.valueOf(totalActive));
                    return new NlpResult("INSIGHT", 0.85,
                            "System health: " + p0 + " P0 active, " + highLoad + " high-load PODs, "
                                    + onHold + " projects on hold.",
                            null, null, data, "/reports/capacity-gap",
                            List.of("Show capacity gap report", "Show hiring forecast", "Show project health"), null);
                }
                return new NlpResult("INSIGHT", 0.75, "Analyzing system health…",
                        null, null, data, "/reports/capacity-gap",
                        List.of("Show capacity gap report", "Open sprint planner"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Data Query ─────────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryDataQuery(String query, NlpCatalogResponse catalog) {
        for (Pattern p : DATA_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String podName = findMentionedEntity(query, catalog.pods());
                String projectName = findMentionedEntity(query, catalog.projects());
                Map<String, Object> context = new LinkedHashMap<>();
                if (podName != null) context.put("podName", podName);
                if (projectName != null) context.put("projectName", projectName);
                String drillDown = "/reports/capacity-gap";
                if (query.toLowerCase().contains("budget") || query.toLowerCase().contains("cost")) drillDown = "/reports/budget";
                else if (query.toLowerCase().contains("utilization")) drillDown = "/reports/utilization";
                return new NlpResult("DATA_QUERY", 0.70, "Let me look that up for you…",
                        null, null, context, drillDown, List.of("Show full report"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Help ───────────────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryHelp(String query, NlpCatalogResponse catalog) {
        for (Pattern p : HELP_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String topic = m.group(1).trim().toLowerCase();

                // Dynamic t-shirt size help using catalog data
                if (topic.contains("t-shirt") || topic.contains("tshirt") || topic.contains("t shirt")
                        || topic.contains("sizing") || topic.matches(".*\\b(xs|xl|xxl)\\b.*")) {
                    if (catalog.tshirtSizes() != null && !catalog.tshirtSizes().isEmpty()) {
                        StringBuilder sb = new StringBuilder("T-shirt sizes map to base effort hours: ");
                        for (NlpCatalogResponse.TshirtSizeInfo ts : catalog.tshirtSizes()) {
                            sb.append(ts.name()).append(" = ").append(ts.baseHours()).append("hrs, ");
                        }
                        sb.setLength(sb.length() - 2);
                        sb.append(". These hours are then multiplied by pod complexity and role effort mix to get the final demand.");
                        Map<String, Object> data = new LinkedHashMap<>();
                        data.put("_type", "COST_RATE"); // reuse the table card
                        for (NlpCatalogResponse.TshirtSizeInfo ts : catalog.tshirtSizes()) {
                            data.put(ts.name(), ts.baseHours() + " hours");
                        }
                        return new NlpResult("HELP", 0.90, sb.toString(),
                                null, null, data, "/settings/ref-data",
                                List.of("Show reference data settings", "What is an effort pattern?"), null);
                    }
                }

                for (var entry : HELP_TOPICS.entrySet()) {
                    if (topic.contains(entry.getKey())) {
                        return new NlpResult("HELP", 0.88, entry.getValue(),
                                null, null, null, null, List.of("Go to " + entry.getKey() + " settings"), null);
                    }
                }
                String route = findBestRoute(topic);
                if (route != null) {
                    String title = getPageTitle(route);
                    return new NlpResult("HELP", 0.80,
                            title + " — this page lets you view and manage " + title.toLowerCase() + " data. Navigate there to see it in action.",
                            null, null, null, null, List.of("Go to " + title), null);
                }
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Result Builders ────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════════════════
    // ── Greeting / Small Talk ───────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryGreeting(String query) {
        for (Pattern p : GREETING_PATTERNS) {
            if (p.matcher(query).matches()) {
                String lower = query.toLowerCase().trim();
                if (lower.startsWith("thank") || lower.startsWith("thx") || lower.startsWith("cheers") || lower.startsWith("appreciate")) {
                    return new NlpResult("HELP", 0.95, "You're welcome! Let me know if there's anything else I can help you with.",
                            null, null, null, null,
                            List.of("Show dashboard", "What can you do?"), null);
                }
                return new NlpResult("HELP", 0.95,
                        "Hello! I'm your Portfolio Planner AI assistant. I can help you navigate pages, look up resources/projects/pods, check sprints & releases, run risk checks, export data, and much more. What would you like to do?",
                        null, null, null, null,
                        List.of("What can you do?", "Show dashboard", "Any red flags?", "Current sprint"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Capability Discovery ────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryCapabilityDiscovery(String query) {
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
                return new NlpResult("HELP", 0.95,
                        "Here's what I can help you with — try any of the example queries below!",
                        null, null, data, null,
                        List.of("Any red flags?", "Current sprint", "Show dashboard", "How many active projects?"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Project Filters (by owner, status, priority) ────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryProjectFilters(String query, NlpCatalogResponse catalog) {
        if (catalog.projectDetails() == null || catalog.projectDetails().isEmpty()) return null;
        String lower = query.toLowerCase();

        // ── By owner: "John's projects", "projects owned by Sarah", "projects under BD" ──
        for (int i = 0; i < 3; i++) {
            if (i < PROJECT_FILTER_PATTERNS.size()) {
                Matcher m = PROJECT_FILTER_PATTERNS.get(i).matcher(query);
                if (m.find()) {
                    String ownerFragment = m.group(1).trim();
                    // Try owner match first
                    List<NlpCatalogResponse.ProjectInfo> ownerProjects = catalog.projectDetails().stream()
                            .filter(p -> p.owner().toLowerCase().contains(ownerFragment.toLowerCase()))
                            .toList();

                    if (!ownerProjects.isEmpty()) {
                        Map<String, Object> data = new LinkedHashMap<>();
                        data.put("_type", "LIST");
                        data.put("listType", "PROJECTS");
                        data.put("_itemType", "PROJECT");
                        data.put("_itemIds", ownerProjects.stream().map(NlpCatalogResponse.ProjectInfo::id).toList());
                        data.put("Owner", ownerProjects.get(0).owner());
                        data.put("Count", String.valueOf(ownerProjects.size()));
                        for (int j = 0; j < ownerProjects.size(); j++) {
                            NlpCatalogResponse.ProjectInfo p = ownerProjects.get(j);
                            data.put("#" + (j + 1), p.name() + " [" + p.priority() + "] — " + formatStatus(p.status()));
                        }
                        return new NlpResult("DATA_QUERY", 0.88,
                                ownerProjects.get(0).owner() + " owns " + ownerProjects.size() + " project(s).",
                                null, null, data, "/projects",
                                List.of("Show project health report"), null);
                    }

                    // Fallback: "under" might mean pod name — find projects assigned to that pod
                    if (catalog.podDetails() != null) {
                        NlpCatalogResponse.PodInfo pod = findPodByName(ownerFragment, catalog.podDetails());
                        if (pod != null && !pod.projectNames().isEmpty()) {
                            List<NlpCatalogResponse.ProjectInfo> podProjects = catalog.projectDetails().stream()
                                    .filter(p -> pod.projectNames().stream()
                                            .anyMatch(pn -> pn.equalsIgnoreCase(p.name())))
                                    .toList();
                            if (!podProjects.isEmpty()) {
                                Map<String, Object> data = new LinkedHashMap<>();
                                data.put("_type", "LIST");
                                data.put("listType", "PROJECTS");
                                data.put("_itemType", "PROJECT");
                                data.put("_itemIds", podProjects.stream().map(NlpCatalogResponse.ProjectInfo::id).toList());
                                data.put("Pod", pod.name());
                                data.put("Count", String.valueOf(podProjects.size()));
                                for (int j = 0; j < podProjects.size(); j++) {
                                    NlpCatalogResponse.ProjectInfo p = podProjects.get(j);
                                    data.put("#" + (j + 1), p.name() + " [" + p.priority() + "] — " + formatStatus(p.status()) + " (Owner: " + p.owner() + ")");
                                }
                                return new NlpResult("DATA_QUERY", 0.88,
                                        pod.name() + " pod has " + podProjects.size() + " project(s).",
                                        null, null, data, "/projects",
                                        List.of("Show " + pod.name() + " pod details"), null);
                            }
                        }
                    }
                }
            }
        }

        // ── By status: "show active projects", "which projects are on hold" ──
        for (int i = 3; i < 5; i++) {
            if (i < PROJECT_FILTER_PATTERNS.size()) {
                Matcher m = PROJECT_FILTER_PATTERNS.get(i).matcher(query);
                if (m.find()) {
                    String statusText = m.group(1).trim().toUpperCase().replaceAll("[\\s\\-]", "_");
                    List<NlpCatalogResponse.ProjectInfo> filtered = catalog.projectDetails().stream()
                            .filter(p -> p.status().equalsIgnoreCase(statusText))
                            .toList();

                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "LIST");
                    data.put("listType", "PROJECTS");
                    data.put("_itemType", "PROJECT");
                    data.put("_itemIds", filtered.stream().map(NlpCatalogResponse.ProjectInfo::id).toList());
                    data.put("Status Filter", formatStatus(statusText));
                    data.put("Count", String.valueOf(filtered.size()));
                    for (int j = 0; j < filtered.size(); j++) {
                        NlpCatalogResponse.ProjectInfo p = filtered.get(j);
                        data.put("#" + (j + 1), p.name() + " [" + p.priority() + "] — " + formatStatus(p.status()) + " (Owner: " + p.owner() + ")");
                    }
                    return new NlpResult("DATA_QUERY", 0.88,
                            filtered.size() + " " + formatStatus(statusText).toLowerCase() + " project(s).",
                            null, null, data, "/projects",
                            List.of("Show all projects", "Show project health"), null);
                }
            }
        }

        // ── By priority: "show P0 projects", "P1 projects" ──────────────
        for (int i = 5; i < PROJECT_FILTER_PATTERNS.size(); i++) {
            Matcher m = PROJECT_FILTER_PATTERNS.get(i).matcher(query);
            if (m.find()) {
                String priority = m.group(1).trim().toUpperCase();
                List<NlpCatalogResponse.ProjectInfo> filtered = catalog.projectDetails().stream()
                        .filter(p -> p.priority().equalsIgnoreCase(priority) && !"COMPLETED".equalsIgnoreCase(p.status()) && !"CANCELLED".equalsIgnoreCase(p.status()))
                        .toList();

                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "LIST");
                data.put("listType", "PROJECTS");
                data.put("_itemType", "PROJECT");
                data.put("_itemIds", filtered.stream().map(NlpCatalogResponse.ProjectInfo::id).toList());
                data.put("Priority Filter", priority);
                data.put("Count", String.valueOf(filtered.size()));
                for (int j = 0; j < filtered.size(); j++) {
                    NlpCatalogResponse.ProjectInfo p = filtered.get(j);
                    data.put("#" + (j + 1), p.name() + " [" + p.priority() + "] — " + formatStatus(p.status()) + " (Owner: " + p.owner() + ")");
                }
                return new NlpResult("DATA_QUERY", 0.88,
                        filtered.size() + " " + priority + " project(s) active.",
                        null, null, data, "/projects",
                        List.of("Show project health report"), null);
            }
        }

        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── BAU Queries ─────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryBauQueries(String query, NlpCatalogResponse catalog) {
        for (Pattern p : BAU_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                // "BAU for API pod"
                if (m.groupCount() >= 1) {
                    String podName = m.group(1).trim();
                    NlpCatalogResponse.PodInfo pod = findPodByName(podName, catalog.podDetails());
                    if (pod != null) {
                        Map<String, Object> data = new LinkedHashMap<>();
                        data.put("_type", "POD_PROFILE");
                        data.put("Name", pod.name());
                        data.put("Members", String.valueOf(pod.memberCount()));
                        data.put("Projects", String.valueOf(pod.projectCount()));
                        data.put("Avg BAU", pod.avgBauPct());
                        data.put("Active", pod.active() ? "Yes" : "No");
                        if (!pod.members().isEmpty()) data.put("Team", String.join(", ", pod.members()));
                        return new NlpResult("DATA_QUERY", 0.88,
                                pod.name() + " pod has an average BAU of " + pod.avgBauPct() + ".",
                                null, null, data, "/pods",
                                List.of("Show all PODs", "Show capacity gap"), null);
                    }
                }

                // General BAU overview
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "LIST");
                data.put("listType", "PODS");
                for (NlpCatalogResponse.PodInfo pod : catalog.podDetails()) {
                    if (pod.active()) {
                        data.put(pod.name() + " POD", "Avg BAU: " + pod.avgBauPct() + " (" + pod.memberCount() + " members)");
                    }
                }
                return new NlpResult("DATA_QUERY", 0.85,
                        "BAU breakdown by POD:",
                        null, null, data, "/pods",
                        List.of("Show all PODs", "What is BAU?"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Jira Search Queries ──────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryJiraSearch(String query, NlpCatalogResponse catalog) {
        for (Pattern p : JIRA_SEARCH_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                // Delegate to LLM — Jira searches need the search_jira_issues tool
                return null; // Let LLM handle with tool calling
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Jira Contributor Queries ──────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryJiraContributors(String query) {
        if (jiraToolExecutor == null) return null;

        for (Pattern p : JIRA_CONTRIBUTOR_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String issueKey = m.group(1).toUpperCase();
                try {
                    Map<String, Object> result = jiraToolExecutor.getIssueContributors(issueKey);
                    if (result != null) {
                        String summary = jiraToolExecutor.summarizeContributors(result);
                        return new NlpResult("DATA_QUERY", 0.92, summary,
                                null, null, result, "/reports/jira-analytics",
                                List.of("Show full details for " + issueKey,
                                        "Show worklog page",
                                        "Show Jira analytics", null), null);
                    }
                } catch (Exception e) {
                    return new NlpResult("DATA_QUERY", 0.80,
                            "Could not find contributor data for " + issueKey + ". The issue may not be synced yet.",
                            null, null, null, null,
                            List.of("Look up " + issueKey, "Check Jira sync status"), null);
                }
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Jira Bug Summary ─────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryJiraBugSummary(String query) {
        for (Pattern p : JIRA_BUG_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Jira Analytics — Bug Summary");
                data.put("route", "/reports/jira-analytics");
                return new NlpResult("NAVIGATE", 0.88,
                        "Opening Jira Analytics where you can see the bug summary including open bugs by priority, creation trend, and resolution time.",
                        "/reports/jira-analytics", null, data, null,
                        List.of("Show Jira sprint health", "Show support queue", "Show project health"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Jira Sprint Health ───────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryJiraSprintHealth(String query) {
        for (Pattern p : JIRA_SPRINT_HEALTH_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Sprint Planner — Health Check");
                data.put("route", "/sprint-planner");
                return new NlpResult("NAVIGATE", 0.88,
                        "Opening the Sprint Planning Recommender where you can see sprint health metrics including completion rate, velocity, blocked stories, and burndown.",
                        "/sprint-planner", null, data, null,
                        List.of("Show Jira analytics", "Show bug summary", "Show sprint calendar"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Jira Workload ────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryJiraWorkload(String query) {
        for (Pattern p : JIRA_WORKLOAD_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Jira Analytics — Workload");
                data.put("route", "/reports/jira-analytics");
                return new NlpResult("NAVIGATE", 0.88,
                        "Opening Jira Analytics where you can see workload distribution — who has the most tickets, in-progress items, and story points assigned.",
                        "/reports/jira-analytics", null, data, null,
                        List.of("Show Jira bug summary", "Show sprint health", "Show resource allocation"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Jira Analytics ───────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryJiraAnalytics(String query) {
        for (Pattern p : JIRA_ANALYTICS_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Jira Analytics");
                data.put("route", "/reports/jira-analytics");
                return new NlpResult("NAVIGATE", 0.88,
                        "Opening the Jira Analytics dashboard where you can see issue trends, created vs resolved, cycle time, and more.",
                        "/reports/jira-analytics", null, data, null,
                        List.of("Show bug summary", "Show workload", "Show sprint health"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── DORA Metrics ─────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryDoraMetrics(String query) {
        for (Pattern p : DORA_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "DORA Metrics");
                data.put("route", "/reports/dora-metrics");
                return new NlpResult("NAVIGATE", 0.90,
                        "Opening the DORA Metrics dashboard — Deployment Frequency, Lead Time for Changes, Change Failure Rate, and Mean Time to Recovery.",
                        "/reports/dora-metrics", null, data, null,
                        List.of("What are DORA metrics?", "Show Jira analytics", "Show project health"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Utilization ──────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryUtilization(String query) {
        for (Pattern p : UTILIZATION_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Utilization Heatmap");
                data.put("route", "/reports/utilization");
                return new NlpResult("NAVIGATE", 0.88,
                        "Opening the Utilization Heatmap — see who is over or under-utilized by pod, role, and month.",
                        "/reports/utilization", null, data, null,
                        List.of("Show capacity gap", "Show hiring forecast", "Show resource allocation"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Capacity vs Demand ───────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryCapacityDemand(String query) {
        for (Pattern p : CAPACITY_DEMAND_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Capacity vs Demand");
                data.put("route", "/reports/capacity-demand");
                return new NlpResult("NAVIGATE", 0.88,
                        "Opening the Capacity vs Demand report — see supply, demand, and gaps across pods and months.",
                        "/reports/capacity-demand", null, data, null,
                        List.of("Show capacity gap", "Show utilization heatmap", "Show hiring forecast"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Hiring Forecast ──────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryHiringForecast(String query) {
        for (Pattern p : HIRING_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Hiring Forecast");
                data.put("route", "/reports/hiring-forecast");
                return new NlpResult("NAVIGATE", 0.88,
                        "Opening the Hiring Forecast — see upcoming capacity shortfalls by role and location, with recommendations on when and what to hire.",
                        "/reports/hiring-forecast", null, data, null,
                        List.of("Show capacity gap", "Show utilization heatmap", "Do we need to hire?"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Concurrency Risk ─────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryConcurrencyRisk(String query) {
        for (Pattern p : CONCURRENCY_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Concurrency Risk");
                data.put("route", "/reports/concurrency");
                return new NlpResult("NAVIGATE", 0.88,
                        "Opening the Concurrency Risk report — see which pods or resources are double-booked or have conflicting allocations.",
                        "/reports/concurrency", null, data, null,
                        List.of("Show resource allocation", "Show capacity demand", "Show project dependencies"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Project Gantt ────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryGantt(String query) {
        for (Pattern p : GANTT_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Project Gantt Chart");
                data.put("route", "/reports/gantt");
                return new NlpResult("NAVIGATE", 0.90,
                        "Opening the Project Gantt Chart — a visual timeline of all projects showing start dates, durations, and overlaps.",
                        "/reports/gantt", null, data, null,
                        List.of("Show project health", "Show cross-pod dependencies", "Show deadline gap"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Owner Demand ─────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryOwnerDemand(String query) {
        for (Pattern p : OWNER_DEMAND_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Owner Demand");
                data.put("route", "/reports/owner-demand");
                return new NlpResult("NAVIGATE", 0.88,
                        "Opening the Owner Demand report — see how project demand is distributed across project owners.",
                        "/reports/owner-demand", null, data, null,
                        List.of("Show project health", "List all projects", "Show capacity demand"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Slack Buffer ─────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult trySlackBuffer(String query) {
        for (Pattern p : SLACK_BUFFER_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Slack / Buffer Analysis");
                data.put("route", "/reports/slack-buffer");
                return new NlpResult("NAVIGATE", 0.88,
                        "Opening the Slack/Buffer Analysis — see how much breathing room each pod has between capacity and demand.",
                        "/reports/slack-buffer", null, data, null,
                        List.of("Show capacity gap", "Show utilization heatmap", "Show pod capacity"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── CapEx / OpEx ─────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryCapexOpex(String query) {
        for (Pattern p : CAPEX_OPEX_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "CapEx / OpEx Report");
                data.put("route", "/jira-capex");
                return new NlpResult("NAVIGATE", 0.88,
                        "Opening the CapEx/OpEx report — see how Jira work hours are classified as capital vs operating expenditure.",
                        "/jira-capex", null, data, null,
                        List.of("What is CapEx?", "Show budget report", "Show Jira worklog"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Pod Capacity ─────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryPodCapacity(String query) {
        for (Pattern p : POD_CAPACITY_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Pod Capacity");
                data.put("route", "/reports/pod-capacity");
                return new NlpResult("NAVIGATE", 0.88,
                        "Opening the Pod Capacity report — see which pods are over or under capacity.",
                        "/reports/pod-capacity", null, data, null,
                        List.of("Show capacity gap", "Show utilization heatmap", "Show hiring forecast"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Dashboard / Overview ─────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryDashboardOverview(String query) {
        for (Pattern p : DASHBOARD_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("page", "Dashboard");
                data.put("route", "/");
                return new NlpResult("NAVIGATE", 0.85,
                        "Opening the Dashboard — your central hub for portfolio overview, key metrics, and quick navigation.",
                        "/", null, data, null,
                        List.of("Show project health", "Show capacity gap", "Any risks?"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Override / Temp Allocation Queries ───────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryOverrideQueries(String query, NlpCatalogResponse catalog) {
        for (Pattern p : OVERRIDE_PATTERNS) {
            if (p.matcher(query).find()) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("action", "View temporary overrides and allocations");
                return new NlpResult("NAVIGATE", 0.85,
                        "Opening the Temporary Overrides page — you can view and manage temp allocations there.",
                        "/overrides", null, data, null,
                        List.of("Show resources", "Show availability grid"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Budget / Cost Queries ───────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryBudgetQueries(String query, NlpCatalogResponse catalog) {
        for (Pattern p : BUDGET_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String lower = query.toLowerCase();

                // "cost of project X" / "budget for project X"
                if (m.groupCount() >= 1 && m.group(1) != null) {
                    String projName = m.group(1).trim();
                    NlpCatalogResponse.ProjectInfo proj = findProjectByName(projName, catalog.projectDetails());
                    if (proj != null) {
                        Map<String, Object> data = new LinkedHashMap<>();
                        data.put("_type", "NAVIGATE_ACTION");
                        data.put("action", "View budget breakdown for " + proj.name());
                        return new NlpResult("NAVIGATE", 0.85,
                                "Opening the Budget report — you can see cost breakdown for " + proj.name() + " and other projects there.",
                                "/reports/budget", null, data, null,
                                List.of("Show " + proj.name() + " details", "Show all projects"), null);
                    }
                }

                // General budget queries → navigate to budget report
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "NAVIGATE_ACTION");
                data.put("action", "View budget report with cost breakdown by project and POD");
                return new NlpResult("NAVIGATE", 0.85,
                        "Opening the Budget & Cost report — it shows project costs by pod, role, and month.",
                        "/reports/budget", null, data, null,
                        List.of("Show project health", "Export budget as CSV"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Cost Rate Lookups ───────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryCostRateLookup(String query, NlpCatalogResponse catalog) {
        if (catalog.costRates() == null || catalog.costRates().isEmpty()) return null;

        for (Pattern p : COST_RATE_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String lower = query.toLowerCase();
                String detectedRole = detectRole(lower);
                String detectedLocation = detectLocation(lower, catalog);

                // Specific role+location: "rate for developer in India"
                if (detectedRole != null || detectedLocation != null) {
                    var filtered = catalog.costRates().stream();
                    String filterDesc = "";

                    if (detectedRole != null) {
                        String role = detectedRole;
                        filtered = filtered.filter(cr -> AliasResolver.matchesField(cr.role(), role));
                        filterDesc += formatRole(detectedRole);
                    }
                    if (detectedLocation != null) {
                        String loc = detectedLocation.toUpperCase();
                        filtered = filtered.filter(cr -> AliasResolver.matchesField(cr.location(), loc));
                        filterDesc += (filterDesc.isEmpty() ? "" : " in ") + detectedLocation;
                    }

                    List<NlpCatalogResponse.CostRateInfo> matches = filtered.toList();
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "COST_RATE");
                    data.put("Filter", filterDesc);
                    for (var cr : matches) {
                        data.put(formatRole(cr.role()) + " (" + cr.location() + ")", cr.hourlyRate());
                    }

                    String summary = matches.isEmpty()
                            ? "No cost rates found for " + filterDesc + "."
                            : matches.size() == 1
                                ? "The billing rate for " + filterDesc + " is " + matches.get(0).hourlyRate() + "."
                                : matches.size() + " rate(s) found for " + filterDesc + ".";

                    return new NlpResult("DATA_QUERY", 0.88, summary,
                            null, null, data, "/settings/ref-data",
                            List.of("Show all cost rates", "Show resource ROI"), null);
                }

                // General: "show all cost rates" / "rate card"
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "COST_RATE");
                data.put("Filter", "All Roles & Locations");
                for (var cr : catalog.costRates()) {
                    data.put(formatRole(cr.role()) + " (" + cr.location() + ")", cr.hourlyRate());
                }
                return new NlpResult("DATA_QUERY", 0.85,
                        "Here are all configured billing rates:",
                        null, null, data, "/settings/ref-data",
                        List.of("Show resource ROI", "Average billing of developers"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Jira-Specific Queries ───────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryJiraSpecific(String query, NlpCatalogResponse catalog) {
        for (Pattern p : JIRA_SPECIFIC_PATTERNS) {
            Matcher m = p.matcher(query);
            if (m.find()) {
                String lower = query.toLowerCase();

                // "capex report", "opex breakdown"
                if (lower.contains("capex") || lower.contains("opex")) {
                    return new NlpResult("NAVIGATE", 0.88,
                            "Opening the Jira CapEx/OpEx report.",
                            "/jira-capex", null,
                            Map.of("_type", "NAVIGATE_ACTION", "action", "View CapEx/OpEx report"),
                            null, List.of("Show budget report", "Show Jira POD dashboard"), null);
                }

                // "worklog summary", "time tracking"
                if (lower.contains("worklog") || lower.contains("time tracking") || lower.contains("time spent")) {
                    return new NlpResult("NAVIGATE", 0.88,
                            "Opening the Jira Worklog report.",
                            "/jira-worklog", null,
                            Map.of("_type", "NAVIGATE_ACTION", "action", "View worklog and time tracking"),
                            null, List.of("Show Jira actuals", "Show Jira POD dashboard"), null);
                }

                // "jira actuals"
                if (lower.contains("actual")) {
                    return new NlpResult("NAVIGATE", 0.88,
                            "Opening Jira Actuals — logged hours vs planned.",
                            "/jira-actuals", null,
                            Map.of("_type", "NAVIGATE_ACTION", "action", "View Jira actuals"),
                            null, List.of("Show worklog", "Show budget report"), null);
                }

                // "jira dashboard for API pod"
                if (m.groupCount() >= 1 && m.group(1) != null) {
                    String podName = m.group(1).trim();
                    NlpCatalogResponse.PodInfo pod = findPodByName(podName, catalog.podDetails());
                    String msg = pod != null
                            ? "Opening Jira POD Dashboard — you can filter for " + pod.name() + " there."
                            : "Opening Jira POD Dashboard.";
                    return new NlpResult("NAVIGATE", 0.85, msg,
                            "/jira-pods", null,
                            Map.of("_type", "NAVIGATE_ACTION", "action", "View Jira POD dashboard"),
                            null, List.of("Show sprint planner", "Show support queue"), null);
                }
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Scenario / What-If ──────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryScenario(String query) {
        for (Pattern p : SCENARIO_PATTERNS) {
            if (p.matcher(query).find()) {
                String lower = query.toLowerCase();
                String route = lower.contains("timeline") ? "/simulator/timeline" : "/simulator/scenario";
                String label = lower.contains("timeline") ? "Timeline Simulator" : "Scenario Simulator";
                return new NlpResult("NAVIGATE", 0.85,
                        "Opening the " + label + " — you can model changes and compare outcomes without affecting live data.",
                        route, null,
                        Map.of("_type", "NAVIGATE_ACTION", "action", "Open " + label),
                        null, List.of("What is a scenario?", "Show capacity gap"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Audit Log ───────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpResult tryAuditLog(String query) {
        for (Pattern p : AUDIT_PATTERNS) {
            if (p.matcher(query).find()) {
                return new NlpResult("NAVIGATE", 0.85,
                        "Opening the Audit Log — it tracks all changes made across the system.",
                        "/settings/audit-log", null,
                        Map.of("_type", "NAVIGATE_ACTION", "action", "View audit trail"),
                        null, List.of("Show dashboard", "Any red flags?"), null);
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Resource Analytics (billing, capacity, role/location breakdowns) ──
    // ════════════════════════════════════════════════════════════════════════
    // ── Location-based team queries ──────────────────────────────────────────
    // Handles: "India team details", "US team", "give me India resources",
    //          "offshore team members", "show me the India team"
    private NlpResult tryLocationTeamQuery(String query, NlpCatalogResponse catalog) {
        if (catalog.resourceDetails() == null || catalog.resourceDetails().isEmpty()) return null;
        String lower = query.toLowerCase();

        // Patterns: "<location> team/resources/people/members", "give me <location> team details"
        boolean isLocationTeamQuery = lower.matches(".*\\b(?:india|us|usa|offshore|onshore|houston|domestic)\\b.*\\b(?:team|people|resources?|members?|staff|details?)\\b.*")
                || lower.matches(".*\\b(?:team|people|resources?|members?|staff|details?)\\b.*\\b(?:india|us|usa|offshore|onshore|houston|domestic)\\b.*");

        if (!isLocationTeamQuery) return null;

        String detectedLocation = detectLocation(lower, catalog);
        if (detectedLocation == null) return null;

        String detectedRole = detectRole(lower);

        var filtered = catalog.resourceDetails().stream()
                .filter(r -> AliasResolver.matchesField(r.location(), detectedLocation));
        if (detectedRole != null) {
            String role = detectedRole;
            filtered = filtered.filter(r -> AliasResolver.matchesField(r.role(), role));
        }

        List<NlpCatalogResponse.ResourceInfo> matches = filtered.toList();
        if (matches.isEmpty()) {
            return new NlpResult("DATA_QUERY", 0.85,
                    "No resources found in " + detectedLocation + ".",
                    null, null, Map.of("_type", "LIST", "listType", "RESOURCES", "Count", "0"),
                    "/resources", List.of("Show all resources"), null);
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "LIST");
        data.put("listType", "RESOURCES");
        data.put("Location", detectedLocation);
        if (detectedRole != null) data.put("Role", formatRole(detectedRole));
        data.put("Count", String.valueOf(matches.size()));

        // Role breakdown
        Map<String, Long> byRole = matches.stream()
                .collect(Collectors.groupingBy(NlpCatalogResponse.ResourceInfo::role, Collectors.counting()));
        StringBuilder roleSummary = new StringBuilder();
        byRole.forEach((role, cnt) -> {
            if (roleSummary.length() > 0) roleSummary.append(", ");
            roleSummary.append(cnt).append(" ").append(formatRole(role)).append("(s)");
        });
        data.put("Role Breakdown", roleSummary.toString());

        // POD breakdown
        Map<String, Long> byPod = matches.stream()
                .filter(r -> r.podName() != null)
                .collect(Collectors.groupingBy(NlpCatalogResponse.ResourceInfo::podName, Collectors.counting()));
        StringBuilder podSummary = new StringBuilder();
        byPod.forEach((pod, cnt) -> {
            if (podSummary.length() > 0) podSummary.append(", ");
            podSummary.append(pod).append(": ").append(cnt);
        });
        if (podSummary.length() > 0) data.put("POD Distribution", podSummary.toString());

        // FTE totals
        double totalFte = 0;
        for (var r : matches) {
            try { totalFte += Double.parseDouble(r.fte()); } catch (Exception ignored) {}
        }
        data.put("Total FTE", String.format("%.1f", totalFte));

        // List each resource with role/pod info
        for (int idx = 0; idx < matches.size(); idx++) {
            var r = matches.get(idx);
            String podName = r.podName() != null ? r.podName() : "Unassigned";
            data.put("#" + (idx + 1), r.name() + " — " + formatRole(r.role()) + " · " + podName);
        }

        String filterDesc = detectedLocation + (detectedRole != null ? " " + formatRole(detectedRole) + "(s)" : " team");
        return new NlpResult("DATA_QUERY", 0.90,
                "The " + filterDesc + " has " + matches.size() + " member(s): " + roleSummary + ".",
                null, null, data, "/resources",
                List.of("Show " + detectedLocation + " billing rates", "Show all resources", "Show POD assignments"), null);
    }

    private NlpResult tryResourceAnalytics(String query, NlpCatalogResponse catalog) {
        if (catalog.resourceDetails() == null || catalog.resourceDetails().isEmpty()) return null;
        String lower = query.toLowerCase();

        // Detect role and location from the query
        String detectedRole = detectRole(lower);
        String detectedLocation = detectLocation(lower, catalog);

        // ── Average billing rate queries ────────────────────────────────
        if (lower.contains("average") || lower.contains("avg") || lower.contains("mean") || lower.contains("billing") || lower.contains("rate") || lower.contains("cost")) {
            if ((lower.contains("billing") || lower.contains("rate") || lower.contains("cost")) &&
                (detectedRole != null || detectedLocation != null)) {

                var filtered = catalog.resourceDetails().stream();
                String filterDesc = "";

                if (detectedRole != null) {
                    String roleUpper = detectedRole;
                    filtered = filtered.filter(r -> AliasResolver.matchesField(r.role(), roleUpper));
                    filterDesc += formatRole(detectedRole);
                }
                if (detectedLocation != null) {
                    String loc = detectedLocation;
                    filtered = filtered.filter(r -> AliasResolver.matchesField(r.location(), loc));
                    filterDesc += (filterDesc.isEmpty() ? "" : " in ") + detectedLocation;
                }

                List<NlpCatalogResponse.ResourceInfo> matches = filtered.toList();
                if (matches.isEmpty()) {
                    return new NlpResult("DATA_QUERY", 0.80,
                            "No resources found matching " + filterDesc + ".",
                            null, null, Map.of(), "/resources", List.of("Show all resources"), null);
                }

                // Parse billing rates and compute average
                double sum = 0; int count = 0;
                for (var r : matches) {
                    String rateStr = r.billingRate().replaceAll("[^\\d.]", "");
                    try { sum += Double.parseDouble(rateStr); count++; } catch (Exception ignored) {}
                }

                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "RESOURCE_ANALYTICS");
                data.put("Filter", filterDesc);
                data.put("Matching Resources", String.valueOf(matches.size()));
                if (count > 0) {
                    double avg = sum / count;
                    data.put("Average Billing Rate", String.format("$%.2f/hr", avg));
                    data.put("Min Rate", matches.stream()
                            .map(r -> r.billingRate().replaceAll("[^\\d.]", ""))
                            .filter(s -> !s.isEmpty())
                            .mapToDouble(Double::parseDouble).min().stream()
                            .mapToObj(d -> String.format("$%.2f/hr", d)).findFirst().orElse("N/A"));
                    data.put("Max Rate", matches.stream()
                            .map(r -> r.billingRate().replaceAll("[^\\d.]", ""))
                            .filter(s -> !s.isEmpty())
                            .mapToDouble(Double::parseDouble).max().stream()
                            .mapToObj(d -> String.format("$%.2f/hr", d)).findFirst().orElse("N/A"));
                }
                // List the individual resources
                for (var r : matches) {
                    data.put(r.name(), r.billingRate() + " (" + r.location() + ")");
                }

                return new NlpResult("DATA_QUERY", 0.88,
                        count > 0 ? "Average billing rate for " + filterDesc + " is " + String.format("$%.2f/hr", sum / count) + " across " + matches.size() + " resource(s)."
                                  : "Found " + matches.size() + " resource(s) matching " + filterDesc + " but no billing rates available.",
                        null, null, data, "/resources",
                        List.of("Show all resources", "Show resource ROI"), null);
            }
        }

        // ── Capacity / headcount by role/location ───────────────────────
        if (lower.contains("capacity") || lower.contains("headcount") || lower.contains("head count")
                || lower.contains("breakdown") || lower.contains("distribution")) {
            if (detectedRole != null || detectedLocation != null) {
                var filtered = catalog.resourceDetails().stream();
                String filterDesc = "";

                if (detectedRole != null) {
                    String roleUpper = detectedRole;
                    filtered = filtered.filter(r -> AliasResolver.matchesField(r.role(), roleUpper));
                    filterDesc += formatRole(detectedRole);
                }
                if (detectedLocation != null) {
                    String loc = detectedLocation;
                    filtered = filtered.filter(r -> AliasResolver.matchesField(r.location(), loc));
                    filterDesc += (filterDesc.isEmpty() ? "" : " in ") + detectedLocation;
                }

                List<NlpCatalogResponse.ResourceInfo> matches = filtered.toList();
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("_type", "RESOURCE_ANALYTICS");
                data.put("Filter", filterDesc);
                data.put("Total Count", String.valueOf(matches.size()));

                // FTE breakdown
                double totalFte = 0;
                for (var r : matches) {
                    try { totalFte += Double.parseDouble(r.fte()); } catch (Exception ignored) {}
                }
                data.put("Total FTE", String.format("%.1f", totalFte));

                // By POD breakdown
                Map<String, Long> byPod = matches.stream()
                        .collect(Collectors.groupingBy(r -> r.podName() != null ? r.podName() : "Unassigned", Collectors.counting()));
                byPod.forEach((pod, cnt) -> data.put("POD: " + pod, cnt + " resource(s)"));

                // If role not specified, show role breakdown
                if (detectedRole == null) {
                    Map<String, Long> byRole = matches.stream()
                            .collect(Collectors.groupingBy(NlpCatalogResponse.ResourceInfo::role, Collectors.counting()));
                    byRole.forEach((role, cnt) -> data.put(formatRole(role), cnt + " resource(s)"));
                }

                // If location not specified, show location breakdown
                if (detectedLocation == null) {
                    Map<String, Long> byLoc = matches.stream()
                            .collect(Collectors.groupingBy(NlpCatalogResponse.ResourceInfo::location, Collectors.counting()));
                    byLoc.forEach((loc, cnt) -> data.put(loc, cnt + " resource(s)"));
                }

                return new NlpResult("DATA_QUERY", 0.88,
                        matches.size() + " " + filterDesc + " resource(s) with total FTE of " + String.format("%.1f", totalFte) + ".",
                        null, null, data, "/resources",
                        List.of("Show all resources", "Show availability grid"), null);
            }
        }

        // ── "how many people in India", "how many QAs", "how many tech leads in Houston" ──
        // ── Also: "list all tech leads", "show all QAs", "who are the developers" ──
        if (lower.matches("(?i).*(?:how many|total|count|number of)\\s+(?:people|resources?|members?|devs?|developers?|qas?|bsas?|tech leads?)\\s+(?:in|at|from)\\s+.+")
            || (lower.matches("(?i).*(?:how many|total|count|number of)\\s+.+") && (detectedRole != null || detectedLocation != null))
            || (lower.matches("(?i).*(?:list|show|display|give|get|who are)\\s+(?:all\\s+)?(?:the\\s+)?(?:devs?|developers?|qas?|bsas?|tech leads?).*") && detectedRole != null)) {

            var filtered = catalog.resourceDetails().stream();
            List<String> filters = new ArrayList<>();

            if (detectedRole != null) {
                String roleUpper = detectedRole;
                filtered = filtered.filter(r -> AliasResolver.matchesField(r.role(), roleUpper));
                filters.add(formatRole(detectedRole) + "(s)");
            } else {
                filters.add("resource(s)");
            }
            if (detectedLocation != null) {
                String loc = detectedLocation;
                filtered = filtered.filter(r -> r.location() != null
                        && (r.location().equalsIgnoreCase(loc)
                            || r.location().toLowerCase().contains(loc.toLowerCase())
                            || loc.toLowerCase().contains(r.location().toLowerCase())));
                filters.add("in " + detectedLocation);
            }

            List<NlpCatalogResponse.ResourceInfo> matches = filtered.toList();
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("_type", "LIST");
            data.put("listType", "RESOURCES");
            data.put("_itemType", "RESOURCE");
            data.put("_itemIds", matches.stream().map(NlpCatalogResponse.ResourceInfo::id).toList());
            String filterDesc = String.join(" ", filters);
            data.put("Filter", filterDesc);
            data.put("Count", String.valueOf(matches.size()));

            // Show as numbered list with role and POD info
            for (int idx = 0; idx < matches.size(); idx++) {
                var r = matches.get(idx);
                String podName = r.podName() != null ? r.podName() : "Unassigned";
                data.put("#" + (idx + 1), r.name() + " — " + formatRole(r.role()) + " · " + podName + " · " + r.location());
            }

            return new NlpResult("DATA_QUERY", 0.88,
                    "There are " + matches.size() + " " + filterDesc + ".",
                    null, null, data, "/resources",
                    List.of("Show all resources", "Show resource allocation"), null);
        }

        return null;
    }

    /**
     * Detect role from query text using centralized AliasResolver.
     * Returns canonical DB enum value (DEVELOPER, QA, BSA, TECH_LEAD) or null.
     */
    private String detectRole(String lower) {
        return aliasResolver.extractRole(lower);
    }

    /**
     * Detect location from query text using centralized AliasResolver.
     * Returns canonical DB enum value (US, INDIA) or null.
     */
    private String detectLocation(String lower, NlpCatalogResponse catalog) {
        return aliasResolver.extractLocation(lower);
    }

    private NlpResult buildResourceResult(NlpCatalogResponse.ResourceInfo r) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "RESOURCE_PROFILE");
        data.put("_entityId", r.id());
        data.put("Name", r.name());
        data.put("Role", formatRole(r.role()));
        data.put("POD", r.podName());
        data.put("Location", r.location());
        data.put("Billing Rate", r.billingRate());
        data.put("FTE", r.fte());
        return new NlpResult("DATA_QUERY", 0.90,
                r.name() + " is a " + formatRole(r.role()) + " in the " + r.podName() + " pod, based in " + r.location() + ".",
                null, null, data, "/resources?highlight=" + r.id(),
                List.of("Go to Resources page", "Show " + r.podName() + " pod details"), null);
    }

    private NlpResult buildProjectResult(NlpCatalogResponse.ProjectInfo p) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "PROJECT_PROFILE");
        data.put("_entityId", p.id());
        data.put("Name", p.name());
        data.put("Priority", p.priority());
        data.put("Owner", p.owner());
        data.put("Status", formatStatus(p.status()));
        data.put("Assigned PODs", p.assignedPods());
        data.put("Timeline", p.timeline());
        data.put("Duration", p.durationMonths());
        if (p.client() != null) data.put("Client", p.client());
        return new NlpResult("DATA_QUERY", 0.90,
                p.name() + " is a " + p.priority() + " project owned by " + p.owner()
                        + ", currently " + formatStatus(p.status()) + ". Assigned to: " + p.assignedPods() + ".",
                null, null, data, "/projects/" + p.id(),
                List.of("Go to Projects page", "Show project health report"), null);
    }

    private NlpResult buildPodResult(NlpCatalogResponse.PodInfo p) {
        return buildPodResult(p, null);
    }

    private NlpResult buildPodResult(NlpCatalogResponse.PodInfo p, NlpCatalogResponse catalog) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "POD_PROFILE");
        data.put("_entityId", p.id());
        data.put("Name", p.name());
        data.put("Members", String.valueOf(p.memberCount()));
        data.put("Projects", String.valueOf(p.projectCount()));
        data.put("Avg BAU", p.avgBauPct());
        data.put("Active", p.active() ? "Yes" : "No");

        // ── Role and location breakdowns (cross-reference with resource catalog) ──
        if (catalog != null && catalog.resourceDetails() != null && !p.members().isEmpty()) {
            List<NlpCatalogResponse.ResourceInfo> podResources = catalog.resourceDetails().stream()
                    .filter(r -> p.members().contains(r.name()))
                    .toList();

            if (!podResources.isEmpty()) {
                // Role breakdown
                Map<String, Long> roleBreakdown = podResources.stream()
                        .collect(Collectors.groupingBy(r -> formatRole(r.role()), Collectors.counting()));
                StringBuilder roleStr = new StringBuilder();
                roleBreakdown.entrySet().stream()
                        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                        .forEach(e -> {
                            if (!roleStr.isEmpty()) roleStr.append(", ");
                            roleStr.append(e.getValue()).append(" ").append(e.getKey()).append(e.getValue() > 1 ? "s" : "");
                        });
                data.put("By Role", roleStr.toString());

                // Location breakdown
                Map<String, Long> locationBreakdown = podResources.stream()
                        .collect(Collectors.groupingBy(NlpCatalogResponse.ResourceInfo::location, Collectors.counting()));
                StringBuilder locStr = new StringBuilder();
                locationBreakdown.entrySet().stream()
                        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                        .forEach(e -> {
                            if (!locStr.isEmpty()) locStr.append(", ");
                            locStr.append(e.getValue()).append(" in ").append(e.getKey());
                        });
                data.put("By Location", locStr.toString());

                // Role × Location detail
                Map<String, Map<String, Long>> roleLocBreakdown = podResources.stream()
                        .collect(Collectors.groupingBy(
                                r -> formatRole(r.role()),
                                Collectors.groupingBy(NlpCatalogResponse.ResourceInfo::location, Collectors.counting())
                        ));
                for (var roleEntry : roleLocBreakdown.entrySet()) {
                    StringBuilder detail = new StringBuilder();
                    roleEntry.getValue().entrySet().stream()
                            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                            .forEach(e -> {
                                if (!detail.isEmpty()) detail.append(", ");
                                detail.append(e.getValue()).append(" in ").append(e.getKey());
                            });
                    data.put(roleEntry.getKey() + "s", detail.toString());
                }
            }
        }

        if (!p.members().isEmpty()) data.put("Team", String.join(", ", p.members()));
        if (!p.projectNames().isEmpty()) data.put("Project List", String.join(", ", p.projectNames()));
        return new NlpResult("DATA_QUERY", 0.90,
                p.name() + " pod has " + p.memberCount() + " member(s) and " + p.projectCount() + " project(s). Avg BAU: " + p.avgBauPct() + ".",
                null, null, data, "/pods/" + p.id(),
                List.of("Go to PODs page", "Show " + p.name() + " capacity"), null);
    }

    private NlpResult buildSprintResult(NlpCatalogResponse.SprintInfo s) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "SPRINT_PROFILE");
        data.put("Name", s.name());
        data.put("Type", s.type());
        data.put("Start Date", s.startDate());
        data.put("End Date", s.endDate());
        if (s.lockInDate() != null) data.put("Lock-in Date", s.lockInDate());
        data.put("Status", s.status());
        return new NlpResult("DATA_QUERY", 0.90,
                s.name() + " (" + s.status() + "): " + s.startDate() + " to " + s.endDate() + ".",
                null, null, data, "/sprint-calendar",
                List.of("Go to Sprint Calendar", "Open Sprint Planner"), null);
    }

    private NlpResult buildReleaseResult(NlpCatalogResponse.ReleaseInfo r) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("_type", "RELEASE_PROFILE");
        data.put("Name", r.name());
        data.put("Release Date", r.releaseDate());
        data.put("Code Freeze", r.codeFreezeDate());
        data.put("Type", r.type());
        data.put("Status", r.status());
        if (r.notes() != null && !r.notes().isBlank()) data.put("Notes", r.notes());
        return new NlpResult("DATA_QUERY", 0.90,
                r.name() + " (" + r.status() + "): releases " + r.releaseDate() + ", code freeze " + r.codeFreezeDate() + ".",
                null, null, data, "/release-calendar",
                List.of("Go to Release Calendar", "Show upcoming releases"), null);
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Entity Finders ─────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private NlpCatalogResponse.ResourceInfo findResourceByName(String fragment, List<NlpCatalogResponse.ResourceInfo> details) {
        if (details == null) return null;
        String lower = fragment.toLowerCase().trim();
        // 1. Exact match
        for (NlpCatalogResponse.ResourceInfo r : details) {
            if (r.name().equalsIgnoreCase(lower)) return r;
        }
        // 2. Substring/contains match
        NlpCatalogResponse.ResourceInfo best = null; int bestScore = 0;
        for (NlpCatalogResponse.ResourceInfo r : details) {
            String rLower = r.name().toLowerCase();
            if (rLower.contains(lower) || lower.contains(rLower)) {
                int score = Math.min(lower.length(), rLower.length());
                if (score > bestScore) { bestScore = score; best = r; }
            }
        }
        if (best != null && lower.length() >= 3) return best;
        // 3. Fuzzy fallback: Levenshtein-based matching for typos
        if (lower.length() >= 3 && preprocessor != null) {
            List<String> names = details.stream().map(NlpCatalogResponse.ResourceInfo::name).toList();
            String fuzzyMatch = preprocessor.fuzzyMatchEntity(lower, names);
            if (fuzzyMatch != null) {
                return details.stream().filter(r -> r.name().equals(fuzzyMatch)).findFirst().orElse(null);
            }
        }
        // 4. Vector semantic search fallback — catches nicknames, misspellings, alternate names
        if (lower.length() >= 2 && vectorSearchService != null) {
            try {
                var vectorResults = vectorSearchService.searchByTypes(fragment, List.of("RESOURCE"), 3);
                for (var vr : vectorResults) {
                    if (vr.similarity() >= VECTOR_ENTITY_THRESHOLD && vr.entityName() != null) {
                        // Match vector result back to a catalog entry
                        for (NlpCatalogResponse.ResourceInfo r : details) {
                            if (r.name().equalsIgnoreCase(vr.entityName())
                                    || (vr.entityId() != null && vr.entityId().equals(r.id()))) {
                                return r;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                // Vector search is non-critical — fall through silently
            }
        }
        return null;
    }

    private NlpCatalogResponse.ProjectInfo findProjectByName(String fragment, List<NlpCatalogResponse.ProjectInfo> details) {
        if (details == null) return null;
        String lower = fragment.toLowerCase().trim().replaceAll("\\bproject\\b", "").trim();
        if (lower.isEmpty()) return null;
        // 1. Exact match
        for (NlpCatalogResponse.ProjectInfo p : details) {
            if (p.name().equalsIgnoreCase(lower)) return p;
        }
        // 2. Substring/contains match
        NlpCatalogResponse.ProjectInfo best = null; int bestScore = 0;
        for (NlpCatalogResponse.ProjectInfo p : details) {
            String pLower = p.name().toLowerCase();
            if (pLower.contains(lower) || lower.contains(pLower)) {
                int score = Math.min(lower.length(), pLower.length());
                if (score > bestScore) { bestScore = score; best = p; }
            }
        }
        if (best != null && lower.length() >= 3) return best;
        // 3. Fuzzy fallback: Levenshtein-based matching for typos
        if (lower.length() >= 3 && preprocessor != null) {
            List<String> names = details.stream().map(NlpCatalogResponse.ProjectInfo::name).toList();
            String fuzzyMatch = preprocessor.fuzzyMatchEntity(lower, names);
            if (fuzzyMatch != null) {
                return details.stream().filter(p -> p.name().equals(fuzzyMatch)).findFirst().orElse(null);
            }
        }
        // 4. Vector semantic search fallback
        if (lower.length() >= 2 && vectorSearchService != null) {
            try {
                var vectorResults = vectorSearchService.searchByTypes(fragment, List.of("PROJECT"), 3);
                for (var vr : vectorResults) {
                    if (vr.similarity() >= VECTOR_ENTITY_THRESHOLD && vr.entityName() != null) {
                        for (NlpCatalogResponse.ProjectInfo p : details) {
                            if (p.name().equalsIgnoreCase(vr.entityName())
                                    || (vr.entityId() != null && vr.entityId().equals(p.id()))) {
                                return p;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                // Vector search is non-critical
            }
        }
        return null;
    }

    private NlpCatalogResponse.PodInfo findPodByName(String fragment, List<NlpCatalogResponse.PodInfo> details) {
        if (details == null) return null;
        String lower = fragment.toLowerCase().trim().replaceAll("\\b(?:pod|team)\\b", "").trim();
        if (lower.isEmpty()) return null;
        // 1. Exact match
        for (NlpCatalogResponse.PodInfo p : details) {
            if (p.name().equalsIgnoreCase(lower)) return p;
        }
        // 2. Substring/contains match
        NlpCatalogResponse.PodInfo best = null; int bestScore = 0;
        for (NlpCatalogResponse.PodInfo p : details) {
            String pLower = p.name().toLowerCase();
            if (pLower.contains(lower) || lower.contains(pLower)) {
                int score = Math.min(lower.length(), pLower.length());
                if (score > bestScore) { bestScore = score; best = p; }
            }
        }
        if (best != null && lower.length() >= 2) return best;
        // 3. Fuzzy fallback: Levenshtein-based matching for typos
        if (lower.length() >= 2 && preprocessor != null) {
            List<String> names = details.stream().map(NlpCatalogResponse.PodInfo::name).toList();
            String fuzzyMatch = preprocessor.fuzzyMatchEntity(lower, names);
            if (fuzzyMatch != null) {
                return details.stream().filter(p -> p.name().equals(fuzzyMatch)).findFirst().orElse(null);
            }
        }
        // 4. Vector semantic search fallback
        if (lower.length() >= 2 && vectorSearchService != null) {
            try {
                var vectorResults = vectorSearchService.searchByTypes(fragment, List.of("POD"), 3);
                for (var vr : vectorResults) {
                    if (vr.similarity() >= VECTOR_ENTITY_THRESHOLD && vr.entityName() != null) {
                        for (NlpCatalogResponse.PodInfo p : details) {
                            if (p.name().equalsIgnoreCase(vr.entityName())
                                    || (vr.entityId() != null && vr.entityId().equals(p.id()))) {
                                return p;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                // Vector search is non-critical
            }
        }
        return null;
    }

    // ── Smart Catch-All Entity Resolution ────────────────────────────────
    // Last resort: scan the entire query for any entity mention (resource, project, pod, sprint, release)
    // and return a profile card if found. This handles the many permutations users can ask about an entity.
    private NlpResult tryCatchAllEntityResolution(String query, NlpCatalogResponse catalog) {
        String lower = query.toLowerCase();

        // Try to match resources first (most common case: "who is X", "tell me about X")
        if (catalog.resourceDetails() != null) {
            for (var r : catalog.resourceDetails()) {
                String rLower = r.name().toLowerCase();
                // Match full name, first name, or last name
                String[] nameParts = rLower.split("\\s+");
                if (lower.contains(rLower)) return buildResourceResult(r);
                for (String part : nameParts) {
                    if (part.length() >= 3 && lower.contains(part)) return buildResourceResult(r);
                }
            }
        }

        // Try projects
        if (catalog.projectDetails() != null) {
            for (var p : catalog.projectDetails()) {
                String pLower = p.name().toLowerCase();
                if (lower.contains(pLower)) return buildProjectResult(p);
                // Also match significant words in the project name (3+ chars)
                String[] words = pLower.split("[\\s\\-]+");
                int matchCount = 0;
                for (String w : words) {
                    if (w.length() >= 3 && lower.contains(w)) matchCount++;
                }
                // If more than half of the project name words match, consider it a hit
                if (words.length > 0 && matchCount > 0 && matchCount >= Math.ceil(words.length / 2.0)) {
                    return buildProjectResult(p);
                }
            }
        }

        // Try pods
        if (catalog.podDetails() != null) {
            for (var p : catalog.podDetails()) {
                if (lower.contains(p.name().toLowerCase())) return buildPodResult(p);
            }
        }

        // Try sprints
        if (catalog.sprintDetails() != null) {
            for (var s : catalog.sprintDetails()) {
                if (lower.contains(s.name().toLowerCase())) {
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "SPRINT_PROFILE");
                    data.put("Name", s.name());
                    data.put("Type", s.type());
                    data.put("Start Date", s.startDate());
                    data.put("End Date", s.endDate());
                    data.put("Lock-in Date", s.lockInDate());
                    data.put("Status", s.status());
                    return new NlpResult("DATA_QUERY", 0.75,
                            "Here are the details for " + s.name() + ".",
                            null, null, data, "/sprint-calendar",
                            List.of("Show sprint allocations", "Show sprint calendar"), null);
                }
            }
        }

        // Try releases
        if (catalog.releaseDetails() != null) {
            for (var r : catalog.releaseDetails()) {
                if (lower.contains(r.name().toLowerCase())) {
                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("_type", "RELEASE_PROFILE");
                    data.put("Name", r.name());
                    data.put("Release Date", r.releaseDate());
                    data.put("Code Freeze", r.codeFreezeDate());
                    data.put("Type", r.type());
                    data.put("Status", r.status());
                    if (r.notes() != null) data.put("Notes", r.notes());
                    return new NlpResult("DATA_QUERY", 0.75,
                            "Here are the details for release " + r.name() + ".",
                            null, null, data, "/release-calendar",
                            List.of("Show upcoming releases", "Show release calendar"), null);
                }
            }
        }

        // Fuzzy matching fallback: try Levenshtein against all entity names
        if (preprocessor != null) {
            // Collect all entity names with their types
            List<String> allNames = new ArrayList<>();
            Map<String, String> nameToType = new HashMap<>();
            if (catalog.resourceDetails() != null) {
                catalog.resourceDetails().forEach(r -> { allNames.add(r.name()); nameToType.put(r.name(), "RESOURCE"); });
            }
            if (catalog.projectDetails() != null) {
                catalog.projectDetails().forEach(p -> { allNames.add(p.name()); nameToType.put(p.name(), "PROJECT"); });
            }
            if (catalog.podDetails() != null) {
                catalog.podDetails().forEach(p -> { allNames.add(p.name()); nameToType.put(p.name(), "POD"); });
            }

            // Try each significant word in the query against all entity names
            String[] words = lower.split("\\s+");
            for (String word : words) {
                if (word.length() >= 4) { // Only try words with 4+ chars for fuzzy matching
                    String match = preprocessor.fuzzyMatchEntity(word, allNames);
                    if (match != null) {
                        String type = nameToType.get(match);
                        if ("RESOURCE".equals(type)) {
                            var res = catalog.resourceDetails().stream()
                                    .filter(r -> r.name().equals(match)).findFirst().orElse(null);
                            if (res != null) return buildResourceResult(res);
                        } else if ("PROJECT".equals(type)) {
                            var proj = catalog.projectDetails().stream()
                                    .filter(p -> p.name().equals(match)).findFirst().orElse(null);
                            if (proj != null) return buildProjectResult(proj);
                        } else if ("POD".equals(type)) {
                            var pod = catalog.podDetails().stream()
                                    .filter(p -> p.name().equals(match)).findFirst().orElse(null);
                            if (pod != null) return buildPodResult(pod);
                        }
                    }
                }
            }
        }

        return null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ── Helpers ─────────────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════
    private String findBestRoute(String target) {
        // 1. Exact match — highest priority
        for (var entry : PAGE_ALIASES.entrySet()) {
            for (String alias : entry.getValue()) {
                if (alias.equalsIgnoreCase(target)) return entry.getKey();
            }
        }
        // 2. Partial match — prefer the LONGEST matching alias to avoid
        //    "pods" (2 chars) beating "pod capacity" (12 chars) for "pods over capacity"
        String bestPartialRoute = null;
        int bestPartialLen = 0;
        for (var entry : PAGE_ALIASES.entrySet()) {
            for (String alias : entry.getValue()) {
                if ((alias.contains(target) || target.contains(alias)) && alias.length() > bestPartialLen) {
                    bestPartialLen = alias.length();
                    bestPartialRoute = entry.getKey();
                }
            }
        }
        if (bestPartialRoute != null) return bestPartialRoute;
        // Fuzzy fallback: try Levenshtein matching against all aliases
        if (preprocessor != null && target.length() >= 3) {
            List<String> allAliases = new ArrayList<>();
            Map<String, String> aliasToRoute = new HashMap<>();
            for (var entry : PAGE_ALIASES.entrySet()) {
                for (String alias : entry.getValue()) {
                    allAliases.add(alias);
                    aliasToRoute.put(alias, entry.getKey());
                }
            }
            String fuzzyMatch = preprocessor.fuzzyMatchEntity(target, allAliases);
            if (fuzzyMatch != null) return aliasToRoute.get(fuzzyMatch);
        }
        return null;
    }

    private String getPageTitle(String route) {
        String[] aliases = PAGE_ALIASES.get(route);
        if (aliases != null && aliases.length > 0) {
            String alias = aliases[0];
            return alias.substring(0, 1).toUpperCase() + alias.substring(1);
        }
        return route;
    }

    private String findMentionedEntity(String query, List<String> entities) {
        if (entities == null) return null;
        String lower = query.toLowerCase();
        for (String entity : entities) {
            if (lower.contains(entity.toLowerCase())) return entity;
        }
        // Fuzzy fallback: try matching individual query words against entities
        if (preprocessor != null) {
            String[] words = lower.split("\\s+");
            for (String word : words) {
                if (word.length() >= 3) {
                    String fuzzyMatch = preprocessor.fuzzyMatchEntity(word, entities);
                    if (fuzzyMatch != null) return fuzzyMatch;
                }
            }
        }
        return null;
    }

    private String formatStatus(String status) {
        if (status == null) return "Unknown";
        return switch (status) {
            case "NOT_STARTED" -> "Not Started"; case "IN_DISCOVERY" -> "In Discovery";
            case "ACTIVE" -> "Active"; case "ON_HOLD" -> "On Hold";
            case "COMPLETED" -> "Completed"; case "CANCELLED" -> "Cancelled";
            default -> status;
        };
    }

    private int parseMonth(String name) {
        return switch (name.toLowerCase()) {
            case "jan", "january" -> 1; case "feb", "february" -> 2; case "mar", "march" -> 3;
            case "apr", "april" -> 4; case "may" -> 5; case "jun", "june" -> 6;
            case "jul", "july" -> 7; case "aug", "august" -> 8; case "sep", "september" -> 9;
            case "oct", "october" -> 10; case "nov", "november" -> 11; case "dec", "december" -> 12;
            default -> -1;
        };
    }

    private Map<String, Object> extractFormFields(String text, String entityType, NlpCatalogResponse catalog) {
        Map<String, Object> fields = new LinkedHashMap<>();

        // ── Priority (Jira-style: HIGHEST, HIGH, MEDIUM, LOW, LOWEST, BLOCKER, MINOR) ──
        Matcher pMatcher = Pattern.compile("(?i)\\b(HIGHEST|HIGH|MEDIUM|LOW|LOWEST|BLOCKER|MINOR|p[0-3])\\b").matcher(text);
        if (pMatcher.find()) {
            String raw = pMatcher.group(1).toUpperCase();
            // Map legacy Px to new names
            String mapped = switch (raw) {
                case "P0" -> "HIGHEST";
                case "P1" -> "HIGH";
                case "P2" -> "MEDIUM";
                case "P3" -> "LOW";
                default -> raw;
            };
            fields.put("priority", mapped);
        }

        // ── Name extraction (multiple patterns) ──
        // Pattern 1: "called X" / "named X"
        Matcher nameMatcher = Pattern.compile("(?i)(?:called|named)\\s+[\"']?([^\"',]+)[\"']?").matcher(text);
        if (nameMatcher.find()) {
            fields.put("name", nameMatcher.group(1).trim());
        } else if ("resource".equals(entityType)) {
            // Pattern 2: "resource - Name to ..." or "resource - Name"
            Matcher dashMatcher = Pattern.compile("(?i)resource\\s*[-–—:]\\s*([^,]+?)(?:\\s+to\\s+|$)").matcher(text);
            if (dashMatcher.find()) {
                String rawName = dashMatcher.group(1).trim();
                // Remove trailing noise words
                rawName = rawName.replaceAll("(?i)\\s+(as|in|for|with)\\s*$", "").trim();
                if (!rawName.isEmpty()) fields.put("name", rawName);
            } else {
                // Pattern 3: "add resource FirstName LastName …"
                Matcher inlineMatcher = Pattern.compile("(?i)resource\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)").matcher(text);
                if (inlineMatcher.find()) {
                    fields.put("name", inlineMatcher.group(1).trim());
                }
            }
        } else if ("project".equals(entityType)) {
            // Pattern: "project - Name" or "project Name" (capitalized words)
            Matcher dashMatcher = Pattern.compile("(?i)project\\s*[-–—:]\\s*([^,]+?)(?:\\s+(?:with|as|in|for)\\s+|$)").matcher(text);
            if (dashMatcher.find()) {
                fields.put("name", dashMatcher.group(1).trim());
            }
        } else if ("pod".equals(entityType)) {
            Matcher dashMatcher = Pattern.compile("(?i)pod\\s*[-–—:]\\s*([^,]+?)(?:\\s+(?:with|as|in|for)\\s+|$)").matcher(text);
            if (dashMatcher.find()) {
                fields.put("name", dashMatcher.group(1).trim());
            }
        }

        // ── POD assignment for resources: "to [pod name]" ──
        if ("resource".equals(entityType) && catalog.pods() != null) {
            Matcher toMatcher = Pattern.compile("(?i)\\bto\\s+(.+?)(?:\\s+(?:team|pod|squad))?\\s*$").matcher(text);
            if (toMatcher.find()) {
                String targetName = toMatcher.group(1).trim()
                        .replaceAll("(?i)\\s*(team|pod|squad)\\s*$", "").trim();
                // Try to match against known PODs
                String matchedPod = null;
                for (String podName : catalog.pods()) {
                    if (podName.equalsIgnoreCase(targetName)
                            || podName.toLowerCase().contains(targetName.toLowerCase())
                            || targetName.toLowerCase().contains(podName.toLowerCase())) {
                        matchedPod = podName;
                        break;
                    }
                }
                if (matchedPod != null) {
                    fields.put("pod", matchedPod);
                }
            }
        }

        // ── Owner (for projects) — match against known resources ──
        if (catalog.resources() != null && !"resource".equals(entityType)) {
            for (String resource : catalog.resources()) {
                if (text.toLowerCase().contains(resource.toLowerCase())) {
                    fields.put("owner", resource);
                    break;
                }
            }
        }

        // ── Start month ──
        Matcher monthMatcher = Pattern.compile(
                "(?i)(?:start(?:ing|s)?\\s+(?:in\\s+)?)(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
        ).matcher(text);
        if (monthMatcher.find()) fields.put("startMonth", monthMatcher.group(1));

        // ── Role (word boundary to avoid false matches) ──
        if (Pattern.compile("(?i)\\b(?:developer|dev)\\b").matcher(text).find()) fields.put("role", "DEVELOPER");
        else if (Pattern.compile("(?i)\\bqa\\b").matcher(text).find()) fields.put("role", "QA");
        else if (Pattern.compile("(?i)\\bbsa\\b").matcher(text).find()) fields.put("role", "BSA");
        else if (Pattern.compile("(?i)\\btech\\s*lead\\b").matcher(text).find()) fields.put("role", "TECH_LEAD");

        // ── Location (word boundary to avoid "us" inside "Piyush", etc.) ──
        if (Pattern.compile("(?i)\\bindia\\b").matcher(text).find()) fields.put("location", "INDIA");
        else if (Pattern.compile("(?i)\\b(?:us|usa|onshore|houston)\\b").matcher(text).find()) fields.put("location", "US");

        return fields;
    }
}
