/**
 * GlobalSearch — Cmd+K / Ctrl+K command palette.  Sprint 7 S7.1 enhanced.
 *
 * Searches across: pages (nav), projects, resources, PODs.
 * Results are purely client-side (uses already-cached TanStack Query data).
 *
 * New in Sprint 7:
 *   - Recent pages tracking (last 8, persisted to localStorage)
 *   - Action commands: New Project, Ask AI, Export, Sprint Planner
 *   - People / resource search surfaced at top level
 *   - Fuzzy-ish matching: checks label, sublabel and all badges
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal, TextInput, Stack, Text, Group, Badge, Kbd, ScrollArea,
  UnstyledButton, Divider,
} from '@mantine/core';
import {
  IconSearch, IconBriefcase, IconUsers, IconHexagons,
  IconChartBar, IconDashboard, IconSettings, IconArrowRight,
  IconBrain, IconInbox, IconTargetArrow, IconAlertTriangle,
  IconBulb, IconCalendarStats, IconArrowsShuffle, IconCalendarPlus,
  IconFlame, IconCalendarOff, IconCalendar, IconTemplate,
  IconUsersGroup, IconTag, IconPackage, IconTicket, IconClock,
  IconCurrencyDollar, IconShieldCheck, IconHeartRateMonitor,
  IconTimeline, IconChartInfographic, IconGitBranch,
  IconReportMoney, IconRocket, IconChartDots3, IconLayoutDashboard,
  IconPlayerPlay, IconAdjustments, IconBellRinging, IconPlugConnected,
  IconBuildingFactory, IconTrendingUp, IconUserSearch,
  IconChartPie, IconSparkles, IconBellCog,
  IconLayoutBoard, IconUpload, IconTarget, IconLayoutGrid,
  IconHistory, IconBolt, IconPlus,
} from '@tabler/icons-react';
import { useProjects } from '../../api/projects';
import { useResources } from '../../api/resources';
import { usePods } from '../../api/pods';
import { AQUA, DARK_SIDEBAR, SIDEBAR_INACTIVE} from '../../brandTokens';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  category: string;
  icon: React.ReactNode;
  path: string;
  badges?: string[];
  isAction?: boolean;     // action commands don't get "recent" tracked
}

// ── Recent pages (localStorage) ─────────────────────────────────────────────
const RECENT_KEY = 'pp_recent_pages';
const MAX_RECENT  = 8;

interface RecentEntry { id: string; label: string; path: string; category: string }

function getRecent(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch { return []; }
}

function addRecent(result: SearchResult) {
  if (result.isAction) return;
  const entry: RecentEntry = { id: result.id, label: result.label, path: result.path, category: result.category };
  const existing = getRecent().filter(r => r.id !== entry.id);
  const next = [entry, ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

// ── Static nav pages — kept in sync with navGroups in AppShell.tsx ──────────
const PAGE_RESULTS: SearchResult[] = [
  // Home
  { id: 'p-dash',   label: 'Dashboard',          category: 'Home',        icon: <IconDashboard size={15} />,        path: '/' },
  { id: 'p-inbox',  label: 'Inbox',              category: 'Home',        icon: <IconInbox size={15} />,            path: '/inbox' },
  { id: 'p-nlp',    label: 'Ask AI',             category: 'Home',        icon: <IconBrain size={15} />,            path: '/nlp' },

  // Portfolio
  { id: 'p-proj',   label: 'Projects',           category: 'Portfolio',   icon: <IconBriefcase size={15} />,        path: '/projects' },
  { id: 'p-pods',   label: 'PODs',               category: 'Portfolio',   icon: <IconHexagons size={15} />,         path: '/pods' },
  { id: 'p-obj',    label: 'Objectives',         category: 'Portfolio',   icon: <IconTargetArrow size={15} />,      path: '/objectives' },
  { id: 'p-risk',   label: 'Risk & Issues',      category: 'Portfolio',   icon: <IconAlertTriangle size={15} />,    path: '/risk-register' },
  { id: 'p-ideas',  label: 'Ideas Board',        category: 'Portfolio',   icon: <IconBulb size={15} />,             path: '/ideas' },

  // People
  { id: 'p-res',    label: 'Resources',          category: 'People',      icon: <IconUsers size={15} />,            path: '/resources' },
  { id: 'p-avail',  label: 'Availability',       category: 'People',      icon: <IconCalendarStats size={15} />,    path: '/availability' },
  { id: 'p-over',   label: 'Overrides',          category: 'People',      icon: <IconArrowsShuffle size={15} />,    path: '/overrides' },
  { id: 'p-book',   label: 'Bookings',           category: 'People',      icon: <IconCalendarPlus size={15} />,     path: '/resource-bookings' },
  { id: 'p-caphub', label: 'Capacity',           category: 'People',      icon: <IconFlame size={15} />,            path: '/capacity' },
  { id: 'p-leave',  label: 'Leave & Holidays',   category: 'People',      icon: <IconCalendarOff size={15} />,      path: '/leave' },
  { id: 'p-rpf',    label: 'Resource Performance',  category: 'People',    icon: <IconTrendingUp size={15} />,       path: '/reports/resource-performance' },
  { id: 'p-rint',   label: 'Resource Intelligence', category: 'People',    icon: <IconUserSearch size={15} />,       path: '/reports/resource-intelligence' },
  { id: 'p-skills', label: 'Skills Matrix',          category: 'People',    icon: <IconChartPie size={15} />,         path: '/reports/skills-matrix' },
  { id: 'p-tpulse', label: 'Team Pulse',             category: 'People',    icon: <IconHeartRateMonitor size={15} />, path: '/reports/team-pulse' },
  { id: 'p-capf',   label: 'Capacity Forecast',      category: 'People',    icon: <IconChartBar size={15} />,         path: '/reports/capacity-forecast' },

  // Calendar
  { id: 'p-cal',    label: 'Strategic Calendar', category: 'Calendar',    icon: <IconCalendar size={15} />,         path: '/calendar' },
  { id: 'p-sprint', label: 'Sprint Planner',     category: 'Calendar',    icon: <IconBrain size={15} />,            path: '/sprint-planner' },
  { id: 'p-templ',  label: 'Project Templates',  category: 'Calendar',    icon: <IconTemplate size={15} />,         path: '/project-templates' },

  // Delivery
  { id: 'p-jpods',  label: 'POD Dashboard',      category: 'Delivery',    icon: <IconUsersGroup size={15} />,       path: '/jira-pods' },
  { id: 'p-rel',    label: 'Releases',           category: 'Delivery',    icon: <IconTag size={15} />,              path: '/jira-releases' },
  { id: 'p-reln',   label: 'Release Notes',      category: 'Delivery',    icon: <IconPackage size={15} />,          path: '/release-notes' },
  { id: 'p-act',    label: 'Jira Actuals',       category: 'Delivery',    icon: <IconTicket size={15} />,           path: '/jira-actuals' },
  { id: 'p-sup',    label: 'Support Queue',      category: 'Delivery',    icon: <IconSettings size={15} />,         path: '/jira-support' },
  { id: 'p-wlog',   label: 'Worklog',            category: 'Delivery',    icon: <IconClock size={15} />,            path: '/jira-worklog' },
  { id: 'p-bcapex', label: 'Budget & CapEx',     category: 'Delivery',    icon: <IconCurrencyDollar size={15} />,   path: '/reports/budget-capex' },

  // Portfolio Analysis
  { id: 'p-phealth', label: 'Portfolio Health',       category: 'Portfolio Analysis', icon: <IconShieldCheck size={15} />,      path: '/reports/portfolio-health-dashboard' },
  { id: 'p-prjh',   label: 'Project Health',         category: 'Portfolio Analysis', icon: <IconHeartRateMonitor size={15} />, path: '/reports/project-health' },
  { id: 'p-ptl',    label: 'Portfolio Timeline',     category: 'Portfolio Analysis', icon: <IconTimeline size={15} />,          path: '/reports/portfolio-timeline' },
  { id: 'p-psig',   label: 'Project Signals',        category: 'Portfolio Analysis', icon: <IconChartInfographic size={15} />,  path: '/reports/project-signals' },
  { id: 'p-dep',    label: 'Dependency Map',         category: 'Portfolio Analysis', icon: <IconGitBranch size={15} />,         path: '/reports/dependency-map' },
  { id: 'p-gdep',   label: 'Gantt & Dependencies',   category: 'Portfolio Analysis', icon: <IconChartBar size={15} />,          path: '/reports/gantt-dependencies' },
  { id: 'p-exec',   label: 'Executive Summary',      category: 'Portfolio Analysis', icon: <IconLayoutDashboard size={15} />,   path: '/reports/executive-summary' },
  { id: 'p-rheat',  label: 'Risk Heatmap',           category: 'Portfolio Analysis', icon: <IconChartDots3 size={15} />,        path: '/reports/risk-heatmap' },
  { id: 'p-statup', label: 'Status Updates',         category: 'Portfolio Analysis', icon: <IconBellRinging size={15} />,       path: '/reports/status-updates' },

  // Engineering
  { id: 'p-eintel', label: 'Eng. Intelligence',      category: 'Engineering',  icon: <IconReportMoney size={15} />,      path: '/reports/engineering-intelligence' },
  { id: 'p-dora',   label: 'DORA Metrics',           category: 'Engineering',  icon: <IconRocket size={15} />,           path: '/reports/dora' },
  { id: 'p-dpred',  label: 'Delivery Predictability', category: 'Engineering', icon: <IconChartDots3 size={15} />,       path: '/reports/delivery-predictability' },
  { id: 'p-janalytics', label: 'Jira Analytics',     category: 'Engineering',  icon: <IconChartInfographic size={15} />, path: '/reports/jira-analytics' },
  { id: 'p-jdbuild', label: 'Dashboard Builder',     category: 'Engineering',  icon: <IconLayoutDashboard size={15} />,  path: '/reports/jira-dashboard-builder' },
  { id: 'p-sret',   label: 'Sprint Retro',           category: 'Engineering',  icon: <IconChartBar size={15} />,          path: '/reports/sprint-retro' },

  // Simulations
  { id: 'p-timsim', label: 'Timeline Simulator',     category: 'Simulations',  icon: <IconPlayerPlay size={15} />,       path: '/simulator/timeline' },
  { id: 'p-scensim', label: 'Scenario Simulator',    category: 'Simulations',  icon: <IconAdjustments size={15} />,      path: '/simulator/scenario' },
  { id: 'p-notifs', label: 'Smart Notifications',    category: 'Simulations',  icon: <IconBellRinging size={15} />,      path: '/reports/smart-notifications' },
  { id: 'p-jsync',  label: 'Jira Portfolio Sync',    category: 'Simulations',  icon: <IconPlugConnected size={15} />,    path: '/reports/jira-portfolio-sync' },

  // Settings
  { id: 'p-org',    label: 'Admin Settings',         category: 'Settings',     icon: <IconBuildingFactory size={15} />,  path: '/settings/org' },
  { id: 'p-tl',     label: 'Timeline Settings',      category: 'Settings',     icon: <IconSettings size={15} />,         path: '/settings/timeline' },
  { id: 'p-ref',    label: 'Reference Data',         category: 'Settings',     icon: <IconSettings size={15} />,         path: '/settings/ref-data' },
  { id: 'p-jira',   label: 'Jira Settings',          category: 'Settings',     icon: <IconSettings size={15} />,         path: '/settings/jira' },
  { id: 'p-nlpset', label: 'NLP Settings',           category: 'Settings',     icon: <IconBrain size={15} />,            path: '/settings/nlp' },
  { id: 'p-users',  label: 'User Management',        category: 'Settings',     icon: <IconUsers size={15} />,            path: '/settings/users' },
  { id: 'p-audit',  label: 'Audit Log',              category: 'Settings',     icon: <IconSettings size={15} />,         path: '/settings/audit-log' },
  { id: 'p-resmap', label: 'Jira Resource Mapping',  category: 'Settings',     icon: <IconSettings size={15} />,         path: '/settings/jira-resource-mapping' },
  { id: 'p-relmap', label: 'Jira Release Mapping',   category: 'Settings',     icon: <IconSettings size={15} />,         path: '/settings/jira-release-mapping' },
  { id: 'p-autoeng',   label: 'Automation Engine',         category: 'Settings',   icon: <IconPlayerPlay size={15} />,  path: '/automation-engine' },
  { id: 'p-insights',     label: 'Smart Insights',            category: 'Portfolio',  icon: <IconSparkles size={15} />,      path: '/smart-insights' },
  { id: 'p-notifpref',   label: 'Notification Preferences',  category: 'Settings',   icon: <IconBellCog size={15} />,       path: '/settings/notification-preferences' },
  { id: 'p-customdash',  label: 'Custom Dashboard',          category: 'Workspace',  icon: <IconLayoutGrid size={15} />,   path: '/custom-dashboard' },
  { id: 'p-approvals',   label: 'Approval Queue',            category: 'Projects',   icon: <IconTarget size={15} />,       path: '/approvals' },
  { id: 'p-bulkimport',  label: 'Bulk Import',               category: 'Settings',   icon: <IconUpload size={15} />,       path: '/bulk-import' },
  { id: 'p-advtimeline', label: 'Advanced Timeline',         category: 'Portfolio',  icon: <IconLayoutBoard size={15} />,   path: '/advanced-timeline' },
];

// ── Action commands — never tracked as "recent" ──────────────────────────────
const ACTION_RESULTS: SearchResult[] = [
  {
    id: 'act-new-project', label: 'New Project',
    sublabel: 'Create a new portfolio project',
    category: 'Actions', icon: <IconPlus size={15} />,
    path: '/projects?action=create', isAction: true,
  },
  {
    id: 'act-ask-ai', label: 'Ask AI',
    sublabel: 'Open the AI assistant',
    category: 'Actions', icon: <IconBrain size={15} />,
    path: '/nlp', isAction: true,
  },
  {
    id: 'act-sprint', label: 'Sprint Planner',
    sublabel: 'Plan next sprint',
    category: 'Actions', icon: <IconBolt size={15} />,
    path: '/sprint-planner', isAction: true,
  },
  {
    id: 'act-inbox', label: 'Open Inbox',
    sublabel: 'View pending notifications',
    category: 'Actions', icon: <IconInbox size={15} />,
    path: '/inbox', isAction: true,
  },
];

const CATEGORY_ORDER = [
  'Recent', 'Actions',
  'Home', 'Portfolio', 'People', 'Calendar', 'Delivery',
  'Portfolio Analysis', 'Engineering', 'Simulations', 'Settings',
  'Projects', 'Resources', 'PODs', 'Workspace',
];

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--mantine-color-yellow-3)', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// Build a SearchResult from a RecentEntry, using the icon from PAGE_RESULTS
function recentToResult(r: RecentEntry): SearchResult {
  const found = PAGE_RESULTS.find(p => p.id === r.id);
  return {
    id: `recent-${r.id}`,
    label: r.label,
    category: 'Recent',
    icon: found?.icon ?? <IconHistory size={15} />,
    path: r.path,
  };
}

export function useGlobalSearch() {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpened(o => !o);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { opened, setOpened };
}

export default function GlobalSearch({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);

  const { data: projects = [] } = useProjects();
  const { data: resources = [] } = useResources();
  const { data: pods = [] } = usePods();

  // Reset query when modal opens; refresh recent list
  useEffect(() => {
    if (opened) {
      setQuery('');
      setSelectedIdx(0);
      setRecentEntries(getRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [opened]);

  const results = useMemo((): SearchResult[] => {
    const q = query.trim().toLowerCase();

    if (!q) {
      // Empty query: show Recent + Actions + first few pages
      const recent = recentEntries.slice(0, 6).map(recentToResult);
      const combined = [...recent, ...ACTION_RESULTS, ...PAGE_RESULTS.slice(0, 8)];
      return combined;
    }

    const matched: SearchResult[] = [];

    // Action commands
    for (const a of ACTION_RESULTS) {
      if (a.label.toLowerCase().includes(q) || (a.sublabel?.toLowerCase().includes(q))) {
        matched.push(a);
      }
    }

    // Pages
    for (const p of PAGE_RESULTS) {
      if (p.label.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) {
        matched.push(p);
      }
    }

    // Projects
    for (const p of projects) {
      if (p.name.toLowerCase().includes(q) || String(p.id) === q || p.owner?.toLowerCase().includes(q)) {
        matched.push({
          id: `proj-${p.id}`,
          label: p.name,
          sublabel: `Project · ${p.owner ?? ''} · M${p.startMonth}–M${(p.startMonth ?? 1) + (p.durationMonths ?? 1) - 1}`,
          category: 'Projects',
          icon: <IconBriefcase size={15} />,
          path: `/projects/${p.id}`,
          badges: p.status ? [p.status] : [],
        });
      }
    }

    // Resources / People
    for (const r of resources) {
      if (r.name.toLowerCase().includes(q) || r.role?.toLowerCase().includes(q) || r.location?.toLowerCase().includes(q)) {
        matched.push({
          id: `res-${r.id}`,
          label: r.name,
          sublabel: `${r.role?.replace(/_/g, ' ')} · ${r.location ?? ''}`,
          category: 'Resources',
          icon: <IconUsers size={15} />,
          path: `/resources`,
          badges: r.active ? [] : ['Inactive'],
        });
      }
    }

    // PODs
    for (const pod of pods) {
      if (pod.name.toLowerCase().includes(q)) {
        matched.push({
          id: `pod-${pod.id}`,
          label: pod.name,
          sublabel: 'POD',
          category: 'PODs',
          icon: <IconHexagons size={15} />,
          path: `/pods/${pod.id}`,
        });
      }
    }

    return matched.slice(0, 60);
  }, [query, projects, resources, pods, recentEntries]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return CATEGORY_ORDER
      .filter(c => map.has(c))
      .map(c => ({ category: c, items: map.get(c)! }));
  }, [results]);

  const flatResults = useMemo(() => results, [results]);

  function handleSelect(item: SearchResult) {
    addRecent(item);
    onClose();
    navigate(item.path);
  }

  useEffect(() => { setSelectedIdx(0); }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = flatResults[selectedIdx];
      if (item) handleSelect(item);
    }
  }

  const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    Recent: <IconHistory size={11} />,
    Actions: <IconBolt size={11} />,
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      padding={0}
      size={560}
      radius="lg"
      // DL-8: position slightly above centre (20vh from top)
      styles={{
        root: { alignItems: 'flex-start', paddingTop: '20vh' },
        content: {
          overflow: 'hidden',
          background: DARK_SIDEBAR,
          border: '1px solid #2e3346',
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.50)',
          animation: 'ppCmdEnter 200ms cubic-bezier(0.4,0,0.2,1)',
        },
        overlay: { backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.60)' },
        body: { padding: 0 },
      }}
    >
      <TextInput
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search pages, projects, people, PODs… or type a command"
        leftSection={<IconSearch size={16} />}
        rightSection={<Kbd size="xs">Esc</Kbd>}
        size="lg"
        variant="unstyled"
        styles={{
          input: {
            background: 'transparent',
            borderBottom: '1px solid #2e3346',
            borderRadius: '12px 12px 0 0',
            paddingLeft: 48,
            paddingRight: 60,
            fontSize: 16,
            color: '#e2e4eb',
            '&::placeholder': { color: '#5a5e70' },
          },
          section: { paddingLeft: 16, color: SIDEBAR_INACTIVE },
        }}
      />

      {results.length === 0 ? (
        <Stack align="center" py="xl" gap="xs">
          <Text c="dimmed" size="sm">No results for "{query}"</Text>
          <Text c="dimmed" size="xs">Try searching for a project name, page, or person</Text>
        </Stack>
      ) : (
        <ScrollArea h={440} p="xs">
          {grouped.map((group, gi) => {
            const prevCount = grouped.slice(0, gi).reduce((s, g) => s + g.items.length, 0);
            const isSpecialCategory = group.category === 'Recent' || group.category === 'Actions';
            return (
              <div key={group.category}>
                <Group gap={4} px="sm" pt={gi === 0 ? 8 : 4} pb={4}>
                  {CATEGORY_ICONS[group.category] && (
                    <span style={{ color: 'var(--mantine-color-dimmed)' }}>
                      {CATEGORY_ICONS[group.category]}
                    </span>
                  )}
                  {/* DL-8 group header: 11px, 600, uppercase, muted, ls 0.5px */}
                  <Text size="xs" fw={600} tt="uppercase"
                    style={{ letterSpacing: '0.5px', fontSize: 11, color: '#5a5e70' }}>
                    {group.category}
                  </Text>
                  {group.category === 'Recent' && (
                    <Badge size="xs" variant="dot" color="blue" ml="auto">
                      {group.items.length}
                    </Badge>
                  )}
                </Group>
                {group.items.map((item, ii) => {
                  const flatIdx = prevCount + ii;
                  const isSelected = flatIdx === selectedIdx;
                  return (
                    <UnstyledButton
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIdx(flatIdx)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        // DL-8: dark-theme result rows
                        backgroundColor: isSelected
                          ? 'rgba(45,204,211,0.12)'
                          : 'transparent',
                        borderLeft: isSelected ? '2px solid #2DCCD3' : '2px solid transparent',
                        transition: 'background 150ms cubic-bezier(0.4,0,0.2,1), border-color 150ms',
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            color: item.isAction
                              ? 'var(--mantine-color-teal-6)'
                              : 'var(--mantine-color-dimmed)',
                            flexShrink: 0,
                          }}>
                            {item.icon}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <Text size="sm" fw={500} truncate>
                              {highlight(item.label, query)}
                            </Text>
                            {item.sublabel && (
                              <Text size="xs" c="dimmed" truncate>{item.sublabel}</Text>
                            )}
                          </div>
                          {(item.badges ?? []).map(b => (
                            <Badge key={b} size="xs" variant="light" color="gray">{b}</Badge>
                          ))}
                          {item.isAction && (
                            <Badge size="xs" variant="light" color="teal" ml="auto">action</Badge>
                          )}
                        </Group>
                        {isSelected && <IconArrowRight size={14} color={AQUA} />}
                      </Group>
                    </UnstyledButton>
                  );
                })}
                {gi < grouped.length - 1 && <Divider my={4} />}
              </div>
            );
          })}
        </ScrollArea>
      )}

      <Divider />
      <Group px="md" py="xs" gap="lg" justify="flex-end">
        <Group gap={4}>
          <Kbd size="xs">↑↓</Kbd>
          <Text size="xs" c="dimmed">navigate</Text>
        </Group>
        <Group gap={4}>
          <Kbd size="xs">↵</Kbd>
          <Text size="xs" c="dimmed">open</Text>
        </Group>
        <Group gap={4}>
          <Kbd size="xs">⌘K</Kbd>
          <Text size="xs" c="dimmed">toggle</Text>
        </Group>
        <Group gap={4}>
          <Kbd size="xs">Esc</Kbd>
          <Text size="xs" c="dimmed">close</Text>
        </Group>
      </Group>
    </Modal>
  );
}
