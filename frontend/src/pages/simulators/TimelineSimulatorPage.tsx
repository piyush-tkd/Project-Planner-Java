import { useState, useMemo, useRef } from 'react';
import {
  Title, Stack, Grid, Card, Text, Button, NumberInput, Group,
  Table, ScrollArea, SegmentedControl, Tooltip, Box,
} from '@mantine/core';
import { IconPlayerPlay } from '@tabler/icons-react';
import { useProjects } from '../../api/projects';
import { useSimulateTimeline } from '../../api/simulator';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { getGapCellColor } from '../../utils/colors';
import { useDarkMode } from '../../hooks/useDarkMode';
import { formatHours } from '../../utils/formatting';
import type { TimelineOverride } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { ProjectStatus } from '../../types';

// ── Status → bar colour mapping ────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:       '#12b886',
  AT_RISK:      '#f59f00',
  BLOCKED:      '#fa5252',
  ON_HOLD:      '#868e96',
  COMPLETED:    '#228be6',
  CANCELLED:    '#adb5bd',
  IN_DISCOVERY: '#7950f2',
  PAUSED:       '#fd7e14',
};

const CELL_PX      = 52;   // px per month column
const TOTAL_MONTHS = 12;
const ROW_H        = 48;
const HEADER_H     = 30;
const LABEL_W      = 180;
const HANDLE_PX    = 10;   // resize handle width

// ── Draggable bar for one project ──────────────────────────────────────────────
interface GanttBarProps {
  name:            string;
  status:          string;
  startMonth:      number;
  durationMonths:  number;
  onUpdate:        (field: 'start' | 'duration', value: number) => void;
}

function GanttBar({ name, status, startMonth, durationMonths, onUpdate }: GanttBarProps) {
  const mode      = useRef<'move' | 'resize' | null>(null);
  const anchorX   = useRef(0);
  const anchorVal = useRef(0);
  const color     = STATUS_COLORS[status] ?? '#12b886';

  function handleDown(e: React.PointerEvent, m: 'move' | 'resize') {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    mode.current      = m;
    anchorX.current   = e.clientX;
    anchorVal.current = m === 'move' ? startMonth : durationMonths;
  }

  function handleMove(e: React.PointerEvent) {
    if (!mode.current) return;
    const delta = Math.round((e.clientX - anchorX.current) / CELL_PX);
    if (mode.current === 'move') {
      const v = Math.max(1, Math.min(TOTAL_MONTHS - durationMonths + 1, anchorVal.current + delta));
      onUpdate('start', v);
    } else {
      const v = Math.max(1, Math.min(TOTAL_MONTHS - startMonth + 1, anchorVal.current + delta));
      onUpdate('duration', v);
    }
  }

  function handleUp() { mode.current = null; }

  return (
    <Tooltip
      label={`${name} — Month ${startMonth}–${startMonth + durationMonths - 1} (${durationMonths}mo)`}
      withArrow
      position="top"
    >
      <Box
        style={{
          position:        'absolute',
          left:            (startMonth - 1) * CELL_PX + 2,
          width:           durationMonths * CELL_PX - 4,
          height:          28,
          top:             '50%',
          transform:       'translateY(-50%)',
          backgroundColor: color,
          borderRadius:    4,
          display:         'flex',
          alignItems:      'center',
          cursor:          'grab',
          userSelect:      'none',
          overflow:        'hidden',
          boxShadow:       '0 1px 3px rgba(0,0,0,0.3)',
        }}
        onPointerDown={e => handleDown(e, 'move')}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
      >
        <Text
          size="xs"
          fw={600}
          c="white"
          px={6}
          style={{ flexGrow: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
        >
          {name}
        </Text>
        {/* Resize handle */}
        <Box
          style={{
            width:      HANDLE_PX,
            height:     '100%',
            background: 'rgba(255,255,255,0.25)',
            cursor:     'ew-resize',
            flexShrink: 0,
          }}
          onPointerDown={e => { e.stopPropagation(); handleDown(e, 'resize'); }}
        />
      </Box>
    </Tooltip>
  );
}

// ── Full Gantt grid with draggable bars ────────────────────────────────────────
interface GanttViewProps {
  projects:          Array<{ id: number; name: string; status: string }>;
  getOverride:       (id: number) => { start: number; duration: number };
  setOverride:       (id: number, field: 'start' | 'duration', value: number) => void;
  monthLabels:       Record<number, string>;
  currentMonthIndex: number;
  dark:              boolean;
}

function GanttView({ projects, getOverride, setOverride, monthLabels, currentMonthIndex, dark }: GanttViewProps) {
  const months = Array.from({ length: TOTAL_MONTHS }, (_, i) => i + 1);
  const pastBg = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const border = '1px solid var(--mantine-color-default-border)';

  return (
    <ScrollArea type="auto">
      <Box style={{ minWidth: LABEL_W + TOTAL_MONTHS * CELL_PX }}>

        {/* Month header */}
        <Box style={{ display: 'flex', height: HEADER_H, borderBottom: border }}>
          <Box style={{ width: LABEL_W, flexShrink: 0, paddingLeft: 8, display: 'flex', alignItems: 'center' }}>
            <Text size="xs" fw={600} c="dimmed">Project</Text>
          </Box>
          {months.map(m => (
            <Box
              key={m}
              style={{
                width:           CELL_PX,
                flexShrink:      0,
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                fontSize:        11,
                fontWeight:      m === currentMonthIndex ? 700 : 400,
                color:           m === currentMonthIndex ? '#12b886' : undefined,
                backgroundColor: m < currentMonthIndex ? pastBg : undefined,
                borderLeft:      border,
              }}
            >
              {monthLabels[m] ?? `M${m}`}
            </Box>
          ))}
        </Box>

        {/* Project rows */}
        {projects.map(p => {
          const { start, duration } = getOverride(p.id);
          return (
            <Box
              key={p.id}
              style={{ display: 'flex', height: ROW_H, borderBottom: border, alignItems: 'center' }}
            >
              {/* Row label */}
              <Box style={{ width: LABEL_W, flexShrink: 0, paddingLeft: 8, paddingRight: 4 }}>
                <Text size="xs" fw={500} lineClamp={2}>{p.name}</Text>
              </Box>

              {/* Bar track */}
              <Box style={{ position: 'relative', width: TOTAL_MONTHS * CELL_PX, height: ROW_H, flexShrink: 0 }}>
                {/* Grid lines */}
                {months.map(m => (
                  <Box
                    key={m}
                    style={{
                      position:        'absolute',
                      left:            (m - 1) * CELL_PX,
                      top:             0,
                      width:           CELL_PX,
                      height:          '100%',
                      backgroundColor: m < currentMonthIndex ? pastBg : undefined,
                      borderLeft:      border,
                    }}
                  />
                ))}
                <GanttBar
                  name={p.name}
                  status={p.status}
                  startMonth={start}
                  durationMonths={duration}
                  onUpdate={(field, value) => setOverride(p.id, field, value)}
                />
              </Box>
            </Box>
          );
        })}

        {projects.length === 0 && (
          <Box style={{ padding: 24, textAlign: 'center' }}>
            <Text c="dimmed" size="sm">No active projects</Text>
          </Box>
        )}

        {/* Legend */}
        <Box style={{ padding: '8px 12px', borderTop: border, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_COLORS).map(([s, c]) => (
            <Group key={s} gap={4}>
              <Box style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
              <Text size="xs" c="dimmed">{s.replace('_', ' ')}</Text>
            </Group>
          ))}
          <Text size="xs" c="dimmed" style={{ marginLeft: 'auto' }}>
            Drag bar to move · Drag right edge to resize
          </Text>
        </Box>
      </Box>
    </ScrollArea>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function TimelineSimulatorPage() {
  const { data: projects, isLoading } = useProjects();
  const { monthLabels, currentMonthIndex } = useMonthLabels();
  const dark    = useDarkMode();
  const pastBg  = dark ? 'rgba(255,255,255,0.04)' : '#f8f9fa';
  const simulate = useSimulateTimeline();

  const [viewMode, setViewMode] = useState<'list' | 'gantt'>('list');

  const activeProjects = useMemo(
    () => (projects ?? []).filter(p => p.status === ProjectStatus.ACTIVE),
    [projects],
  );

  const [overrides, setOverrides] = useState<Record<number, { start: number; duration: number }>>({});

  function getOverride(projectId: number) {
    const proj = activeProjects.find(p => p.id === projectId);
    return overrides[projectId] ?? {
      start:    proj?.startMonth    ?? 1,
      duration: proj?.durationMonths ?? 3,
    };
  }

  function setOverride(projectId: number, field: 'start' | 'duration', value: number) {
    const current = getOverride(projectId);
    setOverrides(prev => ({ ...prev, [projectId]: { ...current, [field]: value } }));
  }

  const handleSimulate = () => {
    const timelineOverrides: TimelineOverride[] = Object.entries(overrides).map(([id, o]) => ({
      projectId:         Number(id),
      newStartMonth:     o.start,
      newDurationMonths: o.duration,
    }));
    simulate.mutate({ overrides: timelineOverrides });
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  if (isLoading) return <LoadingSpinner variant="chart" message="Loading simulator..." />;

  const isGantt = viewMode === 'gantt';

  return (
    <Stack className="page-enter stagger-children">

      {/* Header + view toggle */}
      <Group justify="space-between" align="center" className="slide-in-left">
        <Title order={2}>Timeline Simulator</Title>
        <SegmentedControl
          size="xs"
          value={viewMode}
          onChange={v => setViewMode(v as 'list' | 'gantt')}
          data={[
            { value: 'list',  label: 'List View'  },
            { value: 'gantt', label: 'Gantt View' },
          ]}
        />
      </Group>

      <Grid>
        {/* ── Left panel: project editor ── */}
        <Grid.Col span={isGantt ? 12 : 5}>
          <Card withBorder padding="md">
            <Group justify="space-between" mb="md">
              <Title order={4}>Project Timelines</Title>
              <Button
                size="xs"
                leftSection={<IconPlayerPlay size={14} />}
                onClick={handleSimulate}
                loading={simulate.isPending}
                disabled={Object.keys(overrides).length === 0}
              >
                Simulate
              </Button>
            </Group>

            {!isGantt ? (
              /* List view: spinner inputs */
              <Stack gap="sm">
                {activeProjects.map(p => {
                  const o = getOverride(p.id);
                  return (
                    <Card key={p.id} withBorder padding="xs">
                      <Text fw={500} size="sm" mb={4}>{p.name}</Text>
                      <Group grow>
                        <NumberInput
                          label="Start Month"
                          value={o.start}
                          onChange={v => setOverride(p.id, 'start', Number(v))}
                          min={1} max={12} size="xs"
                        />
                        <NumberInput
                          label="Duration"
                          value={o.duration}
                          onChange={v => setOverride(p.id, 'duration', Number(v))}
                          min={1} max={12} size="xs"
                        />
                      </Group>
                    </Card>
                  );
                })}
                {activeProjects.length === 0 && (
                  <Text c="dimmed" ta="center">No active projects</Text>
                )}
              </Stack>
            ) : (
              /* Gantt view: drag-to-slide bars */
              <GanttView
                projects={activeProjects.map(p => ({ id: p.id, name: p.name, status: String(p.status) }))}
                getOverride={getOverride}
                setOverride={setOverride}
                monthLabels={monthLabels}
                currentMonthIndex={currentMonthIndex}
                dark={dark}
              />
            )}
          </Card>
        </Grid.Col>

        {/* ── Right panel: simulation results ── */}
        {!isGantt && (
          <Grid.Col span={7}>
            <Card withBorder padding="md">
              <Title order={4} mb="md">Simulation Results</Title>
              {simulate.data ? (
                <ScrollArea>
                  <Table fz="xs" withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>POD</Table.Th>
                        {months.map(m => (
                          <Table.Th
                            key={m}
                            style={{
                              textAlign: 'center',
                              fontSize: 11,
                              ...(m < currentMonthIndex ? { opacity: 0.5, backgroundColor: pastBg } : {}),
                            }}
                          >
                            {monthLabels[m] ?? `M${m}`}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {(() => {
                        const podMap = new Map<string, Map<number, number>>();
                        (simulate.data.simulated?.gaps ?? []).forEach(g => {
                          if (!podMap.has(g.podName)) podMap.set(g.podName, new Map());
                          podMap.get(g.podName)!.set(g.monthIndex, Number(g.gapHours));
                        });
                        return Array.from(podMap.entries()).map(([pod, monthData]) => (
                          <Table.Tr key={pod}>
                            <Table.Td fw={500} style={{ fontSize: 12 }}>{pod}</Table.Td>
                            {months.map(m => {
                              const gap = monthData.get(m) ?? 0;
                              return (
                                <Table.Td
                                  key={m}
                                  style={{
                                    textAlign: 'center',
                                    fontSize: 11,
                                    ...(m < currentMonthIndex
                                      ? { opacity: 0.5, backgroundColor: pastBg }
                                      : { backgroundColor: getGapCellColor(gap, dark) }),
                                  }}
                                >
                                  {formatHours(gap)}
                                </Table.Td>
                              );
                            })}
                          </Table.Tr>
                        ));
                      })()}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  Adjust project timelines and click Simulate to see results
                </Text>
              )}
            </Card>
          </Grid.Col>
        )}

        {/* Simulation results below Gantt (full-width) */}
        {isGantt && simulate.data && (
          <Grid.Col span={12}>
            <Card withBorder padding="md">
              <Title order={4} mb="md">Simulation Results</Title>
              <ScrollArea>
                <Table fz="xs" withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>POD</Table.Th>
                      {months.map(m => (
                        <Table.Th
                          key={m}
                          style={{
                            textAlign: 'center',
                            fontSize: 11,
                            ...(m < currentMonthIndex ? { opacity: 0.5, backgroundColor: pastBg } : {}),
                          }}
                        >
                          {monthLabels[m] ?? `M${m}`}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(() => {
                      const podMap = new Map<string, Map<number, number>>();
                      (simulate.data!.simulated?.gaps ?? []).forEach(g => {
                        if (!podMap.has(g.podName)) podMap.set(g.podName, new Map());
                        podMap.get(g.podName)!.set(g.monthIndex, Number(g.gapHours));
                      });
                      return Array.from(podMap.entries()).map(([pod, monthData]) => (
                        <Table.Tr key={pod}>
                          <Table.Td fw={500} style={{ fontSize: 12 }}>{pod}</Table.Td>
                          {months.map(m => {
                            const gap = monthData.get(m) ?? 0;
                            return (
                              <Table.Td
                                key={m}
                                style={{
                                  textAlign: 'center',
                                  fontSize: 11,
                                  ...(m < currentMonthIndex
                                    ? { opacity: 0.5, backgroundColor: pastBg }
                                    : { backgroundColor: getGapCellColor(gap, dark) }),
                                }}
                              >
                                {formatHours(gap)}
                              </Table.Td>
                            );
                          })}
                        </Table.Tr>
                      ));
                    })()}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Card>
          </Grid.Col>
        )}
      </Grid>
    </Stack>
  );
}
