import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Text, Group, Badge, Stack, Collapse, Box,
  Center, ActionIcon, Tooltip,
  TextInput, Select, Divider, Paper, Button,
  RingProgress, ScrollArea, Progress, SimpleGrid, SegmentedControl,
} from '@mantine/core';
import {
  IconChevronDown, IconChevronRight, IconBolt,
  IconSearch, IconRefresh, IconUsersGroup,
  IconCalendar, IconCloudDownload,
  IconBug, IconBook, IconCheckbox, IconSubtask,
  IconFlame, IconArrowUpCircle, IconSparkles, IconHelpCircle,
  IconList, IconLayoutKanban,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../api/client';
import { PPPageLayout } from '../components/pp';
import SprintKanbanBoard from '../components/projects/SprintKanbanBoard';
import SavedViews from '../components/common/SavedViews';
import { AQUA, BORDER_STRONG, COLOR_AMBER_DARK, COLOR_BLUE, COLOR_BLUE_STRONG, COLOR_EMERALD, COLOR_ERROR_DARK, COLOR_ERROR_STRONG, COLOR_GREEN, COLOR_GREEN_STRONG, COLOR_ORANGE_ALT, COLOR_ORANGE_DEEP, COLOR_VIOLET, DARK_BG, DEEP_BLUE, FONT_FAMILY, TEXT_GRAY, TEXT_SUBTLE} from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import EmptyState from '../components/common/EmptyState';
import { useNavigate } from 'react-router-dom';

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
  createdAt: string | null; // Jira issue creation date — used for scope creep detection
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
            color: '#fff', fontSize: 10, fontWeight: 700,
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
      <Group gap={8} wrap="nowrap" miw={0}>
        <Text size="xs" fw={600} style={{ color: AQUA, fontFamily: FONT_FAMILY, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {sub.key}
        </Text>
        <Tooltip label={sub.summary || '(no summary)'} withArrow position="top" openDelay={400} multiline maw={360}>
          <Text size="xs" style={{
            color: isDark ? '#cbd5e1' : '#475569',
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
      <Box miw={0}>
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
              miw={14}
              aria-label="Expand"
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
        <Group gap={8} wrap="nowrap" miw={0}>
          <Text size="xs" fw={600} style={{ color: AQUA, fontFamily: FONT_FAMILY, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {issue.key}
          </Text>
          <Tooltip label={issue.summary || '(no summary)'} withArrow position="top" openDelay={400} multiline maw={400}>
            <Text size="sm" style={{
              color: isDark ? BORDER_STRONG : DEEP_BLUE,
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
        <Box miw={0}>
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
            {sprint.state === 'closed' && (
              <Badge size="xs" color="dark" variant="light">CLOSED</Badge>
            )}
            {sprint.state === 'future' && (() => {
              const isStale = sprint.endDate && new Date(sprint.endDate) < new Date();
              return isStale
                ? <Badge size="xs" color="orange" variant="light">STALE — never started</Badge>
                : <Badge size="xs" color="gray" variant="light">UPCOMING</Badge>;
            })()}

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
  const navigate = useNavigate();
  const [activePod, setActivePod] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string | null>('Story');
  const [sprintView, setSprintView] = useState<string>('future');
  const [hideEmptySprints, setHideEmptySprints] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [savedViewId, setSavedViewId] = useState<string | null>(null);

  const currentFilters = { search, filterType, activePod, sprintView };
  const applyView = (filters: Record<string, string | null>) => {
    if (filters.search !== undefined) setSearch(filters.search ?? '');
    if (filters.filterType !== undefined) setFilterType(filters.filterType);
    if (filters.activePod !== undefined) setActivePod(filters.activePod);
    if (filters.sprintView !== undefined) setSprintView(filters.sprintView ?? 'future');
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

  // Fetch all pods' data in parallel for the consolidated widget — respects sprintView filter
  const allPodResults = useQueries({
    queries: podList.map(pod => ({
      queryKey: ['backlog', String(pod.id), sprintView],
      queryFn: () => apiClient.get<BacklogResponse>(`/backlog/${pod.id}?view=${sprintView}`).then(r => r.data),
      staleTime: 5 * 60 * 1000,
    }))
  });

  const [widgetTab, setWidgetTab] = useState<string>('overview');

  const qc = useQueryClient();
  const triggerSync = useMutation({
    mutationFn: () => apiClient.post('/jira/sync/trigger', null, { params: { fullSync: true } }),
    onSuccess: () => {
      notifications.show({ color: 'teal', title: 'Sync started', message: 'Jira sync is running in background. Data will refresh automatically in ~30s.' });
      // Invalidate ALL pod backlogs — sync is global, not tab-specific
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['backlog'] });
      }, 30000);
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to trigger sync' }),
  });

  const { data: backlogData, isLoading: loadingBacklog, refetch } = useQuery<BacklogResponse>({
    queryKey: ['backlog', podId, sprintView],
    queryFn: () => apiClient.get(`/backlog/${podId}?view=${sprintView}`).then(r => r.data),
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
      {/* PP-13 §7: standardised empty state */}
      <EmptyState
        icon={<IconUsersGroup size={40} />}
        title="No Jira boards configured"
        description="Connect Jira and configure PODs to see your sprint backlog, stories, and epics synced here."
        action={{ label: 'Go to Jira Settings', onClick: () => navigate('/settings/org?tab=jira'), variant: 'filled', color: 'teal' }}
        secondaryAction={{ label: 'View PODs', onClick: () => navigate('/pods'), variant: 'light' }}
        tips={['PODs represent Jira boards — configure one per team', 'Once connected, stories and epics sync automatically']}
        size="lg"
      />
    </PPPageLayout>
  );

  return (
    <PPPageLayout title="Sprint Backlog" subtitle="Jira board backlog view per configured POD" animate
      actions={
        <Group gap="xs">
          {backlogData?.syncedAt && (
            <Text size="xs" c="dimmed">Synced: {backlogData.syncedAt.split('T')[0]}</Text>
          )}
          <Button size="xs" variant="light" color="teal"
            leftSection={<IconCloudDownload size={14} />}
            loading={triggerSync.isPending}
            onClick={() => triggerSync.mutate()}
          >
            Sync Jira
          </Button>
          <ActionIcon variant="light" color="teal" size="sm"
            onClick={() => refetch()} loading={loadingBacklog}
            title="Refresh view"
            aria-label="Refresh"
          >
            <IconRefresh size={14} />
          </ActionIcon>
        </Group>
      }
    >
      <Stack gap="md">
        {/* ── Consolidated widget: ALL boards ── */}
        {(() => {
          // Aggregate active sprint data from all pods
          const allSprints = allPodResults
            .filter(r => r.data)
            .map(r => {
              const d = r.data!;
              const active = d.sprints.find(s => s.state === 'active') ?? d.sprints[0];
              return active ? { pod: d.podDisplayName, sprint: active } : null;
            })
            .filter(Boolean) as { pod: string; sprint: SprintGroup }[];

          if (allSprints.length === 0) return null;

          // Flatten all issues from all active sprints — apply type filter to match per-tab view
          const allIssuesRaw = allSprints.flatMap(({ sprint }) => sprint.issues ?? []);
          const allIssues = filterType
            ? allIssuesRaw.filter(i => (i.issueType || '').toLowerCase() === filterType.toLowerCase())
            : allIssuesRaw;

          // Workflow status groups (based on actual Jira workflow)
          const WORKFLOW_GROUPS: { label: string; statuses: string[]; color: string }[] = [
            { label: 'Backlog/Draft',   color: '#94a3b8', statuses: ['DRAFT','IN SCOPING','PENDING PO APPROVAL','SCOPED AND READY FOR REFINEMENT','HOLD/PAUSED'] },
            { label: 'Ready',           color: '#3b82f6', statuses: ['READY FOR DEVELOPMENT'] },
            { label: 'In Dev',          color: '#8b5cf6', statuses: ['IN DEVELOPMENT','DEVELOPMENT COMPLETE','BLOCKED'] },
            { label: 'Testing',         color: '#f59e0b', statuses: ['READY FOR TESTING','QA IN PROGRESS','QA COMPLETED'] },
            { label: 'UAT',             color: '#06b6d4', statuses: ['READY FOR UAT','READY FOR PO ACCEPTANCE','UAT IN PROGRESS','UAT COMPLETE','UAT NOT REQUIRED'] },
            { label: 'Release',         color: '#10b981', statuses: ['ADDED TO RELEASE BRANCH'] },
            { label: 'Done',            color: '#22c55e', statuses: ['DONE','CANNOT REPRODUCE','NOT NEEDED','DUPLICATE'] },
          ];

          const total   = allIssues.length;
          const done    = allIssues.filter(i => i.statusCategory === 'done').length;
          const donePct = total > 0 ? Math.round((done / total) * 100) : 0;
          const spTotal = allIssues.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
          const spDone  = allIssues.filter(i => i.statusCategory === 'done').reduce((s, i) => s + (i.storyPoints ?? 0), 0);

          // Scope creep: NEW STORIES added to the sprint after it started.
          // Only counts Stories — bugs/tasks added mid-sprint are expected, not scope creep.
          const scopeCreep = allSprints.reduce((acc, { sprint }) => {
            if (!sprint.startDate) return acc;
            const start = sprint.startDate.split('T')[0];
            const added = sprint.issues.filter(i =>
              i.createdAt && i.createdAt > start &&
              (i.issueType?.toLowerCase() === 'story' || i.issueType?.toLowerCase() === 'feature')
            );
            return acc + added.length;
          }, 0);
          const scopeCreepPct = total > 0 ? Math.round((scopeCreep / total) * 100) : 0;

          // Type breakdown
          const byType: Record<string, number> = {};
          allIssues.forEach(i => { const t = i.issueType || 'Other'; byType[t] = (byType[t] ?? 0) + 1; });

          // Priority breakdown
          const PRIORITY_ORDER = ['Highest','High','Medium','Low','Lowest'];
          const byPriority: Record<string, number> = {};
          allIssues.forEach(i => { const p = i.priorityName || 'None'; byPriority[p] = (byPriority[p] ?? 0) + 1; });

          // Workflow status breakdown
          const byWorkflow = WORKFLOW_GROUPS.map(g => ({
            ...g,
            count: allIssues.filter(i => g.statuses.includes((i.statusName || '').toUpperCase())).length,
          }));

          // Per-board summary
          const boardSummaries = allSprints.map(({ pod, sprint }) => {
            const issues = sprint.issues;
            const d = issues.filter(i => i.statusCategory === 'done').length;
            const pct = issues.length > 0 ? Math.round((d / issues.length) * 100) : 0;
            return { pod, name: sprint.name, total: issues.length, done: d, pct };
          });

          return (
            <Paper p="md" radius="md" withBorder mb={4} style={{ borderLeft: `3px solid ${AQUA}` }}>
              <Group justify="space-between" mb="sm">
                <Group gap="xs">
                  <IconUsersGroup size={16} color={AQUA} />
                  <Text fw={700} size="sm" style={{ fontFamily: FONT_FAMILY }}>All Boards — Active Sprint Summary</Text>
                  <Badge size="xs" color="teal" variant="light">{allSprints.length} boards</Badge>
                  <Badge size="xs" color="gray" variant="light">{total} issues</Badge>
                </Group>
                <SegmentedControl
                  size="xs"
                  value={widgetTab}
                  onChange={setWidgetTab}
                  data={[
                    { value: 'overview',  label: 'Overview' },
                    { value: 'workflow',  label: 'Workflow' },
                    { value: 'type',      label: 'By Type' },
                    { value: 'priority',  label: 'Priority' },
                    { value: 'boards',    label: 'By Board' },
                  ]}
                />
              </Group>

              {/* Overview tab */}
              {widgetTab === 'overview' && (
                <Group gap="sm" wrap="nowrap" style={{ overflowX: 'auto' }} pb={2}>
                  <Paper p="sm" radius="md" withBorder style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <RingProgress size={56} thickness={5} roundCaps
                      sections={[{ value: donePct, color: COLOR_EMERALD }]}
                      label={<Text ta="center" size="10px" fw={700} c={COLOR_EMERALD}>{donePct}%</Text>}
                    />
                    <div>
                      <Text size="xs" fw={700} style={{ fontFamily: FONT_FAMILY }}>Overall Progress</Text>
                      <Text size="10px" c="dimmed">{done} of {total} done</Text>
                    </div>
                  </Paper>
                  {[
                    { label: 'Total',       value: total,                                                                    color: COLOR_BLUE },
                    { label: 'Done',        value: done,                                                                     color: COLOR_EMERALD },
                    { label: 'In Progress', value: allIssues.filter(i => i.statusCategory === 'indeterminate').length,      color: COLOR_AMBER_DARK },
                    { label: 'To Do',       value: allIssues.filter(i => i.statusCategory === 'new').length,                color: TEXT_GRAY },
                  ].map(({ label, value, color }) => (
                    <Paper key={label} p="sm" radius="md" withBorder style={{ textAlign: 'center', flexShrink: 0, minWidth: 80 }}>
                      <Text style={{ fontSize: 22, fontWeight: 800, color, fontFamily: FONT_FAMILY, lineHeight: 1.1 }}>{value}</Text>
                      <Text size="xs" c="dimmed" mt={2} style={{ fontFamily: FONT_FAMILY }}>{label}</Text>
                    </Paper>
                  ))}
                  {spTotal > 0 && (
                    <Paper p="sm" radius="md" withBorder style={{ flexShrink: 0, minWidth: 110 }}>
                      <Group gap={4} align="baseline">
                        <Text style={{ fontSize: 22, fontWeight: 800, color: COLOR_VIOLET, fontFamily: FONT_FAMILY, lineHeight: 1.1 }}>{spDone}</Text>
                        <Text size="xs" c="dimmed">/ {spTotal} SP</Text>
                      </Group>
                      <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Story Points</Text>
                      <Progress value={spTotal > 0 ? (spDone/spTotal)*100 : 0} color="violet" size="xs" radius="xl" mt={4} />
                    </Paper>
                  )}
                  <Paper p="sm" radius="md" withBorder style={{ flexShrink: 0, minWidth: 110, borderColor: scopeCreepPct > 10 ? COLOR_ORANGE_ALT : undefined }}>
                    <Group gap={4} align="baseline">
                      <Text style={{ fontSize: 22, fontWeight: 800, color: scopeCreepPct > 10 ? COLOR_ORANGE_ALT : TEXT_GRAY, fontFamily: FONT_FAMILY, lineHeight: 1.1 }}>{scopeCreep}</Text>
                      <Text size="xs" c="dimmed">{scopeCreepPct}%</Text>
                    </Group>
                    <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Scope Creep</Text>
                    <Text size="9px" c="dimmed">Added after sprint start</Text>
                  </Paper>
                </Group>
              )}

              {/* Workflow tab */}
              {widgetTab === 'workflow' && (
                <Stack gap={6}>
                  <Text size="xs" c="dimmed" mb={4}>Issues mapped to your workflow stages across all active sprints</Text>
                  {byWorkflow.filter(g => g.count > 0).map(g => (
                    <Group key={g.label} gap="sm" align="center">
                      <Text size="xs" style={{ fontFamily: FONT_FAMILY, minWidth: 110, color: g.color, fontWeight: 600 }}>{g.label}</Text>
                      <Progress value={total > 0 ? (g.count/total)*100 : 0} color={g.color} size="md" radius="xl" style={{ flex: 1 }} />
                      <Badge size="xs" variant="light" style={{ minWidth: 32, background: `${g.color}22`, color: g.color }}>{g.count}</Badge>
                    </Group>
                  ))}
                </Stack>
              )}

              {/* By Type tab */}
              {widgetTab === 'type' && (
                <SimpleGrid cols={{ base: 3, sm: 5 }} spacing="xs">
                  {Object.entries(byType).sort((a,b) => b[1]-a[1]).map(([type, count]) => {
                    return (
                      <Paper key={type} p="xs" radius="md" withBorder ta="center">
                        <Group justify="center" mb={4}><IssueTypeIcon type={type} /></Group>
                        <Text style={{ fontSize: 20, fontWeight: 800, fontFamily: FONT_FAMILY }}>{count}</Text>
                        <Text size="10px" c="dimmed">{type}</Text>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
              )}

              {/* Priority tab */}
              {widgetTab === 'priority' && (
                <Stack gap={6}>
                  {[...PRIORITY_ORDER, 'None'].map(p => {
                    const count = byPriority[p] ?? 0;
                    if (!count) return null;
                    const color = priorityColor(p);
                    return (
                      <Group key={p} gap="sm" align="center">
                        <Box style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <Text size="xs" style={{ minWidth: 70, fontFamily: FONT_FAMILY, fontWeight: 600, color }}>{p}</Text>
                        <Progress value={total > 0 ? (count/total)*100 : 0} color={color} size="md" radius="xl" style={{ flex: 1 }} />
                        <Text size="xs" fw={700} style={{ minWidth: 32, textAlign: 'right' }}>{count}</Text>
                      </Group>
                    );
                  })}
                </Stack>
              )}

              {/* By Board tab */}
              {widgetTab === 'boards' && (
                <Stack gap={6}>
                  {boardSummaries.map(b => (
                    <Group key={b.pod} gap="sm" align="center">
                      <IconUsersGroup size={13} color={AQUA} style={{ flexShrink: 0 }} />
                      <Text size="xs" style={{ fontFamily: FONT_FAMILY, fontWeight: 600, minWidth: 140 }} truncate>{b.pod}</Text>
                      <Progress value={b.pct} color="teal" size="md" radius="xl" style={{ flex: 1 }} />
                      <Text size="xs" c="dimmed" style={{ minWidth: 80, textAlign: 'right' }}>{b.done}/{b.total} • {b.pct}%</Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </Paper>
          );
        })()}

        {/* ── Global Toolbar — ABOVE POD tabs so filters apply across all boards ── */}
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
            <Select
              data={[
                { value: 'active', label: '● Active only' },
                { value: 'future', label: '● Active + Future' },
                { value: 'closed', label: '✓ Closed sprints' },
                { value: 'all',    label: '⊕ All sprints' },
              ]}
              value={sprintView}
              onChange={v => setSprintView(v ?? 'future')}
              w={170}
              size="sm"
            />
            <Tooltip label={hideEmptySprints ? 'Empty sprints hidden — click to show' : 'Showing empty sprints — click to hide'} withArrow>
              <Button
                size="xs"
                variant={hideEmptySprints ? 'filled' : 'light'}
                color={hideEmptySprints ? 'indigo' : 'gray'}
                onClick={() => setHideEmptySprints(v => !v)}
              >
                {hideEmptySprints ? 'Hide empty' : 'Show empty'}
              </Button>
            </Tooltip>
            <SavedViews
              pageKey="sprint_backlog"
              currentFilters={currentFilters}
              onApply={applyView}
              activeViewId={savedViewId}
              onActiveViewChange={setSavedViewId}
            />
          </Group>
          <Group gap="xs">
            <Tooltip label={viewMode === 'list' ? 'Switch to Board view' : 'Switch to List view'} withArrow>
              <ActionIcon
                variant={viewMode === 'board' ? 'filled' : 'light'}
                color="indigo"
                onClick={() => setViewMode(v => v === 'list' ? 'board' : 'list')}
                aria-label="List view"
              >
                {viewMode === 'list' ? <IconLayoutKanban size={16} /> : <IconList size={16} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Refresh view" withArrow>
              <ActionIcon variant="light" color="teal" onClick={() => refetch()} loading={loadingBacklog}
      aria-label="Refresh"
    >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Pod tabs — horizontally scrollable, never wraps */}
        <ScrollArea scrollbarSize={4} type="hover" style={{ borderBottom: `1px solid ${BORDER_STRONG}` }} pb={2}>
          <Group gap={4} wrap="nowrap" pb={8}>
            {podList.map(pod => {
              const isActive = String(pod.id) === podId;
              return (
                <Box
                  key={pod.id}
                  onClick={() => { setActivePod(String(pod.id)); setSearch(''); setFilterType('Story'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                    whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
                    background: isActive ? `${AQUA}22` : 'transparent',
                    border: `1.5px solid ${isActive ? AQUA : 'transparent'}`,
                    color: isActive ? AQUA : TEXT_GRAY,
                    fontFamily: FONT_FAMILY, fontWeight: isActive ? 700 : 500,
                    fontSize: 13,
                  }}
                >
                  <IconUsersGroup size={13} />
                  <span>{pod.displayName}</span>
                  <span style={{
                    background: isActive ? 'rgba(255,255,255,0.82)' : BORDER_STRONG,
                    color: isActive ? '#0C2340' : TEXT_SUBTLE,
                    borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700,
                  }}>
                    {pod.projectKeys.join(' ')}
                  </span>
                </Box>
              );
            })}
          </Group>
        </ScrollArea>


        {/* ── Per-pod sprint summary (below POD tabs, above issues) ── */}
        {backlogData && (() => {
          const s = backlogData.sprints.find(sp => sp.state === 'active') ?? backlogData.sprints[0];
          if (!s) return null;
          const issues = s.issues;
          const total = issues.length;
          const done  = issues.filter(i => i.statusCategory === 'done').length;
          const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
          const spTotal = issues.reduce((a, i) => a + (i.storyPoints ?? 0), 0);
          const spDone  = issues.filter(i => i.statusCategory === 'done').reduce((a, i) => a + (i.storyPoints ?? 0), 0);
          const scopeCreepCount = s.startDate
            ? issues.filter(i =>
                i.createdAt && i.createdAt > s.startDate!.split('T')[0] &&
                (i.issueType?.toLowerCase() === 'story' || i.issueType?.toLowerCase() === 'feature')
              ).length
            : 0;
          return (
            <Group gap="sm" wrap="nowrap" style={{ overflowX: 'auto' }} pb={2}>
              <Paper p="sm" radius="md" withBorder style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <RingProgress size={48} thickness={4} roundCaps
                  sections={[{ value: pct, color: COLOR_EMERALD }]}
                  label={<Text ta="center" size="10px" fw={700} c={COLOR_EMERALD}>{pct}%</Text>}
                />
                <div>
                  <Text size="xs" fw={700} style={{ fontFamily: FONT_FAMILY }}>{s.name}</Text>
                  {s.startDate && s.endDate && <Text size="10px" c="dimmed">{s.startDate.slice(5)} → {s.endDate.slice(5)}</Text>}
                </div>
              </Paper>
              {[
                { label: 'Items',  value: total, color: COLOR_BLUE },
                { label: 'Done',   value: done,  color: COLOR_EMERALD },
                { label: 'Active', value: issues.filter(i => i.statusCategory === 'indeterminate').length, color: COLOR_AMBER_DARK },
                { label: 'Todo',   value: issues.filter(i => i.statusCategory === 'new').length, color: TEXT_GRAY },
              ].map(({ label, value, color }) => (
                <Paper key={label} p="xs" radius="md" withBorder style={{ textAlign: 'center', flexShrink: 0, minWidth: 72 }}>
                  <Text style={{ fontSize: 20, fontWeight: 800, color, fontFamily: FONT_FAMILY, lineHeight: 1.1 }}>{value}</Text>
                  <Text size="xs" c="dimmed">{label}</Text>
                </Paper>
              ))}
              {spTotal > 0 && (
                <Paper p="xs" radius="md" withBorder style={{ flexShrink: 0, minWidth: 100 }}>
                  <Group gap={3} align="baseline">
                    <Text style={{ fontSize: 20, fontWeight: 800, color: COLOR_VIOLET, fontFamily: FONT_FAMILY, lineHeight: 1.1 }}>{spDone}</Text>
                    <Text size="xs" c="dimmed">/{spTotal} SP</Text>
                  </Group>
                  <Progress value={spTotal > 0 ? (spDone/spTotal)*100 : 0} color="violet" size="xs" radius="xl" mt={2} />
                </Paper>
              )}
              {scopeCreepCount > 0 && (
                <Paper p="xs" radius="md" withBorder style={{ flexShrink: 0, borderColor: COLOR_ORANGE_ALT }}>
                  <Text style={{ fontSize: 20, fontWeight: 800, color: COLOR_ORANGE_ALT, fontFamily: FONT_FAMILY, lineHeight: 1.1 }}>{scopeCreepCount}</Text>
                  <Text size="xs" c="dimmed">Scope creep</Text>
                </Paper>
              )}
            </Group>
          );
        })()}

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
              /* PP-13 §7: standardised empty state for no active sprints */
              <EmptyState
                icon={<IconCalendar size={36} />}
                title="No active or upcoming sprints"
                description="There are no active or upcoming sprints in this board. Start a sprint in Jira or wait for the next sync."
                action={{ label: 'Refresh', onClick: () => window.location.reload(), variant: 'light', color: 'teal' }}
                size="md"
                color="teal"
              />
            ) : (
              backlogData.sprints
                .filter(sprint => {
                  if (!hideEmptySprints || sprint.state === 'active') return true;
                  // Count issues that pass the current type filter (same filter the SprintCard uses)
                  const visibleCount = (sprint.issues ?? []).filter(i =>
                    !filterType || (i.issueType || '').toLowerCase() === filterType.toLowerCase()
                  ).length;
                  return visibleCount > 0;
                })
                .map((sprint, idx) => (
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
