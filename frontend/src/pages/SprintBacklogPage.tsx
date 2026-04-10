import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Tabs, Text, Group, Badge, Stack, Collapse, Box,
  Center, ThemeIcon, ActionIcon, Tooltip,
  TextInput, Select, Divider, Paper, Button,
} from '@mantine/core';
import {
  IconChevronDown, IconChevronRight, IconBolt,
  IconAlertCircle, IconCircleCheck, IconClock,
  IconSearch, IconRefresh, IconUsersGroup,
  IconCalendar, IconCloudDownload,
  IconBug, IconBook, IconCheckbox, IconSubtask,
  IconFlame, IconArrowUpCircle, IconSparkles, IconHelpCircle,
  IconList, IconLayoutKanban,
} from '@tabler/icons-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../api/client';
import { PPPageLayout } from '../components/pp';
import SprintKanbanBoard from '../components/projects/SprintKanbanBoard';
import SavedViews from '../components/common/SavedViews';
import { AQUA, BORDER_STRONG, COLOR_AMBER_DARK, COLOR_BLUE, COLOR_BLUE_STRONG, COLOR_EMERALD, COLOR_ERROR_DARK, COLOR_ERROR_STRONG, COLOR_GREEN, COLOR_GREEN_STRONG, COLOR_ORANGE_ALT, COLOR_ORANGE_DEEP, COLOR_VIOLET, DARK_BG, DEEP_BLUE, FONT_FAMILY, TEXT_GRAY, TEXT_SUBTLE} from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';

// ── Types ──────────────────────────────────────────────────────────────────

interface PodSummary { id: number; displayName: string; projectKeys: string[] }

interface IssueRow {
  key: string; summary: string; issueType: string;
  statusName: string; statusCategory: string;
  priorityName: string; assignee: string | null;
  assigneeAvatarUrl: string | null;
  storyPoints: number | null; epicName: string | null; epicKey: string | null;
  fixVersionName: string | null;
  subtask: boolean; parentKey: string | null;
  subtasks: IssueRow[];
}

interface SprintGroup {
  sprintJiraId: number; boardId: number | null;
  name: string; state: string;
  startDate: string | null; endDate: string | null; goal: string | null;
  todoCount: number; inProgressCount: number; doneCount: number; totalCount: number;
  issues: IssueRow[];
}

interface BacklogGroup { totalCount: number; issues: IssueRow[] }

interface BacklogResponse {
  podId: number; podDisplayName: string; projectKeys: string[];
  sprints: SprintGroup[]; backlog: BacklogGroup; syncedAt: string | null;
}

// ── Issue type icon + colour map ───────────────────────────────────────────

interface TypeDef { bg: string; icon: React.ReactNode }

const TYPE_MAP: Record<string, TypeDef> = {
  Bug:         { bg: COLOR_ERROR_STRONG, icon: <IconBug       size={11} color="#fff" stroke={2.5} /> },
  Story:       { bg: COLOR_GREEN, icon: <IconBook      size={11} color="#fff" stroke={2.5} /> },
  Task:        { bg: COLOR_BLUE, icon: <IconCheckbox  size={11} color="#fff" stroke={2.5} /> },
  Epic:        { bg: '#a855f7', icon: <IconBolt      size={11} color="#fff" stroke={2.5} /> },
  Subtask:     { bg: TEXT_GRAY, icon: <IconSubtask   size={11} color="#fff" stroke={2.5} /> },
  Incident:    { bg: COLOR_ORANGE_ALT, icon: <IconFlame     size={11} color="#fff" stroke={2.5} /> },
  Improvement: { bg: '#06b6d4', icon: <IconArrowUpCircle size={11} color="#fff" stroke={2.5} /> },
  'New Feature': { bg: '#0ea5e9', icon: <IconSparkles size={11} color="#fff" stroke={2.5} /> },
};

function IssueTypeIcon({ type }: { type: string | null }) {
  const def = TYPE_MAP[type ?? ''] ?? { bg: TEXT_SUBTLE, icon: <IconHelpCircle size={11} color="#fff" stroke={2.5} /> };
  return (
    <Tooltip label={type ?? 'Unknown'} withArrow position="top" openDelay={200}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 20, height: 20, borderRadius: 4,
        background: def.bg, flexShrink: 0, cursor: 'default',
      }}>
        {def.icon}
      </span>
    </Tooltip>
  );
}

const STATUS_COLORS: Record<string, string> = {
  done:          'teal',
  indeterminate: 'blue',
};

function statusColor(cat: string | null) {
  if (!cat) return 'gray';
  return STATUS_COLORS[cat.toLowerCase()] ?? 'gray';
}

function priorityColor(p: string | null): string {
  if (!p) return 'gray';
  const l = p.toLowerCase();
  if (l === 'highest' || l === 'critical' || l === 'blocker') return COLOR_ERROR_STRONG;
  if (l === 'high')   return COLOR_ORANGE_ALT;
  if (l === 'medium') return '#eab308';
  if (l === 'low')    return COLOR_GREEN;
  return TEXT_SUBTLE;
}

// ── Assignee avatar (coloured circle + initials, like Jira) ───────────────

const AVATAR_PALETTE = [
  COLOR_VIOLET,COLOR_BLUE_STRONG,COLOR_EMERALD,COLOR_AMBER_DARK,
  COLOR_ERROR_DARK,'#0891B2','#DB2777','#0D9488',
  '#9333EA',COLOR_ORANGE_DEEP,COLOR_GREEN_STRONG,'#1D4ED8',
];

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Route Jira avatar URLs through our backend proxy to handle Jira authentication. */
function proxyAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Avoid double-proxying
  if (url.startsWith('/api/jira/avatar-proxy')) return url;
  return `/api/jira/avatar-proxy?url=${encodeURIComponent(url)}`;
}

function AssigneeAvatar({ name, avatarUrl, size = 26 }: { name: string; avatarUrl?: string | null; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const proxied = proxyAvatarUrl(avatarUrl);
  const showImg = proxied && !imgFailed;
  return (
    <Tooltip label={name} withArrow position="top">
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: showImg ? 'transparent' : nameToColor(name),
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: Math.round(size * 0.38), fontWeight: 700,
        flexShrink: 0, fontFamily: FONT_FAMILY, cursor: 'default',
        border: '2px solid rgba(255,255,255,0.25)',
        letterSpacing: '-0.5px', overflow: 'hidden',
      }}>
        {showImg
          ? <img src={proxied!} alt={name} width={size} height={size}
              style={{ borderRadius: '50%', display: 'block' }}
              onError={() => setImgFailed(true)} />
          : getInitials(name)
        }
      </div>
    </Tooltip>
  );
}

// ── Contributor avatar stack (parent assignee + unique subtask assignees) ──

interface Contributor { name: string; avatarUrl: string | null; role: string; }

function ContributorAvatarStack({ issue, isDark }: { issue: IssueRow; isDark: boolean }) {
  const contributors: Contributor[] = [];
  const seen = new Set<string>();

  function add(name: string | null, avatarUrl: string | null, role: string) {
    if (!name || name === 'Unassigned' || seen.has(name)) return;
    seen.add(name);
    contributors.push({ name, avatarUrl, role });
  }

  // Parent assignee first, then unique subtask assignees
  add(issue.assignee, issue.assigneeAvatarUrl, 'Assignee');
  for (const sub of issue.subtasks ?? []) {
    add(sub.assignee, sub.assigneeAvatarUrl, 'Subtask');
  }

  if (contributors.length === 0) {
    return (
      <Tooltip label="Unassigned" withArrow position="top">
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: isDark ? 'rgba(255,255,255,0.08)' : BORDER_STRONG,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Text size="xs" c="dimmed">—</Text>
        </div>
      </Tooltip>
    );
  }

  const MAX_VISIBLE = 4;
  const visible = contributors.slice(0, MAX_VISIBLE);
  const overflow = contributors.length - MAX_VISIBLE;
  const overflowNames = contributors.slice(MAX_VISIBLE).map(c => c.name).join(', ');

  return (
    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
      {visible.map((c, i) => (
        <div
          key={c.name}
          style={{
            marginLeft: i === 0 ? 0 : -9,
            position: 'relative',
            zIndex: visible.length - i,
            borderRadius: '50%',
            boxShadow: '0 0 0 2px ' + (isDark ? DARK_BG : '#fff'),
          }}
        >
          <AssigneeAvatar name={c.name} avatarUrl={c.avatarUrl} size={26} />
        </div>
      ))}
      {overflow > 0 && (
        <Tooltip label={`Also: ${overflowNames}`} withArrow position="top">
          <div style={{
            marginLeft: -9,
            width: 26, height: 26, borderRadius: '50%',
            background: TEXT_GRAY,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: FONT_FAMILY,
            cursor: 'default',
            boxShadow: '0 0 0 2px ' + (isDark ? DARK_BG : '#fff'),
            zIndex: 0,
            flexShrink: 0,
          }}>
            +{overflow}
          </div>
        </Tooltip>
      )}
    </div>
  );
}

// ── Shared row styles ──────────────────────────────────────────────────────

const ROW_BORDER = (isDark: boolean) =>
  `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`;

// ── Subtask row (indented, no expand toggle) ───────────────────────────────

function SubtaskItem({ sub, isDark }: { sub: IssueRow; isDark: boolean }) {
  return (
    <Box
      px="md" py={6}
      style={{
        display: 'grid',
        gridTemplateColumns: '28px 20px 1fr auto auto 28px auto',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 48,
        borderBottom: ROW_BORDER(isDark),
        background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
        transition: 'background 120ms',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)')}
    >
      <Box />
      <IssueTypeIcon type={sub.issueType} />
      <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
        <Text size="xs" fw={600} style={{ color: AQUA, fontFamily: FONT_FAMILY, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {sub.key}
        </Text>
        <Tooltip label={sub.summary || '(no summary)'} withArrow position="top" openDelay={400} multiline maw={360}>
          <Text size="xs" style={{
            color: isDark ? '#cbd5e1' : '#475569',
            fontFamily: FONT_FAMILY,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 280, cursor: 'default',
          }}>
            {sub.summary || '(no summary)'}
          </Text>
        </Tooltip>
      </Group>
      <Badge size="xs" color={statusColor(sub.statusCategory)} variant="light" style={{ whiteSpace: 'nowrap' }}>
        {sub.statusName || 'To Do'}
      </Badge>
      {/* Fix version */}
      <Box style={{ minWidth: 0 }}>
        {sub.fixVersionName ? (
          <Tooltip label={sub.fixVersionName} withArrow position="top" openDelay={200}>
            <Badge size="xs" variant="outline" color="orange"
              style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
            >
              {sub.fixVersionName}
            </Badge>
          </Tooltip>
        ) : null}
      </Box>
      {/* Avatar */}
      <Box style={{ display: 'flex', justifyContent: 'center' }}>
        {sub.assignee ? <AssigneeAvatar name={sub.assignee} avatarUrl={sub.assigneeAvatarUrl} size={22} /> : (
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text size="xs" c="dimmed">?</Text>
          </div>
        )}
      </Box>
      {/* SP */}
      <Box style={{ minWidth: 28, textAlign: 'right' }}>
        {sub.storyPoints != null && (
          <Badge size="xs" variant="light" color="blue">{sub.storyPoints}</Badge>
        )}
      </Box>
    </Box>
  );
}

// ── Parent issue row (with optional subtask expand) ────────────────────────

function IssueItem({ issue, isDark }: { issue: IssueRow; isDark: boolean }) {
  const hasSubtasks = issue.subtasks && issue.subtasks.length > 0;
  const [subtasksOpen, setSubtasksOpen] = useState(false);

  return (
    <Box>
      <Box
        px="md" py={8}
        style={{
          display: 'grid',
          gridTemplateColumns: '14px 20px 1fr auto auto auto auto',
          alignItems: 'center',
          gap: 8,
          borderBottom: subtasksOpen ? 'none' : ROW_BORDER(isDark),
          cursor: 'pointer',
          transition: 'background 120ms',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Subtask expand toggle */}
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {hasSubtasks ? (
            <ActionIcon
              size={14} variant="subtle" color="gray"
              onClick={e => { e.stopPropagation(); setSubtasksOpen(v => !v); }}
              style={{ minWidth: 14 }}
            >
              {subtasksOpen
                ? <IconChevronDown size={11} />
                : <IconChevronRight size={11} />}
            </ActionIcon>
          ) : null}
        </Box>

        {/* Type icon */}
        <IssueTypeIcon type={issue.issueType} />

        {/* Key + summary + subtask count + epic */}
        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
          <Text size="xs" fw={600} style={{ color: AQUA, fontFamily: FONT_FAMILY, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {issue.key}
          </Text>
          <Tooltip label={issue.summary || '(no summary)'} withArrow position="top" openDelay={400} multiline maw={400}>
            <Text size="sm" style={{
              color: isDark ? BORDER_STRONG : DEEP_BLUE,
              fontFamily: FONT_FAMILY,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: 380, cursor: 'default',
            }}>
              {issue.summary || '(no summary)'}
            </Text>
          </Tooltip>
          {hasSubtasks && (
            <Badge
              size="xs" variant="light" color="gray"
              style={{ flexShrink: 0, cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); setSubtasksOpen(v => !v); }}
            >
              {issue.subtasks.length} sub
            </Badge>
          )}
          {issue.epicName && (
            <Tooltip label={issue.epicName} withArrow position="top" openDelay={300}>
              <Badge size="xs" variant="dot" color="grape" style={{ flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {issue.epicName}
              </Badge>
            </Tooltip>
          )}
        </Group>

        {/* Fix version — own column so it's always visible */}
        <Box style={{ minWidth: 0 }}>
          {issue.fixVersionName ? (
            <Tooltip label={issue.fixVersionName} withArrow position="top" openDelay={200}>
              <Badge
                size="xs" variant="outline" color="orange"
                style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
              >
                {issue.fixVersionName}
              </Badge>
            </Tooltip>
          ) : null}
        </Box>

        {/* Status */}
        <Badge size="xs" color={statusColor(issue.statusCategory)} variant="light" style={{ whiteSpace: 'nowrap' }}>
          {issue.statusName || 'To Do'}
        </Badge>

        {/* Contributor avatar stack — parent assignee + unique subtask assignees */}
        <Box style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 30 }}>
          <ContributorAvatarStack issue={issue} isDark={isDark} />
        </Box>

        {/* SP */}
        <Box style={{ minWidth: 28, textAlign: 'right' }}>
          {issue.storyPoints != null && (
            <Badge size="xs" variant="light" color="blue">{issue.storyPoints}</Badge>
          )}
        </Box>
      </Box>

      {/* Subtask rows */}
      {hasSubtasks && (
        <Collapse in={subtasksOpen}>
          {issue.subtasks.map(sub => (
            <SubtaskItem key={sub.key} sub={sub} isDark={isDark} />
          ))}
          <Box style={{ borderBottom: ROW_BORDER(isDark) }} />
        </Collapse>
      )}
    </Box>
  );
}

// ── Sprint section ─────────────────────────────────────────────────────────

function SprintSection({
  sprint, defaultOpen, search, isDark,
}: {
  sprint: SprintGroup; defaultOpen: boolean; search: string; isDark: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const filtered = useMemo(() =>
    sprint.issues.filter(i =>
      !search ||
      i.key.toLowerCase().includes(search.toLowerCase()) ||
      (i.summary || '').toLowerCase().includes(search.toLowerCase())
    ),
    [sprint.issues, search]
  );

  const headerBg = isDark
    ? (sprint.state === 'active' ? 'rgba(31,168,174,0.10)' : 'rgba(255,255,255,0.03)')
    : (sprint.state === 'active' ? 'rgba(31,168,174,0.07)' : 'rgba(0,0,0,0.02)');

  const sprintPct = sprint.totalCount > 0
    ? Math.round(sprint.doneCount * 100 / sprint.totalCount)
    : 0;

  // Story points totals (sum across all issues including subtasks)
  const allIssuesFlat = useMemo(() => {
    const flat: IssueRow[] = [];
    sprint.issues.forEach(i => { flat.push(i); flat.push(...(i.subtasks ?? [])); });
    return flat;
  }, [sprint.issues]);

  const totalSP   = allIssuesFlat.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const doneSP    = allIssuesFlat.filter(i => i.statusCategory?.toLowerCase() === 'done')
                                  .reduce((s, i) => s + (i.storyPoints ?? 0), 0);

  return (
    <Box style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 8, overflow: 'hidden' }}>
      {/* Header row */}
      <Box
        px="md" py={10}
        onClick={() => setOpen(v => !v)}
        style={{ cursor: 'pointer', background: headerBg, userSelect: 'none' }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap={8} wrap="nowrap">
            {open
              ? <IconChevronDown size={15} style={{ color: isDark ? TEXT_SUBTLE : '#718096', flexShrink: 0 }} />
              : <IconChevronRight size={15} style={{ color: isDark ? TEXT_SUBTLE : '#718096', flexShrink: 0 }} />}

            <Text fw={600} size="sm" style={{ color: sprint.state === 'active' ? AQUA : (isDark ? BORDER_STRONG : DEEP_BLUE), fontFamily: FONT_FAMILY }}>
              {sprint.name}
            </Text>

            {sprint.state === 'active' && (
              <Badge size="xs" color="teal" variant="filled">ACTIVE</Badge>
            )}
            {sprint.state === 'future' && (
              <Badge size="xs" color="gray" variant="light">UPCOMING</Badge>
            )}

            {(sprint.startDate || sprint.endDate) && (
              <Group gap={4} wrap="nowrap">
                <IconCalendar size={12} style={{ color: isDark ? '#718096' : '#a0aec0' }} />
                <Text size="xs" c="dimmed">
                  {sprint.startDate} → {sprint.endDate}
                </Text>
              </Group>
            )}
          </Group>

          <Group gap={12} wrap="nowrap">
            {/* Status pills */}
            <Group gap={6} wrap="nowrap">
              <Tooltip label="To Do" withArrow>
                <Badge size="sm" color="gray" variant="light">{sprint.todoCount}</Badge>
              </Tooltip>
              <Tooltip label="In Progress" withArrow>
                <Badge size="sm" color="blue" variant="light">{sprint.inProgressCount}</Badge>
              </Tooltip>
              <Tooltip label="Done" withArrow>
                <Badge size="sm" color="teal" variant="light">{sprint.doneCount}</Badge>
              </Tooltip>
            </Group>

            <Text size="xs" c="dimmed">{sprint.totalCount} items</Text>
            {totalSP > 0 && (
              <Tooltip label={`${doneSP} / ${totalSP} story points done`} withArrow>
                <Badge size="xs" color="blue" variant="light">
                  {doneSP}/{totalSP} SP
                </Badge>
              </Tooltip>
            )}
            <Badge size="xs" color={sprintPct >= 80 ? 'teal' : sprintPct >= 50 ? 'blue' : 'gray'} variant="dot">
              {sprintPct}% done
            </Badge>
          </Group>
        </Group>

        {sprint.goal && (
          <Text size="xs" c="dimmed" mt={4} ml={23} style={{ fontStyle: 'italic' }}>
            Goal: {sprint.goal}
          </Text>
        )}
      </Box>

      {/* Issue list */}
      <Collapse in={open}>
        {filtered.length === 0 ? (
          <Box px="md" py={12}>
            <Text size="xs" c="dimmed">{search ? 'No matching issues' : 'No issues in this sprint'}</Text>
          </Box>
        ) : (
          filtered.map(issue => (
            <IssueItem key={issue.key} issue={issue} isDark={isDark} />
          ))
        )}
      </Collapse>
    </Box>
  );
}

// ── Backlog section ────────────────────────────────────────────────────────

function BacklogSection({ backlog, search, isDark }: { backlog: BacklogGroup; search: string; isDark: boolean }) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const PAGE = 50;

  // Drag-to-reorder state
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const draggingKeyRef = useRef<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [insertAfterKey, setInsertAfterKey] = useState<string | null | undefined>(undefined); // undefined = no indicator

  const filtered = useMemo(() => {
    const baseList = backlog.issues.filter(i =>
      !search ||
      i.key.toLowerCase().includes(search.toLowerCase()) ||
      (i.summary || '').toLowerCase().includes(search.toLowerCase())
    );
    // Apply local order if set
    if (localOrder.length === 0) return baseList;
    const keyMap = Object.fromEntries(baseList.map(i => [i.key, i]));
    const sorted = localOrder.map(k => keyMap[k]).filter(Boolean) as IssueRow[];
    const remaining = baseList.filter(i => !localOrder.includes(i.key));
    return [...sorted, ...remaining];
  }, [backlog.issues, search, localOrder]);

  const visible = showAll ? filtered : filtered.slice(0, PAGE);

  function handleDragStartBacklog(key: string) {
    draggingKeyRef.current = key;
    setDraggingKey(key);
    setInsertAfterKey(undefined);
  }

  function handleDragOverBacklog(e: React.DragEvent, key: string) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const idx = visible.findIndex(i => i.key === key);
    const afterKey = e.clientY > rect.top + rect.height / 2
      ? key
      : (idx > 0 ? visible[idx - 1].key : null);
    setInsertAfterKey(afterKey);
  }

  function handleDropBacklog(e: React.DragEvent) {
    e.preventDefault();
    const key = draggingKeyRef.current;
    if (!key) return;
    const currentOrder = visible.map(i => i.key);
    const filtered2 = currentOrder.filter(k => k !== key);
    const afterKey = insertAfterKey;
    const insertIdx = afterKey === null
      ? 0
      : afterKey === undefined
      ? filtered2.length
      : filtered2.indexOf(afterKey) + 1;
    const newOrder = [...filtered2];
    newOrder.splice(insertIdx, 0, key);
    setLocalOrder(newOrder);
    setDraggingKey(null);
    setInsertAfterKey(undefined);
    draggingKeyRef.current = null;
  }

  function handleDragEndBacklog() {
    setDraggingKey(null);
    setInsertAfterKey(undefined);
    draggingKeyRef.current = null;
  }

  const AQUA_COLOR = '#2DCCD3';

  return (
    <Box
      onDrop={handleDropBacklog}
      onDragOver={e => e.preventDefault()}
      style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 8, overflow: 'hidden' }}
    >
      <Box px="md" py={10} onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', userSelect: 'none' }}>
        <Group justify="space-between">
          <Group gap={8}>
            {open ? <IconChevronDown size={15} style={{ color: isDark ? TEXT_SUBTLE : '#718096' }} /> : <IconChevronRight size={15} style={{ color: isDark ? TEXT_SUBTLE : '#718096' }} />}
            <Text fw={700} size="sm" style={{ color: isDark ? BORDER_STRONG : DEEP_BLUE, fontFamily: FONT_FAMILY }}>
              Backlog
            </Text>
          </Group>
          <Text size="xs" c="dimmed">{backlog.totalCount} items</Text>
        </Group>
      </Box>

      <Collapse in={open}>
        {visible.length === 0 ? (
          <Box px="md" py={12}>
            <Text size="xs" c="dimmed">{search ? 'No matching issues' : 'Backlog is empty'}</Text>
          </Box>
        ) : (
          <>
            {/* Insert-at-top indicator */}
            {insertAfterKey === null && (
              <Box mx="md" style={{ height: 3, borderRadius: 2, background: AQUA_COLOR, boxShadow: `0 0 6px ${AQUA_COLOR}80` }} />
            )}
            {visible.map((issue) => (
              <Box
                key={issue.key}
                draggable
                onDragStart={() => handleDragStartBacklog(issue.key)}
                onDragOver={e => handleDragOverBacklog(e, issue.key)}
                onDragEnd={handleDragEndBacklog}
                style={{
                  opacity: draggingKey === issue.key ? 0.4 : 1,
                  cursor: 'grab',
                  transition: 'opacity 0.15s',
                }}
              >
                <IssueItem issue={issue} isDark={isDark} />
                {insertAfterKey === issue.key && (
                  <Box mx="md" style={{ height: 3, borderRadius: 2, background: AQUA_COLOR, boxShadow: `0 0 6px ${AQUA_COLOR}80`, marginTop: 1 }} />
                )}
              </Box>
            ))}
            {filtered.length > PAGE && (
              <Box px="md" py={10}>
                <Text
                  size="xs" c="blue"
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setShowAll(v => !v)}
                >
                  {showAll ? '▲ Show fewer' : `▼ Show all ${filtered.length} backlog items`}
                </Text>
              </Box>
            )}
          </>
        )}
      </Collapse>
    </Box>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function SprintBacklogPage() {
  const isDark = useDarkMode();
  const [activePod, setActivePod] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string | null>('Story');
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [savedViewId, setSavedViewId] = useState<string | null>(null);

  const currentFilters = { search, filterType, activePod };
  const applyView = (filters: Record<string, string | null>) => {
    if (filters.search !== undefined) setSearch(filters.search ?? '');
    if (filters.filterType !== undefined) setFilterType(filters.filterType);
    if (filters.activePod !== undefined) setActivePod(filters.activePod);
  };

  const { data: pods, isLoading: loadingPods } = useQuery<PodSummary[]>({
    queryKey: ['backlog', 'pods'],
    queryFn: () => apiClient.get('/backlog/pods').then(r => r.data),
  });

  // Auto-select first pod once loaded
  useEffect(() => {
    if (pods && pods.length > 0 && !activePod) {
      setActivePod(String(pods[0].id));
    }
  }, [pods, activePod]);

  const podList: PodSummary[] = pods ?? [];
  const podId = activePod ?? (podList.length > 0 ? String(podList[0].id) : null);

  const triggerSync = useMutation({
    mutationFn: () => apiClient.post('/jira/sync/trigger', null, { params: { fullSync: true } }),
    onSuccess: () => {
      notifications.show({ color: 'teal', title: 'Sync started', message: 'Jira sync is running in the background. Refresh in ~30s to see updated data.' });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to trigger sync' }),
  });

  const { data: backlogData, isLoading: loadingBacklog, refetch } = useQuery<BacklogResponse>({
    queryKey: ['backlog', podId],
    queryFn: () => apiClient.get(`/backlog/${podId}`).then(r => r.data),
    enabled: !!podId,
    staleTime: 5 * 60 * 1000,
  });

  // Collect all issue types for filter dropdown
  const allTypes = useMemo(() => {
    if (!backlogData) return [];
    const types = new Set<string>();
    backlogData.sprints.forEach(s => s.issues.forEach(i => { if (i.issueType) types.add(i.issueType); }));
    backlogData.backlog.issues.forEach(i => { if (i.issueType) types.add(i.issueType); });
    return Array.from(types).sort();
  }, [backlogData]);

  // Apply type filter
  const effectiveSearch = search;
  const applyTypeFilter = (issues: IssueRow[]) =>
    filterType ? issues.filter(i => i.issueType === filterType) : issues;

  if (loadingPods) return (
    <PPPageLayout title="Sprint Backlog" subtitle="Jira board backlog view per configured POD" animate loading skeletonRows={6}>
      {null}
    </PPPageLayout>
  );

  if (podList.length === 0) return (
    <PPPageLayout title="Sprint Backlog" subtitle="Jira board backlog view per configured POD" animate>
      <Center py={80}>
        <Stack align="center" gap="sm">
          <ThemeIcon size={64} radius="md" variant="light" color="gray">
            <IconUsersGroup size={32} stroke={1.5} />
          </ThemeIcon>
          <Text fw={600} c="dimmed">No boards configured</Text>
          <Text size="sm" c="dimmed">Configure Jira PODs in Settings → Jira to see the backlog.</Text>
        </Stack>
      </Center>
    </PPPageLayout>
  );

  return (
    <PPPageLayout title="Sprint Backlog" subtitle="Jira board backlog view per configured POD" animate>
      <Stack gap="md">
        {/* Toolbar */}
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group gap="sm">
            <TextInput
              placeholder="Search issues…"
              leftSection={<IconSearch size={14} />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              w={220}
              size="sm"
            />
            <Select
              placeholder="All types"
              data={allTypes.map(t => ({ value: t, label: t }))}
              value={filterType}
              onChange={setFilterType}
              clearable
              w={140}
              size="sm"
            />
            <SavedViews
              pageKey="sprint_backlog"
              currentFilters={currentFilters}
              onApply={applyView}
              activeViewId={savedViewId}
              onActiveViewChange={setSavedViewId}
            />
          </Group>
          <Group gap="xs">
            {/* View toggle: List / Board */}
            <Tooltip label={viewMode === 'list' ? 'Switch to Board view' : 'Switch to List view'} withArrow>
              <ActionIcon
                variant={viewMode === 'board' ? 'filled' : 'light'}
                color="indigo"
                onClick={() => setViewMode(v => v === 'list' ? 'board' : 'list')}
              >
                {viewMode === 'list' ? <IconLayoutKanban size={16} /> : <IconList size={16} />}
              </ActionIcon>
            </Tooltip>
            {backlogData?.syncedAt && (
              <Text size="xs" c="dimmed">
                Synced: {backlogData.syncedAt.split('T')[0]}
              </Text>
            )}
            <Button
              size="xs"
              variant="light"
              color="blue"
              leftSection={<IconCloudDownload size={14} />}
              loading={triggerSync.isPending}
              onClick={() => triggerSync.mutate()}
            >
              Trigger Sync
            </Button>
            <Tooltip label="Refresh view" withArrow>
              <ActionIcon variant="light" color="teal" onClick={() => refetch()} loading={loadingBacklog}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Pod tabs */}
        <Tabs
          value={podId}
          onChange={v => { setActivePod(v); setSearch(''); setFilterType('Story'); }}
          variant="pills"
        >
          <Tabs.List>
            {podList.map(pod => (
              <Tabs.Tab key={pod.id} value={String(pod.id)}>
                <Group gap={6} wrap="nowrap">
                  <IconUsersGroup size={14} />
                  <Text size="sm">{pod.displayName}</Text>
                  <Badge size="xs" variant="light" color="gray">
                    {pod.projectKeys.join(', ')}
                  </Badge>
                </Group>
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        {/* Content */}
        {loadingBacklog ? (
          <Stack gap="sm" mt="md">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.04)', animation: 'ppSkeletonPulse 1.6s ease-in-out infinite', animationDelay: `${i * 80}ms` }} />
            ))}
          </Stack>
        ) : !backlogData ? (
          <Center py={60}>
            <Text c="dimmed">No data available for this board.</Text>
          </Center>
        ) : viewMode === 'board' ? (
          // ── Board (Kanban) view ──────────────────────────────────────────────
          (() => {
            const activeSprint = backlogData.sprints.find(s => s.state === 'active') ?? backlogData.sprints[0];
            if (!activeSprint) return (
              <Center py={80}>
                <Text c="dimmed">No active sprint to show as board.</Text>
              </Center>
            );
            const boardIssues = applyTypeFilter(activeSprint.issues);
            return (
              <Stack gap="xs">
                <Group gap="xs">
                  <Badge size="sm" variant="light" color="teal">{activeSprint.name}</Badge>
                  <Text size="xs" c="dimmed">Board view — showing active sprint issues</Text>
                </Group>
                <SprintKanbanBoard issues={boardIssues.map(i => ({
                  ...i,
                  hoursLogged: 0,
                  storyPoints: i.storyPoints ?? 0,
                  assignee: i.assignee ?? '',
                  assigneeAvatarUrl: i.assigneeAvatarUrl ?? '',
                }))} />
              </Stack>
            );
          })()
        ) : (
          // ── List view ────────────────────────────────────────────────────────
          <Stack gap="sm">
            {/* Sprint sections */}
            {backlogData.sprints.length === 0 ? (
              <Paper withBorder radius="md" p="xl">
                <Center>
                  <Stack align="center" gap="xs">
                    <ThemeIcon size={48} radius="md" variant="light" color="gray">
                      <IconCalendar size={24} stroke={1.5} />
                    </ThemeIcon>
                    <Text size="sm" c="dimmed">No active or upcoming sprints found</Text>
                  </Stack>
                </Center>
              </Paper>
            ) : (
              backlogData.sprints.map((sprint, idx) => (
                <SprintSection
                  key={sprint.sprintJiraId}
                  sprint={{ ...sprint, issues: applyTypeFilter(sprint.issues) }}
                  defaultOpen={sprint.state === 'active' || idx === 0}
                  search={effectiveSearch}
                  isDark={isDark}
                />
              ))
            )}

            <Divider label="Backlog" labelPosition="left" my={4} />

            {/* Backlog section */}
            <BacklogSection
              backlog={{ ...backlogData.backlog, issues: applyTypeFilter(backlogData.backlog.issues) }}
              search={effectiveSearch}
              isDark={isDark}
            />
          </Stack>
        )}
      </Stack>
    </PPPageLayout>
  );
}
