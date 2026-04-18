import { useMemo, useState } from 'react';
import {
  ScrollArea, Group, Text, Badge, Tooltip, Select, Box, ActionIcon,
  Stack, SegmentedControl,
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconCircle } from '@tabler/icons-react';
import type { ProjectResponse } from '../../types/project';
import { COLOR_BLUE_DARK, COLOR_ERROR, COLOR_ORANGE, COLOR_SUCCESS, DEEP_BLUE, FONT_FAMILY, TEXT_DIM } from '../../brandTokens';

/* ── Constants ──────────────────────────────────────────────────────── */
const COL_W = 72;           // px per month column (normal density)
const ROW_H = 36;           // px per project row
const ROW_H_COMPACT = 26;
const NAME_COL_W = 200;     // px for the name/label column
const TODAY_MONTH = new Date().getMonth() + 1; // 1-12

/* ── Priority / Status color maps ───────────────────────────────────── */
const PRIORITY_COLORS: Record<string, string> = {
  HIGHEST: COLOR_ERROR,
  HIGH:    COLOR_ORANGE,
  MEDIUM:  COLOR_BLUE_DARK,
  LOW:     '#6366f1',
  LOWEST:  TEXT_DIM,
  BLOCKER: '#dc2626',
  MINOR:   TEXT_DIM,
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:       COLOR_SUCCESS,
  ON_HOLD:      COLOR_ORANGE,
  NOT_STARTED:  TEXT_DIM,
  COMPLETED:    COLOR_BLUE_DARK,
  CANCELLED:    COLOR_ERROR,
};

function barColor(project: ProjectResponse, colorBy: 'priority' | 'status'): string {
  if (colorBy === 'priority') return PRIORITY_COLORS[project.priority] ?? COLOR_BLUE_DARK;
  return STATUS_COLORS[project.status] ?? COLOR_BLUE_DARK;
}

/* ── Group-by helpers ────────────────────────────────────────────────── */
type GroupBy = 'none' | 'priority' | 'status' | 'owner';

function groupProjects(
  projects: ProjectResponse[],
  groupBy: GroupBy,
): Array<{ label: string; items: ProjectResponse[] }> {
  if (groupBy === 'none') return [{ label: '', items: projects }];

  const map = new Map<string, ProjectResponse[]>();
  for (const p of projects) {
    const key =
      groupBy === 'priority' ? p.priority :
      groupBy === 'status'   ? p.status.replace(/_/g, ' ') :
      p.owner || '—';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

/* ── Props ───────────────────────────────────────────────────────────── */
interface GanttViewProps {
  projects: ProjectResponse[];
  monthLabels: Record<number, string>;  // 1-12 → "Jan 25" etc.
  onEdit?: (p: ProjectResponse) => void;
}

/* ── Component ───────────────────────────────────────────────────────── */
export default function GanttView({ projects, monthLabels, onEdit }: GanttViewProps) {
  const [colorBy, setColorBy]   = useState<'priority' | 'status'>('priority');
  const [groupBy, setGroupBy]   = useState<GroupBy>('none');
  const [density, setDensity]   = useState<'normal' | 'compact'>('normal');
  // Horizontal scroll offset in months (0 = start from month 1)
  const [monthOffset, setMonthOffset] = useState(0);
  const VISIBLE_MONTHS = 12;

  const rowH = density === 'compact' ? ROW_H_COMPACT : ROW_H;

  // Clamp offset
  const maxOffset = Math.max(0, 24 - VISIBLE_MONTHS); // support up to 24-month horizon
  const safeOffset = Math.max(0, Math.min(monthOffset, maxOffset));

  // The month columns we show: months 1..24 (2 planning years)
  const ALL_MONTHS = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => i + 1), // month indices 1..24
  []);

  const visibleMonths = ALL_MONTHS.slice(safeOffset, safeOffset + VISIBLE_MONTHS);

  const groups = useMemo(() => groupProjects(projects, groupBy), [projects, groupBy]);

  /* ── Legend items ─────────────────────────────────────────────────── */
  const legendItems = useMemo(() => {
    if (colorBy === 'priority') {
      return Object.entries(PRIORITY_COLORS).map(([k, color]) => ({ label: k, color }));
    }
    const statuses = [...new Set(projects.map(p => p.status))];
    return statuses.map(s => ({ label: s.replace(/_/g, ' '), color: STATUS_COLORS[s] ?? COLOR_BLUE_DARK }));
  }, [colorBy, projects]);

  const totalTimelineW = VISIBLE_MONTHS * COL_W;

  return (
    <Stack gap={8}>
      {/* ── Controls ──────────────────────────────────────────────── */}
      <Group gap="sm" align="center" wrap="wrap">
        <Select
          label="Colour by"
          size="xs"
          value={colorBy}
          onChange={v => v && setColorBy(v as 'priority' | 'status')}
          data={[{ value: 'priority', label: 'Priority' }, { value: 'status', label: 'Status' }]}
          style={{ width: 130 }}
          styles={{ label: { fontFamily: FONT_FAMILY, fontSize: 11 } }}
        />
        <Select
          label="Group by"
          size="xs"
          value={groupBy}
          onChange={v => v && setGroupBy(v as GroupBy)}
          data={[
            { value: 'none', label: 'None' },
            { value: 'priority', label: 'Priority' },
            { value: 'status', label: 'Status' },
            { value: 'owner', label: 'Owner' },
          ]}
          style={{ width: 130 }}
          styles={{ label: { fontFamily: FONT_FAMILY, fontSize: 11 } }}
        />
        <div>
          <Text size="xs" mb={4} style={{ fontFamily: FONT_FAMILY, opacity: 0.7 }}>Density</Text>
          <SegmentedControl
            size="xs"
            value={density}
            onChange={v => setDensity(v as 'normal' | 'compact')}
            data={[{ value: 'normal', label: 'Normal' }, { value: 'compact', label: 'Compact' }]}
            styles={{ label: { fontSize: 11 } }}
          />
        </div>

        {/* Month navigator */}
        <Group gap={4} ml="auto" align="center">
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            {monthLabels[visibleMonths[0]] ?? `M${visibleMonths[0]}`}
            {' — '}
            {monthLabels[visibleMonths[visibleMonths.length - 1]] ?? `M${visibleMonths[visibleMonths.length - 1]}`}
          </Text>
          <ActionIcon
            size="sm" variant="subtle" disabled={safeOffset === 0}
            onClick={() => setMonthOffset(o => Math.max(0, o - 3))}
            aria-label="Previous"
          >
            <IconChevronLeft size={14} />
          </ActionIcon>
          <ActionIcon
            size="sm" variant="subtle" disabled={safeOffset >= maxOffset}
            onClick={() => setMonthOffset(o => Math.min(maxOffset, o + 3))}
            aria-label="Next"
          >
            <IconChevronRight size={14} />
          </ActionIcon>
        </Group>
      </Group>

      {/* ── Legend ────────────────────────────────────────────────── */}
      <Group gap={10} wrap="wrap">
        {legendItems.map(l => (
          <Group key={l.label} gap={4} align="center">
            <IconCircle size={10} style={{ color: l.color, fill: l.color }} />
            <Text size="xs" c="dimmed">{l.label}</Text>
          </Group>
        ))}
      </Group>

      {/* ── Gantt chart ───────────────────────────────────────────── */}
      <ScrollArea type="auto">
        <Box style={{ minWidth: NAME_COL_W + totalTimelineW }}>

          {/* Header row */}
          <Box
            style={{
              display: 'flex',
              borderBottom: '2px solid var(--mantine-color-default-border)',
              background: 'var(--mantine-color-default)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            <Box style={{ width: NAME_COL_W, flexShrink: 0, padding: '6px 10px' }}>
              <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                PROJECT ({projects.length})
              </Text>
            </Box>
            {visibleMonths.map(m => {
              const isToday = m === TODAY_MONTH; // approximate: month index = today's month
              return (
                <Box
                  key={m}
                  style={{
                    width: COL_W,
                    flexShrink: 0,
                    textAlign: 'center',
                    padding: '6px 2px',
                    borderLeft: '1px solid var(--mantine-color-default-border)',
                    background: isToday ? 'rgba(34,139,230,0.06)' : undefined,
                  }}
                >
                  <Text size="xs" fw={isToday ? 700 : 400} c={isToday ? 'blue' : 'dimmed'} style={{ fontFamily: FONT_FAMILY }}>
                    {monthLabels[m] ?? `M${m}`}
                  </Text>
                </Box>
              );
            })}
          </Box>

          {/* Data rows */}
          {groups.map(group => (
            <Box key={group.label}>
              {/* Group header */}
              {groupBy !== 'none' && (
                <Box
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    background: 'var(--mantine-color-default-hover)',
                    borderBottom: '1px solid var(--mantine-color-default-border)',
                  }}
                >
                  <Text
                    size="xs"
                    fw={700}
                    style={{
                      color: DEEP_BLUE,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {group.label} ({group.items.length})
                  </Text>
                </Box>
              )}

              {/* Project rows */}
              {group.items.map((p, idx) => {
                const start = p.startMonth ?? 1;
                const dur   = p.durationMonths ?? 1;
                const end   = start + dur - 1;
                const color = barColor(p, colorBy);

                // Visible bar segment within the window
                const barStart = Math.max(start, visibleMonths[0]);
                const barEnd   = Math.min(end, visibleMonths[visibleMonths.length - 1]);
                const barVisible = barEnd >= barStart;

                // Position in pixels relative to timeline area
                const barLeft = (barStart - visibleMonths[0]) * COL_W;
                const barWidth = barVisible ? (barEnd - barStart + 1) * COL_W - 4 : 0;

                // Is project overflowing outside current view on either side?
                const overflowLeft  = start < visibleMonths[0];
                const overflowRight = end   > visibleMonths[visibleMonths.length - 1];

                return (
                  <Box
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: rowH,
                      borderBottom: '1px solid var(--mantine-color-default-border)',
                      background: idx % 2 === 0 ? undefined : 'var(--mantine-color-default-hover)',
                    }}
                  >
                    {/* Name column */}
                    <Box
                      style={{
                        width: NAME_COL_W,
                        flexShrink: 0,
                        padding: '0 10px',
                        overflow: 'hidden',
                        cursor: onEdit ? 'pointer' : 'default',
                      }}
                      onClick={() => onEdit?.(p)}
                    >
                      <Group gap={6} wrap="nowrap">
                        <Box
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: barColor(p, colorBy),
                            flexShrink: 0,
                          }}
                        />
                        <Tooltip label={p.name} position="right" withArrow openDelay={400}>
                          <Text
                            size="xs"
                            fw={500}
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: NAME_COL_W - 40,
                            }}
                          >
                            {p.name}
                          </Text>
                        </Tooltip>
                      </Group>
                    </Box>

                    {/* Timeline area */}
                    <Box style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
                      {/* Month grid lines */}
                      {visibleMonths.map(m => (
                        <Box
                          key={m}
                          style={{
                            position: 'absolute',
                            left: (m - visibleMonths[0]) * COL_W,
                            top: 0,
                            width: COL_W,
                            height: '100%',
                            borderLeft: '1px solid var(--mantine-color-default-border)',
                            background: m === TODAY_MONTH ? 'rgba(34,139,230,0.04)' : undefined,
                          }}
                        />
                      ))}

                      {/* Project bar */}
                      {barVisible && (
                        <Tooltip
                          label={
                            <Stack gap={2}>
                              <Text size="xs" fw={700}>{p.name}</Text>
                              <Text size="xs">Status: {p.status.replace(/_/g, ' ')}</Text>
                              <Text size="xs">Priority: {p.priority}</Text>
                              <Text size="xs">Owner: {p.owner || '—'}</Text>
                              <Text size="xs">
                                Months: {monthLabels[start] ?? `M${start}`} → {monthLabels[end] ?? `M${end}`} ({dur}m)
                              </Text>
                            </Stack>
                          }
                          position="top"
                          withArrow
                          openDelay={200}
                        >
                          <Box
                            style={{
                              position: 'absolute',
                              left: barLeft + (overflowLeft ? 0 : 2),
                              width: barWidth,
                              height: rowH - 10,
                              top: 5,
                              background: color,
                              borderRadius: `${overflowLeft ? 0 : 4}px ${overflowRight ? 0 : 4}px ${overflowRight ? 0 : 4}px ${overflowLeft ? 0 : 4}px`,
                              opacity: p.status === 'CANCELLED' ? 0.4 : p.status === 'COMPLETED' ? 0.7 : 0.85,
                              cursor: onEdit ? 'pointer' : 'default',
                              display: 'flex',
                              alignItems: 'center',
                              paddingLeft: 6,
                              overflow: 'hidden',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                              transition: 'opacity 0.15s',
                            }}
                            onClick={() => onEdit?.(p)}
                          >
                            {barWidth > 40 && (
                              <Text
                                size="xs"
                                fw={600}
                                style={{
                                  color: '#fff',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  fontSize: density === 'compact' ? 9 : 11,
                                }}
                              >
                                {p.name}
                              </Text>
                            )}
                          </Box>
                        </Tooltip>
                      )}

                      {/* Overflow indicators */}
                      {!barVisible && start <= visibleMonths[visibleMonths.length - 1] && end >= visibleMonths[0] && (
                        <Badge size="xs" color="gray" variant="outline" style={{ position: 'absolute', left: 4 }}>
                          {overflowLeft ? '←' : ''} {p.name.slice(0, 12)} {overflowRight ? '→' : ''}
                        </Badge>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ))}

          {/* Empty state */}
          {projects.length === 0 && (
            <Box p="xl" ta="center">
              <Text c="dimmed" size="sm">No projects match the current filters.</Text>
            </Box>
          )}
        </Box>
      </ScrollArea>
    </Stack>
  );
}
