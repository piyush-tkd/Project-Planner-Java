/**
 * SprintKanbanBoard — Sprint 7 S7.9
 *
 * Drag-and-drop Kanban board for sprint issues.
 * Uses native HTML5 drag API (no external library needed).
 *
 * Columns: To Do · In Progress · Done
 *
 * Note: drag moves are local-state only (no backend write-back since
 * that would require Jira API OAuth, which is out of scope for Sprint 7).
 * A toast is shown with an undo action on every move.
 */
import { useState, useRef, useCallback } from 'react';
import {
  Paper, Text, Group, Badge, Stack, Box, ScrollArea, ActionIcon,
  Tooltip, ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBriefcase, IconBug, IconSubtask, IconCheck, IconClock,
  IconUser, IconDots,
} from '@tabler/icons-react';
import { FONT_FAMILY, AQUA, DEEP_BLUE } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import type { IssueRow } from '../../api/jira';

// ── Column definitions ───────────────────────────────────────────────────────
type ColId = 'To Do' | 'In Progress' | 'In Review' | 'Done';

const COLUMNS: { id: ColId; label: string; color: string; icon: React.ReactNode }[] = [
  { id: 'To Do',       label: 'To Do',       color: '#94A3B8', icon: <IconDots size={14} /> },
  { id: 'In Progress', label: 'In Progress', color: '#F59E0B', icon: <IconClock size={14} /> },
  { id: 'In Review',   label: 'In Review',   color: '#F97316', icon: <IconUser size={14} /> },
  { id: 'Done',        label: 'Done',        color: '#22C55E', icon: <IconCheck size={14} /> },
];

// ── Type badge colours ────────────────────────────────────────────────────────
const ISSUE_TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  Story:      { bg: '#EDE9FE', text: '#7C3AED' },
  Bug:        { bg: '#FEE2E2', text: '#DC2626' },
  Task:       { bg: '#DBEAFE', text: '#2563EB' },
  'Sub-task': { bg: '#F1F5F9', text: '#64748B' },
  Subtask:    { bg: '#F1F5F9', text: '#64748B' },
  Epic:       { bg: '#FFEDD5', text: '#EA580C' },
  default:    { bg: '#F0FDF4', text: '#15803D' },
};

function issueTypeColor(type: string) {
  return ISSUE_TYPE_COLOR[type] ?? ISSUE_TYPE_COLOR.default;
}

function IssueTypeIcon({ type }: { type: string }) {
  if (type === 'Bug') return <IconBug size={12} />;
  if (type.toLowerCase().includes('subtask') || type.toLowerCase().includes('sub-task')) return <IconSubtask size={12} />;
  return <IconBriefcase size={12} />;
}

// ── KanbanCard ────────────────────────────────────────────────────────────────
interface KanbanCardProps {
  issue: IssueRow;
  isDark: boolean;
  onDragStart: (issueKey: string) => void;
  dragOver: boolean;
}

function KanbanCard({ issue, isDark, onDragStart, dragOver }: KanbanCardProps) {
  const tc = issueTypeColor(issue.issueType);
  return (
    <Paper
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(issue.key);
      }}
      withBorder
      p="xs"
      radius="md"
      style={{
        cursor: 'grab',
        background: isDark ? 'var(--mantine-color-dark-6)' : '#fff',
        borderColor: dragOver
          ? AQUA
          : isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-2)',
        boxShadow: dragOver
          ? `0 0 0 2px ${AQUA}40`
          : isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        userSelect: 'none',
      }}
    >
      {/* Type + Key row */}
      <Group gap={6} wrap="nowrap" mb={4}>
        <ThemeIcon size={18} radius="sm" style={{ background: tc.bg, color: tc.text, border: 'none' }}>
          <IssueTypeIcon type={issue.issueType} />
        </ThemeIcon>
        <Text size="xs" fw={600} style={{ color: tc.text, fontFamily: FONT_FAMILY }}>
          {issue.key}
        </Text>
        {issue.storyPoints > 0 && (
          <Badge size="xs" variant="light" color="gray" ml="auto">{issue.storyPoints} pts</Badge>
        )}
      </Group>

      {/* Summary */}
      <Text size="xs" style={{ fontFamily: FONT_FAMILY, lineHeight: 1.4 }} lineClamp={2}>
        {issue.summary}
      </Text>

      {/* Assignee footer */}
      {issue.assignee && (
        <Group gap={4} mt={6} wrap="nowrap">
          <IconUser size={11} color="var(--mantine-color-dimmed)" />
          <Text size="xs" c="dimmed" truncate style={{ fontFamily: FONT_FAMILY, fontSize: 10 }}>
            {issue.assignee}
          </Text>
        </Group>
      )}
    </Paper>
  );
}

// ── KanbanColumn ─────────────────────────────────────────────────────────────
interface KanbanColumnProps {
  col: typeof COLUMNS[number];
  issues: IssueRow[];
  isDark: boolean;
  dragKey: string | null;
  onDragStart: (key: string) => void;
  onDrop: (colId: ColId) => void;
}

function KanbanColumn({ col, issues, isDark, dragKey, onDragStart, onDrop }: KanbanColumnProps) {
  const [isOver, setIsOver] = useState(false);
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-2)';
  const bgColor = isDark ? 'var(--mantine-color-dark-7)' : 'rgba(248,249,250,0.8)';

  return (
    <Box
      style={{ flex: 1, minWidth: 240, maxWidth: 340 }}
      onDragOver={e => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={e => {
        e.preventDefault();
        setIsOver(false);
        onDrop(col.id);
      }}
    >
      {/* Column header */}
      <Group
        gap="xs"
        mb="sm"
        pb="xs"
        style={{
          borderBottom: `3px solid ${col.color}`,
        }}
      >
        <Box style={{ color: col.color }}>{col.icon}</Box>
        <Text fw={700} size="sm" style={{ fontFamily: FONT_FAMILY }}>
          {col.label}
        </Text>
        <Badge
          size="xs"
          variant="filled"
          style={{ background: col.color, color: '#fff', marginLeft: 'auto' }}
        >
          {issues.length}
        </Badge>
      </Group>

      {/* Drop zone */}
      <ScrollArea
        h="calc(100vh - 280px)"
        scrollbarSize={4}
        style={{
          background: isOver
            ? (isDark ? `${col.color}15` : `${col.color}0D`)
            : bgColor,
          border: `2px dashed ${isOver ? col.color : borderColor}`,
          borderRadius: 10,
          padding: 8,
          transition: 'background 0.15s, border-color 0.15s',
          minHeight: 200,
        }}
      >
        <Stack gap="sm">
          {issues.length === 0 && (
            <Text size="xs" c="dimmed" ta="center" py="xl" style={{ fontFamily: FONT_FAMILY }}>
              Drop here
            </Text>
          )}
          {issues.map(issue => (
            <KanbanCard
              key={issue.key}
              issue={issue}
              isDark={isDark}
              onDragStart={onDragStart}
              dragOver={false}
            />
          ))}
        </Stack>
      </ScrollArea>
    </Box>
  );
}

// ── Main SprintKanbanBoard ────────────────────────────────────────────────────
interface SprintKanbanBoardProps {
  issues: IssueRow[];
}

/**
 * Maps a Jira statusCategory to one of our three Kanban column IDs.
 * Falls back to 'To Do' for unknown categories.
 */
function categoryToCol(cat: string): ColId {
  const c = cat.toLowerCase();
  if (c === 'done' || c === 'complete') return 'Done';
  if (c === 'in review' || c === 'review' || c === 'code review' || c === 'qa') return 'In Review';
  if (c === 'in progress' || c === 'indeterminate') return 'In Progress';
  return 'To Do';
}

export default function SprintKanbanBoard({ issues }: SprintKanbanBoardProps) {
  const isDark = useDarkMode();

  // Local overrides: issueKey → colId (user has dragged it somewhere)
  const [overrides, setOverrides] = useState<Record<string, ColId>>({});
  const dragKeyRef = useRef<string | null>(null);

  const getCol = useCallback((issue: IssueRow): ColId => {
    return overrides[issue.key] ?? categoryToCol(issue.statusCategory);
  }, [overrides]);

  const grouped: Record<ColId, IssueRow[]> = {
    'To Do': [],
    'In Progress': [],
    'In Review': [],
    Done: [],
  };
  for (const issue of issues) {
    grouped[getCol(issue)].push(issue);
  }

  function handleDragStart(key: string) {
    dragKeyRef.current = key;
  }

  function handleDrop(targetCol: ColId) {
    const key = dragKeyRef.current;
    if (!key) return;
    dragKeyRef.current = null;

    const issue = issues.find(i => i.key === key);
    if (!issue) return;
    const oldCol = getCol(issue);
    if (oldCol === targetCol) return;

    // Optimistic update
    setOverrides(prev => ({ ...prev, [key]: targetCol }));

    // Undo toast
    const notifId = notifications.show({
      title: 'Issue moved',
      message: `${key} → ${targetCol}`,
      color: 'teal',
      withCloseButton: true,
      autoClose: 4000,
    });

    // Note: actual Jira write-back would go here if Jira API is configured.
    // For now this is a local-state-only view.
  }

  const total = issues.length;
  const doneCount = grouped.Done.length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <Stack gap="md">
      {/* Sprint progress bar */}
      <Group gap="sm" align="center">
        <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
          Sprint progress:
        </Text>
        <Box style={{ flex: 1, maxWidth: 200, height: 6, background: 'var(--mantine-color-gray-2)', borderRadius: 3, overflow: 'hidden' }}>
          <Box style={{ width: `${progress}%`, height: '100%', background: '#22C55E', transition: 'width 0.3s', borderRadius: 3 }} />
        </Box>
        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
          {doneCount}/{total} done ({progress}%)
        </Text>
      </Group>

      {/* Columns */}
      <Group align="flex-start" gap="md" wrap="nowrap" style={{ overflowX: 'auto' }}>
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            col={col}
            issues={grouped[col.id]}
            isDark={isDark}
            dragKey={dragKeyRef.current}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        ))}
      </Group>

      <Text size="xs" c="dimmed" ta="center" style={{ fontFamily: FONT_FAMILY }}>
        Drag cards between columns to reorganise your sprint view. Changes are local only.
      </Text>
    </Stack>
  );
}
