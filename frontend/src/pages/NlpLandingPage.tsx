import { useState, useRef, useEffect, useCallback, useMemo, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, TextInput, Paper, Group, Stack, Badge,
  ActionIcon, Loader, Kbd, Transition, Box, ThemeIcon, SimpleGrid,
  Tooltip, useComputedColorScheme, Anchor, rem,
  Button, Autocomplete, Textarea,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconSearch, IconSparkles, IconArrowRight, IconBrain,
  IconRoute, IconForms, IconChartBar, IconBulb, IconHelp,
  IconUsers, IconBriefcase, IconHexagons,
  IconCalendarStats, IconChartAreaLine, IconAlertTriangle,
  IconPlayerPlay, IconUser, IconMapPin, IconCurrencyDollar,
  IconBuildingSkyscraper, IconFlag, IconClock, IconStatusChange,
  IconDownload, IconArrowsSplit, IconListCheck, IconCalendarEvent,
  IconRocket, IconSnowflake, IconLock, IconPercentage, IconCheck,
  IconX, IconNotes, IconAlertCircle, IconExternalLink, IconChevronRight,
  IconHistory, IconMoodEmpty, IconArrowUpRight, IconThumbUp, IconThumbDown,
} from '@tabler/icons-react';
import { useNlpQuery, useNlpCatalog, useNlpCatalogWarmup, useNlpFeedback, useNlpFeedbackUndo, NlpQueryResponse } from '../api/nlp';
import { DEEP_BLUE, AQUA, AQUA_TINTS, DEEP_BLUE_TINTS, FONT_FAMILY } from '../brandTokens';

// ── Constants ────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Show capacity gaps',           query: 'show me the capacity gap report',    icon: <IconChartBar size={16} /> },
  { label: 'Which pods are over capacity?', query: 'which pods are over capacity?',     icon: <IconAlertTriangle size={16} /> },
  { label: 'Go to Sprint Planner',         query: 'open sprint planner',                icon: <IconPlayerPlay size={16} /> },
  { label: 'Create a new project',         query: 'create a new project',               icon: <IconBriefcase size={16} /> },
  { label: 'Show utilization heatmap',     query: 'show utilization heatmap',            icon: <IconChartAreaLine size={16} /> },
  { label: 'View team calendar',           query: 'go to team calendar',                 icon: <IconCalendarStats size={16} /> },
  { label: 'Add a new resource',           query: 'add a new resource',                  icon: <IconUsers size={16} /> },
  { label: 'Lookup a resource',           query: 'who is ',                               icon: <IconUser size={16} /> },
];

const INTENT_ICONS: Record<string, React.ReactNode> = {
  NAVIGATE:    <IconRoute size={20} />,
  FORM_PREFILL:<IconForms size={20} />,
  DATA_QUERY:  <IconChartBar size={20} />,
  INSIGHT:     <IconBulb size={20} />,
  HELP:        <IconHelp size={20} />,
};

const INTENT_LABELS: Record<string, string> = {
  NAVIGATE:    'Navigation',
  FORM_PREFILL:'Form Pre-fill',
  DATA_QUERY:  'Data Query',
  INSIGHT:     'Insight',
  HELP:        'Help',
  UNKNOWN:     'Unknown',
};

// Status → brand-aligned colors
const STATUS_COLORS: Record<string, string> = {
  'Active': 'teal',
  'Completed': 'gray',
  'In Discovery': 'blue',
  'Not Started': 'orange',
  'On Hold': 'yellow',
  'Cancelled': 'red',
  'Upcoming': 'blue',
  'Released': 'green',
  'Code Frozen': 'cyan',
};

// Role → color mapping for visual distinction in resource lists
const ROLE_COLORS: Record<string, string> = {
  'Developer': 'indigo',
  'DEVELOPER': 'indigo',
  'QA': 'orange',
  'BSA': 'cyan',
  'Tech Lead': 'red',
  'TECH_LEAD': 'red',
};

// Location → color mapping
const LOCATION_COLORS: Record<string, string> = {
  'INDIA': 'violet',
  'India': 'violet',
  'US': 'blue',
  'USA': 'blue',
  'Houston': 'blue',
};

// ── Entity type icon + color signatures for consistent visual identity ────────
const ENTITY_SIGNATURES: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  RESOURCE_PROFILE:    { icon: <IconUser size={16} />,          color: 'blue',   label: 'Resource' },
  PROJECT_PROFILE:     { icon: <IconBriefcase size={16} />,     color: 'teal',   label: 'Project' },
  POD_PROFILE:         { icon: <IconHexagons size={16} />,      color: 'grape',  label: 'POD' },
  SPRINT_PROFILE:      { icon: <IconPlayerPlay size={16} />,    color: 'orange', label: 'Sprint' },
  RELEASE_PROFILE:     { icon: <IconRocket size={16} />,        color: 'cyan',   label: 'Release' },
  COMPARISON:          { icon: <IconArrowsSplit size={16} />,    color: 'indigo', label: 'Comparison' },
  LIST:                { icon: <IconListCheck size={16} />,      color: 'teal',   label: 'List' },
  EXPORT:              { icon: <IconDownload size={16} />,       color: 'green',  label: 'Export' },
  RISK_SUMMARY:        { icon: <IconAlertTriangle size={16} />, color: 'red',    label: 'Risk' },
  RESOURCE_ANALYTICS:  { icon: <IconChartBar size={16} />,      color: 'blue',   label: 'Analytics' },
  CAPABILITIES:        { icon: <IconHelp size={16} />,          color: 'gray',   label: 'Help' },
  PROJECT_ESTIMATES:   { icon: <IconChartBar size={16} />,      color: 'teal',   label: 'Estimates' },
  SPRINT_ALLOCATIONS:  { icon: <IconCalendarStats size={16} />, color: 'orange', label: 'Allocations' },
};

// Max recent queries to keep in memory
const MAX_RECENT_QUERIES = 5;

// ── Component ────────────────────────────────────────────────────────────────

export default function NlpLandingPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const computedColorScheme = useComputedColorScheme('light');
  const isDark = computedColorScheme === 'dark';

  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const [result, setResult] = useState<NlpQueryResponse | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [focusedListIdx, setFocusedListIdx] = useState<number>(-1);
  const [inputFocused, setInputFocused] = useState(false);
  const listItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const nlpQuery = useNlpQuery();
  const { data: catalog } = useNlpCatalog();
  // Pre-warm the backend catalog cache when user visits this page
  useNlpCatalogWarmup();

  // Build autocomplete suggestions from catalog data
  const autocompleteData = useMemo(() => {
    if (!catalog) return [];
    const items: string[] = [];
    // Entity name shortcuts — keep them short and natural
    catalog.projects?.forEach((p) => items.push(`Tell me about ${p}`));
    catalog.resources?.forEach((r) => items.push(`Who is ${r}`));
    catalog.pods?.forEach((p) => items.push(`${p} pod details`));
    catalog.sprints?.slice(0, 5).forEach((s) => items.push(`${s} allocations`));
    catalog.releases?.slice(0, 3).forEach((r) => items.push(`${r} release`));
    // Common actions
    items.push('Show capacity gaps', 'Which pods are over capacity?',
      'Show utilization heatmap', 'Create a new project',
      'Show all developers', 'India team details', 'Show active projects',
      'Show hiring forecast', 'Show project timeline');
    return items;
  }, [catalog]);

  // Auto-focus search input
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Reset keyboard focus when result changes
  useEffect(() => { setFocusedListIdx(-1); }, [result]);

  const addToRecent = useCallback((text: string) => {
    setRecentQueries((prev) => {
      const filtered = prev.filter((q) => q.toLowerCase() !== text.toLowerCase());
      return [text, ...filtered].slice(0, MAX_RECENT_QUERIES);
    });
  }, []);

  const handleSubmit = useCallback((q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setShowResult(false);
    addToRecent(text);
    nlpQuery.mutate(text, {
      onSuccess: (res) => {
        setResult(res);
        setShowResult(true);
        // Auto-navigate for high-confidence navigation intents
        if (res.intent === 'NAVIGATE' && res.confidence >= 0.9 && res.response.route) {
          setTimeout(() => navigate(res.response.route!), 600);
        }
      },
    });
  }, [query, nlpQuery, navigate, addToRecent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const handleQuickAction = (q: string) => {
    setQuery(q);
    handleSubmit(q);
  };

  const handleNavigate = (route: string) => {
    navigate(route, { state: { fromNlp: true } });
  };

  const handleNavigateWithToast = useCallback((route: string, entityName?: string) => {
    if (entityName) {
      notifications.show({
        title: 'Navigating',
        message: `Opening ${entityName}…`,
        color: 'teal',
        autoClose: 1500,
        withCloseButton: false,
      });
    }
    navigate(route, { state: { fromNlp: true } });
  }, [navigate]);

  const handleFormPrefill = (route: string, formData: Record<string, unknown>) => {
    navigate(route, { state: { prefill: formData, fromNlp: true } });
  };

  return (
    <Container size="md" py="xl">
      {/* ── Hero section ── */}
      <Stack align="center" gap="xs" mb="xl">
        <Group gap="xs">
          <ThemeIcon
            size={48}
            radius="xl"
            variant="gradient"
            gradient={{ from: AQUA, to: DEEP_BLUE, deg: 135 }}
          >
            <IconBrain size={28} />
          </ThemeIcon>
        </Group>
        <Title order={2} ta="center" style={{ fontFamily: FONT_FAMILY, color: isDark ? undefined : DEEP_BLUE }}>
          What would you like to do?
        </Title>
        <Text c="dimmed" ta="center" size="sm" maw={480}>
          Ask a question, navigate to a page, or create something new.
          Try natural language like "show me pods that are over capacity" or "create a new project called Alpha".
        </Text>
      </Stack>

      {/* ── Search input ── */}
      <Paper
        shadow="md"
        radius="lg"
        p={4}
        mb="lg"
        style={{
          border: `2px solid ${isDark ? '#2C2C2C' : '#E8ECF2'}`,
          transition: 'border-color 150ms ease',
        }}
      >
        <Autocomplete
          ref={inputRef}
          placeholder="Ask me anything about your portfolio…"
          size="lg"
          radius="lg"
          value={query}
          onChange={(val) => { setQuery(val); setShowResult(false); }}
          onKeyDown={handleKeyDown}
          onOptionSubmit={(val) => { setQuery(val); setTimeout(() => handleSubmit(val), 50); }}
          data={autocompleteData}
          maxDropdownHeight={280}
          limit={8}
          filter={({ options, search }: { options: any[]; search: string }) => {
            if (!search || search.trim().length < 2) return [];
            const q = search.toLowerCase();
            return options.filter((o: any) => {
              const label = typeof o === 'string' ? o : (o?.label ?? o?.value ?? '');
              return String(label).toLowerCase().includes(q);
            });
          }}
          // Only show dropdown when focused, has 2+ chars, and not showing result
          dropdownOpened={inputFocused && query.trim().length >= 2 && !showResult}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setTimeout(() => setInputFocused(false), 200)}
          leftSection={
            nlpQuery.isPending
              ? <Loader size={18} color={AQUA} />
              : <IconSearch size={18} style={{ opacity: 0.5 }} />
          }
          rightSection={
            <Group gap={4} wrap="nowrap" pr={4}>
              {query.trim() && (
                <ActionIcon
                  variant="subtle"
                  radius="xl"
                  size="sm"
                  onClick={() => { setQuery(''); setShowResult(false); setResult(null); inputRef.current?.focus(); }}
                  aria-label="Clear search"
                  style={{ color: DEEP_BLUE_TINTS[40] }}
                >
                  <IconX size={16} />
                </ActionIcon>
              )}
              {query.trim() ? (
                <ActionIcon
                  variant="filled"
                  radius="xl"
                  size="lg"
                  onClick={() => handleSubmit()}
                  loading={nlpQuery.isPending}
                  style={{ backgroundColor: AQUA }}
                >
                  <IconArrowRight size={18} />
                </ActionIcon>
              ) : (
                <Kbd size="sm" style={{ opacity: 0.4 }}>↵</Kbd>
              )}
            </Group>
          }
          rightSectionWidth={88}
          styles={{
            input: {
              border: 'none',
              fontSize: rem(16),
              fontFamily: FONT_FAMILY,
            },
          }}
        />
      </Paper>

      {/* ── Accessibility: screen reader announcements ── */}
      <div role="status" aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {nlpQuery.isPending && 'Processing your query…'}
        {showResult && result && `Result: ${result.response.message ?? 'Query processed'}`}
        {nlpQuery.isError && 'Error processing your query.'}
      </div>

      {/* ── Skeleton loading state ── */}
      {nlpQuery.isPending && !showResult && (
        <Paper shadow="sm" radius="lg" mb="lg" withBorder style={{ overflow: 'hidden' }}>
          <Box
            px="md" py="sm"
            style={{
              background: isDark
                ? `linear-gradient(135deg, rgba(45,204,211,0.06) 0%, rgba(12,35,64,0.06) 100%)`
                : `linear-gradient(135deg, ${AQUA_TINTS[10]} 0%, ${DEEP_BLUE_TINTS[10]} 100%)`,
              borderBottom: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : '#e8ecf2'}`,
            }}
          >
            <Group gap="sm">
              <Box className="nlp-skeleton" style={{ width: 36, height: 36, borderRadius: 8 }} />
              <Stack gap={6} style={{ flex: 1 }}>
                <Box className="nlp-skeleton" style={{ width: '70%', height: 14, borderRadius: 4 }} />
                <Box className="nlp-skeleton" style={{ width: '40%', height: 10, borderRadius: 4 }} />
              </Stack>
            </Group>
          </Box>
          <Box px="md" py="sm">
            <SimpleGrid cols={3} spacing="sm" mb="sm">
              {[1, 2, 3].map((i) => (
                <Box key={i} className="nlp-skeleton" style={{ height: 56, borderRadius: 8 }} />
              ))}
            </SimpleGrid>
            <Box className="nlp-skeleton" style={{ width: '30%', height: 14, borderRadius: 4 }} />
          </Box>
        </Paper>
      )}

      {/* ── Result card ── */}
      <Transition mounted={showResult && result != null} transition="slide-up" duration={250}>
        {(styles) => (
          <Paper
            style={{
              ...styles,
              overflow: 'hidden',
            }}
            shadow="sm"
            radius="lg"
            mb="lg"
            withBorder
          >
            {result && <NlpResultCard result={result} onNavigate={handleNavigate} onNavigateWithToast={handleNavigateWithToast} onFormPrefill={handleFormPrefill} isDark={isDark} />}
          </Paper>
        )}
      </Transition>

      {/* ── Error display ── */}
      {nlpQuery.isError && (
        <Paper p="md" mb="lg" radius="lg" withBorder style={{ borderColor: 'var(--mantine-color-red-4)', borderLeft: `4px solid var(--mantine-color-red-5)` }}>
          <Group gap="sm" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size={32} variant="light" color="red" radius="md">
                <IconAlertCircle size={18} />
              </ThemeIcon>
              <div>
                <Text c="red" size="sm" fw={500}>
                  {nlpQuery.error?.message?.includes('timed out')
                    ? 'The query took too long. The system may be warming up — please try again.'
                    : 'Something went wrong processing your query.'}
                </Text>
                {nlpQuery.error && !nlpQuery.error.message?.includes('timed out') && (
                  <Text c="dimmed" size="xs" mt={4}>
                    {nlpQuery.error.message}
                  </Text>
                )}
              </div>
            </Group>
            <Button
              variant="light"
              color="red"
              size="xs"
              onClick={() => handleSubmit()}
              loading={nlpQuery.isPending}
            >
              Retry
            </Button>
          </Group>
        </Paper>
      )}

      {/* ── Quick actions ── */}
      {!showResult && (
        <Box>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb="xs" style={{ letterSpacing: '0.06em' }}>
            Quick Actions
          </Text>
          <SimpleGrid cols={{ base: 1, xs: 2, sm: 4 }} spacing="xs">
            {QUICK_ACTIONS.map((action) => (
              <Paper
                key={action.label}
                p="sm"
                radius="md"
                withBorder
                style={{ cursor: 'pointer', transition: 'all 150ms ease' }}
                onClick={() => handleQuickAction(action.query)}
                className="nlp-quick-action"
              >
                <Group gap="xs" wrap="nowrap">
                  <ThemeIcon size={28} variant="light" radius="md" style={{ backgroundColor: AQUA_TINTS[10], color: AQUA }}>
                    {action.icon}
                  </ThemeIcon>
                  <Text size="xs" fw={500} lineClamp={2} style={{ fontFamily: FONT_FAMILY }}>
                    {action.label}
                  </Text>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        </Box>
      )}

      {/* ── Recent queries ── */}
      {!showResult && recentQueries.length > 0 && (
        <Box mt="md">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb="xs" style={{ letterSpacing: '0.06em' }}>
            <Group gap={6}>
              <IconHistory size={12} />
              Recent
            </Group>
          </Text>
          <Group gap="xs">
            {recentQueries.map((q) => (
              <Badge
                key={q}
                variant="light"
                size="lg"
                style={{
                  cursor: 'pointer',
                  textTransform: 'none',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DEEP_BLUE_TINTS[10],
                  color: isDark ? undefined : DEEP_BLUE,
                  fontFamily: FONT_FAMILY,
                  fontWeight: 500,
                  transition: 'all 150ms ease',
                }}
                className="nlp-recent-badge"
                onClick={() => handleQuickAction(q)}
              >
                {q}
              </Badge>
            ))}
          </Group>
        </Box>
      )}

      {/* ── Suggestions from result ── */}
      {showResult && result && result.suggestions.length > 0 && (
        <Box mt="md">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb="xs" style={{ letterSpacing: '0.06em' }}>
            Try also
          </Text>
          <Group gap="xs">
            {result.suggestions.map((s) => (
              <Badge
                key={s}
                variant="outline"
                size="lg"
                style={{ cursor: 'pointer', textTransform: 'none', borderColor: AQUA, color: AQUA }}
                onClick={() => handleQuickAction(s)}
              >
                {s}
              </Badge>
            ))}
          </Group>
        </Box>
      )}

      {/* ── CSS for hover ── */}
      <style>{`
        .nlp-quick-action:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 12px rgba(45, 204, 211, 0.12);
          border-color: ${AQUA} !important;
        }
        .nlp-info-tile {
          transition: all 150ms ease;
        }
        .nlp-info-tile:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .nlp-list-item {
          transition: all 150ms ease;
        }
        .nlp-list-item:hover {
          background: ${AQUA_TINTS[10]};
          border-left-color: ${AQUA} !important;
          box-shadow: 0 1px 6px rgba(45, 204, 211, 0.10);
        }
        .nlp-list-item[style*="cursor: pointer"]:hover {
          transform: translateX(2px);
        }
        .nlp-list-item[style*="cursor: pointer"]:hover svg {
          opacity: 0.8 !important;
          transform: translateX(2px);
          transition: all 150ms ease;
        }
        .nlp-list-item[style*="cursor: pointer"]:active {
          transform: translateX(1px);
          background: ${DEEP_BLUE_TINTS[10]};
        }
        .nlp-list-item.nlp-list-focused {
          background: ${AQUA_TINTS[10]};
          border-left-color: ${AQUA} !important;
          box-shadow: 0 0 0 2px ${AQUA};
          outline: none;
        }
        .nlp-recent-badge:hover {
          background: ${AQUA_TINTS[10]} !important;
          color: ${AQUA} !important;
        }
        /* Autocomplete dropdown styling */
        .mantine-Autocomplete-dropdown {
          border: 1px solid #e8ecf2;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          padding: 4px;
          margin-top: 4px;
        }
        .mantine-Autocomplete-option {
          border-radius: 8px;
          font-size: 13px;
          font-family: ${FONT_FAMILY};
          padding: 8px 12px;
        }
        .mantine-Autocomplete-option[data-combobox-selected] {
          background: ${AQUA_TINTS[10]};
          color: ${DEEP_BLUE};
        }
        .mantine-Autocomplete-option:hover {
          background: ${AQUA_TINTS[10]};
        }
        @keyframes nlp-count-up {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .nlp-count-animate {
          animation: nlp-count-up 400ms ease-out;
        }
        @keyframes nlp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .nlp-loading-pulse {
          animation: nlp-pulse 1.2s ease-in-out infinite;
        }
        @keyframes nlp-slide-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .nlp-stagger-item {
          animation: nlp-slide-in 300ms ease-out both;
        }
        @keyframes nlp-skeleton-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .nlp-skeleton {
          background: linear-gradient(90deg, #e8ecf2 25%, #f0f4f8 50%, #e8ecf2 75%);
          background-size: 200% 100%;
          animation: nlp-skeleton-shimmer 1.5s ease-in-out infinite;
        }
        .nlp-breadcrumb-btn:hover {
          background-color: ${AQUA_TINTS[10]} !important;
          box-shadow: 0 0 0 1px ${AQUA};
        }
      `}</style>
    </Container>
  );
}

// ── Result Card sub-component ────────────────────────────────────────────────

function NlpResultCard({
  result,
  onNavigate,
  onNavigateWithToast,
  onFormPrefill,
  isDark,
}: {
  result: NlpQueryResponse;
  onNavigate: (route: string) => void;
  onNavigateWithToast: (route: string, entityName?: string) => void;
  onFormPrefill: (route: string, formData: Record<string, unknown>) => void;
  isDark: boolean;
}) {
  const icon = INTENT_ICONS[result.intent] ?? <IconSparkles size={20} />;
  const intentLabel = INTENT_LABELS[result.intent] ?? result.intent;
  const confPct = Math.round(result.confidence * 100);
  const entityType = result.response.data?._type ? String(result.response.data._type) : null;
  const entitySig = entityType ? ENTITY_SIGNATURES[entityType] : null;

  return (
    <Stack gap={0}>
      {/* ── Card header with brand gradient accent ── */}
      <Box
        px="md"
        py="sm"
        style={{
          background: isDark
            ? `linear-gradient(135deg, rgba(45,204,211,0.12) 0%, rgba(12,35,64,0.12) 100%)`
            : `linear-gradient(135deg, ${AQUA_TINTS[10]} 0%, ${DEEP_BLUE_TINTS[10]} 100%)`,
          borderBottom: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : '#e8ecf2'}`,
        }}
      >
        <Group justify="space-between" align="flex-start">
          <Group gap="sm" style={{ flex: 1 }}>
            <ThemeIcon
              size={36}
              radius="lg"
              variant="filled"
              style={{ backgroundColor: DEEP_BLUE }}
            >
              {icon}
            </ThemeIcon>
            <div style={{ flex: 1 }}>
              <Text size="sm" fw={600} lh={1.4} style={{ fontFamily: FONT_FAMILY, color: isDark ? undefined : DEEP_BLUE }}>
                {result.response.message ?? 'No response'}
              </Text>
            </div>
          </Group>
          <Group gap={6} style={{ flexShrink: 0 }}>
            {entitySig && (
              <Badge
                size="xs"
                variant="light"
                color={entitySig.color}
                radius="sm"
                leftSection={entitySig.icon}
                style={{ fontFamily: FONT_FAMILY, textTransform: 'none' }}
              >
                {entitySig.label}
              </Badge>
            )}
            <Badge
              size="xs"
              variant="filled"
              radius="sm"
              style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY, letterSpacing: '0.03em' }}
            >
              {intentLabel}
            </Badge>
            <Tooltip label={`Resolved by ${result.resolvedBy} at ${confPct}% confidence`}>
              <Badge
                size="xs"
                variant="dot"
                color={result.confidence >= 0.75 ? 'green' : 'orange'}
                radius="sm"
                style={{ fontFamily: FONT_FAMILY }}
              >
                {confPct}%
              </Badge>
            </Tooltip>
          </Group>
        </Group>
      </Box>

      {/* ── Card body ── */}
      <Box px="md" py="sm">
        <CardBody result={result} onNavigate={onNavigate} onNavigateWithToast={onNavigateWithToast} onFormPrefill={onFormPrefill} isDark={isDark} />
      </Box>

      {/* ── Feedback row ── */}
      {result.queryLogId != null && (
        <FeedbackRow queryLogId={result.queryLogId} isDark={isDark} />
      )}
    </Stack>
  );
}

// ── Feedback Row ──────────────────────────────────────────────────────────

function FeedbackRow({ queryLogId, isDark }: { queryLogId: number; isDark: boolean }) {
  const feedback = useNlpFeedback();
  const undoMutation = useNlpFeedbackUndo();
  const [submitted, setSubmitted] = useState<'up' | 'down' | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [comment, setComment] = useState('');
  const [commentSent, setCommentSent] = useState(false);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  const startUndoWindow = () => {
    setUndoCountdown(10);
    undoTimerRef.current = setInterval(() => {
      setUndoCountdown((prev) => {
        if (prev <= 1) {
          if (undoTimerRef.current) clearInterval(undoTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    // After 10 seconds the undo window closes
    undoTimeoutRef.current = setTimeout(() => {
      setUndoCountdown(0);
    }, 10000);
  };

  const handleUndo = () => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoMutation.mutate({ queryLogId });
    setSubmitted(null);
    setCommentSent(false);
    setShowExplanation(false);
    setComment('');
    setScreenshotBase64(null);
    setScreenshotPreview(null);
    setUndoCountdown(0);
  };

  const handleFeedback = (rating: number) => {
    const dir = rating > 0 ? 'up' : 'down';
    setSubmitted(dir);
    if (rating > 0) {
      feedback.mutate({ queryLogId, rating });
      startUndoWindow();
    } else {
      setShowExplanation(true);
    }
  };

  const handleSubmitExplanation = () => {
    const trimmed = comment.trim();
    feedback.mutate({
      queryLogId,
      rating: -1,
      comment: trimmed || undefined,
      screenshot: screenshotBase64 || undefined,
    });
    setCommentSent(true);
    setShowExplanation(false);
    startUndoWindow();
  };

  const handleSkipExplanation = () => {
    feedback.mutate({ queryLogId, rating: -1 });
    setCommentSent(true);
    setShowExplanation(false);
    startUndoWindow();
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      notifications.show({ title: 'File too large', message: 'Max 500KB for screenshots', color: 'red' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setScreenshotBase64(base64);
      setScreenshotPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Box
      px="md"
      py={8}
      style={{
        borderTop: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : '#e8ecf2'}`,
        background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.015)',
      }}
    >
      <Group justify="flex-end" gap={6}>
        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Was this helpful?</Text>
        <Tooltip label="Thumbs up">
          <ActionIcon
            variant={submitted === 'up' ? 'filled' : 'subtle'}
            color={submitted === 'up' ? 'teal' : 'gray'}
            size="sm"
            radius="xl"
            onClick={() => handleFeedback(1)}
            disabled={submitted != null}
          >
            <IconThumbUp size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Thumbs down">
          <ActionIcon
            variant={submitted === 'down' ? 'filled' : 'subtle'}
            color={submitted === 'down' ? 'red' : 'gray'}
            size="sm"
            radius="xl"
            onClick={() => handleFeedback(-1)}
            disabled={submitted != null}
          >
            <IconThumbDown size={14} />
          </ActionIcon>
        </Tooltip>
        {(submitted === 'up' || commentSent) && undoCountdown > 0 && (
          <Button
            variant="subtle"
            color="gray"
            size="compact-xs"
            onClick={handleUndo}
            style={{ fontFamily: FONT_FAMILY }}
          >
            Undo ({undoCountdown}s)
          </Button>
        )}
        {(submitted === 'up' || commentSent) && undoCountdown === 0 && (
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Thanks for your feedback!
          </Text>
        )}
      </Group>

      {/* Explanation input — shown after thumbs-down */}
      {showExplanation && (
        <Box mt={8}>
          <Textarea
            placeholder="What were you expecting? (optional)"
            value={comment}
            onChange={(e) => setComment(e.currentTarget.value)}
            minRows={2}
            maxRows={4}
            autosize
            size="xs"
            styles={{
              input: {
                fontFamily: FONT_FAMILY,
                fontSize: '12px',
                background: isDark ? 'var(--mantine-color-dark-6)' : '#fff',
              },
            }}
          />
          {/* Screenshot upload */}
          <Group gap={6} mt={6}>
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              component="label"
              style={{ fontFamily: FONT_FAMILY, cursor: 'pointer' }}
            >
              {screenshotPreview ? 'Change screenshot' : 'Attach screenshot'}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleScreenshotUpload}
              />
            </Button>
            {screenshotPreview && (
              <img
                src={screenshotPreview}
                alt="Screenshot preview"
                style={{ height: 32, borderRadius: 4, border: '1px solid var(--mantine-color-gray-4)' }}
              />
            )}
          </Group>
          <Group justify="flex-end" gap={6} mt={6}>
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              onClick={handleSkipExplanation}
              style={{ fontFamily: FONT_FAMILY }}
            >
              Skip
            </Button>
            <Button
              variant="filled"
              color={AQUA}
              size="compact-xs"
              onClick={handleSubmitExplanation}
              style={{ fontFamily: FONT_FAMILY }}
            >
              Submit
            </Button>
          </Group>
        </Box>
      )}
    </Box>
  );
}

// ── Card Body ────────────────────────────────────────────────────────────────

function CardBody({
  result,
  onNavigate,
  onNavigateWithToast,
  onFormPrefill,
  isDark,
}: {
  result: NlpQueryResponse;
  onNavigate: (route: string) => void;
  onNavigateWithToast: (route: string, entityName?: string) => void;
  onFormPrefill: (route: string, formData: Record<string, unknown>) => void;
  isDark: boolean;
}) {
  const d = result.response.data;

  // ── Navigation action ──
  if (result.intent === 'NAVIGATE' && result.response.route) {
    return (
      <DrillDownButton route={result.response.route} onNavigate={onNavigate} label={`Go to ${result.response.route}`} />
    );
  }

  // ── Form prefill action ──
  if (result.intent === 'FORM_PREFILL' && result.response.route && result.response.formData) {
    return (
      <Stack gap="sm">
        <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Pre-filled fields</Text>
        <Group gap="xs">
          {Object.entries(result.response.formData).map(([key, val]) => (
            <Badge key={key} variant="light" radius="sm" size="sm" style={{ textTransform: 'none', backgroundColor: AQUA_TINTS[10], color: AQUA }}>
              {key}: {String(val)}
            </Badge>
          ))}
        </Group>
        <DrillDownButton
          route={result.response.route}
          onNavigate={() => onFormPrefill(result.response.route!, result.response.formData!)}
          label="Open form with pre-filled data"
        />
      </Stack>
    );
  }

  if (!d) {
    return <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View details" />;
  }

  const type = String(d._type ?? '');

  // ── Resource Profile ──
  if (type === 'RESOURCE_PROFILE') {
    const isEnriched = d.Role != null || d.POD != null || d.Location != null;
    if (isEnriched) {
      return (
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            <InfoTile icon={<IconUsers size={16} />} label="Role" value={str(d.Role)} accent={ROLE_COLORS[str(d.Role)] ?? 'blue'} />
            <InfoTile icon={<IconHexagons size={16} />} label="POD" value={str(d.POD)} accent="teal" />
            <InfoTile icon={<IconMapPin size={16} />} label="Location" value={str(d.Location)} accent={LOCATION_COLORS[str(d.Location)] ?? 'grape'} />
            <InfoTile icon={<IconCurrencyDollar size={16} />} label="Billing Rate" value={str(d['Billing Rate'])} accent="orange" />
            <InfoTile icon={<IconUser size={16} />} label="FTE" value={str(d.FTE)} accent="indigo" />
          </SimpleGrid>
          <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View on Resources page" />
        </Stack>
      );
    }
    return (
      <Stack gap="sm">
        <Paper p="sm" radius="md" withBorder style={{ borderLeft: `4px solid ${AQUA}` }}>
          <Group gap="sm">
            <ThemeIcon size={36} variant="light" radius="md" style={{ backgroundColor: AQUA_TINTS[10], color: AQUA }}>
              <IconUser size={20} />
            </ThemeIcon>
            <div>
              <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{str(d.entityName || d.Name)}</Text>
              <Text size="xs" c="dimmed">Click below to view full resource profile</Text>
            </div>
          </Group>
        </Paper>
        <DrillDownButton route={result.response.drillDown ?? `/resources`} onNavigate={onNavigate} label="View on Resources page" />
      </Stack>
    );
  }

  // ── Project Profile ──
  if (type === 'PROJECT_PROFILE') {
    // Check if this is an enriched response (has Priority/Owner) vs unenriched (only entityName)
    const isEnriched = d.Priority != null || d.Owner != null || d.Status != null;
    if (isEnriched) {
      return (
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            <InfoTile icon={<IconFlag size={16} />} label="Priority" value={str(d.Priority)} accent="red" />
            <InfoTile icon={<IconUser size={16} />} label="Owner" value={str(d.Owner)} accent="blue" />
            <InfoTile icon={<IconStatusChange size={16} />} label="Status" value={str(d.Status)} accent={STATUS_COLORS[str(d.Status)] ?? 'teal'} />
            <InfoTile icon={<IconHexagons size={16} />} label="Assigned PODs" value={str(d['Assigned PODs'] ?? d['Assigned Pods'])} accent="grape" />
            <InfoTile icon={<IconCalendarStats size={16} />} label="Timeline" value={str(d.Timeline)} accent="orange" />
            <InfoTile icon={<IconClock size={16} />} label="Duration" value={str(d.Duration)} accent="indigo" />
            {d.Client != null && (
              <InfoTile icon={<IconBuildingSkyscraper size={16} />} label="Client" value={str(d.Client)} accent="cyan" />
            )}
          </SimpleGrid>
          <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View on Projects page" />
        </Stack>
      );
    }
    // Unenriched — show entity name with navigation link
    return (
      <Stack gap="sm">
        <Paper p="sm" radius="md" withBorder style={{ borderLeft: `4px solid ${AQUA}` }}>
          <Group gap="sm">
            <ThemeIcon size={36} variant="light" radius="md" style={{ backgroundColor: AQUA_TINTS[10], color: AQUA }}>
              <IconBriefcase size={20} />
            </ThemeIcon>
            <div>
              <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{str(d.entityName || d.Name)}</Text>
              <Text size="xs" c="dimmed">Click below to view full project details</Text>
            </div>
          </Group>
        </Paper>
        <DrillDownButton route={result.response.drillDown ?? `/projects`} onNavigate={onNavigate} label="View on Projects page" />
      </Stack>
    );
  }

  // ── POD Profile ──
  if (type === 'POD_PROFILE') {
    return (
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <InfoTile icon={<IconUsers size={16} />} label="Members" value={str(d.Members)} accent="blue" />
          <InfoTile icon={<IconBriefcase size={16} />} label="Projects" value={str(d.Projects)} accent="teal" />
          <InfoTile icon={<IconPercentage size={16} />} label="Avg BAU" value={str(d['Avg BAU'])} accent="orange" />
          <InfoTile
            icon={d.Active === 'Yes' ? <IconCheck size={16} /> : <IconX size={16} />}
            label="Active"
            value={str(d.Active)}
            accent={d.Active === 'Yes' ? 'green' : 'red'}
          />
        </SimpleGrid>
        <BadgeListSection label="Team Members" items={str(d.Team)} color="blue" />
        <BadgeListSection label="Assigned Projects" items={str(d['Project List'])} color="teal" />
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View on PODs page" />
      </Stack>
    );
  }

  // ── Sprint Profile ──
  if (type === 'SPRINT_PROFILE') {
    return (
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
          <InfoTile icon={<IconPlayerPlay size={16} />} label="Type" value={str(d.Type)} accent="blue" />
          <InfoTile icon={<IconCalendarEvent size={16} />} label="Start Date" value={str(d['Start Date'])} accent="teal" />
          <InfoTile icon={<IconCalendarEvent size={16} />} label="End Date" value={str(d['End Date'])} accent="grape" />
          {d['Lock-in Date'] != null && (
            <InfoTile icon={<IconLock size={16} />} label="Lock-in Date" value={str(d['Lock-in Date'])} accent="orange" />
          )}
          <InfoTile
            icon={<IconStatusChange size={16} />}
            label="Status"
            value={str(d.Status)}
            accent={STATUS_COLORS[str(d.Status)] ?? 'gray'}
          />
        </SimpleGrid>
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View on Sprint Calendar" />
      </Stack>
    );
  }

  // ── Release Profile ──
  if (type === 'RELEASE_PROFILE') {
    return (
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
          <InfoTile icon={<IconRocket size={16} />} label="Release Date" value={str(d['Release Date'])} accent="teal" />
          <InfoTile icon={<IconSnowflake size={16} />} label="Code Freeze" value={str(d['Code Freeze'])} accent="blue" />
          <InfoTile icon={<IconPlayerPlay size={16} />} label="Type" value={str(d.Type)} accent="grape" />
          <InfoTile
            icon={<IconStatusChange size={16} />}
            label="Status"
            value={str(d.Status)}
            accent={STATUS_COLORS[str(d.Status)] ?? 'orange'}
          />
        </SimpleGrid>
        {d.Notes != null && <NotesBox text={str(d.Notes)} />}
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View on Release Calendar" />
      </Stack>
    );
  }

  // ── Comparison ──
  if (type === 'COMPARISON') {
    return (
      <Stack gap="sm">
        <Group gap="xs" mb={4}>
          <Badge variant="filled" size="sm" style={{ backgroundColor: DEEP_BLUE }}>{str(d.entityA)}</Badge>
          <Text size="xs" c="dimmed" fw={700}>vs</Text>
          <Badge variant="filled" size="sm" style={{ backgroundColor: AQUA }}>{str(d.entityB)}</Badge>
        </Group>
        <ComparisonTable data={d} />
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View full report" />
      </Stack>
    );
  }

  // ── LIST card (team members, projects, releases, sprints) ──
  if (type === 'LIST') {
    const itemCount = Object.keys(d).filter(k => /^#\d+$/.test(k)).length;
    const hasNoItems = itemCount === 0 && str(d.Count) === '0';

    return (
      <Stack gap="sm">
        {/* Summary metrics */}
        <SummaryRow data={d} excludeKeys={['Members', 'Projects', 'listType']} />

        {/* Empty state */}
        {hasNoItems ? (
          <Paper p="xl" radius="md" withBorder style={{ textAlign: 'center', borderStyle: 'dashed', borderColor: 'var(--mantine-color-gray-4)' }}>
            <ThemeIcon size={48} variant="light" color="gray" radius="xl" style={{ margin: '0 auto 8px' }}>
              <IconMoodEmpty size={28} />
            </ThemeIcon>
            <Text size="sm" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              No matching items found
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Try adjusting your query or broadening your search criteria.
            </Text>
          </Paper>
        ) : (
          /* Numbered items rendered as clickable mini-cards */
          <NumberedItemList data={d} onNavigate={onNavigateWithToast} />
        )}

        {/* Members badges */}
        <BadgeListSection label="Members" items={str(d.Members)} color="blue" />

        {/* Projects badges */}
        {d.Projects != null && d.listType === 'PROJECTS' && (
          <BadgeListSection label="Projects" items={str(d.Projects)} color="teal" />
        )}

        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View details" />
      </Stack>
    );
  }

  // ── Export ──
  if (type === 'EXPORT') {
    return (
      <Stack gap="sm">
        <Paper p="sm" radius="md" withBorder style={{ borderLeft: `4px solid ${AQUA}` }}>
          <Group gap="sm">
            <ThemeIcon size={40} variant="light" radius="md" style={{ backgroundColor: AQUA_TINTS[10], color: AQUA }}>
              <IconDownload size={22} />
            </ThemeIcon>
            <div>
              <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
                {str(d.label) || 'Data'} Export
              </Text>
              <Text size="xs" c="dimmed">Click to download as CSV</Text>
            </div>
          </Group>
        </Paper>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconDownload size={14} />}
          component="a"
          href={str(d.exportUrl) || '#'}
          target="_blank"
          style={{ alignSelf: 'flex-start', color: AQUA }}
        >
          Download CSV
        </Button>
      </Stack>
    );
  }

  // ── Risk Summary / Insight ──
  if ((type === 'RISK_SUMMARY' && result.intent === 'INSIGHT') || (result.intent === 'INSIGHT' && d)) {
    // Collect summary tiles (keys with short string/number values, NOT numbered items)
    const summaryEntries = Object.entries(d)
      .filter(([k, v]) => !k.startsWith('_') && !k.startsWith('#') && typeof v === 'string' && (v as string).length < 40);
    // Collect numbered items (keys like "#1", "#2", etc.)
    const numberedItems = Object.entries(d)
      .filter(([k]) => /^#\d+$/.test(k))
      .sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)));
    // Collect status/meta entries
    const statusEntry = d['Status'] as string | undefined;

    return (
      <Stack gap="sm">
        {summaryEntries.length > 0 && (
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            {summaryEntries.map(([label, value]) => {
              const numVal = Number(value);
              let accent = 'blue';
              const lower = label.toLowerCase();
              if (lower.includes('over') || lower.includes('p0') || lower.includes('risk') || lower.includes('strained')) accent = numVal > 0 ? 'red' : 'green';
              else if (lower.includes('under') || lower.includes('idle') || lower.includes('unassigned')) accent = numVal > 0 ? 'orange' : 'green';
              else if (lower.includes('hold') || lower.includes('need')) accent = numVal > 0 ? 'yellow' : 'green';
              else if (lower.includes('high') || lower.includes('load')) accent = numVal > 0 ? 'orange' : 'green';
              else if (lower.includes('total') || lower.includes('active')) accent = 'blue';
              const icon = lower.includes('pod') ? <IconHexagons size={16} />
                : lower.includes('project') ? <IconBriefcase size={16} />
                : lower.includes('hiring') || lower.includes('need') ? <IconUsers size={16} />
                : <IconChartBar size={16} />;
              return <InfoTile key={label} icon={icon} label={label} value={str(value)} accent={accent} />;
            })}
          </SimpleGrid>
        )}
        {numberedItems.length > 0 && (
          <Stack gap={6}>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: '0.06em' }}>Details</Text>
            {numberedItems.map(([key, value]) => (
              <Paper key={key} p="xs" radius="md" withBorder className="nlp-list-item" style={{ borderLeft: `3px solid ${AQUA}` }}>
                <Group gap="sm" wrap="nowrap">
                  <Badge size="sm" radius="sm" variant="filled" style={{ backgroundColor: DEEP_BLUE, minWidth: 28, textAlign: 'center' }}>
                    {key}
                  </Badge>
                  <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>{str(value)}</Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
        {statusEntry && numberedItems.length === 0 && (
          <Paper p="sm" radius="md" withBorder style={{ borderLeft: `3px solid var(--mantine-color-green-5)` }}>
            <Group gap="sm">
              <IconCheck size={16} color="var(--mantine-color-green-6)" />
              <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>{statusEntry}</Text>
            </Group>
          </Paper>
        )}
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View full report" />
      </Stack>
    );
  }

  // ── Resource Analytics ──
  if (type === 'RESOURCE_ANALYTICS') {
    return (
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
          {d.Count != null && <InfoTile icon={<IconUsers size={16} />} label="Count" value={str(d.Count)} accent="blue" />}
          {d['Matching Resources'] != null && <InfoTile icon={<IconUsers size={16} />} label="Resources" value={str(d['Matching Resources'])} accent="blue" />}
          {d['Total FTE'] != null && <InfoTile icon={<IconUser size={16} />} label="Total FTE" value={str(d['Total FTE'])} accent="teal" />}
          {d['Average Billing Rate'] != null && <InfoTile icon={<IconCurrencyDollar size={16} />} label="Avg Rate" value={str(d['Average Billing Rate'])} accent="orange" />}
          {d['Min Rate'] != null && <InfoTile icon={<IconCurrencyDollar size={16} />} label="Min Rate" value={str(d['Min Rate'])} accent="green" />}
          {d['Max Rate'] != null && <InfoTile icon={<IconCurrencyDollar size={16} />} label="Max Rate" value={str(d['Max Rate'])} accent="red" />}
        </SimpleGrid>
        <SummaryRow data={d} excludeKeys={['Filter', 'Count', 'Matching Resources', 'Total FTE', 'Average Billing Rate', 'Min Rate', 'Max Rate', 'Total Count']} />
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View on Resources page" />
      </Stack>
    );
  }

  // ── Cost Rate / T-shirt Size ──
  if (type === 'COST_RATE') {
    return (
      <Stack gap="sm">
        {d.Filter != null && <Text size="xs" c="dimmed" fw={600}>{str(d.Filter)}</Text>}
        <Paper p={0} radius="md" withBorder style={{ overflow: 'hidden' }}>
          {Object.entries(d)
            .filter(([k]) => !k.startsWith('_') && k !== 'Filter')
            .map(([label, value], idx, arr) => (
              <Group key={label} gap="xs" justify="space-between" px="sm" py={8}
                style={{
                  borderBottom: idx < arr.length - 1 ? '1px solid var(--mantine-color-default-border)' : undefined,
                  backgroundColor: idx % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
                }}
              >
                <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>{label}</Text>
                <Badge variant="light" radius="sm" size="sm" style={{ textTransform: 'none', backgroundColor: AQUA_TINTS[10], color: AQUA }}>{String(value)}</Badge>
              </Group>
            ))}
        </Paper>
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View reference data" />
      </Stack>
    );
  }

  // ── Capabilities ──
  if (type === 'CAPABILITIES' && result.intent === 'HELP') {
    return (
      <Stack gap={6}>
        {Object.entries(d)
          .filter(([k]) => !k.startsWith('_'))
          .map(([category, examples]) => (
            <Paper key={category} p="xs" radius="md" withBorder style={{ borderLeft: `3px solid ${AQUA}` }}>
              <Text size="xs" fw={700} style={{ fontFamily: FONT_FAMILY, color: AQUA }}>{category}</Text>
              <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>{String(examples)}</Text>
            </Paper>
          ))}
      </Stack>
    );
  }

  // ── Project Estimates ──
  if (type === 'PROJECT_ESTIMATES') {
    return (
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <InfoTile icon={<IconChartBar size={16} />} label="Grand Total" value={`${d['Grand Total Hours'] ?? '0'}h`} accent="teal" highlight />
          <InfoTile icon={<IconHexagons size={16} />} label="PODs" value={str(d['POD Count'])} accent="grape" />
          <InfoTile icon={<IconUsers size={16} />} label="Dev Hours" value={`${d['Dev Hours'] ?? '0'}h`} accent="indigo" />
          <InfoTile icon={<IconListCheck size={16} />} label="QA Hours" value={`${d['QA Hours'] ?? '0'}h`} accent="orange" />
          <InfoTile icon={<IconNotes size={16} />} label="BSA Hours" value={`${d['BSA Hours'] ?? '0'}h`} accent="cyan" />
          <InfoTile icon={<IconUser size={16} />} label="TL Hours" value={`${d['Tech Lead Hours'] ?? '0'}h`} accent="red" />
        </SimpleGrid>
        {Array.isArray(d.podBreakdown) && d.podBreakdown.length > 0 && (
          <Box>
            <SectionLabel text="POD Breakdown" />
            <Stack gap={6}>
              {(d.podBreakdown as Array<Record<string, string>>).map((pod, idx) => (
                <Paper key={idx} p="xs" radius="md" withBorder className="nlp-list-item" style={{ borderLeft: `3px solid ${AQUA}` }}>
                  <Group justify="space-between">
                    <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{pod.POD}</Text>
                    <Badge variant="filled" size="sm" radius="sm" style={{ backgroundColor: AQUA }}>{pod.Total}h</Badge>
                  </Group>
                  <Group gap={6} mt={6}>
                    <RoleBadge role="Dev" value={pod.Dev} />
                    <RoleBadge role="QA" value={pod.QA} />
                    <RoleBadge role="BSA" value={pod.BSA} />
                    <RoleBadge role="TL" value={pod.TL} />
                    <Badge variant="outline" size="xs" radius="sm" color="gray">±{pod.Contingency}</Badge>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View on Projects page" />
      </Stack>
    );
  }

  // ── Sprint Allocations ──
  if (type === 'SPRINT_ALLOCATIONS') {
    return (
      <Stack gap="sm">
        <CountHeader title={str(d.Title) || 'Sprint Allocations'} count={d.Count} unit="allocation" />
        {Array.isArray(d.allocations) && (
          <Stack gap={6}>
            {(d.allocations as Array<Record<string, string>>).map((alloc, idx) => (
              <Paper key={idx} p="xs" radius="md" withBorder className="nlp-list-item" style={{ borderLeft: `3px solid ${AQUA}` }}>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{alloc.Project}</Text>
                    <Text size="xs" c="dimmed">{alloc.Sprint} · {alloc.POD}</Text>
                  </div>
                  <Badge variant="filled" size="sm" radius="sm" style={{ backgroundColor: AQUA }}>{alloc.Total}h</Badge>
                </Group>
                <Group gap={6} mt={6}>
                  <RoleBadge role="Dev" value={alloc.Dev} />
                  <RoleBadge role="QA" value={alloc.QA} />
                  <RoleBadge role="BSA" value={alloc.BSA} />
                  <RoleBadge role="TL" value={alloc.TL} />
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View Sprint Planner" />
      </Stack>
    );
  }

  // ── Resource Availability ──
  if (type === 'RESOURCE_AVAILABILITY') {
    return (
      <Stack gap="sm">
        <CountHeader title={str(d.Title) || 'Resource Availability'} count={d.Count} unit="record" />
        {Array.isArray(d.entries) && (
          <Stack gap={6}>
            {(d.entries as Array<Record<string, string>>).map((entry, idx) => (
              <Paper key={idx} p="xs" radius="md" withBorder className="nlp-list-item">
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{entry.Resource}</Text>
                    <Text size="xs" c="dimmed">{entry.Role} · {entry.POD}</Text>
                  </div>
                  <Group gap={6}>
                    <Badge variant="light" color="grape" size="sm" radius="sm">{entry.Month}</Badge>
                    <Badge variant="filled" size="sm" radius="sm" style={{ backgroundColor: AQUA }}>{entry.Hours}h</Badge>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View Availability page" />
      </Stack>
    );
  }

  // ── Project Dependencies ──
  if (type === 'PROJECT_DEPENDENCIES') {
    return (
      <Stack gap="sm">
        <CountHeader title={str(d.Title) || 'Project Dependencies'} count={d.Count} unit="dependency" color="orange" />
        {Array.isArray(d.dependencies) && (
          <Stack gap={6}>
            {(d.dependencies as Array<Record<string, string>>).map((dep, idx) => (
              <Paper key={idx} p="xs" radius="md" withBorder className="nlp-list-item" style={{ borderLeft: '3px solid var(--mantine-color-orange-5)' }}>
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{dep.Project}</Text>
                    <Text size="xs" c="dimmed">Blocked by <strong>{dep['Blocked By']}</strong></Text>
                  </div>
                  <Group gap={4}>
                    <Badge variant="light" size="xs" radius="sm" color={STATUS_COLORS[dep['Project Status']] ?? 'blue'}>{dep['Project Status']}</Badge>
                    <IconChevronRight size={12} style={{ opacity: 0.4 }} />
                    <Badge variant="light" size="xs" radius="sm" color={STATUS_COLORS[dep['Blocker Status']] ?? 'gray'}>{dep['Blocker Status']}</Badge>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View Cross-POD Dependencies" />
      </Stack>
    );
  }

  // ── Project Actuals ──
  if (type === 'PROJECT_ACTUALS') {
    return (
      <Stack gap="sm">
        <CountHeader title={str(d.Title) || 'Project Actuals'} count={d.Count} unit="record" />
        {Array.isArray(d.entries) && (
          <Stack gap={6}>
            {(d.entries as Array<Record<string, string>>).map((entry, idx) => (
              <Paper key={idx} p="xs" radius="md" withBorder className="nlp-list-item">
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{entry.Project}</Text>
                    <Text size="xs" c="dimmed">{entry.Month}</Text>
                  </div>
                  <Badge variant="filled" size="sm" radius="sm" style={{ backgroundColor: AQUA }}>{entry['Actual Hours'] ?? entry.Actual}h</Badge>
                </Group>
                {entry.Estimated && entry['Over By'] != null && (
                  <Group gap={6} mt={6}>
                    <Badge variant="outline" size="xs" radius="sm" color="blue">Est: {entry.Estimated}h</Badge>
                    <Badge variant="filled" size="xs" radius="sm" color="red">+{entry['Over By']}h over</Badge>
                  </Group>
                )}
              </Paper>
            ))}
          </Stack>
        )}
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View Budget & Cost" />
      </Stack>
    );
  }

  // ── Effort Patterns ──
  if (type === 'EFFORT_PATTERN' || type === 'EFFORT_PATTERN_LIST') {
    return (
      <Stack gap="sm">
        {d.Name != null && !Array.isArray(d.patterns) && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <InfoTile icon={<IconArrowsSplit size={16} />} label="Pattern" value={str(d.Name)} accent="grape" />
            <InfoTile icon={<IconNotes size={16} />} label="Description" value={str(d.Description)} accent="blue" />
          </SimpleGrid>
        )}
        {Array.isArray(d.patterns) && (
          <Stack gap={6}>
            {(d.patterns as Array<Record<string, string>>).map((p, idx) => (
              <Paper key={idx} p="xs" radius="md" withBorder className="nlp-list-item" style={{ borderLeft: `3px solid var(--mantine-color-grape-5)` }}>
                <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{p.Name}</Text>
                <Text size="xs" c="dimmed">{p.Description}</Text>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    );
  }

  // ── Role Effort Mix ──
  if (type === 'ROLE_EFFORT_MIX') {
    return (
      <Stack gap="sm">
        {Array.isArray(d.roles) && (
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            {(d.roles as Array<Record<string, string>>).map((r, idx) => (
              <InfoTile
                key={idx}
                icon={<IconPercentage size={16} />}
                label={r.Role}
                value={r['Mix %']}
                accent={['indigo', 'orange', 'cyan', 'red'][idx % 4]}
              />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    );
  }

  // ── Generic Data / Insight fallback ──
  if (!['NAVIGATE_ACTION'].includes(type)) {
    return (
      <Stack gap="sm">
        <SummaryRow data={d} excludeKeys={['entityName', 'listType', 'filterValue', 'filterRole', 'filterLocation']} />
        <DrillDownButton route={result.response.drillDown} onNavigate={onNavigate} label="View full report" />
      </Stack>
    );
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Shared Sub-Components ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function str(val: unknown): string {
  if (val == null) return '–';
  return String(val);
}

// ── Info Tile (improved) ──

function InfoTile({
  icon, label, value, accent, highlight,
}: {
  icon: React.ReactNode; label: string; value: string; accent: string; highlight?: boolean;
}) {
  return (
    <Paper
      p="xs"
      radius="md"
      withBorder
      className="nlp-info-tile"
      style={{
        borderLeft: `3px solid var(--mantine-color-${accent}-5)`,
        backgroundColor: highlight ? `var(--mantine-color-${accent}-0)` : undefined,
      }}
    >
      <Group gap={8} wrap="nowrap">
        <ThemeIcon size={26} variant="light" color={accent} radius="md">
          {icon}
        </ThemeIcon>
        <div style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" lh={1.2} tt="uppercase" fw={600} style={{ letterSpacing: '0.04em' }}>{label}</Text>
          <Text size="sm" fw={600} lh={1.3} truncate style={{ fontFamily: FONT_FAMILY }}>
            {value}
          </Text>
        </div>
      </Group>
    </Paper>
  );
}

// ── Drill-down button ──

function DrillDownButton({
  route, onNavigate, label,
}: {
  route: string | null | undefined; onNavigate: (route: string) => void; label: string;
}) {
  if (!route) return null;
  return (
    <Anchor
      size="sm"
      fw={500}
      onClick={() => onNavigate(route)}
      style={{ cursor: 'pointer', color: AQUA, fontFamily: FONT_FAMILY, display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      {label} <IconExternalLink size={14} />
    </Anchor>
  );
}

// ── Section label ──

function SectionLabel({ text }: { text: string }) {
  return (
    <Text size="xs" c="dimmed" fw={700} tt="uppercase" mb={4} style={{ letterSpacing: '0.06em' }}>{text}</Text>
  );
}

// ── Count header ──

function CountHeader({ title, count, unit, color }: { title: string; count: unknown; unit: string; color?: string }) {
  return (
    <Group gap="xs">
      <Text size="sm" fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>{title}</Text>
      <Badge className="nlp-count-animate" variant="filled" size="sm" radius="sm" style={{ backgroundColor: color === 'orange' ? 'var(--mantine-color-orange-6)' : AQUA }}>
        {str(count)} {unit}(s)
      </Badge>
    </Group>
  );
}

// ── Role badge (for hour breakdowns) ──

const ROLE_BADGE_COLORS: Record<string, string> = {
  Dev: 'indigo', QA: 'orange', BSA: 'cyan', TL: 'red',
};

function RoleBadge({ role, value }: { role: string; value: string }) {
  return (
    <Badge variant="light" size="xs" radius="sm" color={ROLE_BADGE_COLORS[role] ?? 'gray'} style={{ fontFamily: FONT_FAMILY }}>
      {role}: {value}h
    </Badge>
  );
}

// ── Badge list section (comma-separated → badges) ──

function BadgeListSection({ label, items, color }: { label: string; items: string; color: string }) {
  if (!items || items === '–') return null;
  const names = items.split(', ').filter(Boolean);
  if (names.length === 0) return null;
  return (
    <Box>
      <SectionLabel text={label} />
      <Group gap={6}>
        {names.map((name) => (
          <Badge key={name} variant="light" color={color} size="sm" radius="sm" style={{ textTransform: 'none' }}>
            {name}
          </Badge>
        ))}
      </Group>
    </Box>
  );
}

// ── Summary row (key-value pairs, excluding _ keys and specific keys) ──

function SummaryRow({ data, excludeKeys }: { data: Record<string, unknown>; excludeKeys: string[] }) {
  const entries = Object.entries(data)
    .filter(([k]) => !k.startsWith('_') && !k.startsWith('#') && !excludeKeys.includes(k))
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object');
  if (entries.length === 0) return null;
  return (
    <Paper p={0} radius="md" withBorder style={{ overflow: 'hidden' }}>
      {entries.map(([key, val], idx) => (
        <Group key={key} gap="xs" justify="space-between" px="sm" py={6}
          style={{ borderBottom: idx < entries.length - 1 ? '1px solid var(--mantine-color-default-border)' : undefined }}
        >
          <Text size="xs" c="dimmed" fw={600} style={{ fontFamily: FONT_FAMILY }}>{key}</Text>
          <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>{String(val)}</Text>
        </Group>
      ))}
    </Paper>
  );
}

// ── Numbered item list (for #1, #2, ... keys from LIST-type responses) ──

const NLP_LIST_PAGE_SIZE = 5;

function NumberedItemList({ data, onNavigate }: { data: Record<string, unknown>; onNavigate: (route: string, entityName?: string) => void }) {
  const [listPage, setListPage] = useState(1);

  const allItems = useMemo(() =>
    Object.entries(data)
      .filter(([k]) => /^#\d+$/.test(k))
      .sort(([a], [b]) => parseInt(a.slice(1)) - parseInt(b.slice(1))),
    [data]
  );
  if (allItems.length === 0) return null;

  const itemIds = Array.isArray(data._itemIds) ? (data._itemIds as number[]) : [];
  const itemType = typeof data._itemType === 'string' ? data._itemType : null;
  const totalPages = Math.ceil(allItems.length / NLP_LIST_PAGE_SIZE);
  const startIdx = (listPage - 1) * NLP_LIST_PAGE_SIZE;
  const pageItems = allItems.slice(startIdx, startIdx + NLP_LIST_PAGE_SIZE);

  const getItemRoute = (index: number): string | null => {
    if (!itemType || index >= itemIds.length) return null;
    const id = itemIds[index];
    switch (itemType) {
      case 'PROJECT': return `/projects/${id}`;
      case 'POD': return `/pods/${id}`;
      case 'RESOURCE': return `/resources?highlight=${id}`;
      default: return null;
    }
  };

  return (
    <Stack gap={4}>
      {pageItems.map(([key, val], idx) => {
        const globalIdx = startIdx + idx;
        const text = String(val);
        // Parse: "Name [Priority] — Status (extra)" or "Name — Detail · Detail"
        const match = text.match(/^(.+?)(?:\s*\[(.+?)\])?\s*(?:—|–|-)\s*(.+)$/);
        const name = match ? match[1].trim() : text;
        const priority = match ? match[2] : null;
        const rest = match ? match[3].trim() : null;
        // Check if rest contains a known status
        const statusMatch = rest?.match(/^(Active|Completed|In Discovery|Not Started|On Hold|Cancelled)/);
        const status = statusMatch ? statusMatch[1] : null;
        const extra = status && rest ? rest.slice(status.length).replace(/^\s*\(?/, '').replace(/\)?\s*$/, '').trim() : rest;
        const statusColor = STATUS_COLORS[status ?? ''] ?? 'gray';
        // Extract role and location from "Role · PodName · Location" pattern
        const parts = rest?.split(/\s*·\s*/) ?? [];
        const detectedRole = parts.find(p => Object.keys(ROLE_COLORS).includes(p.trim())) ?? null;
        const detectedLocation = parts.find(p => Object.keys(LOCATION_COLORS).includes(p.trim())) ?? null;
        const route = getItemRoute(globalIdx);
        const isClickable = !!route;

        return (
          <Paper
            key={key}
            px="sm"
            py={8}
            radius="md"
            withBorder
            className={`nlp-list-item nlp-stagger-item`}
            onClick={isClickable ? () => onNavigate(route!, name) : undefined}
            style={{
              borderLeft: `3px solid ${AQUA}`,
              cursor: isClickable ? 'pointer' : 'default',
              animationDelay: `${idx * 50}ms`,
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" fw={700} c="dimmed" style={{ fontFamily: FONT_FAMILY, flexShrink: 0 }}>
                  {key.slice(1)}
                </Text>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text size="sm" fw={600} truncate style={{ fontFamily: FONT_FAMILY, color: isClickable ? DEEP_BLUE : undefined }}>
                    {name}
                  </Text>
                  {extra && (
                    <Text size="xs" c="dimmed" truncate style={{ fontFamily: FONT_FAMILY }}>
                      {extra}
                    </Text>
                  )}
                </div>
              </Group>
              <Group gap={6} style={{ flexShrink: 0 }}>
                {priority && (
                  <Badge variant="light" size="xs" radius="sm" color={priority === 'P0' ? 'red' : priority === 'P1' ? 'orange' : 'blue'}
                    style={{ fontFamily: FONT_FAMILY }}>
                    {priority}
                  </Badge>
                )}
                {status && (
                  <Badge variant="light" size="xs" radius="sm" color={statusColor}
                    style={{ fontFamily: FONT_FAMILY, textTransform: 'none' }}>
                    {status}
                  </Badge>
                )}
                {detectedRole && (
                  <Badge variant="light" size="xs" radius="sm" color={ROLE_COLORS[detectedRole] ?? 'gray'}
                    style={{ fontFamily: FONT_FAMILY, textTransform: 'none' }}>
                    {detectedRole}
                  </Badge>
                )}
                {detectedLocation && (
                  <Badge variant="light" size="xs" radius="sm" color={LOCATION_COLORS[detectedLocation] ?? 'gray'}
                    style={{ fontFamily: FONT_FAMILY, textTransform: 'none' }}>
                    {detectedLocation}
                  </Badge>
                )}
                {isClickable && (
                  <IconChevronRight size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
                )}
              </Group>
            </Group>
          </Paper>
        );
      })}

      {/* Pagination controls for NLP lists */}
      {totalPages > 1 && (
        <Group justify="space-between" mt={4}>
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            {startIdx + 1}–{Math.min(startIdx + NLP_LIST_PAGE_SIZE, allItems.length)} of {allItems.length} items
          </Text>
          <Group gap={4}>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              disabled={listPage <= 1}
              onClick={() => setListPage(p => p - 1)}
              aria-label="Previous page"
            >
              <IconChevronRight size={12} style={{ transform: 'rotate(180deg)' }} />
            </ActionIcon>
            <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY }}>
              {listPage}/{totalPages}
            </Text>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              disabled={listPage >= totalPages}
              onClick={() => setListPage(p => p + 1)}
              aria-label="Next page"
            >
              <IconChevronRight size={12} />
            </ActionIcon>
          </Group>
        </Group>
      )}
    </Stack>
  );
}

// ── Notes box ──

function NotesBox({ text }: { text: string }) {
  return (
    <Paper p="xs" radius="md" withBorder style={{ borderLeft: `3px solid var(--mantine-color-gray-5)` }}>
      <Group gap={6} wrap="nowrap" align="flex-start">
        <ThemeIcon size={24} variant="light" color="gray" radius="sm"><IconNotes size={16} /></ThemeIcon>
        <div>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Notes</Text>
          <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>{text}</Text>
        </div>
      </Group>
    </Paper>
  );
}

// ── Comparison Table ────────────────────────────────────────────────────────

function ComparisonTable({ data }: { data: Record<string, unknown> }) {
  const entityA = String(data.entityA ?? '');
  const entityB = String(data.entityB ?? '');

  const metricsA: [string, string][] = [];
  const metricsB: [string, string][] = [];

  Object.entries(data).forEach(([key, val]) => {
    if (key.startsWith('_') || key === 'compareType' || key === 'entityA' || key === 'entityB') return;
    if (key.startsWith(entityA + ' ')) {
      metricsA.push([key.replace(entityA + ' ', ''), String(val)]);
    } else if (key.startsWith(entityB + ' ')) {
      metricsB.push([key.replace(entityB + ' ', ''), String(val)]);
    }
  });

  return (
    <Paper p={0} radius="md" withBorder style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: DEEP_BLUE }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: FONT_FAMILY, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Metric</th>
            <th style={{ textAlign: 'center', padding: '8px 12px' }}>
              <Badge variant="filled" size="xs" style={{ backgroundColor: AQUA }}>{entityA}</Badge>
            </th>
            <th style={{ textAlign: 'center', padding: '8px 12px' }}>
              <Badge variant="filled" size="xs" color="grape">{entityB}</Badge>
            </th>
          </tr>
        </thead>
        <tbody>
          {metricsA.map(([metric, valA], i) => {
            const valB = metricsB[i]?.[1] ?? '–';
            return (
              <tr key={metric} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, fontFamily: FONT_FAMILY }}>{metric}</td>
                <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'center', fontFamily: FONT_FAMILY }}>{valA}</td>
                <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'center', fontFamily: FONT_FAMILY }}>{valB}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Paper>
  );
}
