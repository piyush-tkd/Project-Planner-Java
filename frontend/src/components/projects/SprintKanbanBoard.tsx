/**
 * SprintKanbanBoard — Sprint 7 S7.9 + Sprint N (DnD within-column reorder)
 *
 * Full drag-and-drop Kanban board for sprint issues.
 * Uses native HTML5 drag API (no external library needed).
 *
 * Columns: To Do · In Progress · In Review · Done
 *
 * Supports:
 *  - Cross-column drag (move card between statuses)
 *  - Within-column position reorder (drag card up/down within same column)
 *
 * Note: drag moves are local-state only (no backend write-back since
 * that would require Jira API OAuth). A toast is shown on every move.
 */
import { useState, useRef, useCallback, useMemo } from 'react';
import {
  Paper, Text, Group, Badge, Stack, Box, ScrollArea, ActionIcon,
  Tooltip, ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBriefcase, IconBug, IconSubtask, IconCheck, IconClock,
  IconUser, IconDots, IconArrowsUpDown,
} from '@tabler/icons-react';
import { AQUA, COLOR_BLUE_STRONG, COLOR_ERROR_DARK, COLOR_GREEN, COLOR_ORANGE_ALT, COLOR_ORANGE_DEEP, COLOR_VIOLET, COLOR_WARNING, DEEP_BLUE, FONT_FAMILY, SURFACE_BLUE_LIGHT, SURFACE_ERROR_LIGHT, SURFACE_LIGHT, SURFACE_ORANGE, SURFACE_SUCCESS_LIGHT, SURFACE_VIOLET, TEXT_GRAY, TEXT_SUBTLE} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import type { IssueRow } from '../../api/jira';

// ── Column definitions ───────────────────────────────────────────────────────
type ColId = 'To Do' | 'In Progress' | 'In Review' | 'Done';

const COLUMNS: { id: ColId; label: string; color: string; icon: React.ReactNode }[] = [
  { id: 'To Do',       label: 'To Do',       color: TEXT_SUBTLE, icon: <IconDots size={14} /> },
  { id: 'In Progress', label: 'In Progress', color: COLOR_WARNING, icon: <IconClock size={14} /> },
  { id: 'In Review',   label: 'In Review',   color: COLOR_ORANGE_ALT, icon: <IconUser size={14} /> },
  { id: 'Done',        label: 'Done',        color: COLOR_GREEN, icon: <IconCheck size={14} /> },
];

// ── Type badge colours ────────────────────────────────────────────────────────
const ISSUE_TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  Story:      { bg: SURFACE_VIOLET, text: COLOR_VIOLET },
  Bug:        { bg: SURFACE_ERROR_LIGHT, text: COLOR_ERROR_DARK },
  Task:       { bg: SURFACE_BLUE_LIGHT, text: COLOR_BLUE_STRONG },
  'Sub-task': { bg: SURFACE_LIGHT, text: TEXT_GRAY },
  Subtask:    { bg: SURFACE_LIGHT, text: TEXT_GRAY },
  Epic:       { bg: SURFACE_ORANGE, text: COLOR_ORANGE_DEEP },
  default:    { bg: SURFACE_SUCCESS_LIGHT, text: '#15803D' },
};

function issueTypeColor(type: string) {
  return ISSUE_TYPE_COLOR[type] ?? ISSUE_TYPE_COLOR.default;
}

function IssueTypeIcon({ type }: { type: string }) {
  if (type === 'Bug') return <IconBug size={12} />;
  if (type.toLowerCase().includes('subtask') || type.toLowerCase().includes('sub-task')) return <IconSubtask size={12} />;
  return <IconBriefcase size={12} />;
}

// ── Insert indicator (blue line showing where card will be dropped) ───────────
interface InsertIndicator {
  colId: ColId;
  afterKey: string | null; // null = insert at top
}

// ── KanbanCard ────────────────────────────────────────────────────────────────
interface KanbanCardProps {
  issue: IssueRow;
  isDark: boolean;
  isDragging: boolean;
  isInsertAbove: boolean;
  isInsertBelow: boolean;
  onDragStart: (issueKey: string) => void;
  onDragOver: (e: React.DragEvent, issueKey: string) => void;
  onDragEnd: () => void;
}

function KanbanCard({
  issue, isDark, isDragging, isInsertAbove, isInsertBelow,
  onDragStart, onDragOver, onDragEnd,
}: KanbanCardProps) {
  const tc = issueTypeColor(issue.issueType);
  return (
    <Box style={{ position: 'relative' }}>
      {/* Insert-above indicator */}
      {isInsertAbove && (
        <Box style={{
          position: 'absolute', top: -3, left: 0, right: 0, height: 3,
          background: AQUA, borderRadius: 2, zIndex: 10,
          boxShadow: `0 0 6px ${AQUA}80`,
        }} />
      )}

      <Paper
        draggable
        onDragStart={e => {
          e.dataTransfer.effectAllowed = 'move';
          onDragStart(issue.key);
        }}
        onDragOver={e => { e.preventDefault(); onDragOver(e, issue.key); }}
        onDragEnd={onDragEnd}
        withBorder
        p="xs"
        radius="md"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          background: isDark ? 'var(--mantine-color-dark-6)' : '#fff',
          borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-2)',
          boxShadow: isDragging
            ? 'none'
            : isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'box-shadow 0.15s, border-color 0.15s, opacity 0.15s',
          opacity: isDragging ? 0.4 : 1,
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

      {/* Insert-below indicator */}
      {isInsertBelow && (
        <Box style={{
          position: 'absolute', bottom: -3, left: 0, right: 0, height: 3,
          background: AQUA, borderRadius: 2, zIndex: 10,
          boxShadow: `0 0 6px ${AQUA}80`,
        }} />
      )}
    </Box>
  );
}

// ── KanbanColumn ─────────────────────────────────────────────────────────────
interface KanbanColumnProps {
  col: typeof COLUMNS[number];
  issues: IssueRow[];
  isDark: boolean;
  draggingKey: string | null;
  insertIndicator: InsertIndicator | null;
  onDragStart: (key: string) => void;
  onDragOverCard: (e: React.DragEvent, colId: ColId, issueKey: string) => void;
  onDragOverColumn: (e: React.DragEvent, colId: ColId) => void;
  onDragLeaveColumn: () => void;
  onDrop: (colId: ColId) => void;
  onDragEnd: () => void;
}

function KanbanColumn({
  col, issues, isDark, draggingKey, insertIndicator,
  onDragStart, onDragOverCard, onDragOverColumn, onDragLeaveColumn, onDrop, onDragEnd,
}: KanbanColumnProps) {
  const [isColOver, setIsColOver] = useState(false);
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-2)';
  const bgColor = isDark ? 'var(--mantine-color-dark-7)' : 'rgba(248,249,250,0.8)';
  const isActive = insertIndicator?.colId === col.id;

  return (
    <Box
      style={{ flex: 1, minWidth: 240, maxWidth: 340 }}
      onDragOver={e => { e.preventDefault(); setIsColOver(true); onDragOverColumn(e, col.id); }}
      onDragLeave={e => {
        const rel = e.relatedTarget as Node | null;
        if (rel && (e.currentTarget as HTMLElement).contains(rel)) return;
        setIsColOver(false);
        onDragLeaveColumn();
      }}
      onDrop={e => {
        e.preventDefault();
        setIsColOver(false);
        onDrop(col.id);
      }}
    >
      {/* Column header */}
      <Group
        gap="xs"
        mb="sm"
        pb="xs"
        style={{ borderBottom: `3px solid ${col.color}` }}
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
          background: isColOver && !isActive
            ? (isDark ? `${col.color}15` : `${col.color}0D`)
            : bgColor,
          border: `2px dashed ${isActive || isColOver ? col.color : borderColor}`,
          borderRadius: 10,
          padding: 8,
          transition: 'background 0.15s, border-color 0.15s',
          minHeight: 200,
        }}
      >
        <Stack gap="sm">
          {/* Insert-at-top indicator */}
          {isActive && insertIndicator?.afterKey === null && (
            <Box style={{
              height: 3, background: AQUA, borderRadius: 2,
              boxShadow: `0 0 6px ${AQUA}80`,
            }} />
          )}

          {issues.length === 0 && (
            <Text size="xs" c="dimmed" ta="center" py="xl" style={{ fontFamily: FONT_FAMILY }}>
              {draggingKey ? 'Drop here' : 'No issues'}
            </Text>
          )}

          {issues.map((issue, idx) => {
            const isThisInsertAbove = isActive &&
              insertIndicator?.afterKey === (idx > 0 ? issues[idx - 1].key : null) &&
              idx > 0;
            const isThisInsertBelow = isActive &&
              insertIndicator?.afterKey === issue.key;

            return (
              <KanbanCard
                key={issue.key}
                issue={issue}
                isDark={isDark}
                isDragging={draggingKey === issue.key}
                isInsertAbove={isThisInsertAbove}
                isInsertBelow={isThisInsertBelow}
                onDragStart={onDragStart}
                onDragOver={(e, key) => onDragOverCard(e, col.id, key)}
                onDragEnd={onDragEnd}
              />
            );
          })}
        </Stack>
      </ScrollArea>
    </Box>
  );
}

// ── Maps statusCategory → ColId ───────────────────────────────────────────────
function categoryToCol(cat: string): ColId {
  const c = cat.toLowerCase();
  if (c === 'done' || c === 'complete') return 'Done';
  if (c === 'in review' || c === 'review' || c === 'code review' || c === 'qa') return 'In Review';
  if (c === 'in progress' || c === 'indeterminate') return 'In Progress';
  return 'To Do';
}

// ── Main SprintKanbanBoard ────────────────────────────────────────────────────
interface SprintKanbanBoardProps {
  issues: IssueRow[];
}

export default function SprintKanbanBoard({ issues }: SprintKanbanBoardProps) {
  const isDark = useDarkMode();

  // Column overrides: issueKey → colId (user has dragged to different column)
  const [colOverrides, setColOverrides] = useState<Record<string, ColId>>({});

  // Within-column order overrides: colId → ordered array of issue keys
  const [orderOverrides, setOrderOverrides] = useState<Record<string, string[]>>({});

  // Active drag state
  const draggingKeyRef = useRef<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  // Insert indicator state
  const [insertIndicator, setInsertIndicator] = useState<InsertIndicator | null>(null);

  // Derive which column each issue belongs to
  const getCol = useCallback((issue: IssueRow): ColId => {
    return colOverrides[issue.key] ?? categoryToCol(issue.statusCategory);
  }, [colOverrides]);

  // Build grouped + ordered lists
  const grouped = useMemo<Record<ColId, IssueRow[]>>(() => {
    const base: Record<ColId, IssueRow[]> = {
      'To Do': [], 'In Progress': [], 'In Review': [], Done: [],
    };
    for (const issue of issues) {
      base[getCol(issue)].push(issue);
    }

    // Apply within-column order overrides
    const result: Record<ColId, IssueRow[]> = { 'To Do': [], 'In Progress': [], 'In Review': [], Done: [] };
    for (const colId of Object.keys(base) as ColId[]) {
      const overrideOrder = orderOverrides[colId];
      if (!overrideOrder) {
        result[colId] = base[colId];
        continue;
      }
      const issueMap = Object.fromEntries(base[colId].map(i => [i.key, i]));
      const sorted: IssueRow[] = [];
      for (const key of overrideOrder) {
        if (issueMap[key]) sorted.push(issueMap[key]);
      }
      // Append any new issues not yet in the order
      for (const issue of base[colId]) {
        if (!overrideOrder.includes(issue.key)) sorted.push(issue);
      }
      result[colId] = sorted;
    }
    return result;
  }, [issues, getCol, orderOverrides]);

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function handleDragStart(key: string) {
    draggingKeyRef.current = key;
    setDraggingKey(key);
    setInsertIndicator(null);
  }

  function handleDragEnd() {
    draggingKeyRef.current = null;
    setDraggingKey(null);
    setInsertIndicator(null);
  }

  function handleDragOverCard(e: React.DragEvent, colId: ColId, targetKey: string) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const afterKey = e.clientY > midY ? targetKey : getPrevKey(colId, targetKey);
    setInsertIndicator({ colId, afterKey });
  }

  function handleDragOverColumn(_e: React.DragEvent, colId: ColId) {
    // Only update if no card-level indicator is active for this column
    setInsertIndicator(prev => {
      if (prev?.colId === colId) return prev;
      return { colId, afterKey: getLastKey(colId) };
    });
  }

  function handleDragLeaveColumn() {
    setInsertIndicator(null);
  }

  function getPrevKey(colId: ColId, key: string): string | null {
    const list = grouped[colId];
    const idx = list.findIndex(i => i.key === key);
    return idx > 0 ? list[idx - 1].key : null;
  }

  function getLastKey(colId: ColId): string | null {
    const list = grouped[colId];
    return list.length > 0 ? list[list.length - 1].key : null;
  }

  function handleDrop(targetColId: ColId) {
    const key = draggingKeyRef.current;
    if (!key) return;

    const issue = issues.find(i => i.key === key);
    if (!issue) return;

    const sourceColId = getCol(issue);
    const afterKey = insertIndicator?.colId === targetColId
      ? insertIndicator.afterKey
      : getLastKey(targetColId);

    // ── Same column: reorder ─────────────────────────────────────────────────
    if (sourceColId === targetColId) {
      const colIssues = grouped[sourceColId];
      const currentOrder = colIssues.map(i => i.key);
      const filtered = currentOrder.filter(k => k !== key);

      const insertIdx = afterKey === null
        ? 0
        : filtered.indexOf(afterKey) + 1;

      const newOrder = [...filtered];
      newOrder.splice(insertIdx, 0, key);

      setOrderOverrides(prev => ({ ...prev, [sourceColId]: newOrder }));

      notifications.show({
        title: 'Card reordered',
        message: `${key} moved within ${sourceColId}`,
        color: 'teal',
        autoClose: 2500,
      });
    }
    // ── Cross-column: move + append after position ────────────────────────────
    else {
      // Update column assignment
      setColOverrides(prev => ({ ...prev, [key]: targetColId }));

      // Insert into target column order
      const targetIssues = grouped[targetColId];
      const targetOrder = targetIssues.map(i => i.key).filter(k => k !== key);
      const insertIdx = afterKey === null
        ? 0
        : targetOrder.indexOf(afterKey) + 1;
      const newTargetOrder = [...targetOrder];
      newTargetOrder.splice(insertIdx, 0, key);
      setOrderOverrides(prev => ({
        ...prev,
        [targetColId]: newTargetOrder,
        [sourceColId]: (prev[sourceColId] ?? grouped[sourceColId].map(i => i.key)).filter(k => k !== key),
      }));

      notifications.show({
        title: 'Issue moved',
        message: `${key} → ${targetColId}`,
        color: 'teal',
        withCloseButton: true,
        autoClose: 4000,
      });
    }

    draggingKeyRef.current = null;
    setDraggingKey(null);
    setInsertIndicator(null);
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
          <Box style={{ width: `${progress}%`, height: '100%', background: COLOR_GREEN, transition: 'width 0.3s', borderRadius: 3 }} />
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
            draggingKey={draggingKey}
            insertIndicator={insertIndicator}
            onDragStart={handleDragStart}
            onDragOverCard={handleDragOverCard}
            onDragOverColumn={handleDragOverColumn}
            onDragLeaveColumn={handleDragLeaveColumn}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </Group>

      <Group gap="xs" justify="center" align="center">
        <IconArrowsUpDown size={13} color="var(--mantine-color-dimmed)" />
        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
          Drag cards between columns or within a column to reorder. Changes are local only.
        </Text>
      </Group>
    </Stack>
  );
}
