import { useState, useMemo, useCallback } from 'react';
import {
  Title, Text, Stack, Paper, Tabs, Badge, Group, Box,
  ActionIcon, Anchor, ThemeIcon, Center, Divider, Button,
  Tooltip, ScrollArea,
} from '@mantine/core';
import {
  IconInbox, IconBell, IconAlertTriangle, IconClock,
  IconCalendar, IconUsers, IconFlame, IconCheck,
  IconExternalLink, IconX, IconCircleCheck,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../brandTokens';
import { useAlertCounts }          from '../hooks/useAlertCounts';
import { useJiraStatus, SupportTicket } from '../api/jira';
import { useProjects }             from '../api/projects';
import { useCapacityDemandSummary } from '../api/reports';
import LoadingSpinner from '../components/common/LoadingSpinner';

// ── Dismissal persistence ─────────────────────────────────────────────────────

const JIRA_KEY      = 'pp_dismissed_alerts';      // shared with NotificationBell
const PORTFOLIO_KEY = 'pp_dismissed_portfolio';   // Inbox-only portfolio alerts

function load(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) ?? '[]')); }
  catch { return new Set(); }
}
function save(key: string, ids: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...ids]));
}

// ── Unified item type ─────────────────────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'info';
type Source   = 'jira' | 'portfolio';

interface InboxItem {
  id:          string;
  source:      Source;
  severity:    Severity;
  icon:        React.ReactNode;
  title:       string;
  detail:      string;
  tag:         string;        // "Jira" | "Overdue" | "Stale" | "Capacity" | "Deadline" | "P0"
  time:        Date | null;
  jiraUrl?:    string;        // open ticket in Jira
  appUrl?:     string;        // navigate inside app
}

// ── Visual helpers ────────────────────────────────────────────────────────────

const SEVERITY: Record<Severity, { border: string; bg: string; badge: string; label: string }> = {
  critical: { border: '#dc2626', bg: '#fff5f5', badge: 'red',    label: 'Critical' },
  warning:  { border: '#ea580c', bg: '#fff8f5', badge: 'orange', label: 'Warning'  },
  info:     { border: '#2563eb', bg: '#f0f6ff', badge: 'blue',   label: 'Info'     },
};

function timeAgo(d: Date | null): string {
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return 'just now';
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<string | null>('all');

  // ── Dismissal state ──
  const [dismissedJira,      setDismissedJira]      = useState<Set<string>>(() => load(JIRA_KEY));
  const [dismissedPortfolio, setDismissedPortfolio] = useState<Set<string>>(() => load(PORTFOLIO_KEY));

  const dismissJira = useCallback((id: string) => {
    setDismissedJira(prev => { const n = new Set(prev).add(id); save(JIRA_KEY, n); return n; });
  }, []);
  const dismissPortfolio = useCallback((id: string) => {
    setDismissedPortfolio(prev => { const n = new Set(prev).add(id); save(PORTFOLIO_KEY, n); return n; });
  }, []);
  const dismissAll = useCallback((items: InboxItem[]) => {
    const jira = new Set(dismissedJira);
    const port = new Set(dismissedPortfolio);
    for (const it of items) {
      if (it.source === 'jira')      jira.add(it.id);
      else                           port.add(it.id);
    }
    save(JIRA_KEY, jira); setDismissedJira(jira);
    save(PORTFOLIO_KEY, port); setDismissedPortfolio(port);
  }, [dismissedJira, dismissedPortfolio]);

  // ── Data ──
  const { criticalTickets }          = useAlertCounts();
  const { data: jiraStatus }         = useJiraStatus();
  const { data: projects, isLoading: projLoading }  = useProjects();
  const { data: capacityData }       = useCapacityDemandSummary();

  const today      = useMemo(() => new Date(), []);
  const twoWeeks   = useMemo(() => new Date(today.getTime() + 14 * 86400000), [today]);
  const jiraBase   = jiraStatus?.baseUrl?.replace(/\/$/, '');

  // ── Build Jira items ──
  const jiraItems = useMemo((): InboxItem[] =>
    criticalTickets
      .filter(t => !dismissedJira.has(t.key))
      .map(t => ({
        id:       t.key,
        source:   'jira' as Source,
        severity: 'critical' as Severity,
        icon:     <IconBell size={15} />,
        title:    t.summary ?? t.key,
        detail:   `${t.assignee ? `→ ${t.assignee}` : 'Unassigned'}`,
        tag:      t.priority ?? 'Critical',
        time:     t.created ? new Date(t.created) : null,
        jiraUrl:  jiraBase ? `${jiraBase}/browse/${t.key}` : undefined,
      })),
    [criticalTickets, dismissedJira, jiraBase]);

  // ── Build portfolio items ──
  const portfolioItems = useMemo((): InboxItem[] => {
    const items: InboxItem[] = [];

    // Overdue projects (critical)
    projects?.forEach(p => {
      const id = `overdue-${p.id}`;
      if (dismissedPortfolio.has(id)) return;
      if (!p.targetDate || p.status === 'COMPLETED' || p.status === 'CANCELLED') return;
      const target = new Date(p.targetDate);
      if (target >= today) return;
      const days = Math.floor((today.getTime() - target.getTime()) / 86400000);
      items.push({
        id, source: 'portfolio', severity: 'critical',
        icon:   <IconAlertTriangle size={15} />,
        title:  `${p.name} is overdue`,
        detail: `${days} day${days !== 1 ? 's' : ''} past target · ${p.owner ?? 'Unassigned'} · ${p.priority ?? ''}`,
        tag:    'Overdue',
        time:   target,
        appUrl: `/projects`,
      });
    });

    // P0 still active (warning)
    projects?.forEach(p => {
      const id = `p0-${p.id}`;
      if (dismissedPortfolio.has(id)) return;
      if (p.priority !== 'P0' || p.status === 'COMPLETED' || p.status === 'CANCELLED') return;
      items.push({
        id, source: 'portfolio', severity: 'warning',
        icon:   <IconFlame size={15} />,
        title:  `P0 project still active: ${p.name}`,
        detail: `${p.status} · ${p.owner ?? 'Unassigned'}`,
        tag:    'P0 Active',
        time:   null,
        appUrl: `/projects`,
      });
    });

    // Stale projects — active > 90 days (warning)
    projects?.forEach(p => {
      const id = `stale-${p.id}`;
      if (dismissedPortfolio.has(id)) return;
      if (p.status !== 'ACTIVE' || !p.createdAt) return;
      const days = Math.floor((today.getTime() - new Date(p.createdAt).getTime()) / 86400000);
      if (days <= 90) return;
      items.push({
        id, source: 'portfolio', severity: 'warning',
        icon:   <IconClock size={15} />,
        title:  `${p.name} has been active for ${days} days`,
        detail: `${p.owner ?? 'Unassigned'} · no completion yet`,
        tag:    'Stale',
        time:   new Date(p.createdAt),
        appUrl: `/projects`,
      });
    });

    // Capacity deficits (info)
    if (Array.isArray(capacityData)) {
      capacityData.forEach((d: any, i: number) => {
        if (typeof d.gap !== 'number' || d.gap >= 0) return;
        const id = `capacity-${d.month ?? i}`;
        if (dismissedPortfolio.has(id)) return;
        items.push({
          id, source: 'portfolio', severity: 'info',
          icon:   <IconUsers size={15} />,
          title:  `Capacity deficit in ${d.month ?? 'upcoming period'}`,
          detail: `${Math.abs(d.gap).toFixed(1)} FTE shortfall — consider reallocation or hiring`,
          tag:    'Capacity',
          time:   null,
          appUrl: `/reports/utilization`,
        });
      });
    }

    // Upcoming deadlines — within 14 days (info)
    projects?.forEach(p => {
      const id = `deadline-${p.id}`;
      if (dismissedPortfolio.has(id)) return;
      if (!p.targetDate || p.status === 'COMPLETED') return;
      const target = new Date(p.targetDate);
      if (target <= today || target > twoWeeks) return;
      const days = Math.floor((target.getTime() - today.getTime()) / 86400000);
      items.push({
        id, source: 'portfolio', severity: 'info',
        icon:   <IconCalendar size={15} />,
        title:  `${p.name} due in ${days} day${days !== 1 ? 's' : ''}`,
        detail: `${p.priority ?? ''} · ${p.owner ?? 'Unassigned'}`,
        tag:    'Deadline',
        time:   target,
        appUrl: `/projects`,
      });
    });

    // Sort: critical first, then warning, then info, then newest
    const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
    return items.sort((a, b) =>
      order[a.severity] - order[b.severity] ||
      (b.time?.getTime() ?? 0) - (a.time?.getTime() ?? 0)
    );
  }, [projects, capacityData, today, twoWeeks, dismissedPortfolio]);

  const allItems     = useMemo(() => [...jiraItems, ...portfolioItems], [jiraItems, portfolioItems]);
  const currentItems = tab === 'jira'      ? jiraItems
                     : tab === 'portfolio' ? portfolioItems
                     : allItems;

  if (projLoading) return <LoadingSpinner />;

  return (
    <Stack gap="lg" className="page-enter">

      {/* Header */}
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={1} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY, fontWeight: 800 }}>
            Inbox
          </Title>
          <Text c="dimmed" size="sm" mt={2} style={{ fontFamily: FONT_FAMILY }}>
            Live alerts from Jira and portfolio monitoring — dismiss to clear, they won't come back until the condition changes
          </Text>
        </Box>
        {allItems.length > 0 && (
          <Button size="xs" variant="subtle" color="gray" leftSection={<IconCheck size={13} />}
            onClick={() => dismissAll(allItems)}>
            Clear all
          </Button>
        )}
      </Group>

      {/* Tabs */}
      <Tabs value={tab} onChange={setTab} variant="outline" radius="sm">
        <Tabs.List mb="lg">
          <Tabs.Tab value="all" leftSection={<IconInbox size={14} />}
            rightSection={allItems.length > 0 ? <Badge size="xs" color="red" variant="filled">{allItems.length}</Badge> : undefined}>
            All
          </Tabs.Tab>
          <Tabs.Tab value="jira" leftSection={<IconBell size={14} />}
            rightSection={jiraItems.length > 0 ? <Badge size="xs" color="red" variant="filled">{jiraItems.length}</Badge> : undefined}>
            Jira
          </Tabs.Tab>
          <Tabs.Tab value="portfolio" leftSection={<IconAlertTriangle size={14} />}
            rightSection={portfolioItems.length > 0 ? <Badge size="xs" color="orange" variant="filled">{portfolioItems.length}</Badge> : undefined}>
            Portfolio
          </Tabs.Tab>
        </Tabs.List>

        {(['all', 'jira', 'portfolio'] as const).map(tabKey => (
          <Tabs.Panel key={tabKey} value={tabKey}>
            <ItemFeed
              items={currentItems}
              emptyTitle={
                tabKey === 'jira'      ? 'No critical Jira tickets' :
                tabKey === 'portfolio' ? 'No portfolio alerts'      : 'All clear'
              }
              emptyDesc={
                tabKey === 'jira'      ? (jiraStatus?.configured ? 'No Blocker or Critical tickets in your support queues right now.' : 'Configure Jira integration in Admin Settings to enable real-time ticket alerts.') :
                tabKey === 'portfolio' ? 'No overdue projects, stale work, or capacity deficits detected.' :
                                        'Nothing needs your attention right now.'
              }
              onDismiss={(item) =>
                item.source === 'jira' ? dismissJira(item.id) : dismissPortfolio(item.id)
              }
              onNavigate={(url) => navigate(url)}
            />
          </Tabs.Panel>
        ))}
      </Tabs>

    </Stack>
  );
}

// ── Feed component ────────────────────────────────────────────────────────────

function ItemFeed({
  items, emptyTitle, emptyDesc, onDismiss, onNavigate,
}: {
  items: InboxItem[];
  emptyTitle: string;
  emptyDesc: string;
  onDismiss: (item: InboxItem) => void;
  onNavigate: (url: string) => void;
}) {
  if (items.length === 0) {
    return (
      <Center py={80}>
        <Stack align="center" gap="md">
          <ThemeIcon size={56} radius="xl" variant="light" color="teal">
            <IconCircleCheck size={28} stroke={1.5} />
          </ThemeIcon>
          <Stack gap={4} align="center">
            <Text fw={700} size="lg" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>{emptyTitle}</Text>
            <Text c="dimmed" size="sm" ta="center" maw={360} style={{ fontFamily: FONT_FAMILY }}>{emptyDesc}</Text>
          </Stack>
        </Stack>
      </Center>
    );
  }

  // Group by severity for a clear visual hierarchy
  const critical = items.filter(i => i.severity === 'critical');
  const warning  = items.filter(i => i.severity === 'warning');
  const info     = items.filter(i => i.severity === 'info');

  return (
    <Stack gap="md">
      {critical.length > 0 && <SeverityGroup label="Critical" color="red" items={critical} onDismiss={onDismiss} onNavigate={onNavigate} />}
      {warning.length  > 0 && <SeverityGroup label="Warnings" color="orange" items={warning} onDismiss={onDismiss} onNavigate={onNavigate} />}
      {info.length     > 0 && <SeverityGroup label="Info"     color="blue" items={info}     onDismiss={onDismiss} onNavigate={onNavigate} />}
    </Stack>
  );
}

// ── Severity group ────────────────────────────────────────────────────────────

function SeverityGroup({
  label, color, items, onDismiss, onNavigate,
}: {
  label: string;
  color: string;
  items: InboxItem[];
  onDismiss: (item: InboxItem) => void;
  onNavigate: (url: string) => void;
}) {
  return (
    <Box>
      <Group gap={8} mb={10}>
        <Box style={{ width: 10, height: 10, borderRadius: '50%', background: SEVERITY[items[0].severity].border }} />
        <Text size="11px" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.06em', fontFamily: FONT_FAMILY }}>
          {label} · {items.length}
        </Text>
      </Group>
      <Stack gap={0}>
        {items.map((item, i) => (
          <ItemRow
            key={item.id}
            item={item}
            last={i === items.length - 1}
            onDismiss={onDismiss}
            onNavigate={onNavigate}
          />
        ))}
      </Stack>
    </Box>
  );
}

// ── Individual item row ───────────────────────────────────────────────────────

function ItemRow({
  item, last, onDismiss, onNavigate,
}: {
  item: InboxItem;
  last: boolean;
  onDismiss: (item: InboxItem) => void;
  onNavigate: (url: string) => void;
}) {
  const sev = SEVERITY[item.severity];
  return (
    <Paper
      withBorder
      p="md"
      radius={0}
      style={{
        borderLeft:   `3px solid ${sev.border}`,
        borderBottom: last ? undefined : '1px solid #f0f4f8',
        borderTop:    'none',
        borderRight:  '1px solid #e8ecf0',
        background:   sev.bg,
        borderRadius: last ? '0 0 8px 0' : 0,
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="sm">
        {/* Icon */}
        <ThemeIcon size={30} radius="md" variant="light" color={sev.badge} style={{ flexShrink: 0 }}>
          {item.icon}
        </ThemeIcon>

        {/* Body */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6} mb={2} wrap="nowrap">
            <Badge size="xs" color={sev.badge} variant="light"
              style={{ fontFamily: FONT_FAMILY, flexShrink: 0 }}>
              {item.tag}
            </Badge>
            {item.source === 'jira' && item.id && (
              <Text size="10px" c="dimmed" style={{ fontFamily: 'monospace', flexShrink: 0 }}>{item.id}</Text>
            )}
            {item.time && (
              <Text size="10px" c="dimmed" style={{ flexShrink: 0 }}>{timeAgo(item.time)}</Text>
            )}
          </Group>
          <Text size="sm" fw={600} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY, lineHeight: 1.3 }}>
            {item.title}
          </Text>
          <Text size="xs" c="dimmed" mt={1} style={{ fontFamily: FONT_FAMILY }}>
            {item.detail}
          </Text>
        </Box>

        {/* Actions */}
        <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
          {item.jiraUrl && (
            <Tooltip label="Open in Jira" withArrow>
              <ActionIcon size="sm" variant="subtle" color="gray"
                component="a" href={item.jiraUrl} target="_blank" rel="noopener">
                <IconExternalLink size={13} />
              </ActionIcon>
            </Tooltip>
          )}
          {item.appUrl && (
            <Tooltip label="View in app" withArrow>
              <ActionIcon size="sm" variant="subtle" color="blue"
                onClick={() => onNavigate(item.appUrl!)}>
                <IconExternalLink size={13} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Dismiss" withArrow>
            <ActionIcon size="sm" variant="subtle" color="gray"
              onClick={() => onDismiss(item)}>
              <IconX size={13} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  );
}
